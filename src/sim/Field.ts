import {
  ABILITY,
  DIFFICULTY,
  ENEMY,
  GAME,
  MONSTERS,
  PLAYER,
  SPLITTER,
  type AlienKind,
} from "../config/constants";
import { difficultyAt, type DifficultyParams } from "../config/difficulty";
import Alien from "../objects/Alien";
import {
  createAbility,
  unlockedAbilities,
  type AbilityHost,
  type AbilityKind,
} from "../objects/abilities";
import { Rng, SpawnStreams } from "./rng";

// Keys of the run's seeded random streams (sim/rng.ts), one per purpose.
const STREAM = { FIELD: 1, SPAWN: 2, DRIFTER: 3 } as const;

/**
 * What happened on the field, for the scene to show (and later for the match
 * to count). The scene drains them with `takeEvents()` after each step.
 */
export type FieldEvent =
  | { type: "spawned"; alien: Alien }
  /** A lethal alien reached the player line (it is already removed). */
  | { type: "reachedPlayer"; alien: Alien };

/** What the field needs from the player's side each step. */
export interface StepContext {
  /** The player's score: difficulty is earned by scoring. */
  score: number;
  /** Field speed: 1 normal, below 1 slow time / post-hit, 0 frozen. */
  speed: number;
  /** The targeted alien: it holds still while the ship lines up the shot. */
  held: Alien | null;
  /** The answered alien a bullet is on its way to: no longer "unsolved". */
  locked: Alien | null;
}

export interface FieldOptions {
  seed: number;
  /** Dev play-testing: every allowed spawn gets one of these abilities. */
  forcedAbilities?: AbilityKind[] | null;
}

/**
 * One player's playfield, free of Phaser and rendering so the same code runs in
 * the browser, in bots and on a future server (docs/MULTIPLAYER_DESIGN.md §8).
 *
 * Owns the aliens, the game clock, the spawners (seeded) and the readability
 * rule. The ship, bullets, score and energy still live in GameScene (they move
 * in with milestone M2b). Call `step()` with a fixed dt: the same seed and the
 * same contexts then give the same field.
 */
export class Field implements AbilityHost {
  readonly seed: number;
  aliens: Alien[] = [];
  /** The game clock: ms of play. Only advances in `step()`, so it stops while
   * the scene is paused. Every rule timing reads it, never the wall clock. */
  elapsedMs = 0;

  /** result -> alien: results are unique, so a typed number maps to one alien. */
  private readonly byResult = new Map<number, Alien>();
  private readonly forcedAbilities: AbilityKind[] | null;
  /** Seeded draws the player's actions cause (rerolled sums, splitlings). */
  private readonly rng: Rng;
  private readonly spawnStreams: SpawnStreams;
  private readonly drifterStreams: SpawnStreams;
  private spawnCountdown = 0; // the first alien spawns on the first step
  private drifterCountdown: number = MONSTERS.drifter.FIRST_MS;
  private score = 0;
  private locked: Alien | null = null;
  private events: FieldEvent[] = [];

  constructor(options: FieldOptions) {
    this.seed = options.seed;
    this.forcedAbilities = options.forcedAbilities ?? null;
    this.rng = Rng.derive(this.seed, STREAM.FIELD);
    this.spawnStreams = new SpawnStreams(this.seed, STREAM.SPAWN);
    this.drifterStreams = new SpawnStreams(this.seed, STREAM.DRIFTER);
  }

  get difficulty(): DifficultyParams {
    return difficultyAt(this.elapsedMs, this.score);
  }

  /** The live alien whose answer is `result`, if any. */
  alienFor(result: number): Alien | undefined {
    return this.byResult.get(result);
  }

  /** Every answer currently on the field. */
  results(): IterableIterator<number> {
    return this.byResult.keys();
  }

  /**
   * Advance the field by `dt` ms of real time: spawn, run ability clocks and
   * move every alien (at `ctx.speed`) under the readability rule.
   */
  step(dt: number, ctx: StepContext): void {
    this.score = ctx.score;
    this.locked = ctx.locked;
    this.elapsedMs += dt;
    const diff = this.difficulty;
    const fieldDt = dt * ctx.speed;
    for (const alien of this.aliens) alien.savePrev();

    // Spawn pacing's PRIMARY gate is the number of UNSOLVED aliens (ones the
    // player still has to do mental math for): start at 1 and open up only as
    // the player earns points. The weighted threat budget is a secondary net so
    // the screen never floods and a hit stays recoverable. Recheck soon instead
    // of waiting a full interval so deferred spawns don't pile up and burst.
    this.spawnCountdown -= fieldDt;
    if (this.spawnCountdown <= 0) {
      const spawned =
        this.unsolved().length < diff.maxUnsolved &&
        this.currentThreat() < diff.threatBudget &&
        this.spawnAlien(diff);
      this.spawnCountdown = spawned ? diff.spawnInterval : ENEMY.SPAWN_RETRY_MS;
    }

    // The bonus drifter runs on its own clock and ignores the caps above: it is
    // optional, so it never takes a slot from the sums the player must solve.
    this.drifterCountdown -= fieldDt;
    if (this.drifterCountdown <= 0 && !this.spawnDrifter(diff)) {
      this.drifterCountdown = ENEMY.SPAWN_RETRY_MS;
    }

    // Ability clocks run on real time, not field time: a blinker must not stay
    // shut through the post-hit freeze meant for reading the board.
    for (const alien of this.aliens) if (alien.active) alien.ability?.update(dt);

    // Advance every alien; detect ones that reached the player line. The held
    // target STOPS: once the player has typed its answer it holds position while
    // the ship lines up the shot, so a correct answer is never punished by the
    // ship's travel time (and it can't cost a life).
    for (const alien of this.aliens) {
      if (alien === ctx.held || !alien.active) continue;
      this.advanceReadable(alien, fieldDt);
      if (alien.lethal && alien.y >= PLAYER.Y - 6) {
        this.remove(alien);
        this.events.push({ type: "reachedPlayer", alien });
      } else if (alien.escaped) {
        this.remove(alien); // a bonus alien crossed unsolved: no penalty
      }
    }
  }

  /** Events since the last call, oldest first. */
  takeEvents(): FieldEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  /** Take an alien off the field (killed or gone) and free its answer. */
  remove(alien: Alien): void {
    if (this.byResult.get(alien.result) === alien) this.byResult.delete(alien.result);
    alien.kill();
  }

  /** Drop removed aliens from the list (the renderer then drops their meshes). */
  prune(): void {
    this.aliens = this.aliens.filter((a) => a.active);
  }

  // ---------------------------------------------------------------------------
  // AbilityHost: what abilities may ask of the field (see objects/abilities.ts)
  // ---------------------------------------------------------------------------
  rerollSum(alien: Alien): boolean {
    const sum = this.rollSum(this.rng, alien.ballCount, alien.ballCount, this.difficulty.maxDigit);
    if (!sum) return false;
    this.byResult.delete(alien.result);
    alien.setSum(sum.digits, sum.result, this.elapsedMs);
    this.byResult.set(sum.result, alien);
    return true;
  }

  spawnSplitling(parent: Alien, x: number, y: number): boolean {
    const diff = this.difficulty;
    const sum = this.rollSum(this.rng, DIFFICULTY.MIN_BALLS, DIFFICULTY.MIN_BALLS, diff.maxDigit);
    if (!sum) return false;
    const make = (cx: number, cy: number) =>
      this.makeAlien(this.rng, "darter", sum, cx, cy, diff, undefined, null, SPLITTER.CHILD_MODEL);
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
  // Readability
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Spawning
  // ---------------------------------------------------------------------------
  /**
   * Aliens the player still has to solve: live, lethal (the bonus drifter is
   * optional) and not the already-answered locked target — a committed kill is
   * no longer a mental burden, so it shouldn't suppress new spawns.
   */
  private unsolved(): Alien[] {
    return this.aliens.filter((a) => a.active && a.lethal && a !== this.locked);
  }

  /** Weighted cognitive load of the unsolved aliens (secondary spawn gate). An
   * ability adds to its alien's weight. */
  private currentThreat(): number {
    return this.unsolved().reduce(
      (t, a) => t + (ENEMY.THREAT_BY_BALLS[a.ballCount] ?? 1) + (a.ability ? ABILITY.THREAT : 0),
      0,
    );
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
  private pickAbility(diff: DifficultyParams, rng: Rng): AbilityKind | null {
    if (this.abilityAliensOnScreen() >= diff.maxAbilityOnScreen) return null;
    const pool = this.forcedAbilities ?? unlockedAbilities(diff.d);
    if (!pool.length) return null;
    if (!this.forcedAbilities && !rng.chance(diff.abilityChance)) return null;
    return rng.pick(pool);
  }

  /**
   * Digits for a new sum (a random count in [minBalls, maxBalls]) whose result
   * isn't already on the field, so each typed number maps to exactly one alien.
   * Null when the field is saturated.
   */
  private rollSum(
    rng: Rng,
    minBalls: number,
    maxBalls: number,
    maxDigit: number,
  ): { digits: number[]; result: number } | null {
    for (let attempt = 0; attempt < 12; attempt++) {
      const count = rng.int(minBalls, maxBalls);
      const digits = Array.from({ length: count }, () => rng.int(1, maxDigit));
      const result = digits.reduce((s, d) => s + d, 0);
      if (!this.byResult.has(result)) return { digits, result };
    }
    return null;
  }

  /**
   * Build (not add) an alien. With an ability it moves as ABILITY.KIND at the
   * ability's SPEED and wears the ability's model; a blinker (strafer) also
   * patrols PATROL_MULT longer. `model` overrides the look (splitlings).
   */
  private makeAlien(
    rng: Rng,
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
      bodyKey: `alien${rng.int(1, 13)}`,
      result: sum.result,
      digits: sum.digits,
      ballTexture: "blueBalls",
      fallSpeed: diff.fallSpeed * speed,
      homeSpeed: diff.homeSpeed * speed,
      spawnedAt: this.elapsedMs,
      rng,
      patrolMs: diff.straferPatrolMs * patrol,
      bandY,
      model: ability ? ABILITY.MODEL[ability] : model,
      ability: ability ? createAbility(ability) : undefined,
    });
  }

  /** Spawn one lethal alien from the top. Returns false if there was no room. */
  private spawnAlien(diff: DifficultyParams): boolean {
    // Don't let the field over-populate — a crowded screen makes a single hit
    // unrecoverable.
    if (this.aliens.filter((a) => a.active && a.lethal).length >= diff.maxOnScreen) return false;

    const rng = this.spawnStreams.next();
    const ability = this.pickAbility(diff, rng);

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
    const sum = this.rollSum(rng, minBalls, maxBallsAllowed, diff.maxDigit);
    if (!sum) return false;

    const kind: AlienKind = ability
      ? ABILITY.KIND[ability]
      : sum.digits.length >= ENEMY.HARD_BALL_THRESHOLD
        ? "lumberer"
        : this.pickTwoBallKind(rng);
    const bandY =
      kind === "strafer"
        ? rng.int(MONSTERS.strafer.BAND_Y.min, MONSTERS.strafer.BAND_Y.max)
        : undefined;

    // Enter just above the top edge, in a column whose whole sweep (zig-zag or
    // patrol span) clears every alien still near the top and whose box clears
    // everyone, so ball rows start apart; advanceReadable keeps them apart.
    const probe = this.makeAlien(rng, kind, sum, 0, 0, diff, bandY, ability);
    const y = -probe.bottom - 2;
    const lo = probe.sweepHalf + ENEMY.SPAWN_EDGE;
    const hi = GAME.WIDTH - lo;
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = rng.int(lo, hi);
      const alien = this.makeAlien(rng, kind, sum, x, y, diff, bandY, ability);
      if (this.hasRoomFor(alien)) {
        this.addAlien(alien);
        this.spawnStreams.succeeded();
        return true;
      }
    }
    return false; // no clear column right now; the spawner retries soon
  }

  private pickTwoBallKind(rng: Rng): AlienKind {
    const weights = ENEMY.TWO_BALL_KINDS;
    let r = rng.next() * (weights.darter + weights.strafer);
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
    this.byResult.set(alien.result, alien);
    this.events.push({ type: "spawned", alien });
  }

  /**
   * Send a bonus drifter across from a random side and schedule the next one.
   * False if not possible now.
   */
  private spawnDrifter(diff: DifficultyParams): boolean {
    if (this.aliens.some((a) => a.active && a.kind === "drifter")) return false;
    const rng = this.drifterStreams.next();
    // Always a quick 2-number sum: it is a bonus, not a test.
    const sum = this.rollSum(rng, DIFFICULTY.MIN_BALLS, DIFFICULTY.MIN_BALLS, diff.maxDigit);
    if (!sum) return false;
    const m = MONSTERS.drifter;
    for (let attempt = 0; attempt < 6; attempt++) {
      const fromLeft = rng.chance(0.5);
      const probe = this.makeAlien(rng, "drifter", sum, 0, 0, diff);
      const x = fromLeft ? -probe.halfW : GAME.WIDTH + probe.halfW - 1;
      const bandY = rng.int(m.BAND_Y.min, m.BAND_Y.max);
      const alien = this.makeAlien(rng, "drifter", sum, x, bandY, diff, bandY);
      if (this.aliens.every((o) => !o.active || !alien.overlaps(o))) {
        this.addAlien(alien);
        this.drifterStreams.succeeded();
        this.drifterCountdown = rng.int(m.INTERVAL_MS.min, m.INTERVAL_MS.max);
        return true;
      }
    }
    return false;
  }
}
