import { describe, expect, it } from "vitest";
import { NO_PROGRESS, flightTo, islandView, mergeLevel, mergeRun, parseProgress, parseSavedRun, runStage } from "./storyProgress";

describe("mergeLevel", () => {
  it("beating a boss opens the next stage and keeps the best score", () => {
    const after1 = mergeLevel(NO_PROGRESS, 0, 4000, true);
    expect(after1).toEqual({ furthest: 1, best: [4000], bestRun: 0 });
    // A worse replay of stage 1 changes nothing; dying in stage 2 records its score.
    const after2 = mergeLevel(mergeLevel(after1, 0, 3000, true), 1, 1500, false);
    expect(after2).toEqual({ furthest: 1, best: [4000, 1500], bestRun: 0 });
  });

  it("a run that dies early never closes a stage already reached", () => {
    const far = { furthest: 3, best: [1, 2, 3], bestRun: 9 };
    expect(mergeLevel(far, 0, 500, true).furthest).toBe(3);
  });
});

describe("mergeRun", () => {
  it("keeps the best total and flags a new best", () => {
    expect(mergeRun(NO_PROGRESS, 5000)).toEqual({ progress: { ...NO_PROGRESS, bestRun: 5000 }, newBest: true });
    expect(mergeRun({ ...NO_PROGRESS, bestRun: 5000 }, 4000).newBest).toBe(false);
  });
});

describe("islandView", () => {
  // The owner's playtest: an earlier run reached stage 8 (index 7).
  const far = { furthest: 7, best: [9, 9, 9, 9, 9, 9, 9, 9], bestRun: 72 };
  const looks = (atStage: number) => Array.from({ length: 10 }, (_, s) => islandView(far, atStage, s).look);

  it("after a game over (no saved run) only island 1 is this run's; the rest reached before are gray", () => {
    expect(runStage(null)).toBe(0);
    expect(looks(runStage(null))).toEqual(["run", ...Array(7).fill("before"), "unreached", "unreached"]);
  });

  it("a saved run colors every island up to its level", () => {
    const at = runStage({ level: 3, lives: 2, score: 900, levelScores: [1, 2, 3] });
    expect(looks(at)).toEqual(["run", "run", "run", "run", "before", "before", "before", "before", "unreached", "unreached"]);
  });

  it("flags every boss ever beaten, gray or not", () => {
    expect(Array.from({ length: 9 }, (_, s) => islandView(far, 0, s).flag)).toEqual([
      ...Array(7).fill(true),
      false,
      false,
    ]);
  });

  it("a first run: islands are this run's or unreached, never gray", () => {
    const first = mergeLevel(mergeLevel(NO_PROGRESS, 0, 100, true), 1, 200, true);
    expect([0, 1, 2, 3].map((s) => islandView(first, 2, s).look)).toEqual(["run", "run", "run", "unreached"]);
  });
});

describe("parseProgress", () => {
  it("drops anything that isn't a sane number", () => {
    expect(parseProgress({ furthest: 99, best: [10, "x", -5, 2.7], bestRun: NaN })).toEqual({
      furthest: 10,
      best: [10, 0, 0, 2],
      bestRun: 0,
    });
    expect(parseProgress(null)).toEqual(NO_PROGRESS);
  });
});

describe("saved story run", () => {
  it("keeps a sensible run", () => {
    expect(parseSavedRun({ level: 2, lives: 1, score: 1234, levelScores: [400, 834], energy: 62 })).toEqual({
      level: 2,
      lives: 1,
      score: 1234,
      levelScores: [400, 834],
      energy: 62,
      playedMs: 0,
    });
  });

  it("keeps the run's play time, and reads an old save without it as 0", () => {
    expect(parseSavedRun({ level: 3, lives: 2, score: 10, playedMs: 361_500 })?.playedMs).toBe(361_500);
    expect(parseSavedRun({ level: 3, lives: 2, score: 10 })?.playedMs).toBe(0);
    expect(parseSavedRun({ level: 3, lives: 2, score: 10, playedMs: -5 })?.playedMs).toBe(0);
  });

  it("reads a run saved before energy carried over as an empty bar, and caps junk", () => {
    expect(parseSavedRun({ level: 1, lives: 2, score: 10 })?.energy).toBe(0);
    expect(parseSavedRun({ level: 1, lives: 2, score: 10, energy: 9999 })?.energy).toBe(100);
  });

  it("drops a run that can't be played (no lives, bad level, junk)", () => {
    expect(parseSavedRun({ level: 1, lives: 0, score: 10 })).toBeNull();
    expect(parseSavedRun({ level: 99, lives: 2, score: 10 })).toBeNull();
    expect(parseSavedRun("nonsense")).toBeNull();
    expect(parseSavedRun(null)).toBeNull();
  });
});

describe("flightTo", () => {
  const atStage9 = { level: 9, lives: 2, score: 900, levelScores: [] };

  it("flies to the next island right after a clear", () => {
    expect(flightTo(atStage9, 9)).toBe(9);
  });

  it("ignores a flight left over from an earlier clear after a game over (owner's phone playtest)", () => {
    // Phaser restarts the map with its last data, { travelTo: 9 }, but the
    // game over deleted the save: the ship belongs on island 1.
    expect(flightTo(null, 9)).toBeNull();
  });

  it("ignores a stale flight once the saved run is on another stage", () => {
    expect(flightTo({ ...atStage9, level: 2 }, 9)).toBeNull();
    expect(flightTo(atStage9, undefined)).toBeNull();
  });
});
