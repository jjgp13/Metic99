import {
  ABILITY,
  BALL_COLOR,
  DIFFICULTY,
  ENEMY,
  GAME,
  MONSTERS,
  PLAYER,
  SPLITTER,
  STORY,
  type AlienKind,
  type BossDef,
} from "../config/constants";
import type { DifficultyParams } from "../config/difficulty";
import Alien from "../objects/Alien";
import { Boss, createAbility, type AbilityHost, type AbilityKind } from "../objects/abilities";
import { createBoss } from "../objects/bosses";
import { TRAITS } from "../objects/traits";
import { EndlessDirector, type SpawnDirector } from "./director";
import { Rng, SpawnStreams } from "./rng";

// Keys of the run's seeded random streams (sim/rng.ts), one per purpose.
// SEND is the Field's (what its attacks carry).
export const STREAM = { FIELD: 1, SPAWN: 2, DRIFTER: 3, SEND: 4 } as const;

/** One alien of an attack: how it moves and its ability (if any). The
 * receiver rolls its sum and column. */
export interface SentAlien {
  kind: AlienKind;
  ability: AbilityKind | null;
}

/** A sum: its digits (one per ball) and its result (what the player types). */
interface Sum {
  digits: number[];
  result: number;
}

/** Everything `makeAlien` needs to build one alien (see AlienConfig). */
interface AlienSpec {
  kind: AlienKind;
  sum: Sum;
  x: number;
  y: number;
  /** Speeds and patrol time come from the difficulty at spawn time. */
  pace: DifficultyParams;
  /** Strafer / drifter: body y of the band it patrols or crosses. */
  bandY?: number;
  /** An ability changes the alien's speed and model too. */
  ability?: AbilityKind | null;
  /** Model to wear instead of the kind's (splitlings). */
  model?: string;
  /** Swooper: where its sideways flight in ends. */
  laneX?: number;
  /** Battle: the seat that sent it. */
  sentBy?: number;
  /** Story: this alien is the level's boss. */
  boss?: BossDef;
  /** Start heading this way (a marching line keeps in step). */
  dir?: 1 | -1;
}

/** What happened to the aliens; `Field` drains them after each step. */
export type SwarmEvent =
  | { type: "spawned"; alien: Alien }
  /** A lethal alien reached the player line (it is already removed; a boss
   * instead digs back up the field). */
  | { type: "reachedPlayer"; alien: Alien };

/** What the swarm needs from the player's side (Field) each step. */
export interface StepContext {
  /** The player's score: difficulty is earned by scoring. */
  score: number;
  /** Battle pressure from the match (0 in solo play). */
  dMatch: number;
  /** Field speed: 1 normal, below 1 slow time / post-hit, 0 frozen. */
  speed: number;
  /** The targeted alien: it holds still while the ship lines up the shot. */
  held: Alien | null;
  /** The answered alien a bullet is on its way to: no longer "unsolved". */
  locked: Alien | null;
}

export interface SwarmOptions {
  seed: number;
  /** Dev play-testing: every allowed spawn gets one of these abilities. */
  forcedAbilities?: AbilityKind[] | null;
  /** Testing: every 2-ball spawn without an ability is one of these kinds. */
  forcedKinds?: AlienKind[] | null;
  /** What spawns and how hard (default: Endless, the score-led curve). */
  director?: SpawnDirector;
}

/**
 * The aliens on one player's field: the game clock, the seeded spawners, their
 * movement and the readability rule, plus the AbilityHost abilities call.
 * `Field` owns one and adds the player's side (ship, typing, score, energy).
 * Call `step()` with a fixed dt: the same seed and the same contexts then give
 * the same swarm.
 */
export class Swarm implements AbilityHost {
  readonly seed: number;
  aliens: Alien[] = [];
  /** The game clock: ms of play. Only advances in `step()`, so it stops while
   * the scene is paused. Every rule timing reads it, never the wall clock. */
  elapsedMs = 0;
  /** Field time: ms the field actually moved (stops in freezes). */
  fieldMs = 0;
  readonly director: SpawnDirector;
  /** Story: the level's boss once it has come in (stays set after it dies). */
  boss: Alien | null = null;

  /** result -> alien: results are unique, so a typed number maps to one alien. */
  private readonly byResult = new Map<number, Alien>();
  private readonly forcedAbilities: AbilityKind[] | null;
  private readonly forcedKinds: AlienKind[] | null;
  /** Seeded draws the player's actions cause (rerolled sums, splitlings). */
  private readonly rng: Rng;
  private readonly spawnStreams: SpawnStreams;
  private readonly drifterStreams: SpawnStreams;
  private spawnCountdown = 0; // the first alien spawns on the first step
  private drifterCountdown: number = MONSTERS.drifter.FIRST_MS;
  private score = 0;
  private dMatch = 0;
  private locked: Alien | null = null;
  private held: Alien | null = null;
  private events: SwarmEvent[] = [];

  constructor(options: SwarmOptions) {
    this.seed = options.seed;
    this.forcedAbilities = options.forcedAbilities ?? null;
    this.forcedKinds = options.forcedKinds ?? null;
    this.director = options.director ?? new EndlessDirector();
    this.rng = Rng.derive(this.seed, STREAM.FIELD);
    this.spawnStreams = new SpawnStreams(this.seed, STREAM.SPAWN);
    this.drifterStreams = new SpawnStreams(this.seed, STREAM.DRIFTER);
  }

  get difficulty(): DifficultyParams {
    return this.difficultyFor(this.score, this.dMatch);
  }

  /** The director's pacing for this field at the given score and pressure. */
  difficultyFor(score: number, dMatch: number): DifficultyParams {
    return this.director.difficulty({ elapsedMs: this.elapsedMs, fieldMs: this.fieldMs, score, dMatch });
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
    this.dMatch = ctx.dMatch;
    this.locked = ctx.locked;
    this.held = ctx.held;
    this.elapsedMs += dt;
    this.fieldMs += dt * ctx.speed;
    const diff = this.difficulty;
    const fieldDt = dt * ctx.speed;
    for (const alien of this.aliens) alien.savePrev();

    // Spawn pacing's PRIMARY gate is the number of UNSOLVED aliens (ones the
    // player still has to do mental math for): start at 1 and open up only as
    // the player earns points. The weighted threat budget is a secondary net so
    // the screen never floods and a hit stays recoverable. Recheck soon instead
    // of waiting a full interval so deferred spawns don't pile up and burst.
    // A story level: at the end of the path no new spawns come until the
    // board is clear, then the boss comes in.
    const pathDone = (this.director.progress(this) ?? 0) >= 1;
    const bossDue = pathDone && this.director.boss !== null && this.boss === null;
    this.spawnCountdown -= fieldDt;
    if (bossDue) {
      if (this.ownUnsolved().length === 0 && this.spawnBoss(this.director.boss!, diff)) {
        this.spawnCountdown = diff.spawnInterval;
      }
    } else if (this.spawnCountdown <= 0) {
      const spawned =
        this.ownUnsolved().length < diff.maxUnsolved &&
        this.currentThreat() < diff.threatBudget &&
        this.spawnAlien(diff);
      this.spawnCountdown = spawned ? diff.spawnInterval : ENEMY.SPAWN_RETRY_MS;
    }

    // The bonus drifter runs on its own clock and ignores the caps above: it is
    // optional, so it never takes a slot from the sums the player must solve.
    if (this.director.drifters(this)) {
      this.drifterCountdown -= fieldDt;
      if (this.drifterCountdown <= 0 && !this.spawnDrifter(diff)) {
        this.drifterCountdown = ENEMY.SPAWN_RETRY_MS;
      }
    }

    // Ability clocks run on real time, not field time: a blinker must not stay
    // shut through the post-hit freeze meant for reading the board.
    for (const alien of this.aliens) if (alien.active) alien.ability?.update(dt, alien, this);

    // Advance every alien; detect ones that reached the player line. The held
    // target STOPS: once the player has typed its answer it holds position while
    // the ship lines up the shot, so a correct answer is never punished by the
    // ship's travel time (and it can't cost a life).
    for (const alien of this.aliens) {
      if (alien === ctx.held || !alien.active) continue;
      alien.ability?.steer(alien, fieldDt);
      this.advanceReadable(alien, fieldDt);
      const boss = alien.ability instanceof Boss ? alien.ability : null;
      if (alien.lethal && alien.y >= PLAYER.Y - 6 && !boss?.burrowing) {
        // It costs a life either way; a boss digs back up instead of leaving.
        if (boss) boss.retreat(alien);
        else this.remove(alien);
        this.events.push({ type: "reachedPlayer", alien });
      } else if (alien.escaped) {
        this.remove(alien); // a bonus alien crossed unsolved: no penalty
      }
    }
  }

  /** Events since the last call, oldest first. */
  takeEvents(): SwarmEvent[] {
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
    // Splitlings keep their parent's slower pace rather than bursting out at
    // full darter speed.
    const pace = {
      ...diff,
      fallSpeed: diff.fallSpeed * SPLITTER.CHILD_SPEED,
      homeSpeed: diff.homeSpeed * SPLITTER.CHILD_SPEED,
    };
    const make = (x: number, y: number) =>
      this.makeAlien(this.rng, { kind: "darter", sum, x, y, pace, model: SPLITTER.CHILD_MODEL });
    // Start halfway out, not at the parent's center: the two splitlings then
    // begin a full box apart, so their numbers never overlap mid-glide. Its box
    // must pass the readability rule where it starts and where it lands (the
    // dead parent no longer counts; the first splitling already does).
    const child = make((parent.x + x) / 2, parent.y);
    const landing = make(x, y);
    const clear = (a: Alien) => this.aliens.every((o) => !o.active || !a.overlaps(o));
    if (!clear(child) || !clear(landing)) return false;
    child.glideTo(x, y, SPLITTER.GLIDE_MS);
    child.hold(SPLITTER.HATCH_MS); // after the glide: time to read both new sums
    this.addAlien(child);
    return true;
  }

  spawnBossPart(def: BossDef, x: number, y: number): Alien | null {
    const diff = this.difficulty;
    const sum = this.rollSum(this.rng, def.BALLS, def.BALLS, diff.maxDigit);
    if (!sum) return null;
    const part = this.makeAlien(this.rng, { kind: def.KIND, sum, x, y, pace: diff, boss: def });
    if (!this.aliens.every((o) => !o.active || !part.overlaps(o))) return null;
    this.addAlien(part);
    return part;
  }

  addBall(alien: Alien): boolean {
    const max = this.difficulty.maxDigit;
    const start = this.rng.int(1, max);
    for (let k = 0; k < max; k++) {
      const digit = ((start - 1 + k) % max) + 1;
      const result = alien.result + digit;
      if (this.byResult.has(result)) continue;
      this.byResult.delete(alien.result);
      alien.setSum([...alien.digits, digit], result, this.elapsedMs);
      this.byResult.set(result, alien);
      return true;
    }
    return false;
  }

  spawnMinion(kind: AlienKind, from: readonly [number, number], to: readonly [number, number], ms: number): Alien | null {
    const diff = this.difficulty;
    if (this.aliens.filter((a) => a.active && a.lethal).length >= diff.maxOnScreen) return null;
    const sum = this.rollSum(this.rng, DIFFICULTY.MIN_BALLS, DIFFICULTY.MIN_BALLS, diff.maxDigit);
    if (!sum) return null;
    const minion = this.makeAlien(this.rng, { kind, sum, x: from[0], y: from[1], pace: diff });
    const landing = this.makeAlien(this.rng, { kind, sum, x: to[0], y: to[1], pace: diff });
    const clear = (a: Alien) => this.aliens.every((o) => !o.active || !a.overlaps(o));
    if (!clear(minion) || !clear(landing)) return null;
    minion.glideTo(to[0], to[1], ms);
    this.addAlien(minion);
    return minion;
  }

  spawnCreature(kind: AlienKind, x: number, y: number): Alien | null {
    const diff = this.difficulty;
    if (this.aliens.filter((a) => a.active && a.lethal).length >= diff.maxOnScreen) return null;
    const balls = kind === "lumberer" ? ENEMY.HARD_BALL_THRESHOLD : DIFFICULTY.MIN_BALLS;
    const sum = this.rollSum(this.rng, balls, balls, diff.maxDigit);
    if (!sum) return null;
    // Already where it lands: a strafer's band and a swooper's lane are here.
    const alien = this.makeAlien(this.rng, { kind, sum, x, y, pace: diff, bandY: y, laneX: x });
    if (!this.aliens.every((o) => !o.active || !alien.overlaps(o))) return null;
    this.addAlien(alien);
    return alien;
  }

  preyNear(hunter: Alien, reachPx: number): Alien | null {
    let best: Alien | null = null;
    let bestDist = reachPx;
    for (const a of this.aliens) {
      if (!a.active || !a.lethal || a === hunter || a.ability instanceof Boss) continue;
      const dist = Math.hypot(a.x - hunter.x, a.y - hunter.y);
      if (dist <= bestDist) {
        best = a;
        bestDist = dist;
      }
    }
    return best;
  }

  swallow(prey: Alien): boolean {
    if (!prey.active || prey === this.held || prey === this.locked) return false;
    this.remove(prey);
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

  /** Unsolved aliens of the field's own: sent aliens (attacks) come on top,
   * so they don't hold back the field's own spawns. */
  private ownUnsolved(): Alien[] {
    return this.unsolved().filter((a) => a.sentBy === null);
  }

  /** Weighted cognitive load of the unsolved aliens (secondary spawn gate). An
   * ability adds to its alien's weight. */
  private currentThreat(): number {
    return this.ownUnsolved().reduce(
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
    const pool = this.forcedAbilities ?? this.director.abilities(diff.d);
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
  ): Sum | null {
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
   * patrols PATROL_MULT longer.
   */
  private makeAlien(rng: Rng, spec: AlienSpec): Alien {
    const { ability, pace, boss } = spec;
    // Story: a plain alien of the field's own is its page's creature.
    const plain = !ability && !boss && !spec.model && spec.sentBy === undefined;
    const species = plain ? this.director.species(spec.kind) : null;
    const speed = boss ? boss.SPEED : ability ? ABILITY.SPEED[ability] : (species?.SPEED ?? 1);
    const patrol = ability === "blinker" ? ABILITY.PATROL_MULT : 1;
    return new Alien({
      kind: spec.kind,
      x: spec.x,
      y: spec.y,
      bodyKey: `alien${rng.int(1, 13)}`,
      result: spec.sum.result,
      digits: spec.sum.digits,
      ballTexture: BALL_COLOR.SUM, // every sum is an addition for now
      fallSpeed: pace.fallSpeed * speed,
      homeSpeed: pace.homeSpeed * speed,
      spawnedAt: this.elapsedMs,
      rng,
      patrolMs: pace.straferPatrolMs * patrol,
      bandY: spec.bandY,
      laneX: spec.laneX,
      model: boss ? boss.MODEL : ability ? ABILITY.MODEL[ability] : spec.model,
      ability: boss
        ? createBoss(boss)
        : ability
          ? createAbility(ability)
          : species?.TRAIT
            ? TRAITS[species.TRAIT]?.()
            : undefined,
      box: boss?.BOX ?? species?.BOX,
      sentBy: spec.sentBy,
      layout: species?.LAYOUT,
      species: species?.NAME,
      dir: spec.dir,
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
    if (kind === "swooper") return this.placeSwooper(rng, sum, diff);
    const bandY =
      kind === "strafer"
        ? rng.int(MONSTERS.strafer.BAND_Y.min, MONSTERS.strafer.BAND_Y.max)
        : undefined;

    if (!this.enterFromTop(rng, { kind, sum, pace: diff, bandY, ability })) return false;
    this.spawnStreams.succeeded();
    if (!ability) this.marchBehind(rng, this.aliens[this.aliens.length - 1], diff);
    return true;
  }

  /**
   * Story: a creature that marches (the beetle) brings followers in a line
   * behind it, in its lane and in step. A line is one event: followers skip
   * the unsolved cap (it would keep lines from ever forming early on) but
   * obey the threat budget and the on-screen cap. Each has its own sum.
   * With MARCH.ROW they come side by side instead (the night's invaders).
   */
  private marchBehind(rng: Rng, leader: Alien, diff: DifficultyParams): void {
    const march = leader.species === null ? undefined : this.director.species(leader.kind)?.MARCH;
    if (!march || !rng.chance(march.CHANCE)) return;
    if (march.ROW) return this.marchInRow(rng, leader, march.SIZE, diff);
    const size = march.SIZE;
    let ahead = leader;
    for (let i = 1; i < size; i++) {
      const spec = this.followerSpec(rng, leader, diff);
      if (!spec) return;
      const probe = this.makeAlien(rng, { ...spec, x: leader.x, y: 0 });
      const y = ahead.y - ahead.top - ENEMY.READ_GAP - STORY.MARCH_GAP - probe.bottom;
      const follower = this.makeAlien(rng, { ...spec, x: leader.x, y });
      if (!this.aliens.every((o) => !o.active || !follower.overlaps(o))) return;
      this.addAlien(follower);
      ahead = follower;
    }
  }

  /** Followers beside the leader, at its height: right, left, two right, two
   * left… (whichever slots fit on the page and are clear). */
  private marchInRow(rng: Rng, leader: Alien, size: number, diff: DifficultyParams): void {
    const spacing = 2 * leader.halfW + ENEMY.READ_GAP + STORY.MARCH_GAP;
    const fits = (x: number) => x - leader.halfW >= ENEMY.SPAWN_EDGE && x + leader.halfW <= GAME.WIDTH - ENEMY.SPAWN_EDGE;
    const slots = [1, -1, 2, -2, 3, -3].map((k) => leader.x + k * spacing).filter(fits);
    let placed = 1;
    for (const x of slots) {
      if (placed >= size) return;
      const spec = this.followerSpec(rng, leader, diff);
      if (!spec) return;
      const follower = this.makeAlien(rng, { ...spec, x, y: leader.y });
      if (!this.aliens.every((o) => !o.active || !follower.overlaps(o))) continue;
      this.addAlien(follower);
      placed++;
    }
  }

  /** A follower of a marching line, or null if the threat budget, the
   * on-screen cap or the sums run out. */
  private followerSpec(rng: Rng, leader: Alien, diff: DifficultyParams) {
    if (this.currentThreat() >= diff.threatBudget) return null;
    if (this.aliens.filter((a) => a.active && a.lethal).length >= diff.maxOnScreen) return null;
    const sum = this.rollSum(rng, leader.ballCount, leader.ballCount, diff.maxDigit);
    if (!sum) return null;
    return { kind: leader.kind, sum, pace: diff, dir: leader.heading };
  }

  /** Story: bring the level's boss in from the top. False if no room yet. */
  private spawnBoss(def: BossDef, diff: DifficultyParams): boolean {
    const rng = this.spawnStreams.next();
    const sum = this.rollSum(rng, def.BALLS, def.BALLS, diff.maxDigit);
    if (!sum || !this.enterFromTop(rng, { kind: def.KIND, sum, pace: diff, boss: def })) return false;
    this.spawnStreams.succeeded();
    this.boss = this.aliens[this.aliens.length - 1];
    return true;
  }

  /**
   * Land an alien sent by another player (an attack). It skips the unsolved
   * cap and the threat budget (that is what makes it an attack) but obeys the
   * on-screen cap and the readability rule; false means no room yet, and the
   * incoming queue tries again. Its sum and column come from this field's
   * own stream, so the attack message only says what kind of alien it is.
   */
  spawnSent(sent: SentAlien, from: number): boolean {
    const diff = this.difficulty;
    if (this.aliens.filter((a) => a.active && a.lethal).length >= diff.maxOnScreen) return false;
    const balls = sent.ability ? ABILITY.BALLS : DIFFICULTY.MIN_BALLS;
    const sum = this.rollSum(this.rng, balls, balls, diff.maxDigit);
    if (!sum) return false;
    const bandY =
      sent.kind === "strafer"
        ? this.rng.int(MONSTERS.strafer.BAND_Y.min, MONSTERS.strafer.BAND_Y.max)
        : undefined;
    return this.enterFromTop(this.rng, { kind: sent.kind, sum, pace: diff, bandY, ability: sent.ability, sentBy: from });
  }

  /**
   * Enter just above the top edge, in a column whose whole sweep (zig-zag or
   * patrol span) clears every alien still near the top and whose box clears
   * everyone, so ball rows start apart; advanceReadable keeps them apart.
   * False if no clear column was found (the caller retries soon).
   */
  private enterFromTop(rng: Rng, spec: Omit<AlienSpec, "x" | "y">): boolean {
    // A probe alien at (0, 0) tells the box and sweep size for this spec.
    const probe = this.makeAlien(rng, { ...spec, x: 0, y: 0 });
    const y = -probe.bottom - 2;
    const lo = probe.sweepHalf + ENEMY.SPAWN_EDGE;
    const hi = GAME.WIDTH - lo;
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = rng.int(lo, hi);
      const alien = this.makeAlien(rng, { ...spec, x, y });
      if (this.hasRoomFor(alien)) {
        this.addAlien(alien);
        return true;
      }
    }
    return false;
  }

  private pickTwoBallKind(rng: Rng): AlienKind {
    if (this.forcedKinds) return rng.pick(this.forcedKinds);
    const weights = Object.entries(this.director.twoBallKinds) as [AlienKind, number][];
    let r = rng.next() * weights.reduce((t, [, w]) => t + w, 0);
    for (const [kind, w] of weights) {
      r -= w;
      if (r < 0) return kind;
    }
    return weights[weights.length - 1][0];
  }

  /**
   * Send a swooper in from a random side edge, through a band below the top
   * HUD, to a random lane. Its whole flight path must be clear: no box in the
   * way now, and nothing above the path (or crossing it sideways) whose sweep
   * could come down into it, so the flight in isn't held up. False if no try
   * found room (the spawner retries soon).
   */
  private placeSwooper(rng: Rng, sum: Sum, pace: DifficultyParams): boolean {
    const m = MONSTERS.swooper;
    const probe = this.makeAlien(rng, { kind: "swooper", sum, x: 0, y: 0, pace });
    const lo = probe.halfW + ENEMY.SPAWN_EDGE;
    const hi = GAME.WIDTH - lo;
    for (let attempt = 0; attempt < 12; attempt++) {
      const fromLeft = rng.chance(0.5);
      const x = fromLeft ? -probe.halfW : GAME.WIDTH + probe.halfW;
      const y = rng.int(m.BAND_Y.min, m.BAND_Y.max);
      const laneX = rng.int(lo, hi);
      const alien = this.makeAlien(rng, { kind: "swooper", sum, x, y, pace, laneX });
      if (this.pathClearFor(alien)) {
        this.addAlien(alien);
        this.spawnStreams.succeeded();
        return true;
      }
    }
    return false;
  }

  /** A swooper's flight path (its sweep at its band) is clear of every alien
   * that is in it or could still come down into it. */
  private pathClearFor(alien: Alien): boolean {
    const [lo, hi] = alien.sweep;
    const pathBottom = alien.y + alien.bottom;
    return this.aliens.every((o) => {
      if (!o.active) return true;
      if (alien.overlaps(o)) return false;
      const [olo, ohi] = o.sweep;
      if (hi + ENEMY.READ_GAP <= olo || ohi + ENEMY.READ_GAP <= lo) return true;
      return o.y - o.top >= pathBottom + ENEMY.READ_GAP; // wholly below the path
    });
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
      const probe = this.makeAlien(rng, { kind: "drifter", sum, x: 0, y: 0, pace: diff });
      const x = fromLeft ? -probe.halfW : GAME.WIDTH + probe.halfW - 1;
      const bandY = rng.int(m.BAND_Y.min, m.BAND_Y.max);
      const alien = this.makeAlien(rng, { kind: "drifter", sum, x, y: bandY, pace: diff, bandY });
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
