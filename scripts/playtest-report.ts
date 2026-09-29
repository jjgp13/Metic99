/**
 * Playtest report: reads runs saved by the playtest Artifact (a JSON array of
 * `runs` documents), replays each one exactly from its seed + input log, and
 * prints what happened next to the bots' numbers.
 *
 *   npm run playtest -- runs.json
 *
 * A replay re-creates the whole run, so anything can be measured afterwards
 * (reaction times, what was on screen at each death, power timing), not only
 * what the logger stored. The replay only matches if this checkout runs the
 * same rules as the build that played it (the record's `build`).
 */
import { readFileSync } from "node:fs";
import { SIM, type PowerKind } from "../src/config/constants";
import { expand } from "../src/services/playtestLog";
import { Field, feed, replayField } from "../src/sim/Field";
import { answerTimes, formatTimes, mergeTimes } from "../src/sim/pace";
import { quantile, summarizeSolves } from "../src/sim/stats";

// Runs in Node (vite-node); the project has no Node types.
declare const process: { argv: string[] };

interface RunDoc {
  build: string;
  at: string;
  device: { ua: string; screen: string; touch: boolean };
  v?: number;
  replay: {
    seed: number;
    lives: number;
    forcedAbilities: string[] | null;
    /** v2+: the power picked for the run. v1 runs had SLOW + FREEZE buttons. */
    power?: PowerKind;
    steps: number;
    inputs: [number, string][];
  };
  summary: {
    survivedMs: number;
    score: number;
    kills: number;
    // v2: `spent` on the run's power; v1: `slow` and `freeze`. Battle runs
    // (M6) add `send` and `cancelled`.
    energy: { earned: number; spent?: number; slow?: number; freeze?: number; send?: number; cancelled?: number };
  };
  solves: [number, number][];
  hits: { atMs: number; kind: string; model: string | null; ability: string | null; digits: number[]; d: number }[];
  inputMode: string;
  sources: Record<string, number>;
  ink: { reads: number; unknown: number; scratch: number };
  pauses: number;
  /** Battle runs (from M6). */
  battle?: { players: number; opponents: string[]; placement: number | null } | null;
}

const path = process.argv[2];
if (!path) throw new Error("usage: npm run playtest -- runs.json");
const raw = JSON.parse(readFileSync(path, "utf8"));
const runs: RunDoc[] = (Array.isArray(raw) ? raw : raw.docs ?? []).map((d: { data?: RunDoc }) => d.data ?? d);

const allPaces = new Map<number, number[]>();
const rows = runs
  .sort((a, b) => a.at.localeCompare(b.at))
  .map((run) => {
    const log = run.replay.inputs.map(([step, code]) => ({ step, input: expand(code) }));
    const replay = replayField(
      {
        seed: run.replay.seed,
        lives: run.replay.lives,
        forcedAbilities: run.replay.forcedAbilities as never,
        power: run.replay.power,
      },
      log,
      run.replay.steps,
      SIM.STEP_MS,
    );
    const matches = replay.score === run.summary.score && replay.kills === run.summary.kills;
    const paces = answerTimes(
      { seed: run.replay.seed, lives: run.replay.lives, forcedAbilities: run.replay.forcedAbilities as never },
      log,
      run.replay.steps,
    );
    if (matches) mergeTimes(allPaces, paces);
    const solves = summarizeSolves(run.solves.map(([balls, ms]) => ({ balls, ms })));
    const phone = /iPhone|Android|Mobile/i.test(run.device.ua) ? "phone" : "desktop";
    const e = run.summary.energy;
    const used = run.replay.power
      ? `${run.replay.power} ${e.spent ?? 0} of ${e.earned}`
      : `slow/freeze ${e.slow ?? 0}/${e.freeze ?? 0} of ${e.earned}`;
    return {
      when: run.at.slice(5, 16).replace("T", " "),
      device: `${phone} ${run.inputMode}`,
      mode: run.battle ? `battle #${run.battle.placement}/${run.battle.players}` : "solo",
      survived: `${Math.round(run.summary.survivedMs / 1000)} s`,
      score: run.summary.score,
      kills: run.summary.kills,
      "answer time": matches ? formatTimes(paces) : "-",
      "solve 2b / 3b": solves.map((s) => `${s.median.toFixed(1)}s`).join(" / "),
      "power: energy used": used,
      "sent/cancelled": run.battle ? `${run.summary.energy.send ?? 0}/${run.summary.energy.cancelled ?? 0}` : "-",
      "killed by": run.hits.map((h) => h.model?.replace("alien_", "") ?? h.kind).join(", "),
      "pad ?": run.ink.reads + run.ink.unknown ? `${run.ink.unknown}/${run.ink.reads + run.ink.unknown}` : "-",
      replay: matches ? "exact" : `DIFFERS (${replay.score} pts)`,
      // Share of the run a time power was on (read from the replay).
      "power on": run.replay.power ? `${Math.round((100 * powerOnSteps(run)) / run.replay.steps)}%` : "-",
    };
  });

/** Steps a time power ran in a (v2) run, found by replaying it. */
function powerOnSteps(run: RunDoc): number {
  const field = new Field({
    seed: run.replay.seed,
    lives: run.replay.lives,
    forcedAbilities: run.replay.forcedAbilities as never,
    power: run.replay.power,
  });
  const log = run.replay.inputs.map(([step, code]) => ({ step, input: expand(code) }));
  let next = 0;
  let on = 0;
  for (let i = 0; i < run.replay.steps; i++) {
    while (next < log.length && log[next].step === i) feed(field, log[next++].input);
    if (field.power.running) on++;
    field.step(SIM.STEP_MS);
  }
  return on;
}

console.log(`${runs.length} runs (builds: ${[...new Set(runs.map((r) => r.build))].join(", ")})`);
console.table(rows);
const all = summarizeSolves(runs.flatMap((r) => r.solves.map(([balls, ms]) => ({ balls, ms }))));
console.log("All runs, median solve by ball count:", all.map((s) => `${s.balls} balls ${s.median}s (n=${s.count})`).join(" · "));
console.log(`Answer time (exact replays only): ${formatTimes(allPaces)}. Compare with the bots' "answer time" in npm run bots.`);
console.log("Bots (npm run bots): rookie 5.0s · pilot 4.2s / 5.4s · ace 3.0s / 3.5s");

// v2 runs by power: how long each power kept the player alive.
const byPower = new Map<string, RunDoc[]>();
for (const run of runs) {
  if (!run.replay.power) continue;
  byPower.set(run.replay.power, [...(byPower.get(run.replay.power) ?? []), run]);
}
if (byPower.size) {
  const median = (xs: number[]) => quantile([...xs].sort((a, b) => a - b), 0.5);
  console.log("By power (v2 runs):");
  console.table(
    [...byPower].map(([power, rs]) => ({
      power,
      runs: rs.length,
      "survived (median)": `${Math.round(median(rs.map((r) => r.summary.survivedMs)) / 1000)} s`,
      "score (median)": median(rs.map((r) => r.summary.score)),
      "energy used": `${Math.round((100 * rs.reduce((t, r) => t + (r.summary.energy.spent ?? 0), 0)) / Math.max(1, rs.reduce((t, r) => t + r.summary.energy.earned, 0)))}%`,
    })),
  );
}
