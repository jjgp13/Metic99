import { describe, expect, it } from "vitest";
import { BALL_COLOR, GAME, LEVELS, PLAYER, SIM, STORY, type BotLevel } from "../config/constants";
import { INVADER_MARCH, UFO_WARP } from "../config/levels/night";
import Alien from "../objects/Alien";
import { Moon } from "../objects/moon";
import { Bounce, March, Warp, Wish } from "../objects/nightTraits";
import { Bot } from "./Bot";
import { Field, type FieldEvent } from "./Field";
import { Rng } from "./rng";

const STEP = SIM.STEP_MS;
// Found by page, not index: levels 7, 8 and 10 are built alongside it.
const NIGHT = LEVELS.find((l) => l.PAGE === "night")!;

/** A bot plays the night sky until it clears it, is knocked out, or time runs out. */
function playLevel(seed: number, level: BotLevel) {
  const field = new Field({ seed, level: NIGHT, lives: STORY.LIVES });
  const bot = Bot.forSeat(level, seed);
  const events: FieldEvent[] = [];
  const maxSteps = Math.round((NIGHT.PATH_MS * 3) / STEP);
  while (!field.knockedOut && !field.cleared && field.steps < maxSteps) {
    bot.update(field, STEP);
    field.step(STEP);
    events.push(...field.takeEvents());
  }
  return { field, events };
}

/** Nobody plays: step the field, calling `look` after each step. */
function watch(seed: number, steps: number, look: (field: Field) => void): void {
  const field = new Field({ seed, level: NIGHT, lives: 99 });
  while (field.steps < steps) {
    field.step(STEP);
    look(field);
  }
}

const live = (field: Field, trait: abstract new (...args: never[]) => unknown) =>
  field.aliens.filter((a) => a.active && a.ability instanceof trait);

describe("story level 9: the night sky", () => {
  it("brings all its creatures, each with its trait, and keeps every box readable", () => {
    const traits = new Map<string, string>();
    let overlapSteps = 0;
    for (const seed of [1, 2, 3]) {
      const field = new Field({ seed, level: NIGHT, lives: STORY.LIVES });
      const bot = Bot.forSeat("ace", seed);
      while (!field.knockedOut && !field.cleared && field.steps < 30_000) {
        bot.update(field, STEP);
        field.step(STEP);
        for (const e of field.takeEvents()) {
          if (e.type === "spawned" && e.alien.species) traits.set(e.alien.species, e.alien.ability?.kind ?? "");
        }
        const alive = field.aliens.filter((a) => a.active);
        if (alive.some((a, i) => alive.slice(i + 1).some((b) => a.overlaps(b)))) overlapSteps++;
      }
    }
    expect(Object.fromEntries(traits)).toEqual({
      invader: "night_march",
      "big invader": "night_bigMarch",
      comet: "night_bounce",
      ufo: "night_warp",
      "shooting star": "night_wish",
    });
    expect(overlapSteps).toBe(0);
  });

  it("invaders come in rows and step together, holding still between steps", () => {
    let rows = 0;
    let together = 0;
    let resting = 0;
    let wasResting = new Set<Alien>();
    watch(1, 12_000, (field) => {
      const invaders = live(field, March).filter((a) => a.species === "invader");
      // Side by side at the same height, the same step in their walk: a row.
      const pairs = invaders.flatMap((a, i) => invaders.slice(i + 1).map((b) => [a, b] as const));
      for (const [a, b] of pairs) {
        if (a.y !== b.y || Math.abs(a.x - b.x) > 200 || a.y > 0) continue;
        rows++;
      }
      for (const [a, b] of pairs) {
        const sameBeat = a.spawnedAt === b.spawnedAt && a.prevY === b.prevY;
        if (sameBeat && !field.recovering) {
          // A row moves as one: the same step at the same moment.
          expect(a.y - a.prevY).toBeCloseTo(b.y - b.prevY, 6);
          together++;
        }
      }
      const nowResting = new Set(invaders.filter((a) => !a.gliding && a.holdLeftMs > 0));
      for (const a of nowResting) {
        if (!wasResting.has(a) || field.recovering) continue;
        expect(a.y).toBe(a.prevY); // between steps it stands still
        expect(a.x).toBe(a.prevX);
        resting++;
      }
      wasResting = nowResting;
    });
    expect(rows).toBeGreaterThan(0);
    expect(together).toBeGreaterThan(0);
    expect(resting).toBeGreaterThan(0);
  });

  it("an invader's beat quickens as it comes down", () => {
    // One invader on its own, marching down an empty page.
    const march = new March("night_march", INVADER_MARCH);
    const invader = new Alien({
      kind: "darter",
      x: GAME.WIDTH / 2,
      y: 0,
      bodyKey: "alien1",
      result: 5,
      digits: [2, 3],
      ballTexture: BALL_COLOR.SUM,
      fallSpeed: 100,
      homeSpeed: 100,
      spawnedAt: 0,
      rng: new Rng(1),
      layout: "eyes",
      ability: march,
    });
    const beats: { y: number; ms: number }[] = [];
    let frame = march.frame;
    let since = 0;
    while (invader.y < PLAYER.Y) {
      march.update(STEP, invader);
      invader.advance(STEP);
      since += STEP;
      if (march.frame !== frame) {
        beats.push({ y: invader.y, ms: since });
        frame = march.frame;
        since = 0;
      }
    }
    const high = beats.filter((b) => b.y < 120).map((b) => b.ms);
    const low = beats.filter((b) => b.y > 300).map((b) => b.ms);
    expect(high.length).toBeGreaterThan(1);
    expect(low.length).toBeGreaterThan(1);
    expect(Math.min(...high.slice(1))).toBeGreaterThan(Math.max(...low));
  });

  it("comets fly on a slant and bounce", () => {
    const flips = new Set<Alien>();
    const dirs = new Map<Alien, number>();
    watch(3, 20_000, (field) => {
      for (const a of live(field, Bounce)) {
        const dir = (a.ability as Bounce).dir;
        if (dir === 0) continue;
        if (dirs.has(a) && dirs.get(a) !== dir) flips.add(a);
        dirs.set(a, dir);
      }
    });
    expect(dirs.size).toBeGreaterThan(0);
    expect(flips.size).toBeGreaterThan(0);
  });

  it("UFOs spin their lights, then warp across, hidden on the way", () => {
    const from = new Map<Alien, number>();
    let warned = 0;
    let warps = 0;
    watch(4, 20_000, (field) => {
      for (const a of live(field, Warp)) {
        const warp = a.ability as Warp;
        if (warp.phase === "warn") {
          expect(warp.cover).toBe(0); // the telegraph: still readable
          warned++;
        } else if (warp.phase === "warp") {
          expect(warp.cover).toBe(1);
          if (!from.has(a)) from.set(a, a.prevX);
        } else if (from.has(a)) {
          const x0 = from.get(a)!;
          from.delete(a);
          // (plus the patrol step it takes once it is back)
          expect(Math.abs(a.x - x0)).toBeLessThanOrEqual(UFO_WARP.PX + 2);
          // It jumps toward the side of the page with more room.
          expect(Math.sign(a.x - x0)).toBe(x0 < GAME.WIDTH / 2 ? 1 : -1);
          warps++;
        }
      }
    });
    expect(warned).toBeGreaterThan(0);
    expect(warps).toBeGreaterThan(0);
  });

  it("a shooting star burns out before it leaves the page", () => {
    let burnt = 0;
    watch(5, 40_000, (field) => {
      for (const a of live(field, Wish)) if (a.ability!.cover >= 1) burnt++;
    });
    expect(burnt).toBeGreaterThan(0);
  });

  it("the moon's shadow darkens its numbers one by one, left first; its sum stays", () => {
    const field = new Field({ seed: 6, level: NIGHT, lives: 99 });
    const bot = Bot.forSeat("ace", 6);
    while (!field.boss && field.steps < 60_000) {
      bot.update(field, STEP);
      field.step(STEP);
    }
    const boss = field.boss!;
    expect(boss.ability).toBeInstanceOf(Moon);
    const moon = boss.ability as Moon;
    const result = boss.result;
    let leftFirst = 0;
    let dark = 0;
    for (let i = 0; i < 1500; i++) {
      field.step(STEP); // nobody answers
      const [l, m, r] = [0, 1, 2].map((b) => moon.ballCover(b, 3));
      if (l > r) leftFirst++;
      if (l === 1 && m === 1 && r === 1) dark++;
      const [from, to] = moon.shadow;
      if (from === 0 && to > 0) {
        // Waning: the shadow comes in from the left.
        expect(l).toBeGreaterThanOrEqual(m - 1e-9);
        expect(m).toBeGreaterThanOrEqual(r - 1e-9);
      } else if (to === 1) {
        // Waxing: it leaves to the right, so the left number is lit first.
        expect(l).toBeLessThanOrEqual(m + 1e-9);
        expect(m).toBeLessThanOrEqual(r + 1e-9);
      }
    }
    expect(leftFirst).toBeGreaterThan(0);
    expect(dark).toBeGreaterThan(0); // new moon: all dark
    expect(boss.result).toBe(result);
  });

  it("an ace clears it on every one of 5 seeds; the moon takes HP answers", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { field, events } = playLevel(seed, "ace");
      expect(field.cleared).toBe(true);
      const bossAnswers = events.filter((e) => e.type === "solved" && e.alien === field.boss);
      expect(bossAnswers).toHaveLength(NIGHT.BOSS.HP);
      expect(events[events.length - 1].type).toBe("levelCleared");
    }
  });
});
