/**
 * Determinism recording (docs/NETCODE.md, S0 step 3). Run with
 * `npm run determinism:record` whenever the game rules change.
 *
 * An ace bot plays a few runs here in Node; we keep only its inputs. Then
 * each run is replayed WITHOUT the bot (so only the field's own code runs),
 * taking a fingerprint every 60 steps and noting every Math.sin / Math.exp
 * call the rules make with Node's exact answer. The result is saved as
 * `src/lab/determinism-recording.json`, which the phone lab
 * (`?lab=determinism`) replays and compares, and `determinism.test.ts`
 * checks is up to date.
 */
import { writeFileSync } from "node:fs";
import { SIM } from "../src/config/constants";
import { Bot } from "../src/sim/Bot";
import { Field, type FieldOptions } from "../src/sim/Field";
import { fingerprintReplay } from "../src/sim/fingerprint";
import {
  PROBED,
  toBits,
  outcomeOf,
  type MathProbe,
  type ProbedFn,
  type RecordedRun,
  type Recording,
} from "../src/sim/determinism";

const OUT = "src/lab/determinism-recording.json";
/** Most distinct inputs kept per Math function (keeps the file small). */
const MAX_PROBES = 5000;

const RUNS: { name: string; about: string; options: FieldOptions; seconds: number }[] = [
  { name: "mix", about: "the normal alien mix, FREEZE", options: { seed: 101, power: "freeze" }, seconds: 150 },
  {
    name: "lumberers",
    about: "every 2-ball alien is a lumberer: Math.sin every step",
    options: { seed: 202, power: "slow", forcedKinds: ["lumberer"] },
    seconds: 120,
  },
  {
    name: "blinkers",
    about: "every allowed spawn is a Blinker: Math.sin in its flutter",
    options: { seed: 303, power: "blast", forcedAbilities: ["blinker"] },
    seconds: 120,
  },
];

/** An ace bot plays; returns its input log and how many steps it ran. */
function play(options: FieldOptions, seconds: number) {
  const field = new Field(options);
  const bot = Bot.forSeat("ace", options.seed);
  const maxSteps = Math.round((seconds * 1000) / SIM.STEP_MS);
  while (!field.knockedOut && field.steps < maxSteps) {
    bot.update(field, SIM.STEP_MS);
    field.step(SIM.STEP_MS);
  }
  return { log: [...field.inputLog], steps: field.steps };
}

/** Run `body` while noting every call to the probed Math functions. */
function withMathProbe(seen: Record<ProbedFn, Map<string, string>>, body: () => void): void {
  const originals = PROBED.map((fn) => [fn, Math[fn]] as const);
  for (const [fn, original] of originals) {
    Math[fn] = (x: number) => {
      const y = original(x);
      seen[fn].set(toBits(x), toBits(y));
      return y;
    };
  }
  try {
    body();
  } finally {
    for (const [fn, original] of originals) Math[fn] = original;
  }
}

/** At most `max` entries, spread evenly over the whole list. */
function spread<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.floor((i * items.length) / max)]);
}

const seen: Record<ProbedFn, Map<string, string>> = { sin: new Map(), exp: new Map() };
const runs: RecordedRun[] = [];
for (const spec of RUNS) {
  const { log, steps } = play(spec.options, spec.seconds);
  let replay!: ReturnType<typeof fingerprintReplay>;
  withMathProbe(seen, () => {
    replay = fingerprintReplay(spec.options, log, steps, SIM.STEP_MS);
  });
  const { checkpoints, field } = replay;
  const outcome = outcomeOf(field);
  runs.push({ name: spec.name, about: spec.about, options: spec.options, steps, log, checkpoints, outcome });
  console.log(
    `${spec.name.padEnd(10)} ${String(steps).padStart(5)} steps (${(steps / 60).toFixed(0)} s), ` +
      `${log.length} inputs, ${checkpoints.length} checkpoints, score ${outcome.score}`,
  );
}

const math = Object.fromEntries(
  PROBED.map((fn) => [fn, spread([...seen[fn].entries()], MAX_PROBES)]),
) as MathProbe;
for (const fn of PROBED) console.log(`Math.${fn}: ${seen[fn].size} distinct inputs, kept ${math[fn].length}`);

const recording: Recording = { recorded: new Date().toISOString(), runs, math };
const json = JSON.stringify(recording);
writeFileSync(OUT, json);
console.log(`wrote ${OUT} (${(json.length / 1024).toFixed(0)} KB)`);
