import Phaser from "phaser";
import {
  BULLET,
  DIFFICULTY,
  ENEMY,
  GAME,
  MONSTERS,
  PLAYER,
  RANKS,
  RECOVERY,
  SCORE,
  SLOW_TIME,
  STORAGE,
  type AlienKind,
  type SlowMode,
} from "../config/constants";
import { difficultyAt, type DifficultyParams } from "../config/difficulty";
import { isLeaderboardEnabled, startMatch } from "../services/leaderboard";
import Alien from "../objects/Alien";
import type { Bullet } from "../objects/Bullet";
import World3D, { getWorld3D } from "../render3d/World3D";
import { selectedShip } from "../config/ships";
import { EnergyMeter, SlowTime, energyForKill } from "../sim/energy";

// Energy HUD sits in the gutters beside the keypad so it never covers the field
// or the keys: the meter on the left, the SLOW button on the right.
const KEYPAD_TOP = PLAYER.Y + 52;
const KEYPAD_BOTTOM = PLAYER.Y + 214;
const GUTTER_H = KEYPAD_BOTTOM - KEYPAD_TOP;
const ENERGY_COLOR = 0x5ef0ff;

/**
 * GameScene owns the actual gameplay. A Phaser Scene has a lifecycle:
 *   create()  -> build the world once
 *   update(t, dt) -> called every frame (dt = ms since last frame)
 *
 * Game objects (ship x, aliens, bullets) are plain state in 2D logical
 * coordinates. Phaser draws only the HUD and keypad; the playfield is drawn in
 * 3D by World3D, which reads a snapshot of this state at the end of each frame.
 */
export default class GameScene extends Phaser.Scene {
  private world!: World3D;
  private shipX: number = GAME.WIDTH / 2;
  private bullets: Bullet[] = [];
  private aliens: Alien[] = [];

  /** result -> alien, so a typed number maps directly to its target. */
  private enemiesInField = new Map<number, Alien>();
  private target: Alien | null = null;
  /** Once we fire on a target it stays locked (and fleeing) until destroyed,
   * independent of the typed string, so a committed kill never turns back. */
  private lockedTarget: Alien | null = null;
  /** The in-flight bullet aimed at lockedTarget; prevents firing a second
   * bullet while one is already on its way (re-fires only if it misses). */
  private lockedBullet: Bullet | null = null;

  private typed = "";
  private typedText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private score = 0;
  private lives: number = PLAYER.LIVES;
  private lifeIcons: Phaser.GameObjects.Image[] = [];

  // Skill scoring: streak of kills without a hit + per-run mastery tracking.
  private combo = 0;
  private comboText!: Phaser.GameObjects.Text;
  private killsThisRun = 0;
  private bestComboThisRun = 0;
  private fastestSolveMs = Infinity;
  private lastFire = 0;
  private gameOver = false;
  /** Guards the single transition out of the game-over screen. */
  private proceeding = false;
  /** Whether this run beat the stored personal best (drives name-entry copy). */
  private newHighScore = false;

  private elapsedMs = 0;
  private spawnCountdown = 0;
  private drifterCountdown: number = MONSTERS.drifter.FIRST_MS;
  private diffBar!: Phaser.GameObjects.Rectangle;

  // Hit-recovery: the field freezes while `freezeLeftMs` > 0, then (once the
  // player has been hit at least once) runs at POST_HIT_FACTOR for the rest of
  // the run. A countdown (not a timestamp) so pausing doesn't eat the freeze.
  private freezeLeftMs = 0;
  private postHitSlow = false;

  // Energy: kills charge it, SLOW spends it (sending comes with multiplayer).
  private energy = new EnergyMeter();
  private slowTime = new SlowTime(SLOW_TIME.DEFAULT_MODE);
  private energyFill!: Phaser.GameObjects.Rectangle;
  private energyTick!: Phaser.GameObjects.Rectangle;
  private energyText!: Phaser.GameObjects.Text;
  private slowBtn!: Phaser.GameObjects.Rectangle;
  private slowLabel!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private slowTint!: Phaser.GameObjects.Rectangle;

  // Pause: while paused the field is frozen and aliens are hidden so the
  // player can't keep solving sums during the break.
  private paused = false;
  private pauseOverlay: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.resetState();

    // The 3D playfield (starfield, ship, aliens, bullets, explosions) renders on
    // its own canvas under Phaser's; stop drawing it when we leave this scene.
    this.world = getWorld3D();
    this.world.begin(this.textures, this.game.canvas, selectedShip().model);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.world.end());

    this.buildHud();
    this.buildKeypad();
    this.buildEnergyHud();
    this.bindKeyboard();

    // --- Enemy spawner: interval & speeds scale with difficulty (see update).
    this.spawnCountdown = 0; // spawn immediately on the first frame
    this.spawnAlien(difficultyAt(0, 0));

    // Open a server-gated match so this run's score can be submitted later.
    // Fire-and-forget: if it fails the player just gets an unsaved score.
    void startMatch();
  }

  private resetState(): void {
    this.shipX = GAME.WIDTH / 2;
    this.bullets = [];
    this.aliens = [];
    this.enemiesInField.clear();
    this.target = null;
    this.lockedTarget = null;
    this.lockedBullet = null;
    this.typed = "";
    this.score = 0;
    this.lives = PLAYER.LIVES;
    this.lifeIcons = [];
    this.combo = 0;
    this.killsThisRun = 0;
    this.bestComboThisRun = 0;
    this.fastestSolveMs = Infinity;
    this.lastFire = 0;
    this.elapsedMs = 0;
    this.spawnCountdown = 0;
    this.drifterCountdown = MONSTERS.drifter.FIRST_MS;
    this.gameOver = false;
    this.proceeding = false;
    this.newHighScore = false;
    this.freezeLeftMs = 0;
    this.postHitSlow = false;
    this.energy = new EnergyMeter();
    this.slowTime = new SlowTime(loadSlowMode());
    this.paused = false;
    this.pauseOverlay = [];
  }

  update(time: number, delta: number): void {
    // Game over / pause freeze the simulation, but the 3D view keeps rendering
    // (stars drift, the final explosion finishes, pause hides the aliens).
    if (!this.gameOver && !this.paused) this.tick(time, delta);

    this.world.render(
      {
        shipX: this.shipX,
        shipTargetX: this.target?.active ? this.target.x : null,
        aliens: this.aliens,
        bullets: this.bullets,
        aliensHidden: this.paused,
      },
      time,
      delta,
    );
  }

  private tick(time: number, delta: number): void {
    this.elapsedMs += delta;
    const diff = difficultyAt(this.elapsedMs, this.score);

    // After a hit the field FREEZES for a few seconds (factor 0), then resumes at
    // POST_HIT_FACTOR for the rest of the run. The difficulty timer keeps running
    // underneath, so absolute speed still climbs over time. Slow time multiplies
    // on top; it holds (no drain) while the hit freeze already stops the field.
    const hitFrozen = this.freezeLeftMs > 0;
    if (hitFrozen) this.freezeLeftMs -= delta;
    const slowFactor = this.slowTime.update(delta, this.energy, hitFrozen);
    const slow = hitFrozen
      ? 0
      : slowFactor * (this.postHitSlow ? RECOVERY.POST_HIT_FACTOR : 1);
    const fieldDelta = delta * slow;

    this.diffBar.setSize(diff.d * (GAME.WIDTH - 24), 4); // show ramp progress

    // Spawn pacing's PRIMARY gate is the number of UNSOLVED aliens (ones the
    // player still has to do mental math for): start at 1 and open up only as
    // the player earns points. The weighted threat budget is a secondary net so
    // the screen never floods and a hit stays recoverable. Recheck soon instead
    // of waiting a full interval so deferred spawns don't pile up and burst.
    this.spawnCountdown -= fieldDelta;
    if (this.spawnCountdown <= 0) {
      const spawned =
        this.unsolvedOnScreen() < diff.maxUnsolved &&
        this.currentThreat() < diff.threatBudget &&
        this.spawnAlien(diff);
      this.spawnCountdown = spawned ? diff.spawnInterval : ENEMY.SPAWN_RETRY_MS;
    }

    // The bonus drifter runs on its own clock and ignores the caps above: it is
    // optional, so it never takes a slot from the sums the player must solve.
    this.drifterCountdown -= fieldDelta;
    if (this.drifterCountdown <= 0) {
      const { min, max } = MONSTERS.drifter.INTERVAL_MS;
      this.drifterCountdown = this.spawnDrifter(diff)
        ? Phaser.Math.Between(min, max)
        : ENEMY.SPAWN_RETRY_MS;
    }

    // Resolve the current target. A locked target (already fired upon) stays
    // committed until it is destroyed; otherwise the typed number picks one.
    if (this.lockedTarget && this.lockedTarget.active) {
      this.target = this.lockedTarget;
    } else {
      this.lockedTarget = null;
      const typedVal = this.typed === "" ? -1 : parseInt(this.typed, 10);
      this.target = this.enemiesInField.get(typedVal) ?? null;
    }

    // Advance every alien; detect ones that reached the player line. The active
    // target STOPS while it is locked on: once the player has typed its answer it
    // holds position while the ship lines up the shot, so a correct answer is
    // never punished by the ship's travel time (and it can't cost a life).
    for (const alien of this.aliens) {
      if (alien === this.target || !alien.active) continue; // hold still while targeted
      this.advanceReadable(alien, fieldDelta);
      if (alien.lethal && alien.y >= PLAYER.Y - 6) this.onAlienReachedPlayer(alien);
      else if (alien.escaped) this.onAlienEscaped(alien);
    }

    // Slide the ship toward the target and fire when lined up. Don't fire again
    // while a bullet is already in flight toward this locked target — only
    // re-fire if that shot missed (its bullet was recycled off-screen).
    if (this.target && this.target.active) {
      this.shipX = Phaser.Math.Linear(this.shipX, this.target.x, PLAYER.MOVE_LERP);
      const shotInFlight =
        this.lockedTarget === this.target &&
        this.lockedBullet !== null &&
        this.lockedBullet.active;
      if (
        !shotInFlight &&
        Math.abs(this.shipX - this.target.x) < PLAYER.SHOOT_RANGE &&
        time - this.lastFire > PLAYER.FIRE_COOLDOWN
      ) {
        this.fire(time, this.target);
      }
    }

    this.moveBullets(delta);

    // Drop killed aliens and spent bullets; the 3D view removes their meshes.
    this.aliens = this.aliens.filter((a) => a.active);
    this.bullets = this.bullets.filter((b) => b.active);

    this.updateEnergyHud();
  }

  /**
   * Readability rule (docs/MULTIPLAYER_DESIGN.md §3): an alien never moves INTO
   * another alien's box (ball row + body). A blocked move is retried one axis
   * at a time; the refused axis holds still, and a refused sideways move turns
   * zig-zags and patrols around. Aliens already too close (shouldn't happen)
   * are ignored so they can move apart.
   */
  private advanceReadable(alien: Alien, delta: number): void {
    const px = alien.x;
    const py = alien.y;
    alien.advance(delta);
    const others = this.aliens.filter(
      (o) => o !== alien && o.active && !alien.overlapsAt(px, py, o),
    );
    const blocked = () => others.some((o) => alien.overlaps(o));
    if (!blocked()) return;

    const nx = alien.x;
    alien.x = px; // keep only the vertical move
    if (!blocked()) {
      if (nx !== px) alien.blockedX();
      return;
    }
    alien.x = nx; // keep only the sideways move
    alien.y = py;
    if (!blocked()) return;
    alien.x = px;
    if (nx !== px) alien.blockedX();
  }

  /**
   * Fly bullets upward and resolve hits. The hit test is swept over the distance
   * travelled this frame, so a fast bullet can't tunnel through an alien on a
   * slow frame. Any alien in the path is hit, not just the locked target.
   */
  private moveBullets(delta: number): void {
    for (const b of this.bullets) {
      if (!b.active) continue;
      const prevY = b.y;
      b.y -= BULLET.SPEED * (delta / 1000);
      // Stray bullets fly through the bonus drifter: it has to be solved.
      const hit = this.aliens.find(
        (a) =>
          a.active &&
          (a.lethal || a === this.lockedTarget) &&
          Math.abs(b.x - a.x) < BULLET.HIT_HALF_W &&
          a.y >= b.y - BULLET.HIT_HALF_H &&
          a.y <= prevY + BULLET.HIT_HALF_H,
      );
      if (hit) this.onBulletHit(b, hit);
      else if (b.y < -20) b.active = false; // flew off the top
    }
  }

  // ---------------------------------------------------------------------------
  // Spawning
  // ---------------------------------------------------------------------------
  /**
   * Aliens the player still has to solve: live, lethal (the bonus drifter is
   * optional) and not the already-answered locked target — a committed kill is
   * no longer a mental burden, so it shouldn't suppress new spawns.
   */
  private unsolved(): Alien[] {
    return this.aliens.filter((a) => a.active && a.lethal && a !== this.lockedTarget);
  }

  /** Weighted cognitive load of the unsolved aliens (secondary spawn gate). */
  private currentThreat(): number {
    return this.unsolved().reduce((t, a) => t + (ENEMY.THREAT_BY_BALLS[a.ballCount] ?? 1), 0);
  }

  /** Count of unsolved aliens. Drives the primary spawn gate. */
  private unsolvedOnScreen(): number {
    return this.unsolved().length;
  }

  /** Count of unsolved "hard" (multi-number) aliens. */
  private hardAliensOnScreen(): number {
    return this.unsolved().filter((a) => a.ballCount >= ENEMY.HARD_BALL_THRESHOLD).length;
  }

  /**
   * Digits for a new sum whose result isn't already on the field, so each typed
   * number maps to exactly one alien. Null when the field is saturated.
   */
  private rollSum(maxBalls: number, maxDigit: number): { digits: number[]; result: number } | null {
    for (let attempt = 0; attempt < 12; attempt++) {
      const count = Phaser.Math.Between(DIFFICULTY.MIN_BALLS, maxBalls);
      const digits = Array.from({ length: count }, () => Phaser.Math.Between(1, maxDigit));
      const result = digits.reduce((s, d) => s + d, 0);
      if (!this.enemiesInField.has(result)) return { digits, result };
    }
    return null;
  }

  private makeAlien(
    kind: AlienKind,
    sum: { digits: number[]; result: number },
    x: number,
    y: number,
    diff: DifficultyParams,
    bandY?: number,
  ): Alien {
    return new Alien({
      kind,
      x,
      y,
      bodyKey: `alien${Phaser.Math.Between(1, 13)}`,
      result: sum.result,
      digits: sum.digits,
      ballTexture: "blueBalls",
      fallSpeed: diff.fallSpeed,
      homeSpeed: diff.homeSpeed,
      spawnedAt: this.time.now,
      patrolMs: diff.straferPatrolMs,
      bandY,
    });
  }

  /** Spawn one lethal alien from the top. Returns false if there was no room. */
  private spawnAlien(diff: DifficultyParams): boolean {
    if (this.gameOver) return false;

    // Don't let the field over-populate — a crowded screen makes a single hit
    // unrecoverable.
    if (this.aliens.filter((a) => a.active && a.lethal).length >= diff.maxOnScreen) return false;

    // Ball count (>= 2, so it is always a real sum) and digit size scale up, but
    // cap concurrent "hard" (multi-number) enemies so the player never has to
    // juggle two slow multi-number sums at once.
    const maxBallsAllowed =
      this.hardAliensOnScreen() >= diff.maxHardOnScreen
        ? Math.max(DIFFICULTY.MIN_BALLS, ENEMY.HARD_BALL_THRESHOLD - 1)
        : diff.maxBalls;
    const sum = this.rollSum(maxBallsAllowed, diff.maxDigit);
    if (!sum) return false;

    const kind: AlienKind =
      sum.digits.length >= ENEMY.HARD_BALL_THRESHOLD ? "lumberer" : this.pickTwoBallKind();
    const bandY =
      kind === "strafer"
        ? Phaser.Math.Between(MONSTERS.strafer.BAND_Y.min, MONSTERS.strafer.BAND_Y.max)
        : undefined;

    // Enter just above the top edge, in a column whose whole sweep (zig-zag or
    // patrol span) clears every alien still near the top and whose box clears
    // everyone, so ball rows start apart; advanceReadable keeps them apart.
    const probe = this.makeAlien(kind, sum, 0, 0, diff, bandY);
    const y = -probe.bottom - 2;
    const lo = probe.sweepHalf + ENEMY.SPAWN_EDGE;
    const hi = GAME.WIDTH - lo;
    for (let attempt = 0; attempt < 12; attempt++) {
      const alien = this.makeAlien(kind, sum, Phaser.Math.Between(lo, hi), y, diff, bandY);
      if (this.hasRoomFor(alien)) {
        this.addAlien(alien);
        return true;
      }
    }
    return false; // no clear column right now; the spawner retries soon
  }

  private pickTwoBallKind(): AlienKind {
    const weights = ENEMY.TWO_BALL_KINDS;
    let r = Math.random() * (weights.darter + weights.strafer);
    r -= weights.darter;
    return r < 0 ? "darter" : "strafer";
  }

  private hasRoomFor(alien: Alien): boolean {
    const [lo, hi] = alien.sweep;
    return this.aliens.every((o) => {
      if (!o.active) return true;
      if (alien.overlaps(o)) return false;
      if (o.y >= ENEMY.ENTRY_ZONE_Y) return true;
      const [olo, ohi] = o.sweep;
      return hi + ENEMY.READ_GAP <= olo || ohi + ENEMY.READ_GAP <= lo;
    });
  }

  private addAlien(alien: Alien): void {
    this.aliens.push(alien);
    this.enemiesInField.set(alien.result, alien);
  }

  /** Send a bonus drifter across from a random side. False if not possible now. */
  private spawnDrifter(diff: DifficultyParams): boolean {
    if (this.gameOver || this.aliens.some((a) => a.active && a.kind === "drifter")) return false;
    // Always a quick 2-number sum: it is a bonus, not a test.
    const sum = this.rollSum(DIFFICULTY.MIN_BALLS, diff.maxDigit);
    if (!sum) return false;
    const m = MONSTERS.drifter;
    for (let attempt = 0; attempt < 6; attempt++) {
      const fromLeft = Math.random() < 0.5;
      const probe = this.makeAlien("drifter", sum, 0, 0, diff);
      const x = fromLeft ? -probe.halfW : GAME.WIDTH + probe.halfW - 1;
      const bandY = Phaser.Math.Between(m.BAND_Y.min, m.BAND_Y.max);
      const alien = this.makeAlien("drifter", sum, x, bandY, diff, bandY);
      if (this.aliens.every((o) => !o.active || !alien.overlaps(o))) {
        this.addAlien(alien);
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Combat
  // ---------------------------------------------------------------------------
  private fire(time: number, target: Alien | null): void {
    this.lastFire = time;
    const bullet: Bullet = { x: this.shipX, y: PLAYER.Y - BULLET.MUZZLE_OFFSET, active: true };
    this.bullets.push(bullet);
    this.sound.play("shoot", { volume: 0.4 });
    // Clear the typed answer once we have committed to a shot, but keep the
    // target LOCKED so it keeps fleeing until a bullet actually destroys it.
    this.setTyped("");
    if (target && target.active) {
      this.lockedTarget = target;
      this.lockedBullet = bullet;
    }

    // If the locked target sits at/below the muzzle, an upward bullet can't
    // reach it, so resolve the hit point-blank to guarantee the kill.
    if (target && target.active && target.y >= PLAYER.Y - BULLET.MUZZLE_OFFSET) {
      this.onBulletHit(bullet, target);
    }
  }

  private onBulletHit(bullet: Bullet, alien: Alien): void {
    if (!alien.active) return;
    bullet.active = false;
    this.killAlien(alien);
  }

  /** Award and clean up a destroyed alien. */
  private killAlien(alien: Alien): void {
    if (!alien.active) return;

    const solveMs = this.time.now - alien.spawnedAt;

    // Extend the streak first so this kill is scored with its own multiplier.
    this.combo += 1;
    this.killsThisRun += 1;
    this.bestComboThisRun = Math.max(this.bestComboThisRun, this.combo);
    this.fastestSolveMs = Math.min(this.fastestSolveMs, solveMs);
    this.updateComboText();

    const points = this.computeScore(alien.ballCount, solveMs);

    this.explode(alien);
    this.addScore(points, alien.x, alien.y);
    // The bonus drifter adds its burst on top of the normal kill energy.
    const burst = alien.lethal ? 0 : MONSTERS.drifter.ENERGY_BURST;
    this.addEnergy(energyForKill({ digits: alien.digits, solveMs, combo: this.combo }) + burst);
    if (burst > 0) this.popBurst(burst, alien.x, alien.y);

    this.enemiesInField.delete(alien.result);
    if (this.lockedTarget === alien) {
      this.lockedTarget = null;
      this.lockedBullet = null;
    }
    alien.kill();
  }

  /** points = BASE * ballCountBonus * speedBonus * difficultyMult * comboMult. */
  private computeScore(ballCount: number, solveMs: number): number {
    const ballBonus = SCORE.BALL_COUNT_BONUS[ballCount] ?? 1;

    const span = SCORE.SLOW_MS - SCORE.FAST_MS;
    const t = Phaser.Math.Clamp((solveMs - SCORE.FAST_MS) / span, 0, 1);
    const speedBonus = SCORE.FAST_MULT + (SCORE.SLOW_MULT - SCORE.FAST_MULT) * t;

    const difficultyMult = 1 + difficultyAt(this.elapsedMs, this.score).d;
    const comboMult = Math.min(SCORE.COMBO_MAX, 1 + (this.combo - 1) * SCORE.COMBO_STEP);

    return Math.round(SCORE.BASE * ballBonus * speedBonus * difficultyMult * comboMult);
  }

  private updateComboText(): void {
    if (this.combo >= 2) {
      const mult = Math.min(SCORE.COMBO_MAX, 1 + (this.combo - 1) * SCORE.COMBO_STEP);
      this.comboText.setText(`x${mult.toFixed(2)}  (${this.combo} streak)`);
    } else {
      this.comboText.setText("");
    }
  }

  private onAlienReachedPlayer(alien: Alien): void {
    this.enemiesInField.delete(alien.result);
    this.explode(alien);
    alien.kill();
    this.loseLife();
  }

  /** A bonus alien crossed the field unsolved: it just leaves, no penalty. */
  private onAlienEscaped(alien: Alien): void {
    this.enemiesInField.delete(alien.result);
    alien.kill();
  }

  /** Label the drifter's energy burst where it was solved (the meter pops too). */
  private popBurst(amount: number, x: number, y: number): void {
    const pop = this.add
      .text(x, y + 22, `+${amount} ENERGY`, {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#ff6be6",
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.tweens.add({
      targets: pop,
      y: y - 30,
      alpha: 0,
      duration: 1100,
      onComplete: () => pop.destroy(),
    });
  }

  private explode(alien: Alien): void {
    this.sound.play("explode", { volume: 0.5 });
    this.world.explode(alien.x, alien.y, alien);
  }

  // ---------------------------------------------------------------------------
  // Score & lives HUD
  // ---------------------------------------------------------------------------
  private addScore(points: number, x: number, y: number): void {
    this.score += points;
    this.scoreText.setText(this.score.toString().padStart(7, "0"));

    const pop = this.add
      .text(x, y, `+${points}`, { fontFamily: "monospace", fontSize: "16px", color: "#ffd166" })
      .setOrigin(0.5);
    this.tweens.add({
      targets: pop,
      y: y - 40,
      alpha: 0,
      duration: 700,
      onComplete: () => pop.destroy(),
    });
  }

  private loseLife(): void {
    this.sound.play("hurt", { volume: 0.5 });
    this.lives = Math.max(0, this.lives - 1);
    this.combo = 0; // a hit breaks the streak
    this.updateComboText();
    const icon = this.lifeIcons[this.lives];
    if (icon) icon.setAlpha(0.15);
    this.cameras.main.shake(150, 0.01);
    this.world.shake(150, 0.01);
    if (this.lives <= 0) {
      this.endGame();
      return;
    }
    // Freeze the whole field for a few seconds so the player can recover, then
    // run at a reduced speed for the rest of the run (difficulty keeps ramping).
    this.freezeLeftMs = RECOVERY.FREEZE_MS;
    this.postHitSlow = true;
  }

  /** Freeze the field and hide aliens so the player can't solve while paused. */
  private togglePause(): void {
    if (this.gameOver) return;
    this.paused = !this.paused;

    // The 3D view hides the aliens while paused (see update()).
    if (this.paused) {
      this.typedText.setVisible(false);

      const dim = this.add
        .rectangle(GAME.WIDTH / 2, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x05060f, 0.92)
        .setDepth(9)
        .setInteractive();
      dim.on("pointerdown", () => this.togglePause());
      const label = this.add
        .text(GAME.WIDTH / 2, GAME.HEIGHT / 2, "PAUSED\n\ntap / P to resume", {
          fontFamily: "monospace",
          fontSize: "28px",
          color: "#4ea1ff",
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(10);
      this.pauseOverlay = [dim, label];
    } else {
      this.pauseOverlay.forEach((o) => o.destroy());
      this.pauseOverlay = [];
      this.typedText.setVisible(true);
    }
  }

  private buildHud(): void {
    // HUD sits above gameplay so aliens entering from the top never obscure it.
    const HUD_DEPTH = 5;
    this.scoreText = this.add
      .text(12, 12, "0000000", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffffff",
      })
      .setDepth(HUD_DEPTH);

    // Difficulty ramp indicator: a thin bar that fills as the game speeds up.
    this.add
      .rectangle(12, 44, GAME.WIDTH - 24, 4, 0x1b2340)
      .setOrigin(0, 0.5)
      .setDepth(HUD_DEPTH);
    this.diffBar = this.add
      .rectangle(12, 44, 0, 4, 0x4ea1ff)
      .setOrigin(0, 0.5)
      .setDepth(HUD_DEPTH);

    for (let i = 0; i < PLAYER.LIVES; i++) {
      const icon = this.add
        .image(GAME.WIDTH - 18 - i * 26, 22, "life")
        .setScale(1.4)
        .setDepth(HUD_DEPTH);
      this.lifeIcons.push(icon);
    }

    this.typedText = this.add
      .text(GAME.WIDTH / 2, PLAYER.Y + 36, "_", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#4ea1ff",
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    // Combo / streak multiplier indicator.
    this.comboText = this.add
      .text(12, 56, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffd166",
      })
      .setDepth(HUD_DEPTH);

    // Pause button (also bound to the P key).
    const pauseBtn = this.add
      .text(GAME.WIDTH / 2, 22, "II", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#4ea1ff",
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH)
      .setInteractive({ useHandCursor: true });
    pauseBtn.on("pointerdown", () => this.togglePause());
  }

  // ---------------------------------------------------------------------------
  // Energy & slow time
  // ---------------------------------------------------------------------------
  private addEnergy(gain: number): void {
    const stored = this.energy.charge(gain);
    if (stored < 0.5) return;
    const pop = this.add
      .text(30, KEYPAD_TOP - 18, `+${Math.round(stored)}`, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#5ef0ff",
      })
      .setOrigin(0.5, 1)
      .setDepth(6);
    this.tweens.add({
      targets: pop,
      y: pop.y - 30,
      alpha: 0,
      duration: 700,
      onComplete: () => pop.destroy(),
    });
  }

  private triggerSlow(): void {
    if (this.gameOver || this.paused) return;
    if (this.slowTime.trigger(this.energy)) this.sound.play("blip", { volume: 0.5, rate: 0.6 });
    this.updateEnergyHud();
  }

  /** Playtest switch between the two slow-time modes; remembered across runs. */
  private toggleSlowMode(): void {
    if (this.gameOver || this.paused) return;
    const next: SlowMode = this.slowTime.currentMode === "drain" ? "stop" : "drain";
    this.slowTime.setMode(next);
    saveSlowMode(next);
    this.modeText.setText(slowModeLabel(next));
    this.updateEnergyHud();
  }

  private buildEnergyHud(): void {
    const HUD_DEPTH = 5;
    const midY = KEYPAD_TOP + GUTTER_H / 2;

    // Field tint while slow time runs. It is drawn on the transparent Phaser
    // canvas, so it tints the 3D playfield underneath (and sits below the HUD).
    this.slowTint = this.add
      .rectangle(GAME.WIDTH / 2, 0, GAME.WIDTH, PLAYER.Y + 20, ENERGY_COLOR, 1)
      .setOrigin(0.5, 0)
      .setDepth(4)
      .setVisible(false);

    // Left gutter: vertical energy meter.
    this.add
      .text(30, KEYPAD_TOP - 4, "EN", { fontFamily: "monospace", fontSize: "12px", color: "#5ef0ff" })
      .setOrigin(0.5, 1)
      .setDepth(HUD_DEPTH);
    this.add
      .rectangle(30, midY, 18, GUTTER_H, 0x1b2340)
      .setStrokeStyle(1, 0x33406e)
      .setDepth(HUD_DEPTH);
    this.energyFill = this.add
      .rectangle(30, KEYPAD_BOTTOM, 14, 0, ENERGY_COLOR)
      .setOrigin(0.5, 1)
      .setDepth(HUD_DEPTH);
    // Marks how much energy the current slow mode needs before it can be used.
    this.energyTick = this.add.rectangle(30, KEYPAD_BOTTOM, 26, 2, 0xffd166).setDepth(HUD_DEPTH);
    this.energyText = this.add
      .text(30, KEYPAD_BOTTOM + 6, "0", { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" })
      .setOrigin(0.5, 0)
      .setDepth(HUD_DEPTH);

    // Right gutter: a tall SLOW button (also Space), easy to hit with a thumb.
    this.slowBtn = this.add
      .rectangle(GAME.WIDTH - 30, midY, 48, GUTTER_H, 0x1b2340)
      .setStrokeStyle(2, ENERGY_COLOR)
      .setDepth(HUD_DEPTH)
      .setInteractive({ useHandCursor: true });
    this.slowLabel = this.add
      .text(GAME.WIDTH - 30, midY, "S\nL\nO\nW", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffffff",
        align: "center",
        lineSpacing: 6,
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.add
      .text(GAME.WIDTH - 30, KEYPAD_BOTTOM + 6, "SPACE", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8892b0",
      })
      .setOrigin(0.5, 0)
      .setDepth(HUD_DEPTH);
    this.slowBtn.on("pointerdown", () => this.triggerSlow());

    // Below the keypad: which slow mode is active; tap it (or M) to switch.
    const modeBg = this.add
      .rectangle(GAME.WIDTH / 2, KEYPAD_BOTTOM + 34, 340, 30, 0x0b1020)
      .setStrokeStyle(1, 0x33406e)
      .setDepth(HUD_DEPTH)
      .setInteractive({ useHandCursor: true });
    this.modeText = this.add
      .text(GAME.WIDTH / 2, KEYPAD_BOTTOM + 34, slowModeLabel(this.slowTime.currentMode), {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffd166",
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    modeBg.on("pointerdown", () => this.toggleSlowMode());

    this.updateEnergyHud();
  }

  private updateEnergyHud(): void {
    const e = this.energy;
    this.energyFill.setSize(14, GUTTER_H * e.fraction);
    this.energyTick.setY(KEYPAD_BOTTOM - GUTTER_H * (this.slowTime.threshold / e.max));
    this.energyText.setText(String(Math.floor(e.value)));

    const active = this.slowTime.active;
    const usable = active || this.slowTime.canTrigger(e);
    this.slowBtn.setFillStyle(active ? 0x1f6f7a : 0x1b2340).setAlpha(usable ? 1 : 0.35);
    this.slowLabel.setAlpha(usable ? 1 : 0.35);
    this.slowTint
      .setVisible(active)
      .setAlpha(this.slowTime.currentMode === "stop" ? 0.2 : 0.1);
  }

  // ---------------------------------------------------------------------------
  // Input: on-screen keypad + physical keyboard
  // ---------------------------------------------------------------------------
  private buildKeypad(): void {
    const labels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"];
    const cols = 3;
    const cellW = 120;
    const cellH = 42;
    const startX = GAME.WIDTH / 2 - cellW;
    const startY = PLAYER.Y + 70;

    labels.forEach((label, i) => {
      const cx = startX + (i % cols) * cellW;
      const cy = startY + Math.floor(i / cols) * cellH;

      const btn = this.add
        .rectangle(cx, cy, cellW - 8, cellH - 6, 0x1b2340)
        .setStrokeStyle(2, 0x4ea1ff)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(cx, cy, label, { fontFamily: "monospace", fontSize: "22px", color: "#ffffff" })
        .setOrigin(0.5);

      btn.on("pointerdown", () => {
        btn.setFillStyle(0x33406e);
        this.handleInput(label);
      });
      btn.on("pointerup", () => btn.setFillStyle(0x1b2340));
      btn.on("pointerout", () => btn.setFillStyle(0x1b2340));
    });
  }

  private bindKeyboard(): void {
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") {
        this.togglePause();
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        this.triggerSlow();
        return;
      }
      if (e.key === "m" || e.key === "M") {
        this.toggleSlowMode();
        return;
      }
      if (e.key >= "0" && e.key <= "9") this.handleInput(e.key);
      else if (e.key === "Backspace") this.handleInput("<");
      else if (e.key === "Escape") this.handleInput("C");
      else if (e.key === "Enter" && this.gameOver) this.proceedAfterGameOver();
    });
  }

  private handleInput(key: string): void {
    if (this.gameOver) {
      this.proceedAfterGameOver();
      return;
    }
    if (this.paused) return;
    this.sound.play("blip", { volume: 0.3 });
    if (key === "C") this.setTyped("");
    else if (key === "<") this.setTyped(this.typed.slice(0, -1));
    else if (this.typed.length < 2) this.setTyped(this.typed + key);
  }

  private setTyped(value: string): void {
    this.typed = value;
    this.typedText.setText(value === "" ? "_" : value);
  }

  // ---------------------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------------------
  private endGame(): void {
    this.gameOver = true;

    // Merge this run into the persistent mastery stats.
    const num = (k: string) => Number(localStorage.getItem(k) ?? 0);
    const priorHigh = num(STORAGE.HIGHSCORE);
    this.newHighScore = this.score > 0 && this.score >= priorHigh;
    const best = Math.max(this.score, priorHigh);
    const bestCombo = Math.max(this.bestComboThisRun, num(STORAGE.BEST_COMBO));
    const totalKills = num(STORAGE.TOTAL_KILLS) + this.killsThisRun;
    const priorFastest = num(STORAGE.FASTEST_MS); // 0 = none recorded yet
    const fastest =
      this.fastestSolveMs === Infinity
        ? priorFastest
        : priorFastest === 0
          ? this.fastestSolveMs
          : Math.min(priorFastest, this.fastestSolveMs);

    localStorage.setItem(STORAGE.HIGHSCORE, String(best));
    localStorage.setItem(STORAGE.BEST_COMBO, String(bestCombo));
    localStorage.setItem(STORAGE.TOTAL_KILLS, String(totalKills));
    localStorage.setItem(STORAGE.FASTEST_MS, String(fastest));

    const rank = RANKS.reduce((acc, r) => (best >= r.min ? r.name : acc), RANKS[0].name);
    const fastestStr = fastest > 0 ? `${(fastest / 1000).toFixed(2)}s` : "—";

    this.add
      .rectangle(GAME.WIDTH / 2, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x05060f, 0.8)
      .setDepth(10);
    this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT / 2 - 110, "GAME OVER", {
        fontFamily: "monospace",
        fontSize: "40px",
        color: "#ef476f",
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT / 2 - 60, `Rank: ${rank}`, {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffd166",
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.add
      .text(
        GAME.WIDTH / 2,
        GAME.HEIGHT / 2 + 20,
        `Score: ${this.score}    Best: ${best}\n` +
          `Best combo: ${bestCombo}    Kills: ${totalKills}\n` +
          `Fastest solve: ${fastestStr}\n` +
          `Energy ${Math.round(this.energy.earned)} earned, ` +
          `${Math.round(this.energy.spent.slow)} on slow (${this.slowTime.currentMode})`,
        { fontFamily: "monospace", fontSize: "16px", color: "#ffffff", align: "center", lineSpacing: 8 },
      )
      .setOrigin(0.5)
      .setDepth(11);
    const continueText = isLeaderboardEnabled()
      ? "tap / Enter to enter initials"
      : "tap / Enter to play again";
    this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT / 2 + 96, continueText, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#4ea1ff",
      })
      .setOrigin(0.5)
      .setDepth(11);

    this.input.once("pointerdown", () => this.proceedAfterGameOver());
  }

  /** Single, idempotent exit from game-over: leaderboard flow or plain restart. */
  private proceedAfterGameOver(): void {
    if (this.proceeding) return;
    this.proceeding = true;
    if (isLeaderboardEnabled()) {
      this.scene.start("NameEntryScene", {
        score: this.score,
        personalBest: this.newHighScore,
      });
    } else {
      this.scene.start("MenuScene");
    }
  }
}

function slowModeLabel(mode: SlowMode): string {
  const text =
    mode === "drain"
      ? `SLOW: ${Math.round(SLOW_TIME.DRAIN.FACTOR * 100)}% SPEED, DRAINS`
      : `SLOW: FULL STOP ${SLOW_TIME.STOP.DURATION_MS / 1000}s, COSTS ${SLOW_TIME.STOP.COST}`;
  return `${text}  [M]`;
}

function loadSlowMode(): SlowMode {
  try {
    const stored = localStorage.getItem(STORAGE.SLOW_MODE);
    if (stored === "drain" || stored === "stop") return stored;
  } catch {
    // Storage blocked: use the default mode.
  }
  return SLOW_TIME.DEFAULT_MODE;
}

function saveSlowMode(mode: SlowMode): void {
  try {
    localStorage.setItem(STORAGE.SLOW_MODE, mode);
  } catch {
    // Not persisted; the switch still applies for this session.
  }
}
