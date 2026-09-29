/**
 * Fit a bot level to a player's pace: `npm run bots:fit -- ace 1.15 2.27`
 * searches THINK_BASE and PER_ADD (PER_CARRY follows at 35%) for the values
 * whose median answer times (src/sim/pace.ts) on 2- and 3-ball sums are
 * closest to the targets in seconds, and prints them to paste into BOT in
 * constants.ts. Get a player's targets from `npm run playtest -- runs.json`.
 * An optional 4th number is the smallest PER_ADD to try (keeps the levels in
 * order: a weaker level shouldn't find additions easier).
 */
import { BOT, SIM, type BotLevel } from "../src/config/constants";
import { Bot } from "../src/sim/Bot";
import { Field } from "../src/sim/Field";
import { answerTimes, mergeTimes } from "../src/sim/pace";

declare const process: { argv: string[] };

const [level, t2, t3, minAdd] = [
  process.argv[2] as BotLevel,
  Number(process.argv[3]),
  Number(process.argv[4]),
  Number(process.argv[5] ?? 300),
];
if (!(level in BOT.LEVELS) || !t2 || !t3) throw new Error("usage: npm run bots:fit -- <rookie|pilot|ace> <2-ball s> <3-ball s> [min PER_ADD ms]");

const median = (list: number[] = []) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] / 1000;

function measure(seeds: number): [number, number] {
  const all = new Map<number, number[]>();
  for (let seed = 1; seed <= seeds; seed++) {
    const field = new Field({ seed });
    const bot = Bot.forSeat(level, seed);
    while (!field.knockedOut && field.steps < 60 * 300) {
      bot.update(field, SIM.STEP_MS);
      field.step(SIM.STEP_MS);
      field.takeEvents();
    }
    mergeTimes(all, answerTimes({ seed }, field.inputLog, field.steps));
  }
  return [median(all.get(2)), median(all.get(3))];
}

// The skill table is a plain object at run time; override it while searching.
const skill = BOT.LEVELS[level] as unknown as Record<string, number>;
let best = { err: Infinity, THINK_BASE: 0, PER_ADD: 0, got: [0, 0] };
for (let base = 0; base <= 2400; base += 150) {
  for (let add = minAdd; add <= 3000; add += 150) {
    skill.THINK_BASE = base;
    skill.PER_ADD = add;
    skill.PER_CARRY = Math.round(add * 0.35);
    const got = measure(6);
    const err = Math.abs(got[0] - t2) + Math.abs(got[1] - t3);
    if (err < best.err) best = { err, THINK_BASE: base, PER_ADD: add, got };
  }
}
console.log(
  `${level}: THINK_BASE ${best.THINK_BASE}, PER_ADD ${best.PER_ADD}, PER_CARRY ${Math.round(best.PER_ADD * 0.35)}` +
    ` → answers 2 balls in ${best.got[0].toFixed(2)} s, 3 balls in ${best.got[1].toFixed(2)} s (target ${t2} / ${t3})`,
);
