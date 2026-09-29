/**
 * Bot report: plays every bot level on several seeds, headless, and prints how
 * they did. Run with `npm run bots` (add `-- --lives 1` for the battle rule,
 * `-- --minutes 5` to cap runs, `-- --seeds 20` for more runs,
 * `-- --ability splitter` to make every allowed spawn that ability).
 *
 * This is "balancing by simulation": change a number in BOT or DIFFICULTY,
 * re-run, and compare, instead of playing dozens of games by hand. Compare the
 * solve times with your own (dev console at game over).
 */
import { BOT, SIM, type BotLevel } from "../src/config/constants";
import { Bot } from "../src/sim/Bot";
import type { AbilityKind } from "../src/objects/abilities";
import { Field } from "../src/sim/Field";
import { answerTimes, formatTimes, mergeTimes } from "../src/sim/pace";
import { quantile, summarizeSolves } from "../src/sim/stats";

// Runs in Node (vite-node); the project has no Node types, and argv is all we need.
declare const process: { argv: string[] };

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const SEEDS = arg("seeds", 8);
const MINUTES = arg("minutes", 10);
const LIVES = arg("lives", 3);
const abilityArg = process.argv.indexOf("--ability");
const FORCED = abilityArg >= 0 ? (process.argv[abilityArg + 1].split(",") as AbilityKind[]) : null;

const rows = [];
for (const level of Object.keys(BOT.LEVELS) as BotLevel[]) {
  const survived: number[] = [];
  const scores: number[] = [];
  let kills = 0;
  let answers = 0;
  let slips = 0;
  const solves = [];
  const hitsBy = new Map<string, number>();
  const paces = new Map<number, number[]>();
  let hits = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const field = new Field({ seed, lives: LIVES, forcedAbilities: FORCED });
    const bot = Bot.forSeat(level, seed);
    const maxSteps = Math.round((MINUTES * 60_000) / SIM.STEP_MS);
    while (!field.knockedOut && field.steps < maxSteps) {
      bot.update(field, SIM.STEP_MS);
      field.step(SIM.STEP_MS);
      for (const e of field.takeEvents()) {
        if (e.type !== "hit") continue;
        const by = e.alien.model?.replace("alien_", "") ?? e.alien.kind;
        hitsBy.set(by, (hitsBy.get(by) ?? 0) + 1);
        hits++;
      }
    }
    mergeTimes(paces, answerTimes({ seed, lives: LIVES, forcedAbilities: FORCED }, field.inputLog, field.steps));
    survived.push(field.elapsedMs / 1000);
    scores.push(field.score);
    kills += field.kills;
    answers += bot.answers;
    slips += bot.slips;
    solves.push(...field.solves);
  }
  survived.sort((a, b) => a - b);
  scores.sort((a, b) => a - b);
  const bySize = summarizeSolves(solves)
    .map((s) => `${s.balls}b ${s.median.toFixed(1)}s`)
    .join("  ");
  rows.push({
    level,
    "survived (median)": `${Math.round(quantile(survived, 0.5))} s`,
    "made it to the cap": `${survived.filter((s) => s >= MINUTES * 60 - 1).length}/${SEEDS}`,
    "score (median)": quantile(scores, 0.5),
    "kills/run": Math.round(kills / SEEDS),
    slips: `${((100 * slips) / Math.max(1, answers)).toFixed(0)}%`,
    "answer time": formatTimes(paces),
    "solve time (median)": bySize,
    "hit by": [...hitsBy.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([by, n]) => `${by} ${Math.round((100 * n) / hits)}%`)
      .join(", "),
  });
}
console.log(
  `${SEEDS} seeds per level, ${LIVES} ${LIVES === 1 ? "life" : "lives"}, runs capped at ${MINUTES} min` +
    (FORCED ? `, every allowed spawn: ${FORCED.join(", ")}` : ""),
);
console.table(rows);
