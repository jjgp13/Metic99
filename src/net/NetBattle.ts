import { NET, type PowerKind } from "../config/constants";
import type { BattleSource } from "../sim/BattleSource";
import { Field, type MatchMessage } from "../sim/Field";
import { fingerprint } from "../sim/fingerprint";
import type { MatchEvent, PlayerTile, Seat } from "../sim/Match";
import type { NetClient } from "./NetClient";
import type { ServerMessage, WireEntry } from "./protocol";

/** The `start` message: everything needed to build your field like the server did. */
export type StartInfo = Extract<ServerMessage, { t: "start" }>;

/**
 * An online match on this device (docs/NETCODE.md, S4): the client half of
 * option A.
 *
 * - **Prediction:** your field runs HERE, at once, built exactly like the
 *   server's copy (same seed, lives, power). Your keys never wait for the
 *   network.
 * - **Inputs out:** every input your field logs goes to the server tagged
 *   with its step, with how far you've played (`upTo`), every frame you act
 *   and at least every NET.SEND_EVERY_MS.
 * - **Messages in:** attacks and standing from the server are applied at
 *   your next step, and you report "message seq N at step S", so the
 *   server's copy applies it at the same step: no rollback ever needed.
 * - **Checks:** every FINGERPRINT_EVERY steps you send your field's
 *   fingerprint; the server compares it with its copy's (S0).
 * - **Everyone else:** tiles (10 Hz) and match events come from the server;
 *   your own tile is replaced by your live field, so it never lags.
 */
export class NetBattle implements BattleSource {
  readonly field: Field;
  readonly you: number;
  readonly online = true;
  readonly seats: { who: Seat; name?: string }[];
  kicked: string | null = null;
  /** Desyncs the server reported (should stay 0). */
  desyncs = 0;

  private inbox: { seq: number; message: MatchMessage }[] = [];
  private events: MatchEvent[] = [];
  private lastTiles: PlayerTile[] | null = null;
  private readonly placements: number[];
  /** Log entries already sent, and the message seqs applied (in log order). */
  private logCursor = 0;
  private appliedSeqs: number[] = [];
  private messagesSeen = 0;
  private checks: { step: number; hash: string }[] = [];
  private lastSentAt = -Infinity;
  private lastSentUpTo = -1;
  private readonly stopListening: () => void;
  /** A blank field's summary, for opponents before the first tiles arrive. */
  private readonly blank = new Field({ seed: 0 }).summary();

  constructor(
    private readonly client: NetClient,
    start: StartInfo,
  ) {
    this.you = start.you;
    this.seats = start.seats;
    this.field = new Field({ seed: start.seed, lives: start.lives, power: start.power as PowerKind });
    this.placements = start.seats.map(() => 0);
    this.stopListening = client.on((m) => this.onServer(m));
  }

  get seatCount(): number {
    return this.seats.length;
  }

  /** Apply the server's messages that arrived, then one rule step. */
  step(dt: number): void {
    for (const { seq, message } of this.inbox) {
      const logged = this.field.inputLog.length;
      this.field.receive(message);
      // A knocked-out field ignores messages (and logs nothing): no report.
      if (this.field.inputLog.length > logged) this.appliedSeqs.push(seq);
    }
    this.inbox = [];
    this.field.step(dt);
    // Attacks you send are delivered by the server's copy of your field, not
    // from here: just empty the outbox.
    this.field.takeOutgoing();
    if (this.field.steps % NET.FINGERPRINT_EVERY === 0) {
      this.checks.push({ step: this.field.steps, hash: fingerprint(this.field) });
    }
  }

  /** Send what's new: log entries, how far we've played, fingerprints. */
  poll(): void {
    const now = performance.now();
    const log = this.field.inputLog;
    const entries: WireEntry[] = [];
    for (; this.logCursor < log.length; this.logCursor++) {
      const { step, input } = log[this.logCursor];
      if (input.type === "standing" || input.type === "attack") {
        entries.push({ step, seq: this.appliedSeqs[this.messagesSeen++] });
      } else {
        entries.push({ step, input });
      }
    }
    const upTo = this.field.steps;
    const due = now - this.lastSentAt >= NET.SEND_EVERY_MS && upTo !== this.lastSentUpTo;
    if (entries.length || due) {
      this.client.send({ t: "inputs", upTo, entries });
      this.lastSentAt = now;
      this.lastSentUpTo = upTo;
    }
    for (const check of this.checks) this.client.send({ t: "check", ...check });
    this.checks = [];
  }

  takeEvents(): MatchEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  tiles(): PlayerTile[] {
    const tiles =
      this.lastTiles ??
      this.seats.map(
        (s, seat): PlayerTile => ({
          ...this.blank,
          seat,
          who: s.who,
          name: s.name,
          alive: true,
          placement: 0,
          badgePoints: 0,
          badges: 0,
          aim: "random",
          target: null,
          targetedBy: 0,
          bonus: 0,
        }),
      );
    // Your own tile from your live field (the server's copy runs behind).
    return tiles.map((t) => (t.seat === this.you ? { ...t, ...this.field.summary() } : t));
  }

  placementOf(seat: number): number {
    return this.placements[seat] ?? 0;
  }

  /** Stop listening to the server (the match is over and left behind). */
  dispose(): void {
    this.stopListening();
  }

  private onServer(m: ServerMessage): void {
    switch (m.t) {
      case "msg":
        this.inbox.push({ seq: m.seq, message: m.message });
        break;
      case "tiles":
        this.lastTiles = m.tiles;
        m.tiles.forEach((t) => (this.placements[t.seat] = t.placement));
        break;
      case "event":
        this.events.push(m.event);
        if (m.event.type === "ko") this.placements[m.event.seat] = m.event.placement;
        if (m.event.type === "over") this.placements[m.event.winner] = 1;
        break;
      case "desync":
        this.desyncs++;
        console.warn(`[net] desync at step ${m.step}: mine ${m.yours}, server ${m.server}`);
        break;
      case "kicked":
        this.kicked = m.reason;
        break;
    }
  }
}
