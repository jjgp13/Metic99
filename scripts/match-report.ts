/**
 * Match report: plays whole battle-royale matches with bots only, headless,
 * and prints how they went. Run with `npm run match` (add `-- --matches 40`,
 * `-- --players 16`, `-- --seats ace,ace,pilot,...` to pick the lineup).
 *
 * The default lineup mixes levels, so the table shows how often each level
 * wins and where it usually places, and how long matches last.
 */
import { BOT, MATCH, SIM, type BotLevel } from "../src/config/constants";
import { Match, type Seat } from "../src/sim/Match";
import { quantile } from "../src/sim/stats";

// Runs in Node (vite-node); the project has no Node types, and argv is all we need.
declare const process: { argv: string[] };

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const MATCHES = arg("matches", 20);
const PLAYERS = arg("players", MATCH.PLAYERS);
const seatsArg = process.argv.indexOf("--seats");
const LEVELS = Object.keys(BOT.LEVELS) as BotLevel[];
const SEATS: Seat[] =
  seatsArg >= 0
    ? (process.argv[seatsArg + 1].split(",") as BotLevel[])
    : Array.from({ length: PLAYERS }, (_, i) => LEVELS[i % LEVELS.length]);
// A safety net for the report only: the pressure should end every match long before.
const MAX_STEPS = Math.round((30 * 60_000) / SIM.STEP_MS);

const lengths: number[] = [];
const koTimes: number[][] = SEATS.map(() => []);
const byLevel = new Map<
  BotLevel,
  { places: number[]; wins: number; survived: number[]; scores: number[]; sent: number; cancelled: number }
>();
const koBy = new Map<string, number>();
let koByAttack = 0;
let attacks = 0;
let unfinished = 0;

for (let seed = 1; seed <= MATCHES; seed++) {
  const match = new Match({ seed, seats: SEATS });
  const koAt = SEATS.map(() => 0);
  while (!match.over && match.steps < MAX_STEPS) {
    match.step(SIM.STEP_MS);
    for (const e of match.takeEvents()) {
      if (e.type === "attack") attacks++;
      if (e.type !== "ko") continue;
      if (e.by !== null) koByAttack++;
      koAt[e.seat] = match.elapsedMs;
      const alien = match.fields[e.seat].knockedOutBy;
      const by = alien?.model?.replace("alien_", "") ?? alien?.kind ?? "?";
      koBy.set(by, (koBy.get(by) ?? 0) + 1);
    }
  }
  if (!match.over) unfinished++;
  lengths.push(match.elapsedMs / 1000);
  match.koOrder.forEach((seat, i) => koTimes[i]?.push(koAt[seat] / 1000));
  SEATS.forEach((level, seat) => {
    if (level === "human") return;
    const row = byLevel.get(level) ?? { places: [], wins: 0, survived: [], scores: [], sent: 0, cancelled: 0 };
    row.sent += match.fields[seat].energy.spent.send;
    row.cancelled += match.fields[seat].cancelledTotal;
    row.places.push(match.placements[seat]);
    if (match.placements[seat] === 1) row.wins++;
    row.survived.push(match.fields[seat].elapsedMs / 1000);
    row.scores.push(match.fields[seat].score);
    byLevel.set(level, row);
  });
}

const median = (xs: number[]) => quantile([...xs].sort((a, b) => a - b), 0.5);
console.log(
  `${MATCHES} matches, ${SEATS.length} players (${SEATS.join(", ")}), ${MATCH.LIVES} life` +
    (unfinished ? `, ${unfinished} NOT FINISHED in 30 min` : ""),
);
console.log(
  `match length: median ${Math.round(median(lengths))} s, ` +
    `range ${Math.round(Math.min(...lengths))}–${Math.round(Math.max(...lengths))} s`,
);
console.table(
  [...byLevel.entries()].map(([level, r]) => ({
    level,
    seats: r.places.length / MATCHES,
    "win rate": `${Math.round((100 * r.wins) / MATCHES)}%`,
    "place (median)": median(r.places),
    "survived (median)": `${Math.round(median(r.survived))} s`,
    "score (median)": Math.round(median(r.scores)),
    "energy sent/run": Math.round(r.sent / r.places.length),
    "cancelled/run": Math.round(r.cancelled / r.places.length),
  })),
);
console.log(
  "KO n (median time): " +
    koTimes
      .filter((t) => t.length)
      .map((t, i) => `#${i + 1} ${Math.round(median(t))}s`)
      .join("  "),
);
const kos = [...koBy.values()].reduce((a, b) => a + b, 0);
console.log(
  `attacks: ${(attacks / MATCHES).toFixed(1)} per match; ` +
    `${Math.round((100 * koByAttack) / Math.max(1, kos))}% of KOs by a sent alien`,
);
console.log(
  "knocked out by: " +
    [...koBy.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([by, n]) => `${by} ${Math.round((100 * n) / kos)}%`)
      .join(", "),
);
