import Phaser from "phaser";
import {
  ABILITY,
  BULLET,
  DIFFICULTY,
  ENEMY,
  FEEDBACK,
  GAME,
  MONSTERS,
  PLAYER,
  RANKS,
  RECOVERY,
  SCORE,
  SPLITTER,
  STORAGE,
  type AlienKind,
  type SlowMode,
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
import type { AnswerState, AnswerView } from "../render3d/AnswerStars";
import { selectedShip } from "../config/ships";
import { EnergyMeter, SlowTime, energyForKill } from "../sim/energy";

// Energy HUD sits in the gutters beside the keypad so it never covers the field
// or the keys: the meter on the left, the SLOW button on the right.
const KEYPAD_TOP = PLAYER.Y + 52;
const KEYPAD_BOTTOM = PLAYER.Y + 214;
const GUTTER_H = KEYPAD_BOTTOM - KEYPAD_TOP;
const ENERGY_COLOR = 0x5ef0ff;
const METER_X = GAME.WIDTH / 2 - 180; // under the keypad, same width
const METER_W = 360;
const METER_Y = KEYPAD_BOTTOM + 22;
const POWER_COLOR: Record<SlowMode, number> = { slow: ENERGY_COLOR, freeze: 0xb8d8ff };
const POWER_ON_FILL: Record<SlowMode, number> = { slow: 0x1f6f7a, freeze: 0x3a5a8c };

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
  /** What the answer display shows (typed number or the locked answer). */
  private answer: AnswerView | null = null;
  /** Counts down while the typed answer is wrong; at 0 it clears itself. */
  private wrongLeftMs = 0;
  /** Lock-on brackets around the current target. */
  private reticle!: Phaser.GameObjects.Graphics;
  private reticleTarget: Alien | null = null;
  private reticleAge = 0;
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
  private slowTime = new SlowTime();
  private energyFill!: Phaser.GameObjects.Rectangle;
  private energyText!: Phaser.GameObjects.Text;
  private powerButtons = {} as Record<
    SlowMode,
    { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }
  >;
  private slowTint!: Phaser.GameObjects.Rectangle;

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
    this.answer = null;
    this.wrongLeftMs = 0;
    this.reticleTarget = null;
    this.reticleAge = 0;
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
    this.slowTime = new SlowTime();
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
        answer: this.paused || this.gameOver ? null : this.answer,
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

    // Ability clocks run on real time, not field time: a blinker must not stay
    // shut through the post-hit freeze meant for reading the board.
    for (const alien of this.aliens) if (alien.active) alien.ability?.update(delta);

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

    // Aliens come and go, so an answer can turn right or wrong without a key.
    this.refreshAnswer();
    if (this.answer?.state === "wrong") {
      this.wrongLeftMs -= delta;
      if (this.wrongLeftMs <= 0) this.setTyped("");
    }
    this.drawReticle(delta);

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
   * slow frame. A bullet only hits the alien whose answer fired it and flies
   * through every other one: results are unique on the field, so only the
   * alien that was solved can die (or lose its shield).
   */
  private moveBullets(delta: number): void {
    for (const b of this.bullets) {
      if (!b.active) continue;
      const prevY = b.y;
      b.y -= BULLET.SPEED * (delta / 1000);
      const a = b.target;
      const hit =
        a !== null &&
        a.active &&
        Math.abs(b.x - a.x) < BULLET.HIT_HALF_W &&
        a.y >= b.y - BULLET.HIT_HALF_H &&
        a.y <= prevY + BULLET.HIT_HALF_H;
      if (hit) this.onBulletHit(b, a);
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

  /** Weighted cognitive load of the unsolved aliens (secondary spawn gate). An
   * ability adds to its alien's weight. */
  private currentThreat(): number {
    return this.unsolved().reduce(
      (t, a) => t + (ENEMY.THREAT_BY_BALLS[a.ballCount] ?? 1) + (a.ability ? ABILITY.THREAT : 0),
      0,
    );
  }

  /** Count of unsolved aliens. Drives the primary spawn gate. */
  private unsolvedOnScreen(): number {
    return this.unsolved().length;
  }

  /** Count of unsolved "hard" (multi-number) aliens. */
  private hardAliensOnScreen(): number {
    return this.unsolved().filter((a) => a.ballCount >= ENEMY.HARD_BALL_THRESHOLD).length;
  }

  /** Count of unsolved ability aliens. */
  private abilityAliensOnScreen(): number {
    return this.unsolved().filter((a) => a.ability).length;
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
   * Digits for a new sum (a random count in [minBalls, maxBalls]) whose result
   * isn't already on the field, so each typed number maps to exactly one alien.
   * Null when the field is saturated.
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

  /**
   * Build (not add) an alien. With an ability it moves as ABILITY.KIND at the
   * ability's SPEED and wears the ability's model; a blinker (strafer) also
   * patrols PATROL_MULT longer. `model` overrides the look (splitlings).
   */
  private makeAlien(
    kind: AlienKind,
    sum: { digits: number[]; result: number },
    x: number,
    y: number,
    diff: DifficultyParams,
    bandY?: number,
    ability?: AbilityKind | null,
    model?: string,
  ): Alien {
    const speed = ability ? ABILITY.SPEED[ability] : 1;
    const patrol = ability === "blinker" ? ABILITY.PATROL_MULT : 1;
    return new Alien({
      kind,
      x,
      y,
      bodyKey: `alien${Phaser.Math.Between(1, 13)}`,
      result: sum.result,
      digits: sum.digits,
      ballTexture: "blueBalls",
      fallSpeed: diff.fallSpeed * speed,
      homeSpeed: diff.homeSpeed * speed,
      spawnedAt: this.time.now,
      patrolMs: diff.straferPatrolMs * patrol,
      bandY,
      model: ability ? ABILITY.MODEL[ability] : model,
      ability: ability ? createAbility(ability) : undefined,
    });
  }

  /** Spawn one lethal alien from the top. Returns false if there was no room. */
  private spawnAlien(diff: DifficultyParams): boolean {
    if (this.gameOver) return false;

    // Don't let the field over-populate — a crowded screen makes a single hit
    // unrecoverable.
    if (this.aliens.filter((a) => a.active && a.lethal).length >= diff.maxOnScreen) return false;

    const ability = this.pickAbility(diff);

    // Ball count (>= 2, so it is always a real sum) and digit size scale up, but
    // cap concurrent "hard" (multi-number) enemies so the player never has to
    // juggle two slow multi-number sums at once. Ability aliens carry a fixed,
    // easy ball count: the ability is the challenge.
    const maxBallsAllowed = ability
      ? ABILITY.BALLS
      : this.hardAliensOnScreen() >= diff.maxHardOnScreen
        ? Math.max(DIFFICULTY.MIN_BALLS, ENEMY.HARD_BALL_THRESHOLD - 1)
        : diff.maxBalls;
    const minBalls = ability ? ABILITY.BALLS : DIFFICULTY.MIN_BALLS;
    const sum = this.rollSum(minBalls, maxBallsAllowed, diff.maxDigit);
    if (!sum) return false;

    const kind: AlienKind = ability
      ? ABILITY.KIND[ability]
      : sum.digits.length >= ENEMY.HARD_BALL_THRESHOLD
        ? "lumberer"
        : this.pickTwoBallKind();
    const bandY =
      kind === "strafer"
        ? Phaser.Math.Between(MONSTERS.strafer.BAND_Y.min, MONSTERS.strafer.BAND_Y.max)
        : undefined;

    // Enter just above the top edge, in a column whose whole sweep (zig-zag or
    // patrol span) clears every alien still near the top and whose box clears
    // everyone, so ball rows start apart; advanceReadable keeps them apart.
    const probe = this.makeAlien(kind, sum, 0, 0, diff, bandY, ability);
    const y = -probe.bottom - 2;
    const lo = probe.sweepHalf + ENEMY.SPAWN_EDGE;
    const hi = GAME.WIDTH - lo;
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = Phaser.Math.Between(lo, hi);
      const alien = this.makeAlien(kind, sum, x, y, diff, bandY, ability);
      if (this.hasRoomFor(alien)) {
        this.addAlien(alien);
        if (ability) this.introduceAbility(ability);
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
    const sum = this.rollSum(DIFFICULTY.MIN_BALLS, DIFFICULTY.MIN_BALLS, diff.maxDigit);
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
    const diff = difficultyAt(this.elapsedMs, this.score);
    const sum = this.rollSum(DIFFICULTY.MIN_BALLS, DIFFICULTY.MIN_BALLS, diff.maxDigit);
    if (!sum) return false;
    const make = (cx: number, cy: number) =>
      this.makeAlien("darter", sum, cx, cy, diff, undefined, null, SPLITTER.CHILD_MODEL);
    // Start halfway out, not at the parent's center: the two splitlings then
    // begin a full box apart, so their numbers never overlap mid-glide. Its box
    // must pass the readability rule where it starts and where it lands (the
    // dead parent no longer counts; the first splitling already does).
    const child = make((parent.x + x) / 2, parent.y);
    const landing = make(x, y);
    const clear = (a: Alien) => this.aliens.every((o) => !o.active || !a.overlaps(o));
    if (!clear(child) || !clear(landing)) return false;
    child.glideTo(x, y, SPLITTER.GLIDE_MS);
    this.addAlien(child);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Combat
  // ---------------------------------------------------------------------------
  private fire(time: number, target: Alien | null): void {
    this.lastFire = time;
    const bullet: Bullet = {
      x: this.shipX,
      y: PLAYER.Y - BULLET.MUZZLE_OFFSET,
      active: true,
      target: target?.active ? target : null,
    };
    this.bullets.push(bullet);
    this.sound.play("shoot", { volume: 0.4 });
    // Clear the typed answer once we have committed to a shot, but keep the
    // target LOCKED until a bullet actually destroys it. Lock first, so the
    // display goes straight on showing the locked answer.
    if (target && target.active) {
      this.lockedTarget = target;
      this.lockedBullet = bullet;
    }
    this.setTyped("");

    // If the locked target sits at/below the muzzle, an upward bullet can't
    // reach it, so resolve the hit point-blank to guarantee the kill.
    if (target && target.active && target.y >= PLAYER.Y - BULLET.MUZZLE_OFFSET) {
      this.onBulletHit(bullet, target);
    }
  }

  private onBulletHit(bullet: Bullet, alien: Alien): void {
    if (!alien.active) return;
    bullet.active = false;
    // Read the solved sum before an ability rerolls it.
    const solved = { digits: alien.digits, solveMs: this.time.now - alien.spawnedAt };
    if (alien.ability?.onHit(alien, this)) this.onHitAbsorbed(alien, solved);
    else this.killAlien(alien);
  }

  /**
   * An ability took the hit (e.g. a shield broke and rolled a new sum). The
   * answer was still correct, so it scores, charges energy and extends the
   * streak like a kill, but the alien lives on: release the lock so the player
   * can target its new sum.
   */
  private onHitAbsorbed(
    alien: Alien,
    solved: { digits: readonly number[]; solveMs: number },
  ): void {
    this.combo += 1;
    this.bestComboThisRun = Math.max(this.bestComboThisRun, this.combo);
    this.updateComboText();
    this.sound.play("explode", { volume: 0.3, rate: 1.6 });
    this.addScore(this.computeScore(solved.digits.length, solved.solveMs), alien.x, alien.y);
    this.addEnergy(energyForKill({ ...solved, combo: this.combo }));
    this.popEquation(solved.digits, alien);
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
    this.popEquation(alien.digits, alien);
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

  /** A bonus alien crossed the field unsolved: it just leaves, no penalty. */
  private onAlienEscaped(alien: Alien): void {
    this.enemiesInField.delete(alien.result);
    alien.kill();
  }

  /**
   * Show the solved sum ("7 + 5 = 12") above the alien, and burst the answer's
   * background stars: a clear "that was right" beat that also teaches the sum.
   */
  private popEquation(digits: readonly number[], alien: Alien): void {
    const E = FEEDBACK.EQUATION;
    const result = digits.reduce((s, d) => s + d, 0);
    this.world.answerSolved(String(result));
    const y = alien.y - alien.top - 12;
    const text = this.add
      .text(alien.x, y, `${digits.join(" + ")} = ${result}`, {
        fontFamily: "monospace",
        fontSize: `${E.FONT_PX}px`,
        fontStyle: "bold",
        color: FEEDBACK.COLOR.match,
        stroke: "#05060f",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(5);
    const half = text.width / 2 + 4;
    text.setX(Phaser.Math.Clamp(alien.x, half, GAME.WIDTH - half)).setScale(1.4);
    this.tweens.add({ targets: text, scale: 1, duration: E.POP_MS, ease: "Back.easeOut" });
    this.tweens.add({
      targets: text,
      y: y - E.RISE_PX,
      alpha: 0,
      delay: E.HOLD_MS,
      duration: E.FADE_MS,
      onComplete: () => text.destroy(),
    });
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
    this.reticle.setVisible(!this.paused);
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
        fontStyle: "bold",
        color: FEEDBACK.COLOR.typing,
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    // Under the HUD, over the (3D) field.
    this.reticle = this.add.graphics().setDepth(4);

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
  // Energy & time powers (SLOW / FREEZE)
  // ---------------------------------------------------------------------------
  private addEnergy(gain: number): void {
    const stored = this.energy.charge(gain);
    if (stored < 0.5) return;
    const pop = this.add
      .text(METER_X + METER_W * this.energy.fraction, METER_Y - 8, `+${Math.round(stored)}`, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#5ef0ff",
      })
      .setOrigin(0.5, 1)
      .setDepth(6);
    this.tweens.add({
      targets: pop,
      y: pop.y - 20,
      alpha: 0,
      duration: 700,
      onComplete: () => pop.destroy(),
    });
  }

  private triggerPower(mode: SlowMode): void {
    if (this.gameOver || this.paused) return;
    if (this.slowTime.trigger(mode, this.energy)) {
      this.sound.play("blip", { volume: 0.5, rate: mode === "freeze" ? 0.4 : 0.6 });
    }
    this.updateEnergyHud();
  }

  private buildEnergyHud(): void {
    const HUD_DEPTH = 5;

    // Field tint while a power runs. It is drawn on the transparent Phaser
    // canvas, so it tints the 3D playfield underneath (and sits below the HUD).
    this.slowTint = this.add
      .rectangle(GAME.WIDTH / 2, 0, GAME.WIDTH, PLAYER.Y + 20, ENERGY_COLOR, 1)
      .setOrigin(0.5, 0)
      .setDepth(4)
      .setVisible(false);

    // Tall power buttons in the gutters beside the keypad, one per thumb.
    const makeButton = (mode: SlowMode, x: number, label: string) => {
      const color = POWER_COLOR[mode];
      const bg = this.add
        .rectangle(x, KEYPAD_TOP + GUTTER_H / 2, 48, GUTTER_H, 0x1b2340)
        .setStrokeStyle(2, color)
        .setDepth(HUD_DEPTH)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(x, KEYPAD_TOP + GUTTER_H / 2, label.split("").join("\n"), {
          fontFamily: "monospace",
          fontSize: "18px",
          color: "#ffffff",
          align: "center",
          lineSpacing: label.length > 4 ? 0 : 8,
        })
        .setOrigin(0.5)
        .setDepth(HUD_DEPTH);
      bg.on("pointerdown", () => this.triggerPower(mode));
      this.powerButtons[mode] = { bg, text };
    };
    makeButton("slow", 30, "SLOW");
    makeButton("freeze", GAME.WIDTH - 30, "FREEZE");

    // Horizontal energy meter under the keypad.
    this.add
      .text(30, METER_Y, "EN", { fontFamily: "monospace", fontSize: "12px", color: "#5ef0ff" })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.add
      .rectangle(METER_X, METER_Y, METER_W, 12, 0x1b2340)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x33406e)
      .setDepth(HUD_DEPTH);
    this.energyFill = this.add
      .rectangle(METER_X, METER_Y, 0, 8, ENERGY_COLOR)
      .setOrigin(0, 0.5)
      .setDepth(HUD_DEPTH);
    // Marks the energy needed to switch a power on.
    this.add
      .rectangle(METER_X + METER_W * (this.slowTime.threshold / this.energy.max), METER_Y, 2, 18, 0xffd166)
      .setDepth(HUD_DEPTH);
    this.energyText = this.add
      .text(GAME.WIDTH - 30, METER_Y, "0", { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.add
      .text(GAME.WIDTH / 2, METER_Y + 22, "SPACE slow  ·  F freeze", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8892b0",
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    this.updateEnergyHud();
  }

  private updateEnergyHud(): void {
    const e = this.energy;
    this.energyFill.setSize(METER_W * e.fraction, 8);
    this.energyText.setText(String(Math.floor(e.value)));

    const running = this.slowTime.mode;
    const usable = this.slowTime.canTrigger(e);
    for (const mode of ["slow", "freeze"] as const) {
      const { bg, text } = this.powerButtons[mode];
      const on = running === mode;
      bg.setFillStyle(on ? POWER_ON_FILL[mode] : 0x1b2340).setAlpha(on || usable ? 1 : 0.35);
      text.setAlpha(on || usable ? 1 : 0.35);
    }
    if (running) {
      this.slowTint
        .setVisible(true)
        .setFillStyle(POWER_COLOR[running], running === "freeze" ? 0.22 : 0.1);
    } else {
      this.slowTint.setVisible(false);
    }
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
        this.triggerPower("slow");
        return;
      }
      if (e.key === "f" || e.key === "F") {
        this.triggerPower("freeze");
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
    this.refreshAnswer();
  }

  // ---------------------------------------------------------------------------
  // Answer feedback: the display, the lock-on brackets, the flying number
  // ---------------------------------------------------------------------------
  /** The typed number and how it reads; with nothing typed, the locked answer
   * stays shown (gold) until its alien is destroyed. */
  private answerView(): AnswerView | null {
    if (this.typed !== "") return { text: this.typed, state: this.typedState() };
    const lock = this.lockedTarget;
    return lock?.active ? { text: String(lock.result), state: "match" } : null;
  }

  /** match = an alien has this answer; typing = one could still (a longer
   * answer starts with it); wrong = no alien's answer can. */
  private typedState(): AnswerState {
    if (this.enemiesInField.has(parseInt(this.typed, 10))) return "match";
    const canGrow =
      this.typed.length < 2 &&
      [...this.enemiesInField.keys()].some((r) => String(r).startsWith(this.typed));
    return canGrow ? "typing" : "wrong";
  }

  /** Recompute the answer and react when its text or state changes. */
  private refreshAnswer(): void {
    const view = this.answerView();
    const prev = this.answer;
    this.answer = view;
    if (view?.text === prev?.text && view?.state === prev?.state) return;

    const state = view?.state ?? "typing";
    this.tweens.killTweensOf(this.typedText);
    this.typedText
      .setText(view?.text ?? "_")
      .setColor(FEEDBACK.COLOR[state])
      .setScale(1)
      .setX(GAME.WIDTH / 2);

    if (state === "match" && this.typed !== "") {
      this.sound.play("blip", { volume: 0.35, rate: 1.5 });
      this.typedText.setScale(FEEDBACK.MATCH_POP_SCALE);
      this.tweens.add({
        targets: this.typedText,
        scale: 1,
        duration: FEEDBACK.MATCH_POP_MS,
        ease: "Back.easeOut",
      });
      const alien = this.enemiesInField.get(parseInt(this.typed, 10));
      if (alien) this.flyAnswer(this.typed, alien);
    } else if (state === "wrong") {
      this.sound.play("blip", { volume: 0.4, rate: 0.5 });
      this.wrongLeftMs = FEEDBACK.WRONG_CLEAR_MS;
      this.tweens.add({
        targets: this.typedText,
        x: GAME.WIDTH / 2 + FEEDBACK.WRONG_SHAKE_PX,
        duration: 45,
        yoyo: true,
        repeat: 2,
        ease: "Sine.easeInOut",
      });
    }
  }

  /** A matched number flies from the display up to its alien. */
  private flyAnswer(text: string, alien: Alien): void {
    const fly = this.add
      .text(this.typedText.x, this.typedText.y, text, {
        fontFamily: "monospace",
        fontSize: "32px",
        fontStyle: "bold",
        color: FEEDBACK.COLOR.match,
        stroke: "#05060f",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.tweens.add({
      targets: fly,
      x: alien.x,
      y: alien.y - alien.top,
      scale: 0.5,
      alpha: 0.2,
      duration: FEEDBACK.FLY_MS,
      ease: "Cubic.easeIn",
      onComplete: () => fly.destroy(),
    });
  }

  /** Corner brackets around the target's box; they snap in when it is acquired. */
  private drawReticle(delta: number): void {
    const a = this.target?.active ? this.target : null;
    if (a !== this.reticleTarget) {
      this.reticleTarget = a;
      this.reticleAge = 0;
    }
    this.reticle.clear();
    if (!a) return;
    this.reticleAge += delta;
    const R = FEEDBACK.RETICLE;
    const t = Math.min(1, this.reticleAge / R.SNAP_MS);
    const grow = 1 + (R.SNAP_FROM - 1) * (1 - t) * (1 - t);
    const top = a.y - a.top - R.PAD;
    const bottom = a.y + a.bottom + R.PAD;
    const cy = (top + bottom) / 2;
    const hw = (a.halfW + R.PAD) * grow;
    const hh = ((bottom - top) / 2) * grow;
    this.reticle.lineStyle(R.WIDTH, R.COLOR, 0.4 + 0.6 * t);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = a.x + sx * hw;
        const y = cy + sy * hh;
        this.reticle.beginPath();
        this.reticle.moveTo(x - sx * R.ARM, y);
        this.reticle.lineTo(x, y);
        this.reticle.lineTo(x, y - sy * R.ARM);
        this.reticle.strokePath();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------------------
  private endGame(): void {
    this.gameOver = true;
    this.reticle.clear();

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
          `Energy earned ${Math.round(this.energy.earned)} · used ` +
          `${Math.round(this.energy.spent.slow)} slow, ${Math.round(this.energy.spent.freeze)} freeze`,
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
