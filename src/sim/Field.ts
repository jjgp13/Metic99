import {
  ABILITY,
  BULLET,
  FEEDBACK,
  GAME,
  MONSTERS,
  PLAYER,
  RECOVERY,
  POWER_KINDS,
  SCORE,
  SEND,
  type AlienKind,
  type PowerKind,
  type TargetStrategy,
} from "../config/constants";
import { difficultyAt, matchPressure, suddenDeathSpeed, type DifficultyParams } from "../config/difficulty";
import type Alien from "../objects/Alien";
import { ABILITY_KINDS, type AbilityKind } from "../objects/abilities";
import type { Bullet } from "../objects/Bullet";
import { EnergyMeter, Power, energyForKill, type PowerUse } from "./energy";
import { Rng } from "./rng";
import { STREAM, Swarm, type SentAlien } from "./Swarm";

const PLAYER_START_X = GAME.WIDTH / 2;

/** Longest answer that can be typed (results stay in 0–99). */
export const ANSWER_MAX_DIGITS = 2;

/**
 * Everything a player can do to their field (docs/MULTIPLAYER_DESIGN.md §9,
 * "player inputs"). The keypad, keyboard, drawing pad and bots all turn into
 * these, and later they are what a client sends to the server.
 */
export type FieldInput =
  /** One or more digits appended to the answer (the pad and bots send several
   * at once, so "12" never passes through "1"). Ignored if they don't fit. */
  | { type: "digits"; digits: string }
  | { type: "back" }
  | { type: "clear" }
  /** Press POWER: use the player's picked power (a time power toggles). */
  | { type: "power" }
  /** Battle: spend `cost` energy on the SEND tier with that cost. */
  | { type: "send"; cost: number }
  /** Battle: aim attacks by a strategy, or at one opponent's seat by hand. */
  | { type: "target"; aim: Aim };

/** Where a player's attacks go: a Tetris 99 strategy, or one seat. */
export type Aim = TargetStrategy | { seat: number };

/**
 * What the match tells a field (docs/MULTIPLAYER_DESIGN.md §8, the Match ↔
 * Field seam). Offline it is a method call; in phase 1 the server sends it.
 * It is logged with the player's inputs, so a battle field replays from its
 * seed and its log alone. Attacks (M6) will be another message.
 */
export type MatchMessage =
  /** Players still in the match (sent at the start and after every KO). */
  | { type: "standing"; alive: number; total: number }
  /** Aliens another player sent (an attack): they join the incoming queue. */
  | { type: "attack"; from: number; cost: number; aliens: SentAlien[] };

/** An attack this field sent; the match picks who gets it. */
export interface Outgoing {
  cost: number;
  aliens: SentAlien[];
}

/** One sent alien waiting to land. Kill energy pays off `left` first; at 0
 * it is cancelled. */
export interface Incoming {
  from: number;
  alien: SentAlien;
  cost: number;
  left: number;
  landsAtMs: number;
}

/** One entry of a field's log: a player input or a message from the match. */
export interface LoggedInput {
  step: number;
  input: FieldInput | MatchMessage;
}

/**
 * What the other players see of a field (a tile in the opponent strip), and
 * what the server will broadcast per player. Small on purpose.
 */
export interface FieldSummary {
  score: number;
  kills: number;
  knockedOut: boolean;
  /** 0 = calm, 1 = an unanswered alien is at the player line. */
  danger: number;
  /** Energy of the attacks still waiting to land. */
  incoming: number;
  /** Power meter and attack gauge, 0–1. */
  energy: number;
  attack: number;
  /** The player's power, and whether it is on (time) or armed (shield). */
  power: PowerKind;
  powerOn: boolean;
  /** Aliens on screen, as 0–1 positions on the field (the tile's dots);
   * `sent` marks an attack from another player. */
  aliens: { x: number; y: number; sent: boolean }[];
}

/** match = an alien has this answer; typing = one could still (a longer answer
 * starts with it); wrong = no alien's answer can. */
export type AnswerState = "typing" | "match" | "wrong";

/** The number the answer display (and the answer stars) show. */
export interface AnswerView {
  text: string;
  state: AnswerState;
}

/**
 * What happened, for the scene to show and play (and later for the match to
 * count). Drained with `takeEvents()` after each step.
 */
export type FieldEvent =
  | { type: "spawned"; alien: Alien }
  | { type: "fired"; bullet: Bullet }
  /** A correct answer landed. `absorbed`: an ability took it (a shield broke
   * and the alien lives on with a new sum). `digits` is the solved sum. */
  | {
      type: "solved";
      alien: Alien;
      digits: readonly number[];
      points: number;
      /** Energy actually stored (overflow past the max is lost; 0 while a
       * time power runs, since powers never pay for themselves). */
      energy: number;
      /** Drifter bonus energy included in `energy`'s gain (0 otherwise). */
      burst: number;
      absorbed: boolean;
      /** Battle: kill value that paid off incoming attacks, and what the rest
       * stored in the attack gauge. */
      cancelled: number;
      attack: number;
    }
  /** This field sent an attack (the match delivers it). */
  | { type: "sent"; cost: number; aliens: SentAlien[] }
  /** An attack arrived in the incoming queue. */
  | { type: "incoming"; from: number; cost: number }
  /** A lethal alien reached the player line (it is already removed). */
  | { type: "hit"; alien: Alien; livesLeft: number }
  /** The power was pressed and did something. */
  | { type: "power"; use: PowerUse }
  /** BLAST destroyed these aliens (already removed): no score, no energy. */
  | { type: "blasted"; aliens: Alien[] }
  /** An armed SHIELD destroyed this alien at the ship instead of a life. */
  | { type: "shielded"; alien: Alien }
  | { type: "knockedOut" };

/** One kill: how many balls its sum had and how long it took (spawn → hit). */
export interface Solve {
  balls: number;
  ms: number;
}

export interface FieldOptions {
  seed: number;
  /** Lives for this run (solo: PLAYER.LIVES; battle: 1). */
  lives?: number;
  /** Dev play-testing: every allowed spawn gets one of these abilities. */
  forcedAbilities?: AbilityKind[] | null;
  /** Testing: every 2-ball spawn without an ability is one of these kinds. */
  forcedKinds?: AlienKind[] | null;
  /** The power picked before the run (default: the first of POWER_KINDS). */
  power?: PowerKind;
}

/**
 * One player's whole field, free of Phaser and rendering, so the same code runs
 * in the browser, in bots and on a future server (docs/MULTIPLAYER_DESIGN.md
 * §8). It changes only through `apply(input)` and `step(dt)`:
 *
 *   same seed + same inputs at the same steps  →  same run
 *
 * Every input is logged with the step it arrived at (`inputLog`), so a run can
 * be replayed exactly (`replayField`). The aliens live in a `Swarm`; this adds
 * the ship, bullets, typed answer, score, lives, energy and the power.
 */
export class Field {
  readonly seed: number;
  /** Steps run so far (the input log's clock). */
  steps = 0;
  readonly inputLog: LoggedInput[] = [];

  shipX = PLAYER_START_X;
  /** shipX before the last step, for drawing between steps. */
  prevShipX = PLAYER_START_X;
  bullets: Bullet[] = [];
  /** The alien the ship is going for: the locked one, else the typed answer's. */
  target: Alien | null = null;
  /** Once fired upon, a target stays locked until destroyed, independent of
   * the typed string, so a committed kill never turns back. */
  lockedTarget: Alien | null = null;
  /** The typed answer (digits only). */
  typed = "";

  score = 0;
  lives: number;
  knockedOut = false;
  /** The alien that ended the run (M7: its sender gets the KO credit). */
  knockedOutBy: Alien | null = null;
  /** Kill streak without a hit (scores and charges more). */
  combo = 0;
  kills = 0;
  bestCombo = 0;
  fastestSolveMs = Infinity;
  /** Every kill's solve time (spawn → hit), to compare players and bots. */
  readonly solves: Solve[] = [];

  readonly energy = new EnergyMeter();
  /** Battle: the attack gauge. Kills fill it (after paying off incoming); only
   * SEND spends it, so attacking never costs the power's fuel. */
  readonly attack = new EnergyMeter(SEND.GAUGE_MAX);
  readonly power: Power;
  /** Hit recovery: the field is frozen while > 0 (a countdown, so pausing the
   * scene can't eat it), then runs at POST_HIT_FACTOR for the rest of the run. */
  freezeLeftMs = 0;
  private postHitSlow = false;
  /** Players still in the battle, from the match (null in solo play). */
  standing: { alive: number; total: number } | null = null;
  /** Battle: where this player's attacks go (the match reads it). */
  aim: Aim = "random";
  /** Sent aliens waiting to land, soonest first. */
  readonly incoming: Incoming[] = [];
  /** Kill energy spent cancelling attacks, this run. */
  cancelledTotal = 0;
  private outgoing: Outgoing[] = [];
  /** What this field's attacks carry (which ability a 50 sends). */
  private readonly sendRng: Rng;

  private readonly swarm: Swarm;
  /** The in-flight bullet aimed at lockedTarget: no second shot while one is on
   * its way (re-fires only if it misses). */
  private lockedBullet: Bullet | null = null;
  /** Game-clock time of the last shot (-Infinity: the first shot is free). */
  private lastFire = -Infinity;
  /** A wrong answer clears itself: the text it was, and the time left. */
  private wrongText: string | null = null;
  private wrongLeftMs = 0;
  private events: FieldEvent[] = [];

  constructor(options: FieldOptions) {
    this.seed = options.seed;
    this.lives = options.lives ?? PLAYER.LIVES;
    this.power = new Power(options.power ?? POWER_KINDS[0]);
    this.swarm = new Swarm({
      seed: options.seed,
      forcedAbilities: options.forcedAbilities,
      forcedKinds: options.forcedKinds,
    });
    this.sendRng = Rng.derive(options.seed, STREAM.SEND);
  }

  /** The SEND tier a tap buys now: the strongest affordable, else null. */
  sendTier(): number | null {
    if (!this.standing) return null;
    const tiers = SEND.TIERS.filter((t) => this.attack.canSpend(t.COST));
    return tiers.length ? tiers[tiers.length - 1].COST : null;
  }

  /** Attacks sent since the last call (the match delivers them). */
  takeOutgoing(): Outgoing[] {
    const out = this.outgoing;
    this.outgoing = [];
    return out;
  }

  get aliens(): readonly Alien[] {
    return this.swarm.aliens;
  }

  /** The game clock (ms of play). */
  get elapsedMs(): number {
    return this.swarm.elapsedMs;
  }

  get difficulty(): DifficultyParams {
    return difficultyAt(this.swarm.elapsedMs, this.score, this.dMatch);
  }

  /** Battle pressure on this field (0 in solo play). */
  get dMatch(): number {
    const s = this.standing;
    return s ? matchPressure(this.swarm.elapsedMs, s.alive, s.total) : 0;
  }

  /** The live alien whose answer is `result`, if any. */
  alienFor(result: number): Alien | undefined {
    return this.swarm.alienFor(result);
  }

  /** The typed number and how it reads; with nothing typed, the locked answer
   * stays shown until its alien is destroyed. */
  answerView(): AnswerView | null {
    if (this.typed !== "") return { text: this.typed, state: this.typedState() };
    const lock = this.lockedTarget;
    return lock?.active ? { text: String(lock.result), state: "match" } : null;
  }

  /**
   * The player did something. Applied at once and logged with the current
   * step, which replays identically: an input between steps N and N+1 counts
   * as the start of step N+1. Returns whether it changed anything.
   */
  apply(input: FieldInput): boolean {
    if (this.knockedOut) return false;
    this.inputLog.push({ step: this.steps, input });
    let changed = true;
    switch (input.type) {
      case "digits":
        changed =
          /^\d+$/.test(input.digits) &&
          this.typed.length + input.digits.length <= ANSWER_MAX_DIGITS;
        if (changed) this.typed += input.digits;
        break;
      case "back":
        this.typed = this.typed.slice(0, -1);
        break;
      case "clear":
        this.typed = "";
        break;
      case "power": {
        const use = this.power.trigger(this.energy);
        changed = use !== null;
        if (use) this.events.push({ type: "power", use });
        if (use === "blast") this.blast();
        break;
      }
      case "send":
        changed = this.send(input.cost);
        break;
      case "target":
        changed = this.standing !== null;
        if (changed) this.aim = input.aim;
        break;
    }
    this.checkTyped();
    return changed;
  }

  /** A message from the match. Logged like an input (it changes the run). */
  receive(message: MatchMessage): void {
    if (this.knockedOut) return;
    this.inputLog.push({ step: this.steps, input: message });
    switch (message.type) {
      case "standing":
        this.standing = { alive: message.alive, total: message.total };
        break;
      case "attack": {
        const cost = message.cost / message.aliens.length;
        const delay = SEND.DELAY_MS.easy + (SEND.DELAY_MS.hard - SEND.DELAY_MS.easy) * this.dMatch;
        message.aliens.forEach((alien, i) => {
          const landsAtMs = this.elapsedMs + delay + i * SEND.STAGGER_MS;
          this.incoming.push({ from: message.from, alien, cost, left: cost, landsAtMs });
        });
        this.incoming.sort((a, b) => a.landsAtMs - b.landsAtMs);
        this.events.push({ type: "incoming", from: message.from, cost: message.cost });
        break;
      }
    }
  }

  /** What the other players see of this field. */
  summary(): FieldSummary {
    let danger = 0;
    const aliens = [];
    for (const a of this.aliens) {
      if (!a.active) continue;
      aliens.push({ x: a.x / GAME.WIDTH, y: Math.max(0, a.y) / PLAYER.Y, sent: a.sentBy !== null });
      if (a.lethal && a !== this.lockedTarget) danger = Math.max(danger, a.y / PLAYER.Y);
    }
    return {
      score: this.score,
      kills: this.kills,
      knockedOut: this.knockedOut,
      danger: Math.min(1, Math.max(0, danger)),
      incoming: this.incoming.reduce((t, a) => t + a.left, 0),
      energy: this.energy.fraction,
      attack: this.attack.fraction,
      power: this.power.kind,
      powerOn: this.power.running || this.power.shieldArmed,
      aliens,
    };
  }

  /** Advance the rules by `dt` ms (always SIM.STEP_MS in play). */
  step(dt: number): void {
    if (this.knockedOut) return;
    this.steps++;

    // After a hit the field FREEZES for a few seconds (factor 0), then resumes at
    // POST_HIT_FACTOR for the rest of the run. The difficulty timer keeps running
    // underneath, so absolute speed still climbs over time. A time power
    // multiplies on top; it holds (no drain) while the hit freeze already stops
    // the field.
    const hitFrozen = this.freezeLeftMs > 0;
    if (hitFrozen) this.freezeLeftMs -= dt;
    const slowFactor = this.power.update(dt, this.energy, hitFrozen);
    const suddenDeath = this.standing ? suddenDeathSpeed(this.elapsedMs) : 1;
    const speed = hitFrozen ? 0 : slowFactor * (this.postHitSlow ? RECOVERY.POST_HIT_FACTOR : 1) * suddenDeath;

    // Resolve the current target. A locked target (already fired upon) stays
    // committed until it is destroyed; otherwise the typed number picks one.
    if (this.lockedTarget?.active) {
      this.target = this.lockedTarget;
    } else {
      this.lockedTarget = null;
      this.target = this.typed === "" ? null : (this.alienFor(parseInt(this.typed, 10)) ?? null);
    }

    this.landIncoming();

    // Spawn, run ability clocks and move the aliens. The target holds still.
    this.swarm.step(dt, {
      score: this.score,
      dMatch: this.dMatch,
      speed,
      held: this.target,
      locked: this.lockedTarget,
    });
    for (const e of this.swarm.takeEvents()) {
      if (e.type === "spawned") this.events.push(e);
      else if (this.power.absorbHit()) this.events.push({ type: "shielded", alien: e.alien });
      else this.loseLife(e.alien);
    }
    if (this.knockedOut) return;

    // Slide the ship toward the target and fire when lined up. Don't fire again
    // while a bullet is already in flight toward this locked target — only
    // re-fire if that shot missed (its bullet was recycled off-screen).
    this.prevShipX = this.shipX;
    if (this.target?.active) {
      this.shipX += (this.target.x - this.shipX) * PLAYER.MOVE_LERP;
      const shotInFlight =
        this.lockedTarget === this.target && this.lockedBullet?.active === true;
      if (
        !shotInFlight &&
        Math.abs(this.shipX - this.target.x) < PLAYER.SHOOT_RANGE &&
        this.elapsedMs - this.lastFire > PLAYER.FIRE_COOLDOWN
      ) {
        this.fire(this.target);
      }
    }

    this.moveBullets(dt);

    // Drop killed aliens and spent bullets.
    this.swarm.prune();
    this.bullets = this.bullets.filter((b) => b.active);

    // Aliens come and go, so an answer can turn right or wrong without a key;
    // a wrong one clears itself after a moment.
    this.checkTyped();
    if (this.wrongText !== null) {
      this.wrongLeftMs -= dt;
      if (this.wrongLeftMs <= 0) {
        this.typed = "";
        this.wrongText = null;
      }
    }
  }

  /** Events since the last call, oldest first. */
  takeEvents(): FieldEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  // ---------------------------------------------------------------------------
  // Battle: sending and receiving attacks
  // ---------------------------------------------------------------------------
  /** Spend energy on a SEND tier: its aliens go out through takeOutgoing(). */
  private send(cost: number): boolean {
    const tier = SEND.TIERS.find((t) => t.COST === cost);
    if (!this.standing || !tier || !this.attack.spend(cost, "send")) return false;
    const aliens = tier.ALIENS.map((k): SentAlien => {
      if (k === "darter") return { kind: "darter", ability: null };
      const ability = this.sendRng.pick(ABILITY_KINDS);
      return { kind: ABILITY.KIND[ability], ability };
    });
    this.outgoing.push({ cost, aliens });
    this.events.push({ type: "sent", cost, aliens });
    return true;
  }

  /** Sent aliens whose time is up enter the field; one without room waits. */
  private landIncoming(): void {
    for (let i = 0; i < this.incoming.length; ) {
      const a = this.incoming[i];
      if (a.landsAtMs > this.elapsedMs) break; // sorted: the rest land later
      if (this.swarm.spawnSent(a.alien, a.from)) this.incoming.splice(i, 1);
      else i++;
    }
  }

  /** Kill energy pays off incoming attacks first, soonest first; returns
   * what is left for the meter. */
  private cancelIncoming(energy: number): number {
    while (energy > 0 && this.incoming.length) {
      const next = this.incoming[0];
      const paid = Math.min(energy, next.left);
      next.left -= paid;
      energy -= paid;
      this.cancelledTotal += paid;
      if (next.left <= 1e-9) this.incoming.shift();
    }
    return energy;
  }

  // ---------------------------------------------------------------------------
  // Answer
  // ---------------------------------------------------------------------------
  private typedState(): AnswerState {
    if (this.alienFor(parseInt(this.typed, 10))) return "match";
    const canGrow =
      this.typed.length < ANSWER_MAX_DIGITS &&
      [...this.swarm.results()].some((r) => String(r).startsWith(this.typed));
    return canGrow ? "typing" : "wrong";
  }

  /** Start the wrong-answer countdown when the typed text turns wrong. */
  private checkTyped(): void {
    const wrong = this.typed !== "" && this.typedState() === "wrong";
    if (!wrong) this.wrongText = null;
    else if (this.wrongText !== this.typed) {
      this.wrongText = this.typed;
      this.wrongLeftMs = FEEDBACK.WRONG_CLEAR_MS;
    }
  }

  // ---------------------------------------------------------------------------
  // Combat
  // ---------------------------------------------------------------------------
  private fire(target: Alien): void {
    this.lastFire = this.elapsedMs;
    const muzzleY = PLAYER.Y - BULLET.MUZZLE_OFFSET;
    const bullet: Bullet = { x: this.shipX, y: muzzleY, prevY: muzzleY, active: true, target };
    this.bullets.push(bullet);
    this.events.push({ type: "fired", bullet });
    // Clear the typed answer once committed to a shot, but keep the target
    // LOCKED until a bullet actually destroys it.
    this.lockedTarget = target;
    this.lockedBullet = bullet;
    this.typed = "";

    // If the locked target sits at/below the muzzle, an upward bullet can't
    // reach it, so resolve the hit point-blank to guarantee the kill.
    if (target.y >= muzzleY) this.onBulletHit(bullet, target);
  }

  /**
   * Fly bullets upward and resolve hits. The hit test is swept over the distance
   * travelled this step, so a fast bullet can't tunnel through an alien. A
   * bullet only hits the alien whose answer fired it and flies through every
   * other one: results are unique, so only the solved alien can die (or lose
   * its shield).
   */
  private moveBullets(dt: number): void {
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.prevY = b.y;
      b.y -= BULLET.SPEED * (dt / 1000);
      const a = b.target;
      const hit =
        a !== null &&
        a.active &&
        Math.abs(b.x - a.x) < BULLET.HIT_HALF_W &&
        a.y >= b.y - BULLET.HIT_HALF_H &&
        a.y <= b.prevY + BULLET.HIT_HALF_H;
      if (hit) this.onBulletHit(b, a);
      else if (b.y < -20) b.active = false; // flew off the top
    }
  }

  /**
   * A correct answer landed. It scores, charges energy (unless a time power
   * runs) and extends the streak.
   * If an ability absorbs it (a shield broke and rolled a new sum) the alien
   * lives on and the lock is released so its new sum can be targeted.
   */
  private onBulletHit(bullet: Bullet, alien: Alien): void {
    if (!alien.active) return;
    bullet.active = false;
    // Read the solved sum before an ability rerolls it.
    const digits = alien.digits;
    const solveMs = this.elapsedMs - alien.spawnedAt;
    const absorbed = alien.ability?.onHit(alien, this.swarm) ?? false;

    // Extend the streak first so this answer is scored with its own multiplier.
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (!absorbed) {
      this.kills += 1;
      this.fastestSolveMs = Math.min(this.fastestSolveMs, solveMs);
      this.solves.push({ balls: digits.length, ms: solveMs });
    }

    const abilityMult = !absorbed && alien.ability ? ABILITY.SCORE_MULT[alien.ability.kind] : 1;
    const points = Math.round(this.computeScore(digits.length, solveMs) * abilityMult);
    this.score += points;
    // The bonus drifter adds its burst on top of the normal kill energy.
    const burst = alien.lethal ? 0 : MONSTERS.drifter.ENERGY_BURST;
    // Powers never pay for themselves: a kill while a time power runs charges
    // nothing (no energy, no cancel, no attack). Otherwise the kill charges the
    // power meter in full, and in a battle its value (the drifter's burst is
    // power energy only) pays off incoming attacks first; the rest fills the
    // attack gauge, which only SEND spends.
    const kill = this.power.running ? 0 : energyForKill({ digits, solveMs, combo: this.combo });
    const energy = kill > 0 ? this.energy.charge(kill + burst) : 0;
    const left = this.standing ? this.cancelIncoming(kill) : 0;
    const attack = left > 0 ? this.attack.charge(left) : 0;

    if (this.lockedTarget === alien) {
      this.lockedTarget = null;
      this.lockedBullet = null;
    }
    if (!absorbed) {
      this.swarm.remove(alien);
      // After remove() so the dead alien doesn't block its own splitlings' lanes.
      alien.ability?.onKilled(alien, this.swarm);
    }
    const cancelled = this.standing ? kill - left : 0;
    this.events.push({ type: "solved", alien, digits, points, energy, burst, absorbed, cancelled, attack });
  }

  /**
   * BLAST: every alien on the field is destroyed. Nothing scores or charges,
   * the streak is untouched, and splitters don't split (their onKilled is
   * skipped). A shot in flight at one of them just flies off.
   */
  private blast(): void {
    const aliens = this.aliens.filter((a) => a.active);
    for (const a of aliens) this.swarm.remove(a);
    this.lockedTarget = null;
    this.lockedBullet = null;
    this.target = null;
    this.typed = "";
    this.events.push({ type: "blasted", aliens });
  }

  /** points = BASE * ballCountBonus * speedBonus * difficultyMult * comboMult. */
  private computeScore(ballCount: number, solveMs: number): number {
    const ballBonus = SCORE.BALL_COUNT_BONUS[ballCount] ?? 1;

    const span = SCORE.SLOW_MS - SCORE.FAST_MS;
    const t = Math.min(1, Math.max(0, (solveMs - SCORE.FAST_MS) / span));
    const speedBonus = SCORE.FAST_MULT + (SCORE.SLOW_MULT - SCORE.FAST_MULT) * t;

    const difficultyMult = 1 + this.difficulty.d;
    const comboMult = Math.min(SCORE.COMBO_MAX, 1 + (this.combo - 1) * SCORE.COMBO_STEP);

    return Math.round(SCORE.BASE * ballBonus * speedBonus * difficultyMult * comboMult);
  }

  private loseLife(alien: Alien): void {
    // Two aliens can reach the player in the same step; only the first of them
    // on the last life ends the run (the second used to end it again).
    if (this.knockedOut) return;
    this.lives = Math.max(0, this.lives - 1);
    this.combo = 0; // a hit breaks the streak
    this.events.push({ type: "hit", alien, livesLeft: this.lives });
    if (this.lives <= 0) {
      this.knockedOut = true;
      this.knockedOutBy = alien;
      this.events.push({ type: "knockedOut" });
      return;
    }
    // Freeze the whole field for a few seconds so the player can recover, then
    // run at a reduced speed for the rest of the run (difficulty keeps ramping).
    this.freezeLeftMs = RECOVERY.FREEZE_MS;
    this.postHitSlow = true;
  }
}

/**
 * Re-run a field from its seed and input log: the replay and the original
 * match exactly (the basis for bug reports now and server checks later).
 */
export function replayField(
  options: FieldOptions,
  log: readonly LoggedInput[],
  steps: number,
  dt: number,
): Field {
  const field = new Field(options);
  let next = 0;
  for (let i = 0; i <= steps; i++) {
    while (next < log.length && log[next].step === i) feed(field, log[next++].input);
    if (i < steps) field.step(dt);
  }
  return field;
}

/** Hand a logged entry back to the field the way it first arrived. */
export function feed(field: Field, input: FieldInput | MatchMessage): void {
  if (input.type === "standing" || input.type === "attack") field.receive(input);
  else field.apply(input);
}
