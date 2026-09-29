import { describe, expect, it } from "vitest";
import { MATCH, SIM } from "../config/constants";
import { matchPressure, suddenDeathSpeed } from "../config/difficulty";
import { replayField } from "./Field";
import { Match, type MatchEvent, type Seat } from "./Match";

const STEP = SIM.STEP_MS;
/** Far beyond sudden death: a match that isn't over by then never ends. */
const LIMIT = Math.round((15 * 60_000) / STEP);

const LINEUP: Seat[] = Array.from({ length: 16 }, (_, i) => (["rookie", "pilot", "ace"] as const)[i % 3]);

function play(match: Match): MatchEvent[] {
  const events: MatchEvent[] = [];
  while (!match.over && match.steps < LIMIT) {
    match.step(STEP);
    events.push(...match.takeEvents());
  }
  return events;
}

describe("matchPressure", () => {
  it("rises with KOs, then with overtime, and is 0 with everyone in", () => {
    const { KO_MAX, OVERTIME_AT_MS, OVERTIME_RAMP_MS, MAX } = MATCH.PRESSURE;
    expect(matchPressure(0, 8, 8)).toBe(0);
    expect(matchPressure(0, 2, 8)).toBeCloseTo(KO_MAX);
    expect(matchPressure(0, 5, 8)).toBeCloseTo((KO_MAX * 3) / 6);
    expect(matchPressure(OVERTIME_AT_MS + OVERTIME_RAMP_MS / 2, 8, 8)).toBeCloseTo(0.5);
    expect(matchPressure(OVERTIME_AT_MS * 10, 2, 8)).toBe(MAX);
    expect(suddenDeathSpeed(MATCH.SUDDEN_DEATH_AT_MS)).toBe(1);
    expect(suddenDeathSpeed(MATCH.SUDDEN_DEATH_AT_MS + 120_000)).toBe(1 + 2 * MATCH.SUDDEN_DEATH_PER_MIN);
  });
});

describe("Match", () => {
  it("always ends, with unique placements (16 bots, several seeds)", () => {
    for (const seed of [1, 2, 3]) {
      const match = new Match({ seed, seats: LINEUP });
      const events = play(match);
      expect(match.over).toBe(true);
      expect([...match.placements].sort((a, b) => a - b)).toEqual(LINEUP.map((_, i) => i + 1));
      expect(match.koOrder.length).toBe(LINEUP.length - 1);
      const over = events.find((e) => e.type === "over");
      expect(over?.type === "over" && match.placements[over.winner]).toBe(1);
      // Placement = players alive + 1 at the KO: the first out is last.
      const kos = events.filter((e) => e.type === "ko");
      expect(kos[0].type === "ko" && kos[0].placement).toBe(LINEUP.length);
    }
  });

  it("replays exactly: same seed → same match; each field from its own log", () => {
    const a = new Match({ seed: 4, seats: LINEUP.slice(0, 8) });
    const b = new Match({ seed: 4, seats: LINEUP.slice(0, 8) });
    const eventsA = play(a);
    expect(play(b)).toEqual(eventsA);
    expect(b.placements).toEqual(a.placements);

    // A field only hears from the match through logged messages, so its
    // seed + log rebuild it without the match (what a server will check).
    a.fields.forEach((field) => {
      expect(field.inputLog.some((e) => e.input.type === "standing")).toBe(true);
      const replay = replayField({ seed: 4, lives: MATCH.LIVES }, field.inputLog, field.steps, STEP);
      expect([replay.score, replay.kills, replay.knockedOut, replay.elapsedMs]).toEqual([
        field.score,
        field.kills,
        field.knockedOut,
        field.elapsedMs,
      ]);
    });

    const c = new Match({ seed: 5, seats: LINEUP.slice(0, 8) });
    expect(play(c)).not.toEqual(eventsA);
  });

  it("raises the pressure on the players left after each KO", () => {
    const match = new Match({ seed: 6, seats: LINEUP.slice(0, 8) });
    let seen = 0;
    while (!match.over) {
      match.step(STEP);
      for (const e of match.takeEvents()) {
        if (e.type !== "ko" || match.over) continue;
        const [survivor] = match.alive;
        expect(match.fields[survivor].standing?.alive).toBe(match.alive.length);
        expect(match.fields[survivor].dMatch).toBeGreaterThan(seen);
        seen = match.fields[survivor].dMatch;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("ranks players who fall in the same step (idle players all fall together)", () => {
    // Nobody answers, and every field has the same aliens: all hit at once.
    const match = new Match({ seed: 7, seats: ["human", "human", "human"] });
    const events = play(match);
    expect(events.map((e) => e.type)).toEqual(["ko", "ko", "ko", "over"]);
    expect(new Set(events.map((e) => e.step)).size).toBe(1);
    expect(match.placements).toEqual([1, 2, 3]); // same score: the lower seat ranks first
  });

  it("ends even between perfect players (sudden death)", () => {
    const match = new Match({ seed: 8, seats: ["human", "human"] });
    while (!match.over && match.steps < LIMIT) {
      // Instantly answer the lowest unanswered alien: faster than any person.
      for (const f of match.fields) {
        if (f.knockedOut || f.typed !== "") continue;
        const next = f.aliens
          .filter((a) => a.active && a.lethal && a !== f.lockedTarget && a.y - a.top >= 0)
          .sort((x, y) => y.y - x.y)[0];
        if (next) f.apply({ type: "digits", digits: String(next.result) });
      }
      match.step(STEP);
      match.fields.forEach((f) => f.takeEvents());
    }
    expect(match.over).toBe(true);
    expect(match.elapsedMs).toBeGreaterThan(MATCH.SUDDEN_DEATH_AT_MS);
  });
});
