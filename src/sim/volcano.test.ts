import { describe, expect, it } from "vitest";
import { LEVELS, SIM, STORY, type BotLevel } from "../config/constants";
import { Shielded } from "../objects/abilities";
import { Dragon } from "../objects/dragon";
import { Flash, Hops } from "../objects/volcanoTraits";
import { Bot } from "./Bot";
import { Field, type FieldEvent } from "./Field";

const STEP = SIM.STEP_MS;
// Found by page, not index: levels 2–5 are built alongside it.
const VOLCANO = LEVELS.find((l) => l.PAGE === "volcano")!;

/** A bot plays the volcano until it clears it, is knocked out, or time runs out. */
function playLevel(seed: number, level: BotLevel) {
  const field = new Field({ seed, level: VOLCANO, lives: STORY.LIVES });
  const bot = Bot.forSeat(level, seed);
  const events: FieldEvent[] = [];
  const maxSteps = Math.round((VOLCANO.PATH_MS * 3) / STEP);
  while (!field.knockedOut && !field.cleared && field.steps < maxSteps) {
    bot.update(field, STEP);
    field.step(STEP);
    events.push(...field.takeEvents());
  }
  return { field, events };
}

/** Play (as an ace) until the dragon is up. */
function untilBoss(seed: number): Field {
  const field = new Field({ seed, level: VOLCANO, lives: 99 });
  const bot = Bot.forSeat("ace", seed);
  while (!field.boss && field.steps < 60_000) {
    bot.update(field, STEP);
    field.step(STEP);
  }
  return field;
}

describe("story level 6: the volcano", () => {
  it("brings all its creatures, each with its trait, and keeps every box readable", () => {
    const traits = new Map<string, string>();
    let overlapSteps = 0;
    for (const seed of [1, 2, 3]) {
      const field = new Field({ seed, level: VOLCANO, lives: STORY.LIVES });
      const bot = Bot.forSeat("ace", seed);
      while (!field.knockedOut && !field.cleared && field.steps < 30_000) {
        bot.update(field, STEP);
        field.step(STEP);
        for (const e of field.takeEvents()) {
          if (e.type === "spawned" && e.alien.species) traits.set(e.alien.species, e.alien.ability?.kind ?? "");
        }
        const live = field.aliens.filter((a) => a.active);
        if (live.some((a, i) => live.slice(i + 1).some((b) => a.overlaps(b)))) overlapSteps++;
      }
    }
    expect(Object.fromEntries(traits)).toEqual({
      "lava drip": "drip",
      firefly: "flash",
      tortoise: "shielded",
      spark: "spark",
    });
    expect(overlapSteps).toBe(0);
  });

  it("fireflies flash in step, all dark at the same moment", () => {
    // A burst all along: nobody answers here, so a rest (one sum at a time)
    // would never bring two fireflies up together.
    const level = { ...VOLCANO, WAVES: { PROFILE: [{ KIND: "burst", SHARE: 1 }], BASE: 1, PEAK: 3 } } as const;
    let together = 0;
    for (const seed of [4, 1, 2, 3]) {
      const field = new Field({ seed, level, lives: 99 });
      while (field.steps < 20_000) {
        field.step(STEP);
        const covers = field.aliens.filter((a) => a.active && a.ability instanceof Flash).map((a) => a.ability!.cover);
        if (covers.length < 2) continue;
        expect(Math.max(...covers) - Math.min(...covers)).toBeLessThan(1e-9);
        together++;
      }
    }
    expect(together).toBeGreaterThan(0); // two or more fireflies were up at once
  });

  it("lava drips only move in drops, with rests in between", () => {
    const field = new Field({ seed: 5, level: VOLCANO, lives: 99 });
    const drips = new Set<unknown>();
    let resting = 0;
    while (field.steps < 6000) {
      const before = new Map(field.aliens.map((a) => [a, a.y]));
      field.step(STEP);
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof Hops) || a.species !== "lava drip" || !before.has(a)) continue;
        drips.add(a);
        // (Hit recovery pushes every monster back up; that isn't the drip moving.)
        if (a.ability.phase !== "hop" && !field.recovering) {
          expect(a.y).toBe(before.get(a)); // a resting drip holds still
          resting++;
        }
      }
    }
    expect(drips.size).toBeGreaterThan(0);
    expect(resting).toBeGreaterThan(0);
  });

  it("a tortoise takes two answers (its shell, then itself)", () => {
    const { events } = playLevel(2, "ace");
    const solved = events.filter((e) => e.type === "solved" && e.alien.ability instanceof Shielded);
    expect(solved.some((e) => e.type === "solved" && e.absorbed)).toBe(true);
    expect(solved.some((e) => e.type === "solved" && !e.absorbed)).toBe(true);
  });

  it("the dragon inhales, then breathes fire: a new sum and a step back", () => {
    const field = untilBoss(7);
    const boss = field.boss!;
    expect(boss.ability).toBeInstanceOf(Dragon);
    const dragon = boss.ability as Dragon;
    // Nobody answers now: the dragon walks, winds up and breathes. A breath
    // whose inhale was interrupted by a hit (whose pushback already lifts
    // the dragon) doesn't count: wait for a clean one.
    let inhaledAt: number | null = null;
    let yAtBreath = 0;
    let version = boss.sumVersion;
    let clean = true;
    for (;;) {
      field.step(STEP);
      if (field.recovering) clean = false;
      if (boss.mode === "windup") {
        inhaledAt ??= field.steps;
        yAtBreath = boss.y;
      }
      if (boss.sumVersion === version) continue;
      if (clean || field.steps > 100_000) break;
      version = boss.sumVersion;
      clean = true;
    }
    expect(inhaledAt).not.toBeNull();
    expect(dragon.breathing).toBe(true);
    expect(boss.ability!.cover).toBe(1); // its numbers melt in the flames
    for (let i = 0; i < 60; i++) field.step(STEP);
    expect(boss.y).toBeLessThan(yAtBreath); // the breath reared it back
  });

  it("an ace clears it on every one of 5 seeds; the dragon takes HP answers", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { field, events } = playLevel(seed, "ace");
      expect(field.cleared).toBe(true);
      const bossAnswers = events.filter((e) => e.type === "solved" && e.alien === field.boss);
      expect(bossAnswers).toHaveLength(VOLCANO.BOSS.HP);
      expect(events[events.length - 1].type).toBe("levelCleared");
    }
  });
});
