import { describe, expect, it } from "vitest";
import { POWER_KINDS, SIM, type BotLevel, type PowerKind } from "../config/constants";
import { Bot } from "./Bot";
import { Field, type FieldEvent } from "./Field";
import { Match, type MatchEvent } from "./Match";

/**
 * Golden master (docs/ENGINEERING.md §4): fixed-seed bot games and a bot
 * match, summed up and compared with the saved snapshot in
 * `__snapshots__/golden.test.ts.snap`.
 *
 * The rules are deterministic (same seed + same inputs = same run), so any
 * change to how the game plays changes these numbers:
 * - a refactor must leave this test green (behavior unchanged);
 * - an intended rule change updates the snapshot (`npx vitest run -u`) and
 *   the commit says why the numbers moved.
 */

const STEP = SIM.STEP_MS;
const MAX_MINUTES = 3;

/** Round floats so the snapshot is about behavior, not the last digit. */
const round = (x: number) => Math.round(x * 1000) / 1000;

function countByType(events: readonly { type: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return counts;
}

/** A bot plays a solo field until knocked out or MAX_MINUTES pass. */
function soloRun(seed: number, level: BotLevel, power: PowerKind) {
  const field = new Field({ seed, power });
  const bot = Bot.forSeat(level, seed);
  const events: FieldEvent[] = [];
  const maxSteps = Math.round((MAX_MINUTES * 60_000) / STEP);
  while (!field.knockedOut && field.steps < maxSteps) {
    bot.update(field, STEP);
    field.step(STEP);
    events.push(...field.takeEvents());
  }
  return {
    steps: field.steps,
    score: field.score,
    kills: field.kills,
    lives: field.lives,
    bestCombo: field.bestCombo,
    energyEarned: round(field.energy.earned),
    energySpent: round(field.energy.spent[power]),
    inputs: field.inputLog.length,
    events: countByType(events),
    aliensLeft: field.aliens.map((a) => [a.kind, Math.round(a.x), Math.round(a.y), a.result]),
  };
}

function matchRun(seed: number) {
  const match = new Match({ seed, seats: ["ace", "ace", "pilot", "pilot", "pilot", "rookie", "rookie", "rookie"] });
  const events: MatchEvent[] = [];
  const maxSteps = Math.round((10 * 60_000) / STEP);
  while (!match.over && match.steps < maxSteps) {
    match.step(STEP);
    events.push(...match.takeEvents());
  }
  return {
    steps: match.steps,
    placements: match.placements,
    koOrder: match.koOrder,
    badgePoints: match.badgePoints,
    scores: match.fields.map((f) => f.score),
    events: countByType(events),
    attacks: events.flatMap((e) => (e.type === "attack" ? [[e.from, e.to, e.cost, round(e.weight)]] : [])),
  };
}

describe("golden master", () => {
  it("solo bot runs, one per power and level, play exactly as before", () => {
    const runs = Object.fromEntries(
      POWER_KINDS.flatMap((power, i) =>
        (["rookie", "ace"] as const).map((level) => [`${level}-${power}`, soloRun(100 + i, level, power)]),
      ),
    );
    expect(runs).toMatchSnapshot();
  });

  it("a bot battle match plays exactly as before", () => {
    expect(matchRun(7)).toMatchSnapshot();
  });
});
