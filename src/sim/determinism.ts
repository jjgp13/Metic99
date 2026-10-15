import { SIM } from "../config/constants";
import type { FieldOptions, LoggedInput } from "./Field";
import { fingerprintReplay, type Checkpoint } from "./fingerprint";

/**
 * The determinism experiment (docs/NETCODE.md, S0 step 3): does the same
 * field code, fed the same inputs, compute the same state on every JS engine?
 *
 * Node records a few runs once (`npm run determinism:record`): the inputs,
 * Node's fingerprints every 60 steps, and Node's answer for every Math.sin /
 * Math.exp call the rules made. Any other engine (the phone lab,
 * `?lab=determinism`) replays the same inputs and compares. The inputs are a
 * recording, not a live bot, so the only thing that differs between the two
 * sides is the engine running the field: one variable at a time.
 */

/** One recorded run: what to replay and what Node got. */
export interface RecordedRun {
  name: string;
  /** What this run stresses, e.g. "lumberers: Math.sin every step". */
  about: string;
  options: FieldOptions;
  steps: number;
  log: LoggedInput[];
  checkpoints: Checkpoint[];
  /** How the run ended on Node: the outcome players would see. */
  outcome: Outcome;
}

/** What a player would notice: if these differ, the copies disagree on the game. */
export interface Outcome {
  score: number;
  kills: number;
  lives: number;
}

export function outcomeOf(field: { score: number; kills: number; lives: number }): Outcome {
  return { score: field.score, kills: field.kills, lives: field.lives };
}

/** The math functions the game rules call whose results engines may round
 * differently (the spec lets them approximate). `+ - * /` and sqrt are exact. */
export const PROBED = ["sin", "exp"] as const;
export type ProbedFn = (typeof PROBED)[number];

/** Node's answers for one function: [input bits, output bits] pairs. */
export type MathProbe = Record<ProbedFn, [string, string][]>;

/** Everything Node recorded, shipped to the lab as JSON. */
export interface Recording {
  /** When Node made it (ISO date). */
  recorded: string;
  runs: RecordedRun[];
  math: MathProbe;
}

/** How one run went on this engine. */
export interface RunResult {
  name: string;
  ok: boolean;
  checkpoints: number;
  /** The first checkpoint that differs from Node's, if any. */
  firstMismatch: { step: number; expected: string; got: string } | null;
  /** The outcome here, and whether it equals Node's. */
  outcome: Outcome;
  sameOutcome: boolean;
  ms: number;
}

/** A float's exact 64 bits as 16 hex digits (to compare and ship exactly). */
export function toBits(x: number): string {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  return view.getBigUint64(0).toString(16).padStart(16, "0");
}

export function fromBits(hex: string): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, BigInt(`0x${hex}`));
  return view.getFloat64(0);
}

/** Replay a recorded run here and compare its fingerprints with Node's. */
export function checkRun(run: RecordedRun): RunResult {
  const start = performance.now();
  const { checkpoints: got, field } = fingerprintReplay(run.options, run.log, run.steps, SIM.STEP_MS);
  const ms = performance.now() - start;
  const i = got.findIndex((c, k) => c.hash !== run.checkpoints[k]?.hash);
  const firstMismatch =
    i < 0 ? null : { step: got[i].step, expected: run.checkpoints[i]?.hash ?? "-", got: got[i].hash };
  const outcome = outcomeOf(field);
  const sameOutcome = JSON.stringify(outcome) === JSON.stringify(run.outcome);
  return { name: run.name, ok: i < 0, checkpoints: got.length, firstMismatch, outcome, sameOutcome, ms };
}

/** One input where this engine's Math function disagrees with Node's. */
export interface MathMismatch {
  fn: ProbedFn;
  x: number;
  expected: string;
  got: string;
}

/** Re-ask this engine every recorded Math question; list where it disagrees. */
export function checkMath(probe: MathProbe): { checked: number; mismatches: MathMismatch[] } {
  let checked = 0;
  const mismatches: MathMismatch[] = [];
  for (const fn of PROBED) {
    for (const [xBits, yBits] of probe[fn]) {
      const x = fromBits(xBits);
      const got = toBits(Math[fn](x));
      checked++;
      if (got !== yBits) mismatches.push({ fn, x, expected: yBits, got });
    }
  }
  return { checked, mismatches };
}

/** The float right next to `x` (one step in the last bit): the smallest
 * possible change, like an engine that rounds the other way. */
export function oneBitOff(x: number): number {
  return fromBits((BigInt(`0x${toBits(x)}`) + 1n).toString(16).padStart(16, "0"));
}

/**
 * The "break it" experiment: run `body` with a wrong Math.sin, then restore
 * it. By default it is off by one last bit, as if this engine rounded
 * differently from Node; `relative` (e.g. 0.01 = 1%) makes it much worse.
 */
export function withBrokenSin<T>(body: () => T, relative?: number): T {
  const sin = Math.sin;
  Math.sin = relative === undefined ? (x: number) => oneBitOff(sin(x)) : (x: number) => sin(x) * (1 + relative);
  try {
    return body();
  } finally {
    Math.sin = sin;
  }
}
