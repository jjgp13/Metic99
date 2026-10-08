import { describe, expect, it } from "vitest";
import { mergeRun, rankFor, type Mastery } from "./masteryStats";

const NONE: Mastery = { highScore: 0, bestCombo: 0, totalKills: 0, fastestSolveMs: 0 };

describe("mergeRun", () => {
  it("keeps the bests, adds the kills, and flags a new high score", () => {
    const prior: Mastery = { highScore: 5000, bestCombo: 8, totalKills: 40, fastestSolveMs: 900 };
    const { mastery, newHighScore } = mergeRun(prior, { score: 7000, bestCombo: 5, kills: 12, fastestSolveMs: 1200 });
    expect(mastery).toEqual({ highScore: 7000, bestCombo: 8, totalKills: 52, fastestSolveMs: 900 });
    expect(newHighScore).toBe(true);
  });

  it("records the first fastest solve, and ignores a run that solved nothing", () => {
    expect(mergeRun(NONE, { score: 100, bestCombo: 1, kills: 1, fastestSolveMs: 1500 }).mastery.fastestSolveMs).toBe(1500);
    const idle = mergeRun(NONE, { score: 0, bestCombo: 0, kills: 0, fastestSolveMs: Infinity });
    expect(idle.mastery.fastestSolveMs).toBe(0);
    expect(idle.newHighScore).toBe(false);
  });
});

describe("rankFor", () => {
  it("names the highest rank reached", () => {
    expect(rankFor(0)).toBe("Rookie");
    expect(rankFor(6000)).toBe("Pilot");
    expect(rankFor(1_000_000)).toBe("Legend");
  });
});
