import { MATCH, type BotLevel } from "../config/constants";
import { Bot } from "./Bot";
import { Field } from "./Field";
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
}

/** What happened in the match, drained with `takeEvents()`. */
export type MatchEvent =
  /** A player is out; `placement` is final (players alive + 1 at the KO).
   * `by`: the seat that sent the alien that did it (null: the field's own). */
  | { type: "ko"; seat: number; placement: number; by: number | null; step: number }
  /** `from` sent an attack worth `cost` energy to `to`. */
  | { type: "attack"; from: number; to: number; cost: number; step: number }
  /** One player (or none, if the last ones fell together) is left. */
  | { type: "over"; winner: number; step: number };

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
  private events: MatchEvent[] = [];
  private readonly rng: Rng;

  constructor(options: MatchOptions) {
    this.seed = options.seed;
    this.seats = options.seats;
    const lives = options.lives ?? MATCH.LIVES;
    this.fields = this.seats.map(() => new Field({ seed: this.seed, lives }));
    this.bots = this.seats.map((s, seat) => (s === "human" ? null : Bot.forSeat(s, this.seed, seat)));
    this.placements = this.seats.map(() => 0);
    this.rng = Rng.derive(this.seed, MATCH_STREAM);
    this.announceStanding();
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
      // Nobody draws a bot's field; drop its events (the person's scene drains its own).
      if (this.bots[seat]) field.takeEvents();
    });

    this.countKOs();
    if (!this.over) this.deliverAttacks();
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
      const by = this.fields[seat].knockedOutBy?.sentBy ?? null;
      this.events.push({ type: "ko", seat, placement, by, step: this.steps });
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
   * Every attack sent this step goes to an opponent still in the match. For
   * now a random one (M7 adds targeting strategies and picking by hand).
   * Attacks from a player knocked out this step still arrive.
   */
  private deliverAttacks(): void {
    this.fields.forEach((field, from) => {
      for (const attack of field.takeOutgoing()) {
        const opponents = this.alive.filter((seat) => seat !== from);
        if (!opponents.length) return;
        const to = this.rng.pick(opponents);
        this.fields[to].receive({ type: "attack", from, cost: attack.cost, aliens: attack.aliens });
        this.events.push({ type: "attack", from, to, cost: attack.cost, step: this.steps });
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
