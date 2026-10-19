import { describe, expect, it } from "vitest";
import { NO_PROGRESS, islandState, mergeLevel, mergeRun, parseProgress } from "./storyProgress";

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

describe("islandState", () => {
  it("cleared below the furthest stage, reached at it, unreached past it", () => {
    const p = { ...NO_PROGRESS, furthest: 2 };
    expect([0, 1, 2, 3].map((s) => islandState(p, s))).toEqual(["cleared", "cleared", "reached", "unreached"]);
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
