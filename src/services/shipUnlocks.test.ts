import { describe, expect, it } from "vitest";
import { RENDER3D } from "../config/constants";
import { isUnlocked, newShips, rewardLine, storyComplete, unlockHint, unlockedShips } from "./shipUnlocks";
import { NO_PROGRESS, mergeLevel, type StoryProgress } from "./storyProgress";

const reached = (furthest: number): StoryProgress => ({ ...NO_PROGRESS, furthest });
const names = (ships: { name: string }[]) => ships.map((s) => s.name);
const ship = (name: string) => RENDER3D.SHIPS.find((s) => s.name === name)!;

describe("unlockedShips", () => {
  it("a new player has the three starting ships", () => {
    expect(names(unlockedShips(NO_PROGRESS))).toEqual(["FALCON", "DART", "POD"]);
  });

  it("beating the Great Owl (stage 3) unlocks the leaf glider, not before", () => {
    expect(isUnlocked(ship("LEAF GLIDER"), reached(2))).toBe(false); // on stage 3, owl not beaten
    expect(isUnlocked(ship("LEAF GLIDER"), reached(3))).toBe(true);
  });

  it("finishing the story unlocks every ship", () => {
    expect(unlockedShips(reached(10))).toEqual(RENDER3D.SHIPS);
    expect(names(unlockedShips(reached(9)))).not.toContain("CRAYON");
  });
});

describe("newShips", () => {
  it("names only what a clear just unlocked", () => {
    // Clearing stage 6 (the Dragon) for the first time.
    const before = reached(5);
    expect(names(newShips(before, mergeLevel(before, 5, 9000, true)))).toEqual(["LAVA ROCKET"]);
  });

  it("is empty for a replay of a boss already beaten, or a game over", () => {
    const far = reached(7);
    expect(newShips(far, mergeLevel(far, 2, 9000, true))).toEqual([]);
    expect(newShips(far, mergeLevel(far, 7, 500, false))).toEqual([]);
  });

  it("beating the last boss unlocks the crayon ship", () => {
    const before = reached(9);
    expect(names(newShips(before, mergeLevel(before, 9, 20000, true)))).toEqual(["CRAYON"]);
  });
});

describe("storyComplete", () => {
  it("only once the last boss is beaten", () => {
    expect(storyComplete(reached(9))).toBe(false);
    expect(storyComplete(reached(10))).toBe(true);
  });
});

describe("unlockHint", () => {
  it("names the boss to beat, or the whole story for the finisher's ship", () => {
    expect(unlockHint(ship("FALCON"))).toBe("");
    expect(unlockHint(ship("LEAF GLIDER"))).toBe("beat the GREAT OWL");
    expect(unlockHint(ship("STAR CRUISER"))).toBe("beat THE MOON");
    expect(unlockHint(ship("CRAYON"))).toBe("finish the story");
  });
});

describe("rewardLine", () => {
  it("names the ships a finish unlocked for the credits", () => {
    expect(rewardLine([ship("CRAYON")])).toBe("the crayon ship");
    expect(rewardLine([ship("LAVA ROCKET"), ship("CRAYON")])).toBe("the lava rocket and the crayon ship");
  });

  it("says nothing when a finish unlocked nothing new (a second finish)", () => {
    expect(rewardLine([])).toBeUndefined();
  });

  it("the first finish unlocks the crayon ship, a second one nothing", () => {
    const beforeLastBoss = { furthest: 9, best: [], bestRun: 0 };
    const finished = mergeLevel(beforeLastBoss, 9, 1000, true);
    expect(rewardLine(newShips(beforeLastBoss, finished))).toBe("the crayon ship");
    expect(rewardLine(newShips(finished, mergeLevel(finished, 9, 2000, true)))).toBeUndefined();
  });
});
