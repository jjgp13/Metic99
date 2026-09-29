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
import { SIM } from "../src/config/constants";
import { expand } from "../src/services/playtestLog";
import { replayField } from "../src/sim/Field";
import { answerTimes, formatTimes, mergeTimes } from "../src/sim/pace";
import { summarizeSolves } from "../src/sim/stats";

// Runs in Node (vite-node); the project has no Node types.
declare const process: { argv: string[] };

interface RunDoc {
  build: string;
  at: string;
  device: { ua: string; screen: string; touch: boolean };
  replay: { seed: number; lives: number; forcedAbilities: string[] | null; steps: number; inputs: [number, string][] };
  summary: { survivedMs: number; score: number; kills: number; energy: { earned: number; slow: number; freeze: number } };
  solves: [number, number][];
  hits: { atMs: number; kind: string; model: string | null; ability: string | null; digits: number[]; d: number }[];
  inputMode: string;
  sources: Record<string, number>;
  ink: { reads: number; unknown: number; scratch: number };
  pauses: number;
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
      { seed: run.replay.seed, lives: run.replay.lives, forcedAbilities: run.replay.forcedAbilities as never },
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
    return {
      when: run.at.slice(5, 16).replace("T", " "),
      device: `${phone} ${run.inputMode}`,
      survived: `${Math.round(run.summary.survivedMs / 1000)} s`,
      score: run.summary.score,
      kills: run.summary.kills,
      "answer time": matches ? formatTimes(paces) : "-",
      "solve 2b / 3b": solves.map((s) => `${s.median.toFixed(1)}s`).join(" / "),
      "slow/freeze used": `${run.summary.energy.slow}/${run.summary.energy.freeze} of ${run.summary.energy.earned}`,
      "killed by": run.hits.map((h) => h.model?.replace("alien_", "") ?? h.kind).join(", "),
      "pad ?": run.ink.reads + run.ink.unknown ? `${run.ink.unknown}/${run.ink.reads + run.ink.unknown}` : "-",
      replay: matches ? "exact" : `DIFFERS (${replay.score} pts)`,
    };
  });

console.log(`${runs.length} runs (builds: ${[...new Set(runs.map((r) => r.build))].join(", ")})`);
console.table(rows);
const all = summarizeSolves(runs.flatMap((r) => r.solves.map(([balls, ms]) => ({ balls, ms }))));
console.log("All runs, median solve by ball count:", all.map((s) => `${s.balls} balls ${s.median}s (n=${s.count})`).join(" · "));
console.log(`Answer time (exact replays only): ${formatTimes(allPaces)}. Compare with the bots' "answer time" in npm run bots.`);
