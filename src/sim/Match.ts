import { MATCH, type BotLevel, type PowerKind } from "../config/constants";
import { Bot } from "./Bot";
import { Field, type Aim, type FieldSummary } from "./Field";
import type { SentAlien } from "./Swarm";
import { Rng } from "./rng";

/** Key of the match's own random stream (who gets an attack), apart from
 * the fields' and the bots' streams. */
const MATCH_STREAM = 98;

/** Who plays a seat: a bot of some level, or a person driving it from outside
 * (GameScene applies their inputs to `match.fields[seat]`). */
export type Seat = BotLevel | "human";

export interface MatchOptions {
  seed: number;
  seats: readonly Seat[];
  /** Lives per player (battle rule: MATCH.LIVES = 1). */
  lives?: number;
  /** The power a person picked (bots play the default power for now). */
  humanPower?: PowerKind;
}

/** What happened in the match, drained with `takeEvents()`. */
export type MatchEvent =
  /** A player is out; `placement` is final (players alive + 1 at the KO).
   * `by`: who gets the KO credit (null: nobody), and the badge points it
   * earned them. */
  | { type: "ko"; seat: number; placement: number; by: number | null; badges: number; step: number }
  /** `from` sent an attack to `to`: `cost` energy spent, `weight` after the
   * badge/defense bonus (what the receiver must cancel). */
  | { type: "attack"; from: number; to: number; cost: number; weight: number; step: number }
  /** One player (or none, if the last ones fell together) is left. */
  | { type: "over"; winner: number; step: number };

/**
 * What everyone sees of one player: a tile in the opponent strip (desktop) or
 * whatever the phone UI draws. Also what the phase 1 server will broadcast per
 * player, so keep it small; the UI only ever reads this.
 */
export interface PlayerTile extends FieldSummary {
  seat: number;
  who: Seat;
  alive: boolean;
  /** Final place once knocked out (1 = winner), else 0. */
  placement: number;
  /** Badge points (KOs + the badges they took) and the badge level 0–4. */
  badgePoints: number;
  badges: number;
  /** KOs credited to this player, and who knocked them out (null: nobody
   * credited, or still in). */
  kos: number;
  koBy: number | null;
  /** How this player aims, and who they aim at right now (null: nobody). */
  aim: Aim;
  target: number | null;
  /** Players aiming at this one right now. */
  targetedBy: number;
  /** Attack bonus from badges + defense, e.g. 0.5 = +50%. */
  bonus: number;
}

/**
 * A battle-royale match (docs/MULTIPLAYER_DESIGN.md §6): N fields on ONE seed,
 * so every player meets the same base aliens, stepped together at a fixed
 * step. Each field only ever hears from the match through messages
 * (`field.receive`), and the match only reads a field's public state
 * (`knockedOut`, `score`, `summary()`). That seam is the future network
 * protocol: in phase 1 this class moves to the server and the calls become
 * WebSocket messages.
 *
 * Every KO raises the pressure on the players left (`matchPressure`), and so
 * does overtime, so a match always ends.
 *
 * Targeting (M7, Tetris 99): each player aims by a strategy (random, KOs =
 * whoever is closest to falling, attackers = whoever aims at you, badges =
 * whoever has most) or at a seat picked by hand; targets are re-picked every
 * RETARGET_MS. A KO earns the credited player the victim's badge points + 1;
 * badges and being targeted by several players make attacks heavier.
 */
export class Match {
  readonly seed: number;
  readonly seats: readonly Seat[];
  readonly fields: Field[];
  /** The bot playing each seat (null for a person). */
  readonly bots: (Bot | null)[];
  steps = 0;
  /** Final place per seat (1 = the winner); 0 while still playing. */
  readonly placements: number[];
  /** Seats in the order they were knocked out. */
  readonly koOrder: number[] = [];
  over = false;
  /** Who each seat aims at right now (null: nobody left, or knocked out). */
  readonly targets: (number | null)[];
  /** Badge points per seat. */
  readonly badgePoints: number[];
  /** KOs credited per seat, and who knocked each seat out. */
  readonly kos: number[];
  readonly koBy: (number | null)[];
  /** A seat someone is watching: its field's events are left for the viewer
   * to drain (others' are dropped, since nobody draws them). */
  spectate: number | null = null;
  private events: MatchEvent[] = [];
  private readonly rng: Rng;
  private retargetLeftMs: number[];
  /** The last attack each seat received: from whom, at what match time. */
  private readonly lastAttack: ({ from: number; atMs: number } | null)[];

  constructor(options: MatchOptions) {
    this.seed = options.seed;
    this.seats = options.seats;
    const lives = options.lives ?? MATCH.LIVES;
    this.fields = this.seats.map(
      (s) => new Field({ seed: this.seed, lives, power: s === "human" ? options.humanPower : undefined }),
    );
    this.bots = this.seats.map((s, seat) => (s === "human" ? null : Bot.forSeat(s, this.seed, seat)));
    this.placements = this.seats.map(() => 0);
    this.targets = this.seats.map(() => null);
    this.badgePoints = this.seats.map(() => 0);
    this.kos = this.seats.map(() => 0);
    this.koBy = this.seats.map(() => null);
    this.retargetLeftMs = this.seats.map(() => 0);
    this.lastAttack = this.seats.map(() => null);
    this.rng = Rng.derive(this.seed, MATCH_STREAM);
    this.announceStanding();
  }

  /** Badge level 0–4 for some badge points. */
  static badgeLevel(points: number): number {
    return MATCH.BADGE_STEPS.filter((p) => points >= p).length;
  }

  /** Players aiming at `seat` right now. */
  targetedBy(seat: number): number {
    return this.alive.filter((s) => this.targets[s] === seat).length;
  }

  /** Attack bonus of `seat`: its badges, plus defense when several players
   * aim at it. */
  bonus(seat: number): number {
    const badges = Match.badgeLevel(this.badgePoints[seat]) * MATCH.BADGE_BONUS;
    const defense = Math.min(MATCH.DEFENSE_MAX, MATCH.DEFENSE_BONUS * Math.max(0, this.targetedBy(seat) - 1));
    return badges + defense;
  }

  /** Everyone's tile, by seat (see PlayerTile). */
  tiles(): PlayerTile[] {
    return this.fields.map((field, seat) => ({
      ...field.summary(),
      seat,
      who: this.seats[seat],
      alive: this.placements[seat] === 0,
      placement: this.placements[seat],
      badgePoints: this.badgePoints[seat],
      badges: Match.badgeLevel(this.badgePoints[seat]),
      kos: this.kos[seat],
      koBy: this.koBy[seat],
      aim: field.aim,
      target: this.targets[seat],
      targetedBy: this.targetedBy(seat),
      bonus: this.bonus(seat),
    }));
  }

  /** Seats still playing. */
  get alive(): number[] {
    return this.placements.flatMap((p, seat) => (p === 0 ? [seat] : []));
  }

  /** Match time (ms): every field runs on the same clock. */
  get elapsedMs(): number {
    return Math.max(...this.fields.map((f) => f.elapsedMs));
  }

  /**
   * One fixed step for every field: bots decide (they see the field as it is
   * now), then all fields step, then KOs are counted and attacks delivered
   * (they land in the next steps, after the incoming delay). A person's inputs are
   * applied to their field between steps, like a bot's.
   */
  step(dt: number): void {
    if (this.over) return;
    this.steps++;
    this.fields.forEach((field, seat) => {
      if (this.placements[seat] !== 0) return;
      this.bots[seat]?.update(field, dt);
      field.step(dt);
      // Nobody draws a bot's field (unless it is being watched): drop its
      // events. A person's scene drains its own.
      if (this.bots[seat] && seat !== this.spectate) field.takeEvents();
    });

    this.countKOs();
    if (this.over) return;
    this.retarget(dt);
    this.deliverAttacks();
  }

  /**
   * Placement = players alive + 1 at the moment of the KO. Players who fall in
   * the same step are ranked by score (then seat), so places stay unique.
   */
  private countKOs(): void {
    const out = this.alive.filter((seat) => this.fields[seat].knockedOut);
    if (!out.length) return;
    const aliveBefore = this.alive.length;
    out.sort((a, b) => this.fields[b].score - this.fields[a].score || a - b);
    out.forEach((seat, i) => {
      const placement = aliveBefore - out.length + 1 + i;
      this.placements[seat] = placement;
      this.koOrder.push(seat);
      const by = this.koCredit(seat, out);
      const badges = by === null ? 0 : this.badgePoints[seat] + 1;
      this.koBy[seat] = by;
      if (by !== null) {
        this.badgePoints[by] += badges;
        this.kos[by]++;
      }
      this.events.push({ type: "ko", seat, placement, by, badges, step: this.steps });
    });

    const left = this.alive;
    if (left.length <= 1) {
      // The winner is the last one standing, or the best of the last to fall.
      const winner = left[0] ?? this.placements.indexOf(1);
      this.placements[winner] = 1;
      this.over = true;
      this.events.push({ type: "over", winner, step: this.steps });
      return;
    }
    this.announceStanding();
  }

  /**
   * KO credit: the sender of the alien that did it, else the last player who
   * attacked the victim within KO_CREDIT_MS. Only a player still in the match
   * (or who falls in the same step) can take it.
   */
  private koCredit(seat: number, sameStep: readonly number[]): number | null {
    const sender = this.fields[seat].knockedOutBy?.sentBy ?? null;
    const last = this.lastAttack[seat];
    const recent = last && this.elapsedMs - last.atMs <= MATCH.KO_CREDIT_MS ? last.from : null;
    const by = sender ?? recent;
    if (by === null || by === seat) return null;
    return this.placements[by] === 0 || sameStep.includes(by) ? by : null;
  }

  /**
   * Re-pick targets: every RETARGET_MS, and at once when a target is out.
   * Seats are handled in order and each sees the targets picked before it
   * this step, so the result is deterministic.
   */
  private retarget(dt: number): void {
    for (const seat of this.alive) {
      this.retargetLeftMs[seat] -= dt;
      const target = this.targets[seat];
      const lost = target === null || this.placements[target] !== 0;
      if (!lost && this.retargetLeftMs[seat] > 0) continue;
      this.targets[seat] = this.pickTarget(seat);
      this.retargetLeftMs[seat] = MATCH.RETARGET_MS;
    }
  }

  private pickTarget(seat: number): number | null {
    const opponents = this.alive.filter((s) => s !== seat);
    if (!opponents.length) return null;
    const aim = this.fields[seat].aim;
    // The best by a score; ties are broken at random.
    const best = (score: (s: number) => number) => {
      const top = Math.max(...opponents.map(score));
      return this.rng.pick(opponents.filter((s) => score(s) >= top - 1e-9));
    };
    if (typeof aim !== "string") return opponents.includes(aim.seat) ? aim.seat : this.rng.pick(opponents);
    switch (aim) {
      case "random":
        return this.rng.pick(opponents);
      case "kos": {
        // Closest to falling: its most dangerous alien, plus what's incoming.
        return best((s) => {
          const t = this.fields[s].summary();
          return t.danger + Math.min(1, t.incoming / 100);
        });
      }
      case "attackers": {
        const attackers = opponents.filter((s) => this.targets[s] === seat);
        if (!attackers.length) return this.rng.pick(opponents);
        const last = this.lastAttack[seat]?.from;
        return last !== undefined && attackers.includes(last) ? last : this.rng.pick(attackers);
      }
      case "badges":
        return best((s) => this.badgePoints[s]);
    }
  }

  /**
   * Every attack sent this step goes to the sender's current target (picked
   * now if it has none). Badges and defense add weight: the aliens cost more
   * to cancel, and each EXTRA_ALIEN_PER of weight above the cost adds a
   * darter. Attacks from a player knocked out this step still arrive.
   */
  private deliverAttacks(): void {
    this.fields.forEach((field, from) => {
      for (const attack of field.takeOutgoing()) {
        let to = this.targets[from];
        if (to === null || this.placements[to] !== 0 || to === from) {
          to = this.pickTarget(from);
          if (this.placements[from] === 0) this.targets[from] = to;
        }
        if (to === null) return;
        const weight = attack.cost * MATCH.ATTACK_MULT * (1 + this.bonus(from));
        const extra = Math.floor(Math.max(0, weight - attack.cost) / MATCH.EXTRA_ALIEN_PER + 1e-9);
        const aliens: SentAlien[] = [
          ...attack.aliens,
          ...Array.from({ length: extra }, (): SentAlien => ({ kind: "darter", ability: null })),
        ];
        this.fields[to].receive({ type: "attack", from, cost: weight, aliens });
        this.lastAttack[to] = { from, atMs: this.elapsedMs };
        this.events.push({ type: "attack", from, to, cost: attack.cost, weight, step: this.steps });
      }
    });
  }

  /** Events since the last call, oldest first. */
  takeEvents(): MatchEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  /** Tell every field still playing how many are left (the pressure). */
  private announceStanding(): void {
    const alive = this.alive;
    for (const seat of alive) {
      this.fields[seat].receive({ type: "standing", alive: alive.length, total: this.seats.length });
    }
  }
}
