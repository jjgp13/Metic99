/**
 * Story report: every bot level plays each story level from its start (3
 * lives, like a run's first level) on several seeds, headless, and prints
 * how often it clears the level, how long a level takes, and in which part
 * of the level's wave the hits land. Run with `npm run bots:story` (add
 * `-- --stage 4` or `-- --stage 1,2,3` for some levels, `-- --seeds 20`,
 * `-- --power none` or `-- --power freeze`; default SLOW, the owner's pick).
 *
 * Same idea as `npm run bots` (balancing by simulation), for story levels:
 * change a level's PATH_MS, D or WAVES, re-run, compare.
 */
import { BOT, LEVELS, SIM, STORY, type BotLevel, type PowerKind } from "../src/config/constants";
import { Bot } from "../src/sim/Bot";
import { Field } from "../src/sim/Field";
import { quantile } from "../src/sim/stats";

// Runs in Node (vite-node); the project has no Node types, and argv is all we need.
declare const process: { argv: string[] };

const list = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1].split(",") : null;
};
const SEEDS = Number(list("seeds")?.[0] ?? 12);
const STAGES = (list("stage") ?? LEVELS.map((_, i) => String(i + 1))).map(Number);
const POWER = list("power")?.[0] ?? "slow";
const BOTS = (list("level") ?? Object.keys(BOT.LEVELS)) as BotLevel[];
/** A level that runs longer than this is called off (a stuck run). */
const MAX_MS = 8 * 60_000;

const s = (ms: number) => `${Math.round(ms / 1000)} s`;
const rows = [];
for (const stage of STAGES) {
  const level = LEVELS[stage - 1];
  for (const botLevel of BOTS) {
    let cleared = 0;
    const clearMs: number[] = [];
    const pathMs: number[] = [];
    const bossMs: number[] = [];
    let hits = 0;
    let powerSteps = 0;
    let steps = 0;
    const hitsIn = new Map<string, number>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const field = new Field({
        seed,
        level,
        lives: STORY.LIVES,
        power: POWER === "none" ? undefined : (POWER as PowerKind),
      });
      const bot = Bot.forSeat(botLevel, seed);
      bot.usesPower = POWER !== "none";
      let bossAt: number | null = null;
      while (!field.knockedOut && !field.cleared && field.elapsedMs < MAX_MS) {
        bot.update(field, SIM.STEP_MS);
        if (field.power.running) powerSteps++;
        field.step(SIM.STEP_MS);
        steps++;
        if (bossAt === null && field.boss !== null) bossAt = field.elapsedMs;
        for (const e of field.takeEvents()) {
          if (e.type !== "hit") continue;
          hits++;
          const where = bossAt !== null ? "boss" : field.wave?.kind ?? "path";
          hitsIn.set(where, (hitsIn.get(where) ?? 0) + 1);
        }
      }
      if (bossAt !== null) pathMs.push(bossAt);
      if (field.cleared) {
        cleared++;
        clearMs.push(field.elapsedMs);
        bossMs.push(field.elapsedMs - (bossAt ?? 0));
      }
    }
    for (const list of [clearMs, pathMs, bossMs]) list.sort((a, b) => a - b);
    rows.push({
      stage: `${stage} ${level.NAME}`,
      bot: botLevel,
      cleared: `${cleared}/${SEEDS}`,
      "level time": clearMs.length ? s(quantile(clearMs, 0.5)) : "-",
      "to boss": pathMs.length ? s(quantile(pathMs, 0.5)) : "-",
      "boss fight": bossMs.length ? s(quantile(bossMs, 0.5)) : "-",
      "power on": `${Math.round((100 * powerSteps) / Math.max(1, steps))}%`,
      "hits/run": (hits / SEEDS).toFixed(1),
      "hits in": [...hitsIn.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([where, n]) => `${where} ${Math.round((100 * n) / hits)}%`)
        .join(", "),
    });
  }
}
console.log(`${SEEDS} seeds per level, ${STORY.LIVES} lives from the level's start, power: ${POWER}`);
console.table(rows);
