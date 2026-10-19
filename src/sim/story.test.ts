import { describe, expect, it } from "vitest";
import { LEVELS, SIM, STORY, type BotLevel } from "../config/constants";
import { Boss } from "../objects/abilities";
import { Bot } from "./Bot";
import { Field, type FieldEvent } from "./Field";

const STEP = SIM.STEP_MS;
const LEVEL_1 = LEVELS[0];

/** A bot plays story level 1 until it clears it, is knocked out, or time runs out. */
function playLevel(seed: number, level: BotLevel) {
  const field = new Field({ seed, level: LEVEL_1, lives: STORY.LIVES });
  const bot = Bot.forSeat(level, seed);
  const events: FieldEvent[] = [];
  const maxSteps = Math.round((LEVEL_1.PATH_MS * 3) / STEP);
  while (!field.knockedOut && !field.cleared && field.steps < maxSteps) {
    bot.update(field, STEP);
    field.step(STEP);
    events.push(...field.takeEvents());
  }
  return { field, events };
}

describe("story level 1", () => {
  it("follows the path, then brings in the boss, who takes HP answers", () => {
    const { field, events } = playLevel(7, "ace");
    expect(field.levelProgress).toBe(1);
    expect(field.boss).not.toBeNull();
    const bossAnswers = events.filter((e) => e.type === "solved" && e.alien === field.boss);
    if (field.cleared) {
      expect(bossAnswers).toHaveLength(LEVEL_1.BOSS.HP);
      expect(bossAnswers.filter((e) => e.type === "solved" && !e.absorbed)).toHaveLength(1);
      expect(events[events.length - 1].type).toBe("levelCleared");
    }
  });

  it("an ace clears it on most seeds", () => {
    const cleared = [1, 2, 3, 4, 5].filter((seed) => playLevel(seed, "ace").field.cleared).length;
    expect(cleared).toBeGreaterThanOrEqual(3);
  });

  it("the path holds still while the field is frozen", () => {
    const field = new Field({ seed: 3, level: LEVEL_1 });
    field.freezeLeftMs = 1000;
    for (let i = 0; i < 30; i++) field.step(STEP);
    expect(field.levelProgress).toBe(0);
  });

  it("BLAST leaves the boss standing", () => {
    // An ace plays (with BLAST picked) until the boss is up, then we blast.
    const field = new Field({ seed: 7, level: LEVEL_1, power: "blast" });
    const bot = Bot.forSeat("ace", 7);
    while (!field.boss && !field.knockedOut) {
      bot.update(field, STEP);
      field.step(STEP);
    }
    const boss = field.boss!;
    expect(boss.ability).toBeInstanceOf(Boss);
    field.takeEvents();
    field.energy.charge(100);
    field.apply({ type: "power" });
    const blasted = field.takeEvents().find((e) => e.type === "blasted");
    expect(blasted).toBeDefined();
    expect(boss.active).toBe(true);
  });
});
