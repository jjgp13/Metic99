/**
 * Match report: plays whole battle-royale matches with bots only, headless,
 * and prints how they went. Run with `npm run match` (add `-- --matches 40`,
 * `-- --players 16`, `-- --seats ace,ace,pilot,...` to pick the lineup).
 * Experiments: `-- --aim kos` makes every bot aim by that strategy,
 * `-- --no-send ace` stops that level from ever sending, `-- --no-send-seats
 * 0,2,4,6` those seats (a mirror match: same level, half send, half don't),
 * `-- --send-at 100` makes every bot send only at that much energy.
 *
 * The default lineup mixes levels, so the table shows how often each level
 * wins and where it usually places, and how long matches last.
 */
import { BOT, MATCH, SIM, TARGET_STRATEGIES, type BotLevel, type TargetStrategy } from "../src/config/constants";
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
const argOf = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
};
// Experiments rewrite the bot table for this run only.
const levels = BOT.LEVELS as unknown as Record<BotLevel, { SEND_AT: number; TARGETING: TargetStrategy }>;
const AIM = argOf("aim") as TargetStrategy | null;
if (AIM && !TARGET_STRATEGIES.includes(AIM)) throw new Error(`--aim: one of ${TARGET_STRATEGIES.join(", ")}`);
if (AIM) for (const l of Object.values(levels)) l.TARGETING = AIM;
const NO_SEND = argOf("no-send") as BotLevel | null;
if (NO_SEND) levels[NO_SEND].SEND_AT = Infinity;
const NO_SEND_SEATS = (argOf("no-send-seats") ?? "").split(",").filter(Boolean).map(Number);
// `--send-at 100`: every bot sends only at this much energy.
const SEND_AT = argOf("send-at");
if (SEND_AT) for (const l of Object.values(levels)) l.SEND_AT = Number(SEND_AT);

// A safety net for the report only: the pressure should end every match long before.
const MAX_STEPS = Math.round((30 * 60_000) / SIM.STEP_MS);

const lengths: number[] = [];
const koTimes: number[][] = SEATS.map(() => []);
const byLevel = new Map<
  BotLevel,
  {
    places: number[];
    wins: number;
    survived: number[];
    scores: number[];
    sent: number;
    cancelled: number;
    kos: number;
    badges: number[];
  }
>();
const koBy = new Map<string, number>();
let koByAttack = 0;
let attacks = 0;
let unfinished = 0;

for (let seed = 1; seed <= MATCHES; seed++) {
  const match = new Match({ seed, seats: SEATS });
  for (const seat of NO_SEND_SEATS) match.bots[seat]!.sendAt = Infinity;
  const koAt = SEATS.map(() => 0);
  const kosBy = SEATS.map(() => 0);
  while (!match.over && match.steps < MAX_STEPS) {
    match.step(SIM.STEP_MS);
    for (const e of match.takeEvents()) {
      if (e.type === "attack") attacks++;
      if (e.type !== "ko") continue;
      if (e.by !== null) {
        koByAttack++;
        kosBy[e.by]++;
      }
      koAt[e.seat] = match.elapsedMs;
      const alien = match.fields[e.seat].knockedOutBy;
      const by = alien?.model?.replace("alien_", "") ?? alien?.kind ?? "?";
      koBy.set(by, (koBy.get(by) ?? 0) + 1);
    }
  }
  if (!match.over) unfinished++;
  lengths.push(match.elapsedMs / 1000);
  match.koOrder.forEach((seat, i) => koTimes[i]?.push(koAt[seat] / 1000));
  SEATS.forEach((seatLevel, seat) => {
    if (seatLevel === "human") return;
    const level = (NO_SEND_SEATS.includes(seat) ? `${seatLevel} (no send)` : seatLevel) as BotLevel;
    const row = byLevel.get(level) ?? {
      places: [],
      wins: 0,
      survived: [],
      scores: [],
      sent: 0,
      cancelled: 0,
      kos: 0,
      badges: [],
    };
    row.kos += kosBy[seat];
    row.badges.push(Match.badgeLevel(match.badgePoints[seat]));
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
    (AIM ? `, everyone aims ${AIM}` : "") +
    (NO_SEND ? `, ${NO_SEND} never sends` : "") +
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
    "place (mean)": (r.places.reduce((a, b) => a + b, 0) / r.places.length).toFixed(2),
    "survived (median)": `${Math.round(median(r.survived))} s`,
    "score (median)": Math.round(median(r.scores)),
    "energy sent/run": Math.round(r.sent / r.places.length),
    "cancelled/run": Math.round(r.cancelled / r.places.length),
    "KOs/run": (r.kos / r.places.length).toFixed(2),
    "badge lvl (mean)": (r.badges.reduce((a, b) => a + b, 0) / r.badges.length).toFixed(2),
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
    `${Math.round((100 * koByAttack) / Math.max(1, kos))}% of KOs credited to a player`,
);
console.log(
  "knocked out by: " +
    [...koBy.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([by, n]) => `${by} ${Math.round((100 * n) / kos)}%`)
      .join(", "),
);
