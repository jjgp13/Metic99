import { describe, expect, it } from "vitest";
import { LEVELS, SIM, STORY, type BotLevel } from "../config/constants";
import { Boss } from "../objects/abilities";
import { GiantMole } from "../objects/mole";
import { MOLE_HILLS } from "../config/levels/backyard";
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

  it("brings its creatures, keeps every box readable, and beetles march", () => {
    const species = new Set<string>();
    let overlapSteps = 0;
    let marchers = 0;
    for (const seed of [1, 2, 3]) {
      const field = new Field({ seed, level: LEVEL_1, lives: STORY.LIVES });
      const bot = Bot.forSeat("ace", seed);
      while (!field.knockedOut && !field.cleared && field.steps < 30_000) {
        bot.update(field, STEP);
        field.step(STEP);
        for (const e of field.takeEvents()) {
          if (e.type !== "spawned") continue;
          if (e.alien.species) species.add(e.alien.species);
          // A follower spawns in the same step as its leader, right above it.
          if (e.alien.species === "beetle" && e.alien.y < -e.alien.bottom - 10) marchers++;
        }
        const live = field.aliens.filter((a) => a.active);
        if (live.some((a, i) => live.slice(i + 1).some((b) => a.overlaps(b)))) overlapSteps++;
      }
    }
    expect([...species].sort()).toEqual(["beetle", "butterfly", "worm"]);
    expect(overlapSteps).toBe(0);
    expect(marchers).toBeGreaterThan(0);
  });

  it("the path holds back while the field is frozen, but never below PATH_MIN_PACE of real time", () => {
    const field = new Field({ seed: 3, level: LEVEL_1 });
    field.freezeLeftMs = 1000;
    for (let i = 0; i < 30; i++) field.step(STEP);
    expect(field.levelProgress).toBeCloseTo((30 * STEP * STORY.PATH_MIN_PACE) / LEVEL_1.PATH_MS);
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

  it("energy carries over: a level starts with what the last one ended with", () => {
    expect(new Field({ seed: 3, level: LEVEL_1, energy: 62 }).energy.value).toBe(62);
    expect(new Field({ seed: 3, level: LEVEL_1, energy: 500 }).energy.value).toBe(100);
    expect(new Field({ seed: 3, level: LEVEL_1 }).energy.value).toBe(0);
  });

  it("an armed shield goes back into the bar for the next level", () => {
    const field = new Field({ seed: 3, level: LEVEL_1, power: "shield", energy: 70 });
    field.apply({ type: "power" });
    expect(field.power.shieldArmed).toBe(true);
    expect(field.energy.value).toBe(70 - field.power.cost);
    expect(field.carriedEnergy()).toBe(70);
  });
});

describe("the Giant Mole (whack-a-mole)", () => {
  it("peeks out of its molehills one at a time, the next one telegraphed", () => {
    const phases = new Set<string>();
    const hillsVisited = new Set<number>();
    let peeks = 0;
    let peeksAtAHill = 0;
    let readableWhileDigging = 0;
    let digsWithoutTelegraph = 0;
    for (const seed of [1, 2, 3]) {
      const field = new Field({ seed, level: LEVEL_1, lives: STORY.LIVES });
      const bot = Bot.forSeat("pilot", seed);
      let wasPeeking = false;
      while (!field.knockedOut && !field.cleared && field.steps < 30_000) {
        bot.update(field, STEP);
        field.step(STEP);
        field.takeEvents();
        const boss = field.boss;
        if (!boss?.active || !(boss.ability instanceof GiantMole)) continue;
        const mole = boss.ability;
        phases.add(mole.phase);
        const peeking = mole.phase === "peek";
        if (peeking && !wasPeeking) {
          peeks++;
          const hill = (MOLE_HILLS.X as readonly number[]).indexOf(Math.round(boss.x));
          if (hill >= 0) {
            peeksAtAHill++;
            hillsVisited.add(hill);
          }
        }
        wasPeeking = peeking;
        if (mole.phase === "dig" && mole.cover < 1) readableWhileDigging++;
        if (mole.phase === "dig" && mole.nextHill === null) digsWithoutTelegraph++;
      }
      expect(field.cleared).toBe(true);
    }
    expect([...phases].sort()).toEqual(["dig", "duck", "peek", "walk"]);
    // It pops out of every hill, and almost always out of a hill (another
    // creature in its way can stop a dig short: it surfaces where it stopped).
    expect(hillsVisited.size).toBe(MOLE_HILLS.X.length);
    expect(peeksAtAHill / peeks).toBeGreaterThan(0.8);
    expect(readableWhileDigging).toBe(0);
    expect(digsWithoutTelegraph).toBe(0);
  });
});
