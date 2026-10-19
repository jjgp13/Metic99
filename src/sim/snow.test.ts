import { describe, expect, it } from "vitest";
import { LEVELS, SIM, STORY, type BotLevel } from "../config/constants";
import { ICE_SLIDE, PENGUIN_SLIDE, SNOWBALL_GROW } from "../config/levels/snow";
import { IceSlide, PenguinSlide, SnowballGrow } from "../objects/snowTraits";
import { Yeti } from "../objects/yeti";
import type Alien from "../objects/Alien";
import { Bot } from "./Bot";
import { Field, type FieldEvent } from "./Field";

const STEP = SIM.STEP_MS;
// Found by page, not index: levels 7, 9 and 10 are built alongside it.
const SNOW = LEVELS.find((l) => l.PAGE === "snow")!;

/** A bot plays the snowy mountain until it clears it, is knocked out, or time runs out. */
function playLevel(seed: number, level: BotLevel) {
  const field = new Field({ seed, level: SNOW, lives: STORY.LIVES });
  const bot = Bot.forSeat(level, seed);
  const events: FieldEvent[] = [];
  const maxSteps = Math.round((SNOW.PATH_MS * 3) / STEP);
  while (!field.knockedOut && !field.cleared && field.steps < maxSteps) {
    bot.update(field, STEP);
    field.step(STEP);
    events.push(...field.takeEvents());
  }
  return { field, events };
}

/** Play (as an ace) until the yeti is up. */
function untilBoss(seed: number): Field {
  const field = new Field({ seed, level: SNOW, lives: 99 });
  const bot = Bot.forSeat("ace", seed);
  while (!field.boss && field.steps < 60_000) {
    bot.update(field, STEP);
    field.step(STEP);
  }
  return field;
}

describe("story level 8: the snowy mountain", () => {
  it("brings all its creatures, each with its trait, and keeps every box readable", () => {
    const traits = new Map<string, string>();
    let overlapSteps = 0;
    for (const seed of [1, 2, 3]) {
      const field = new Field({ seed, level: SNOW, lives: STORY.LIVES });
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
      penguin: "snow_slide",
      snowball: "snow_grow",
      "ice block": "snow_ice",
      snowflake: "snow_gust",
    });
    expect(overlapSteps).toBe(0);
  });

  it("penguins lean, then belly-slide forward, holding still while they lean", () => {
    const field = new Field({ seed: 4, level: SNOW, lives: 99 });
    let leaning = 0;
    let slides = 0;
    const leanY = new Map<Alien, number>();
    while (field.steps < 8000) {
      field.step(STEP);
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof PenguinSlide)) continue;
        const phase = a.ability.phase;
        if (field.recovering) {
          // Hit recovery pushes every monster back up; that isn't the penguin moving.
          leanY.delete(a);
        } else if (phase === "warn") {
          if (leanY.has(a)) expect(a.y).toBe(leanY.get(a));
          leanY.set(a, a.y);
          leaning++;
        } else {
          if (phase === "slide" && leanY.has(a)) slides++; // a slide right after a lean
          leanY.delete(a);
        }
      }
    }
    expect(leaning).toBeGreaterThan(0);
    expect(slides).toBeGreaterThan(0);
    expect(PENGUIN_SLIDE.SLIDE_PX).toBeGreaterThan(0);
  });

  it("a snowball picks up a number past the grow line: its old numbers stay", () => {
    const field = new Field({ seed: 5, level: SNOW, lives: 99 });
    let grew = 0;
    const before = new Map<Alien, readonly number[]>();
    while (field.steps < 12_000 && grew < 3) {
      field.step(STEP);
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof SnowballGrow)) continue;
        if (!a.ability.grown) {
          expect(a.ballCount).toBe(2);
          before.set(a, a.digits);
        } else if (before.has(a)) {
          const old = before.get(a)!;
          expect(a.y).toBeGreaterThanOrEqual(SNOWBALL_GROW.GROW_Y);
          expect(a.digits.slice(0, old.length)).toEqual(old);
          expect(a.ballCount).toBe(3);
          expect(a.result).toBe(a.digits.reduce((s, d) => s + d, 0));
          expect(field.alienFor(a.result)).toBe(a); // still the one alien with that answer
          before.delete(a);
          grew++;
        }
      }
    }
    expect(grew).toBeGreaterThan(0);
  });

  it("ice blocks speed up as they slide down", () => {
    const field = new Field({ seed: 6, level: SNOW, lives: 99 });
    const high: number[] = [];
    const low: number[] = [];
    while (field.steps < 20_000) {
      const ys = new Map(field.aliens.map((a) => [a, a.y]));
      field.step(STEP);
      if (field.recovering) continue;
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof IceSlide) || !ys.has(a) || a.scripted) continue;
        const dy = a.y - ys.get(a)!;
        if (dy <= 0) continue; // standing between stomps, or held by the readability rule
        (a.y < 140 ? high : a.y > 300 ? low : []).push(dy);
      }
    }
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(high.length).toBeGreaterThan(0);
    expect(low.length).toBeGreaterThan(0);
    expect(avg(low)).toBeGreaterThan(avg(high) * 1.4);
    expect(ICE_SLIDE.TO_PACE).toBeGreaterThan(ICE_SLIDE.FROM_PACE);
  });

  it("the yeti winds up, stomps and throws a snowball that rolls down", () => {
    const field = untilBoss(7);
    const boss = field.boss!;
    expect(boss.ability).toBeInstanceOf(Yeti);
    const yeti = boss.ability as Yeti;
    // Nobody answers now: the yeti walks, winds up and stomps.
    let woundUp = false;
    let thrown: Alien | null = null;
    for (let i = 0; i < 40_000 && !thrown; i++) {
      const before = new Set(field.aliens);
      field.step(STEP);
      if (boss.mode === "windup") woundUp = true;
      if (!yeti.stomping) continue;
      thrown = field.aliens.find((a) => !before.has(a) && a.species === "snowball") ?? null;
    }
    expect(woundUp).toBe(true);
    expect(thrown).not.toBeNull();
    expect(thrown!.ballCount).toBe(2);
    const y0 = thrown!.y;
    for (let i = 0; i < 240; i++) field.step(STEP);
    expect(thrown!.y).toBeGreaterThan(y0); // it rolls down the slope
  });

  it("an ace clears it on every one of 5 seeds; the yeti takes HP answers", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { field, events } = playLevel(seed, "ace");
      expect(field.cleared).toBe(true);
      const bossAnswers = events.filter((e) => e.type === "solved" && e.alien === field.boss);
      expect(bossAnswers).toHaveLength(SNOW.BOSS.HP);
      expect(events[events.length - 1].type).toBe("levelCleared");
    }
  });
});
