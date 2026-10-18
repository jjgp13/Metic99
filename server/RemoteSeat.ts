import { NET, SIM } from "../src/config/constants";
import type { MatchMessage } from "../src/sim/Field";
import type { Field } from "../src/sim/Field";
import { fingerprint } from "../src/sim/fingerprint";
import type { WireEntry } from "../src/net/protocol";
import type { Player } from "./Player";

/**
 * The server's side of one person in a match (docs/NETCODE.md, S3).
 *
 * The person plays their field on their own device at once (no waiting for
 * the network). The server keeps a COPY of that field and advances it only
 * from what the device reports: its inputs, each tagged with its step, and
 * how far it has played (`upTo`). Same seed + same inputs + deterministic
 * rules (S0) = the same state, so the server knows the person's field
 * without trusting anything but their inputs. Its copy runs a little behind
 * (by the network delay), and that's fine: KOs and attacks are decided from
 * it a fraction of a second later.
 *
 * Messages the match sends this field (attacks, standing) take a round
 * trip: the server sends them numbered (`seq`), the device applies each one
 * at its next step and reports "seq N at step S", and the copy applies the
 * server's own copy of message N at step S. The device picks the step, so
 * it never has to undo anything; the server checks it doesn't take too long.
 *
 * What the server checks (it never trusts a client):
 * - steps only move forward, and never ahead of real time (no speed hack);
 * - message reports come in order, and on time (no dodging attacks);
 * - inputs are only ones a player can make (protocol.ts), and the copy's own
 *   rules decide what they do (a SEND without energy does nothing here).
 */
export class RemoteSeat {
  /** Steps the device says it has played (the copy has run this far). */
  ackedStep = 0;
  /** When we last heard from the device (ms, server clock). */
  lastHeardAt: number;
  /** Set when the seat was handed to a bot (with the reason). */
  replaced: string | null = null;

  private nextSeq = 0;
  /** Sent, not yet applied by the device: seq → message and the device's step then. */
  private readonly pending = new Map<number, { message: MatchMessage; sentAtStep: number }>();
  /** The next seq the device must report (they're applied in order). */
  private nextApplied = 0;
  /** Our copy's fingerprints, and the device's, by step (to compare). */
  private readonly ours = new Map<number, string>();
  private readonly theirs = new Map<number, string>();
  /** Desyncs found (should stay 0: the S0 work makes the copies equal). */
  desyncs = 0;

  constructor(
    readonly seat: number,
    readonly player: Player,
    readonly field: Field,
    now: number,
  ) {
    this.lastHeardAt = now;
  }

  /** Send a match message to the device (numbered; it reports when applied). */
  send(message: MatchMessage): void {
    const seq = this.nextSeq++;
    this.pending.set(seq, { message, sentAtStep: this.ackedStep });
    this.player.send({ t: "msg", seq, message });
  }

  /**
   * The device's log since its last report. Returns null if all is well,
   * else why the report is refused (the caller then replaces the player).
   * `dueStep` = the steps real time says the device has played by now: it
   * may be up to MAX_AHEAD_STEPS ahead (network jitter) and MAX_BEHIND_STEPS
   * behind (a slow-motion client gets more thinking time).
   */
  receive(upTo: number, entries: WireEntry[], dueStep: number, now: number): string | null {
    const maxStep = dueStep + NET.MAX_AHEAD_STEPS;
    if (this.replaced) return null;
    this.lastHeardAt = now;
    if (upTo < this.ackedStep) return "step went backwards";
    if (upTo > maxStep) return "ahead of real time (speed hack?)";
    let last = this.ackedStep;
    for (const entry of entries) {
      if (entry.step < last || entry.step > upTo) return "entry out of order";
      last = entry.step;
      this.advanceTo(entry.step);
      if ("seq" in entry) {
        if (entry.seq !== this.nextApplied) return "message reported out of order";
        const sent = this.pending.get(entry.seq);
        if (!sent) return "unknown message";
        this.pending.delete(entry.seq);
        this.nextApplied++;
        this.field.receive(sent.message);
      } else {
        this.field.apply(entry.input);
      }
    }
    this.advanceTo(upTo);
    this.ackedStep = upTo;
    // A knocked-out field stops for good: being "behind" is then fine.
    if (!this.field.knockedOut && upTo < dueStep - NET.MAX_BEHIND_STEPS) return "too far behind real time (slow motion?)";
    return this.lateMessage();
  }

  /** The device's fingerprint at `step`: compare it when we have ours. */
  check(step: number, hash: string): void {
    this.theirs.set(step, hash);
    this.compare(step);
  }

  /**
   * The player left or misbehaved: whatever they hadn't applied yet goes
   * straight into the copy (in order), so a bot can play on from there.
   */
  handOver(reason: string): void {
    this.replaced = reason;
    for (const seq of [...this.pending.keys()].sort((a, b) => a - b)) this.field.receive(this.pending.get(seq)!.message);
    this.pending.clear();
  }

  /** Step the copy up to `step`, noting our fingerprint every FINGERPRINT_EVERY. */
  private advanceTo(step: number): void {
    while (this.field.steps < step && !this.field.knockedOut) {
      this.field.step(SIM.STEP_MS);
      this.field.takeEvents(); // nobody draws the copy
      if (this.field.steps % NET.FINGERPRINT_EVERY === 0) {
        this.ours.set(this.field.steps, fingerprint(this.field));
        this.compare(this.field.steps);
      }
    }
  }

  private compare(step: number): void {
    const ours = this.ours.get(step);
    const theirs = this.theirs.get(step);
    if (ours === undefined || theirs === undefined) return;
    this.ours.delete(step);
    this.theirs.delete(step);
    if (ours === theirs) return;
    this.desyncs++;
    console.warn(`[seat ${this.seat}] desync at step ${step}: device ${theirs}, server ${ours}`);
    this.player.send({ t: "desync", step, yours: theirs, server: ours });
  }

  /** A message the device has had for too many of its steps without applying it. */
  private lateMessage(): string | null {
    if (this.field.knockedOut) return null; // a knocked-out field ignores messages
    for (const { sentAtStep } of this.pending.values()) {
      if (this.ackedStep - sentAtStep > NET.MESSAGE_DEADLINE_STEPS) return "didn't apply a message in time";
    }
    return null;
  }
}
