import Phaser from "phaser";
import {
  ABILITY,
  BULLET,
  DIFFICULTY,
  ENEMY,
  GAME,
  PLAYER,
  RANKS,
  RECOVERY,
  SCORE,
  SPLITTER,
  STORAGE,
} from "../config/constants";
import { difficultyAt, type DifficultyParams } from "../config/difficulty";
import { isLeaderboardEnabled, startMatch } from "../services/leaderboard";
import Alien from "../objects/Alien";
import {
  ABILITY_KINDS,
  createAbility,
  unlockedAbilities,
  type AbilityHost,
  type AbilityKind,
} from "../objects/abilities";
import type { Bullet } from "../objects/Bullet";
import World3D, { getWorld3D } from "../render3d/World3D";
import { selectedShip } from "../config/ships";

/**
 * GameScene owns the actual gameplay. A Phaser Scene has a lifecycle:
 *   create()  -> build the world once
 *   update(t, dt) -> called every frame (dt = ms since last frame)
 *
 * Game objects (ship x, aliens, bullets) are plain state in 2D logical
 * coordinates. Phaser draws only the HUD and keypad; the playfield is drawn in
 * 3D by World3D, which reads a snapshot of this state at the end of each frame.
 */
export default class GameScene extends Phaser.Scene implements AbilityHost {
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
  private lastSpawnX = -999;
  private lastFire = 0;
  private gameOver = false;
  /** Guards the single transition out of the game-over screen. */
  private proceeding = false;
  /** Whether this run beat the stored personal best (drives name-entry copy). */
  private newHighScore = false;

  private elapsedMs = 0;
  private spawnCountdown = 0;
  private diffBar!: Phaser.GameObjects.Rectangle;

  // Hit-recovery: the field freezes until `freezeUntil`, then (once the player
  // has been hit at least once) runs at POST_HIT_FACTOR for the rest of the run.
  private freezeUntil = 0;
  private postHitSlow = false;

  // Pause: while paused the field is frozen and aliens are hidden so the
  // player can't keep solving sums during the break.
  private paused = false;
  private pauseOverlay: Phaser.GameObjects.GameObject[] = [];

  /** Abilities already introduced this run (each gets one intro banner). */
  private seenAbilities = new Set<AbilityKind>();
  /** Dev only: `?ability=blinker,shielded` makes every allowed spawn one of
   * these (ignoring unlocks and chance) for play-testing. */
  private forcedAbilities: AbilityKind[] | null = null;

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
    this.bindKeyboard();

    // --- Enemy spawner: interval & speeds scale with difficulty (see update).
    this.spawnCountdown = 0; // spawn immediately on the first frame
    this.spawnAlien();

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
    this.lastSpawnX = -999;
    this.lastFire = 0;
    this.elapsedMs = 0;
    this.spawnCountdown = 0;
    this.gameOver = false;
    this.proceeding = false;
    this.newHighScore = false;
    this.freezeUntil = 0;
    this.postHitSlow = false;
    this.paused = false;
    this.pauseOverlay = [];
    this.seenAbilities.clear();
    this.forcedAbilities = null;
    if (import.meta.env.DEV) {
      const forced = new URLSearchParams(window.location.search).get("ability");
      const kinds = forced
        ?.split(",")
        .filter((k): k is AbilityKind => (ABILITY_KINDS as string[]).includes(k));
      if (kinds?.length) this.forcedAbilities = kinds;
    }
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
    // underneath, so absolute speed still climbs over time.
    const slow = time < this.freezeUntil ? 0 : this.postHitSlow ? RECOVERY.POST_HIT_FACTOR : 1;
    const fieldDelta = delta * slow;

    this.diffBar.setSize(diff.d * (GAME.WIDTH - 24), 4); // show ramp progress

    // Spawn pacing's PRIMARY gate is the number of UNSOLVED aliens (ones the
    // player still has to do mental math for): start at 1 and open up only as
    // the player earns points. The weighted threat budget is a secondary net so
    // the screen never floods and a hit stays recoverable. Recheck soon instead
    // of waiting a full interval so deferred spawns don't pile up and burst.
    this.spawnCountdown -= fieldDelta;
    if (this.spawnCountdown <= 0) {
      if (
        this.unsolvedOnScreen() < diff.maxUnsolved &&
        this.currentThreat() < diff.threatBudget
      ) {
        this.spawnAlien();
        this.spawnCountdown = diff.spawnInterval;
      } else {
        this.spawnCountdown = ENEMY.SPAWN_RETRY_MS;
      }
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

    // Ability clocks run on real time, not field time: a blinker must not stay
    // shut through the post-hit freeze meant for reading the board.
    for (const alien of this.aliens) if (alien.active) alien.ability?.update(delta);

    // Advance every alien; detect ones that reached the player line. The active
    // target STOPS while it is locked on: once the player has typed its answer it
    // holds position while the ship lines up the shot, so a correct answer is
    // never punished by the ship's travel time (and it can't cost a life).
    for (const alien of this.aliens) {
      if (alien === this.target || !alien.active) continue; // hold still while targeted
      alien.advance(fieldDelta);
      if (alien.y >= PLAYER.Y - 6) this.onAlienReachedPlayer(alien);
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
      const hit = this.aliens.find(
        (a) =>
          a.active &&
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
   * Weighted cognitive load currently on screen. Already-answered (locked,
   * fleeing) aliens are excluded: they are committed kills, no longer a mental
   * burden, so they shouldn't suppress new spawns.
   */
  private currentThreat(): number {
    let threat = 0;
    for (const a of this.aliens) {
      if (!a.active || a === this.lockedTarget) continue;
      threat += ENEMY.THREAT_BY_BALLS[a.ballCount] ?? 1;
      if (a.ability) threat += ABILITY.THREAT;
    }
    return threat;
  }

  /** Count of UNSOLVED aliens — every live alien except the already-answered
   * (locked, fleeing) target. Drives the primary spawn gate. */
  private unsolvedOnScreen(): number {
    return this.aliens.filter((a) => a.active && a !== this.lockedTarget).length;
  }

  /** Count of live "hard" (multi-number) aliens, excluding the locked target. */
  private hardAliensOnScreen(): number {
    return this.aliens.filter(
      (a) => a.active && a !== this.lockedTarget && a.ballCount >= ENEMY.HARD_BALL_THRESHOLD,
    ).length;
  }

  /** Count of live ability aliens, excluding the locked target. */
  private abilityAliensOnScreen(): number {
    return this.aliens.filter((a) => a.active && a !== this.lockedTarget && a.ability).length;
  }

  /** Roll whether the next spawn gets an ability (and which), or null. */
  private pickAbility(diff: DifficultyParams): AbilityKind | null {
    if (this.abilityAliensOnScreen() >= diff.maxAbilityOnScreen) return null;
    const pool = this.forcedAbilities ?? unlockedAbilities(diff.d);
    if (!pool.length) return null;
    if (!this.forcedAbilities && Math.random() >= diff.abilityChance) return null;
    return Phaser.Utils.Array.GetRandom(pool);
  }

  /**
   * Roll digits (a random count in [minBalls, maxBalls], each 1..maxDigit) whose
   * sum is not already on the field, so each typed number maps to exactly one
   * alien. Returns null if the field is too saturated to find one.
   */
  private rollSum(
    minBalls: number,
    maxBalls: number,
    maxDigit: number,
  ): { digits: number[]; result: number } | null {
    for (let attempt = 0; attempt < 12; attempt++) {
      const count = Phaser.Math.Between(minBalls, maxBalls);
      const digits = Array.from({ length: count }, () => Phaser.Math.Between(1, maxDigit));
      const result = digits.reduce((s, d) => s + d, 0);
      if (!this.enemiesInField.has(result)) return { digits, result };
    }
    return null;
  }

  private spawnAlien(): void {
    if (this.gameOver) return;

    const diff = difficultyAt(this.elapsedMs, this.score);

    // Don't let the field over-populate — a crowded screen makes a single hit
    // unrecoverable.
    if (this.aliens.filter((a) => a.active).length >= diff.maxOnScreen) return;

    const kind = this.pickAbility(diff);

    // Ball count (>= 2, so it is always a real sum) and digit size scale up, but
    // cap concurrent "hard" (multi-number) enemies so the player never has to
    // juggle two slow multi-number sums at once. Ability aliens carry a fixed,
    // easy ball count: the ability is the challenge.
    const maxBallsAllowed = kind
      ? ABILITY.BALLS
      : this.hardAliensOnScreen() >= diff.maxHardOnScreen
        ? Math.max(DIFFICULTY.MIN_BALLS, ENEMY.HARD_BALL_THRESHOLD - 1)
        : diff.maxBalls;
    const minBalls = kind ? ABILITY.BALLS : DIFFICULTY.MIN_BALLS;
    const sum = this.rollSum(minBalls, maxBallsAllowed, diff.maxDigit);
    if (!sum) return; // field saturated, skip this tick

    // Pick a lane x that keeps clear of the last spawn AND any alien still near
    // the top, so aliens (and their numbers) never overlap on screen. Gliding
    // aliens (splitlings) count where they will land.
    const overlaps = (cx: number) =>
      this.aliens.some(
        (a) => a.active && a.laneY < 110 && Math.abs(a.laneX - cx) < ENEMY.MIN_SPAWN_GAP,
      );
    const margin = ENEMY.LANE_MARGIN;
    let x = Phaser.Math.Between(margin, GAME.WIDTH - margin);
    let guard = 0;
    while (
      (Math.abs(x - this.lastSpawnX) < ENEMY.MIN_SPAWN_GAP || overlaps(x)) &&
      guard++ < 12
    ) {
      x = Phaser.Math.Between(margin, GAME.WIDTH - margin);
    }
    if (overlaps(x)) return; // no clear lane right now — skip to avoid overlap
    this.lastSpawnX = x;

    this.addAlien(x, -20, sum, diff, kind ? ABILITY.MODEL[kind] : undefined, kind);
    if (kind) this.introduceAbility(kind);
  }

  private addAlien(
    x: number,
    y: number,
    sum: { digits: number[]; result: number },
    diff: DifficultyParams,
    model?: string,
    kind?: AbilityKind | null,
  ): Alien {
    // Personality: fewer balls (easier sum) => faster; more balls => slower.
    const speedScale = ENEMY.SPEED_BY_BALLS[sum.digits.length] ?? 1;
    const alien = new Alien({
      x,
      y,
      bodyKey: `alien${Phaser.Math.Between(1, 13)}`,
      result: sum.result,
      digits: sum.digits,
      ballTexture: "blueBalls",
      fallSpeed: diff.fallSpeed * speedScale,
      homeSpeed: diff.homeSpeed * speedScale,
      spawnedAt: this.time.now,
      model,
      ability: kind ? createAbility(kind) : undefined,
    });
    this.aliens.push(alien);
    this.enemiesInField.set(sum.result, alien);
    return alien;
  }

  /** First sighting of an ability this run: a short banner names it and its rule. */
  private introduceAbility(kind: AbilityKind): void {
    if (this.seenAbilities.has(kind)) return;
    this.seenAbilities.add(kind);
    const banner = this.add
      .text(GAME.WIDTH / 2, ABILITY.INTRO_Y, ABILITY.INTRO[kind], {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#ffd166",
        stroke: "#05060f",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: ABILITY.INTRO_MS,
      duration: 400,
      onComplete: () => banner.destroy(),
    });
  }

  // ---------------------------------------------------------------------------
  // AbilityHost: what abilities may ask of the field (see objects/abilities.ts)
  // ---------------------------------------------------------------------------
  public rerollSum(alien: Alien): boolean {
    const diff = difficultyAt(this.elapsedMs, this.score);
    const sum = this.rollSum(alien.ballCount, alien.ballCount, diff.maxDigit);
    if (!sum) return false;
    this.enemiesInField.delete(alien.result);
    alien.setSum(sum.digits, sum.result, this.time.now);
    this.enemiesInField.set(sum.result, alien);
    return true;
  }

  public spawnSplitling(parent: Alien, x: number, y: number): boolean {
    const blocked = this.aliens.some(
      (a) =>
        a.active &&
        a !== parent &&
        Math.abs(a.laneX - x) < ENEMY.MIN_SPAWN_GAP &&
        Math.abs(a.laneY - y) < SPLITTER.CLEAR_Y,
    );
    if (blocked) return false;
    const diff = difficultyAt(this.elapsedMs, this.score);
    const sum = this.rollSum(DIFFICULTY.MIN_BALLS, DIFFICULTY.MIN_BALLS, diff.maxDigit);
    if (!sum) return false;
    // Start halfway out, not at the parent's center: the two splitlings then
    // begin a full ball-row apart, so their numbers never overlap mid-glide.
    const child = this.addAlien((parent.x + x) / 2, parent.y, sum, diff, SPLITTER.CHILD_MODEL);
    child.glideTo(x, y, SPLITTER.GLIDE_MS);
    return true;
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
    const solveMs = this.time.now - alien.spawnedAt; // before an ability rerolls the sum
    if (alien.ability?.onHit(alien, this)) this.onHitAbsorbed(alien, solveMs);
    else this.killAlien(alien);
  }

  /**
   * An ability took the hit (e.g. a shield broke and rolled a new sum). The
   * answer was still correct, so it scores and extends the streak, but the
   * alien lives on: release the lock so the player can target its new sum.
   */
  private onHitAbsorbed(alien: Alien, solveMs: number): void {
    this.combo += 1;
    this.bestComboThisRun = Math.max(this.bestComboThisRun, this.combo);
    this.updateComboText();
    this.sound.play("explode", { volume: 0.3, rate: 1.6 });
    this.addScore(this.computeScore(alien.ballCount, solveMs), alien.x, alien.y);
    if (this.lockedTarget === alien) {
      this.lockedTarget = null;
      this.lockedBullet = null;
    }
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

    const abilityMult = alien.ability ? ABILITY.SCORE_MULT[alien.ability.kind] : 1;
    const points = Math.round(this.computeScore(alien.ballCount, solveMs) * abilityMult);

    this.explode(alien);
    this.addScore(points, alien.x, alien.y);

    this.enemiesInField.delete(alien.result);
    if (this.lockedTarget === alien) {
      this.lockedTarget = null;
      this.lockedBullet = null;
    }
    alien.kill();
    // After kill() so the dead alien doesn't block its own splitlings' lanes.
    alien.ability?.onKilled(alien, this);
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
    this.freezeUntil = this.time.now + RECOVERY.FREEZE_MS;
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
        GAME.HEIGHT / 2 + 10,
        `Score: ${this.score}    Best: ${best}\n` +
          `Best combo: ${bestCombo}    Kills: ${totalKills}\n` +
          `Fastest solve: ${fastestStr}`,
        { fontFamily: "monospace", fontSize: "16px", color: "#ffffff", align: "center", lineSpacing: 8 },
      )
      .setOrigin(0.5)
      .setDepth(11);
    const continueText = isLeaderboardEnabled()
      ? "tap / Enter to enter initials"
      : "tap / Enter to play again";
    this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT / 2 + 80, continueText, {
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
