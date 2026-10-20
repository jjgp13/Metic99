/**
 * Bot report: plays every bot level on several seeds, headless, and prints how
 * they did. Run with `npm run bots` (add `-- --lives 1` for the battle rule,
 * `-- --minutes 5` to cap runs, `-- --seeds 20` for more runs,
 * `-- --ability splitter` to make every allowed spawn that ability,
 * `-- --kind swooper` to make every 2-ball spawn that kind,
 * `-- --power slow` or `-- --power none,freeze` to pick powers (default: every
 * power plus "none", the no-power baseline), `-- --level ace` for one level,
 * `-- --sharp` for flawless power use (a power's ceiling, see Bot.powerStyle),
 * `-- --story 1,7` to play story stages instead of Endless (each from a fresh
 * field with STORY.LIVES; a run ends when the stage is cleared).
 *
 * The energy columns say whether the power's fuel is scarce: when the bar
 * first fills, how much of the run it sits full, and how much of what kills
 * earned was lost to overflow (earned past a full bar).
 *
 * This is "balancing by simulation": change a number in BOT or DIFFICULTY,
 * re-run, and compare, instead of playing dozens of games by hand. Compare the
 * solve times with your own (dev console at game over).
 */
import { BOT, LEVELS as STAGES, POWER_KINDS, SIM, STORY, type AlienKind, type BotLevel, type PowerKind } from "../src/config/constants";
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
const kindArg = process.argv.indexOf("--kind");
const KINDS = kindArg >= 0 ? (process.argv[kindArg + 1].split(",") as AlienKind[]) : null;
const list = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1].split(",") : null;
};
type PowerChoice = PowerKind | "none";
const POWERS_RUN = (list("power") ?? ["none", ...POWER_KINDS]) as PowerChoice[];
const SHARP = process.argv.includes("--sharp");
const LEVELS = (list("level") ?? Object.keys(BOT.LEVELS)) as BotLevel[];
// Story stages are numbered from 1 like on the map; null = Endless.
const STAGE_RUN = list("story")?.map(Number) ?? [null];

const rows = [];
for (const stage of STAGE_RUN)
for (const level of LEVELS)
for (const power of POWERS_RUN) {
  const survived: number[] = [];
  const scores: number[] = [];
  let kills = 0;
  let answers = 0;
  let slips = 0;
  const solves = [];
  const hitsBy = new Map<string, number>();
  const paces = new Map<number, number[]>();
  let hits = 0;
  // Power use: steps a time power ran, presses that did something, energy.
  let onSteps = 0;
  let steps = 0;
  let uses = 0;
  let blocked = 0;
  let earned = 0;
  let spent = 0;
  let fullSteps = 0;
  let overflow = 0;
  const fullAt: number[] = [];
  let cleared = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const lives = stage === null ? LIVES : STORY.LIVES;
    const field = new Field({
      seed,
      lives,
      level: stage === null ? undefined : STAGES[stage - 1],
      forcedAbilities: FORCED,
      forcedKinds: KINDS,
      power: power === "none" ? undefined : power,
    });
    const bot = Bot.forSeat(level, seed);
    bot.usesPower = power !== "none";
    if (SHARP) bot.powerStyle = "sharp";
    const maxSteps = Math.round((MINUTES * 60_000) / SIM.STEP_MS);
    let firstFull: number | null = null;
    while (!field.knockedOut && !field.cleared && field.steps < maxSteps) {
      bot.update(field, SIM.STEP_MS);
      if (field.power.running) onSteps++;
      const full = field.energy.value >= field.energy.max;
      if (full) fullSteps++;
      if (full && firstFull === null) firstFull = field.elapsedMs / 1000;
      field.step(SIM.STEP_MS);
      for (const e of field.takeEvents()) {
        if (e.type === "power" && e.use !== "off") uses++;
        if (e.type === "shielded") blocked++;
        if (e.type !== "hit") continue;
        const by = e.alien.model?.replace("alien_", "") ?? e.alien.kind;
        hitsBy.set(by, (hitsBy.get(by) ?? 0) + 1);
        hits++;
      }
    }
    if (field.cleared) cleared++;
    fullAt.push(firstFull ?? Infinity);
    // Stored = what is still in the bar + what was spent; the rest overflowed.
    const stored = field.energy.value + Object.values(field.energy.spent).reduce((a, b) => a + b, 0);
    overflow += field.energy.earned - stored;
    mergeTimes(paces, answerTimes({ seed, lives, level: stage === null ? undefined : STAGES[stage - 1], forcedAbilities: FORCED, forcedKinds: KINDS, power: power === "none" ? undefined : power }, field.inputLog, field.steps));
    steps += field.steps;
    earned += field.energy.earned;
    spent += power === "none" ? 0 : field.energy.spent[power];
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
  fullAt.sort((a, b) => a - b);
  const medianFull = quantile(fullAt, 0.5);
  rows.push({
    ...(stage === null ? {} : { stage }),
    level,
    power,
    "survived (median)": `${Math.round(quantile(survived, 0.5))} s`,
    ...(stage === null
      ? { "made it to the cap": `${survived.filter((s) => s >= MINUTES * 60 - 1).length}/${SEEDS}` }
      : { cleared: `${cleared}/${SEEDS}` }),
    "score (median)": quantile(scores, 0.5),
    "kills/run": Math.round(kills / SEEDS),
    "uses/run": power === "none" ? "-" : (uses / SEEDS).toFixed(1),
    "time on": onSteps ? `${Math.round((100 * onSteps) / steps)}%` : "-",
    "energy used": power === "none" ? "-" : `${Math.round((100 * spent) / Math.max(1, earned))}%`,
    "full at": Number.isFinite(medianFull) ? `${Math.round(medianFull)} s` : "never",
    "time full": `${Math.round((100 * fullSteps) / Math.max(1, steps))}%`,
    overflow: `${Math.round((100 * overflow) / Math.max(1, earned))}%`,
    "hits blocked": blocked ? (blocked / SEEDS).toFixed(1) : "-",
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
    (FORCED ? `, every allowed spawn: ${FORCED.join(", ")}` : "") +
    (KINDS ? `, every 2-ball spawn: ${KINDS.join(", ")}` : "") +
    (SHARP ? ", sharp power use" : ""),
);
console.table(rows);
