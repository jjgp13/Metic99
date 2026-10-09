import { NET } from "../config/constants";
import { FNV_OFFSET, hashByte, hashNumber, hashString } from "./hash";
import { Field, feed, type FieldOptions, type LoggedInput } from "./Field";

/**
 * State fingerprints (docs/NETCODE.md, S0): a short hash of a field's whole
 * state, so two copies of a run (Node and a phone, later the server and a
 * client) can check they still agree by comparing 8 characters.
 *
 * The hash is a smoke detector for drift, so it must cover everything that
 * can change a future step. Instead of a hand-picked list (which silently
 * misses the next field someone adds), `walkState` visits every value
 * reachable from the field, private ones included, in a fixed order.
 */

/** A value the walk reports; objects and arrays are walked into. */
export type StateLeaf = number | string | boolean | null | undefined;

/**
 * Keys that are not state: the input log is what produced the state (both
 * copies have it by definition), and `events` is an outbox nobody may have
 * emptied (a replay never takes them).
 */
const SKIP_KEYS = new Set(["inputLog", "events"]);

/**
 * Visit every value reachable from `root`, depth first, in a fixed order:
 * object keys in creation order (the same code path gives the same order on
 * every engine), arrays and Maps in order. An object met a second time
 * (`field.target` is also in `swarm.aliens`) is reported as a reference
 * "@<path where it was first met>", so shared objects and cycles are walked
 * once and "which alien is the target" is still part of the state.
 */
export function walkState(root: object, visit: (path: string, value: StateLeaf) => void): void {
  const seen = new Map<object, string>();

  const walk = (path: string, value: unknown): void => {
    if (value === null || typeof value !== "object") {
      if (typeof value === "function" || typeof value === "symbol") return;
      visit(path, value as StateLeaf);
      return;
    }
    const firstPath = seen.get(value);
    if (firstPath !== undefined) {
      visit(path, `@${firstPath}`);
      return;
    }
    seen.set(value, path);

    if (Array.isArray(value)) {
      visit(`${path}.length`, value.length);
      value.forEach((item, i) => walk(`${path}[${i}]`, item));
    } else if (value instanceof Map) {
      visit(`${path}.size`, value.size);
      for (const [k, v] of value) walk(`${path}{${String(k)}}`, v);
    } else if (value instanceof Set) {
      visit(`${path}.size`, value.size);
      let i = 0;
      for (const v of value) walk(`${path}{${i++}}`, v);
    } else {
      for (const key of Object.keys(value)) {
        if (SKIP_KEYS.has(key)) continue;
        walk(path ? `${path}.${key}` : key, (value as Record<string, unknown>)[key]);
      }
    }
  };

  walk("", root);
}

/** One type tag byte per leaf, so `1`, `"1"` and `true` hash differently. */
function hashLeaf(h: number, value: StateLeaf): number {
  switch (typeof value) {
    case "number":
      return hashNumber(hashByte(h, 1), value);
    case "string":
      return hashString(hashByte(h, 2), value);
    case "boolean":
      return hashByte(hashByte(h, 3), value ? 1 : 0);
    default:
      return hashByte(h, value === null ? 4 : 5);
  }
}

/** The field's fingerprint: 8 hex characters (32 bits). */
export function fingerprint(field: Field): string {
  let h = FNV_OFFSET;
  walkState(field, (path, value) => {
    h = hashLeaf(hashString(h, path), value);
  });
  return h.toString(16).padStart(8, "0");
}

/**
 * The whole state as "path = value" lines, for finding *which* number
 * differs once two fingerprints disagree. Numbers print exactly (JS prints
 * the shortest digits that read back as the same 64 bits; -0 is spelled out).
 */
export function stateDump(field: Field): string[] {
  const lines: string[] = [];
  walkState(field, (path, value) => {
    const text = Object.is(value, -0) ? "-0" : typeof value === "string" ? JSON.stringify(value) : String(value);
    lines.push(`${path} = ${text}`);
  });
  return lines;
}

/** A fingerprint taken at a step. */
export interface Checkpoint {
  step: number;
  hash: string;
}

/**
 * Replay a run (like `replayField`) and take a fingerprint every `every`
 * steps, from step 0, plus one at the end. Two machines that replay the same
 * seed and log should produce the same list; the first entry that differs
 * says when they drifted apart.
 */
export function fingerprintReplay(
  options: FieldOptions,
  log: readonly LoggedInput[],
  steps: number,
  dt: number,
  every: number = NET.FINGERPRINT_EVERY,
): Checkpoint[] {
  const field = new Field(options);
  const checkpoints: Checkpoint[] = [];
  let next = 0;
  for (let i = 0; i <= steps; i++) {
    while (next < log.length && log[next].step === i) feed(field, log[next++].input);
    if (i % every === 0 || i === steps) checkpoints.push({ step: i, hash: fingerprint(field) });
    if (i < steps) field.step(dt);
  }
  return checkpoints;
}
