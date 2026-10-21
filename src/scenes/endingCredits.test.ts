import { describe, expect, it } from "vitest";
import { ENDING } from "../config/constants";
import { creditLines, playTime } from "./endingCredits";

describe("playTime", () => {
  it("says minutes, then hours and minutes", () => {
    expect(playTime(25 * 60_000)).toBe("25 minutes");
    expect(playTime(61_000)).toBe("1 minute");
    expect(playTime(64 * 60_000)).toBe("1 hour and 4 minutes");
    expect(playTime(120 * 60_000)).toBe("2 hours");
  });

  it("never says 0 minutes (an old save without its time)", () => {
    expect(playTime(0)).toBe("1 minute");
  });
});

describe("creditLines", () => {
  const run = { score: 123456, playedMs: 34 * 60_000, worlds: 10 };

  it("credits the author and tells the run back to the player", () => {
    const text = creditLines(run).map((l) => l.text);
    expect(text).toContain(`a game by ${ENDING.CREDIT_NAME}`);
    expect(text).toContain("You spent 34 minutes in my notebook,");
    expect(text).toContain("beat all 10 worlds");
    expect(text).toContain("and scored 123,456 points.");
  });

  it("adds the reward line only when something was unlocked, without moving the rest", () => {
    const plain = creditLines(run);
    const rewarded = creditLines({ ...run, unlocked: "the crayon ship" });
    expect(plain.some((l) => l.style === "reward")).toBe(false);
    expect(rewarded.find((l) => l.style === "reward")?.text).toBe("You unlocked the crayon ship!");
    expect(rewarded.find((l) => l.style === "sign")?.rule).toBe(plain.find((l) => l.style === "sign")?.rule);
  });

  it("gives every line its own rule, top to bottom", () => {
    const rules = creditLines({ ...run, unlocked: "x" }).map((l) => l.rule);
    expect(rules).toEqual([...rules].sort((a, b) => a - b));
    expect(new Set(rules).size).toBe(rules.length);
  });
});
