import { NET, POWER_KINDS, SEND, TARGET_STRATEGIES, type PowerKind } from "../config/constants";
import type { FieldInput, MatchMessage } from "../sim/Field";
import type { MatchEvent, PlayerTile, Seat } from "../sim/Match";

/**
 * The online protocol (docs/NETCODE.md, S1): every message the client and
 * the server send each other over the WebSocket, as JSON. Both sides import
 * this file, so a message's shape is defined once.
 *
 * The big idea (option A): the client never sends state, only its inputs,
 * each tagged with the step it happened at. The server re-runs the same
 * field code from those inputs and the shared seed, so it knows the same
 * state without trusting the client. The server sends back what it owns:
 * messages for your field (attacks, standing), everyone's tiles, and match
 * events (KOs, attacks, the end).
 *
 * Every message has a `t` (type) field. Names are short because tiles go
 * out ten times a second to every player.
 */

// ---------------------------------------------------------------------------
// Client → server
// ---------------------------------------------------------------------------

/**
 * One entry of a client's log, as sent: a player input, or "I applied the
 * server's message number `seq` at this step". The client never sends the
 * message itself back (it could change it); the server looks it up by seq.
 */
export type WireEntry = { step: number; input: FieldInput } | { step: number; seq: number };

export type ClientMessage =
  /** First message: who I am and which game I run. */
  | { t: "hello"; protocol: number; build: string; name: string; power: PowerKind }
  /** Lobby: start the match now (fill the rest with bots). */
  | { t: "go" }
  /** My log since the last send, and that my field has run `upTo` steps. */
  | { t: "inputs"; upTo: number; entries: WireEntry[] }
  /** My field's fingerprint at this step (the server compares its copy's). */
  | { t: "check"; step: number; hash: string }
  | { t: "ping"; id: number };

// ---------------------------------------------------------------------------
// Server → client
// ---------------------------------------------------------------------------

export type ServerMessage =
  | { t: "welcome"; id: number }
  /** The hello was refused (wrong version, server full…); the socket closes. */
  | { t: "reject"; reason: string }
  /** Who is waiting, when the match starts, whether one is running. */
  | { t: "lobby"; players: string[]; startsInMs: number | null; running: boolean }
  /** The match begins: build your field exactly like this, you are `you`. */
  | {
      t: "start";
      seed: number;
      you: number;
      lives: number;
      power: PowerKind;
      seats: { who: Seat; name?: string }[];
    }
  /** A message for your field: apply it at your next step and report it. */
  | { t: "msg"; seq: number; message: MatchMessage }
  /** What everyone sees of everyone (10 times a second). */
  | { t: "tiles"; step: number; tiles: PlayerTile[] }
  | { t: "event"; event: MatchEvent }
  /** Your field and the server's copy disagree at this step (a bug). */
  | { t: "desync"; step: number; yours: string; server: string }
  /** You were replaced by a bot (too slow, too far behind, or cheating). */
  | { t: "kicked"; reason: string }
  | { t: "pong"; id: number };

export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

/** A server message (trusted: the server only sends well-formed ones). */
export function decodeServer(raw: string): ServerMessage | null {
  try {
    const m = JSON.parse(raw) as ServerMessage;
    return typeof m === "object" && m !== null && typeof m.t === "string" ? m : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation: the server never trusts what a client sends
// ---------------------------------------------------------------------------

const isInt = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** Most entries one `inputs` message may carry (a client sends every 50 ms). */
const MAX_ENTRIES = 64;
/** Largest step number accepted (about 4.6 hours at 60 Hz). */
const MAX_STEP = 1_000_000;

/** A valid player input, or null. Only inputs a player can really make. */
export function parseInput(x: unknown): FieldInput | null {
  if (!isObject(x)) return null;
  switch (x.type) {
    case "digits":
      return typeof x.digits === "string" && /^\d{1,2}$/.test(x.digits) ? { type: "digits", digits: x.digits } : null;
    case "back":
    case "clear":
    case "power":
      return { type: x.type };
    case "send":
      return SEND.TIERS.some((tier) => tier.COST === x.cost) ? { type: "send", cost: x.cost as number } : null;
    case "target": {
      const aim = x.aim;
      if (typeof aim === "string") {
        return (TARGET_STRATEGIES as readonly string[]).includes(aim)
          ? { type: "target", aim: aim as (typeof TARGET_STRATEGIES)[number] }
          : null;
      }
      return isObject(aim) && isInt(aim.seat, 0, NET.SEATS - 1) ? { type: "target", aim: { seat: aim.seat } } : null;
    }
    default:
      return null;
  }
}

function parseEntry(x: unknown): WireEntry | null {
  if (!isObject(x) || !isInt(x.step, 0, MAX_STEP)) return null;
  if ("seq" in x) return isInt(x.seq, 0, MAX_STEP) ? { step: x.step, seq: x.seq } : null;
  const input = parseInput(x.input);
  return input ? { step: x.step, input } : null;
}

/**
 * A client message, checked field by field and rebuilt (so no unexpected
 * property gets through), or null if anything is off. The server drops a
 * client that sends null-parsing messages.
 */
export function parseClient(raw: string): ClientMessage | null {
  let x: unknown;
  try {
    x = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(x)) return null;
  switch (x.t) {
    case "hello": {
      const name = typeof x.name === "string" ? cleanName(x.name) : "";
      const power = (POWER_KINDS as readonly unknown[]).includes(x.power) ? (x.power as PowerKind) : null;
      if (!isInt(x.protocol, 0, 1_000) || typeof x.build !== "string" || x.build.length > 40 || !power) return null;
      return { t: "hello", protocol: x.protocol, build: x.build, name, power };
    }
    case "go":
      return { t: "go" };
    case "inputs": {
      if (!isInt(x.upTo, 0, MAX_STEP) || !Array.isArray(x.entries) || x.entries.length > MAX_ENTRIES) return null;
      const entries = x.entries.map(parseEntry);
      return entries.every((e) => e !== null) ? { t: "inputs", upTo: x.upTo, entries: entries as WireEntry[] } : null;
    }
    case "check":
      return isInt(x.step, 0, MAX_STEP) && typeof x.hash === "string" && /^[0-9a-f]{8}$/.test(x.hash)
        ? { t: "check", step: x.step, hash: x.hash }
        : null;
    case "ping":
      return isInt(x.id, 0, Number.MAX_SAFE_INTEGER) ? { t: "ping", id: x.id } : null;
    default:
      return null;
  }
}

/** Letters and digits only (accents dropped: José → JOSE), upper case, at
 * most NET.NAME_MAX. */
export function cleanName(name: string): string {
  return name
    .normalize("NFD")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, NET.NAME_MAX);
}
