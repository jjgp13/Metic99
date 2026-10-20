import { describe, expect, it } from "vitest";
import { LEVELS, SIM, STORY, type BotLevel } from "../config/constants";
import { Boss } from "../objects/abilities";
import { BigFrog } from "../objects/pondCreatures";
import { Bot } from "./Bot";
import { Field, type FieldEvent } from "./Field";

const STEP = SIM.STEP_MS;
const POND = LEVELS.find((l) => l.PAGE === "pond")!;

/** A bot plays the pond until it clears it, is knocked out, or time runs out;
 * `watch` sees the field after every step. */
function playPond(seed: number, level: BotLevel, watch?: (field: Field, events: FieldEvent[]) => void) {
  const field = new Field({ seed, level: POND, lives: STORY.LIVES });
  const bot = Bot.forSeat(level, seed);
  const events: FieldEvent[] = [];
  const maxSteps = Math.round((POND.PATH_MS * 3) / STEP);
  while (!field.knockedOut && !field.cleared && field.steps < maxSteps) {
    bot.update(field, STEP);
    field.step(STEP);
    const fresh = field.takeEvents();
    events.push(...fresh);
    watch?.(field, fresh);
  }
  return { field, events };
}

describe("story level 2, the pond", () => {
  it("brings every creature, with 3–4 ball frogs, and keeps every box readable", () => {
    const species = new Set<string>();
    const frogBalls = new Set<number>();
    let schools = 0;
    let overlapSteps = 0;
    for (const seed of [1, 2, 3]) {
      playPond(seed, "ace", (field, events) => {
        for (const e of events) {
          if (e.type !== "spawned" || !e.alien.species) continue;
          species.add(e.alien.species);
          if (e.alien.species === "frog") frogBalls.add(e.alien.ballCount);
          // A school follower spawns in the same step as its leader, right above it.
          if (e.alien.species === "fish" && e.alien.y < -e.alien.bottom - 10) schools++;
        }
        const live = field.aliens.filter((a) => a.active);
        if (live.some((a, i) => live.slice(i + 1).some((b) => a.overlaps(b)))) overlapSteps++;
      });
    }
    expect([...species].sort()).toEqual(["dragonfly", "duck", "fish", "frog"]);
    expect([...frogBalls].sort()).toEqual([3, 4]);
    expect(schools).toBeGreaterThan(0);
    expect(overlapSteps).toBe(0);
  });

  it("dragonflies dart down and hover; ducks dive with their numbers hidden", () => {
    let hovered = false;
    let duckHidden = false;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      playPond(seed, "pilot", (field) => {
        for (const a of field.aliens) {
          if (!a.active) continue;
          if (a.species === "dragonfly" && a.mode === "dive" && a.y === a.prevY && a.y > 0) hovered = true;
          if (a.species === "duck" && a.ability?.cover === 1) duckHidden = true;
        }
      });
    }
    expect(hovered).toBe(true);
    expect(duckHidden).toBe(true);
  });

  it("the Big Frog croaks before each leap and takes HP answers", () => {
    let croaked = false;
    let leapedDown = false;
    let lastY = 0;
    const { field, events } = playPond(4, "ace", (f) => {
      const boss = f.boss;
      if (!boss?.active || !(boss.ability instanceof BigFrog) || boss.ability.burrowing) return;
      if (boss.mode === "windup") croaked = true;
      if (lastY > 0 && boss.y > lastY + 1) leapedDown = true;
      lastY = boss.y;
    });
    expect(field.boss?.ability).toBeInstanceOf(Boss);
    expect(croaked).toBe(true);
    expect(leapedDown).toBe(true);
    expect(field.cleared).toBe(true);
    const bossAnswers = events.filter((e) => e.type === "solved" && e.alien === field.boss);
    expect(bossAnswers).toHaveLength(POND.BOSS.HP);
  });

  it("pilots and aces clear it", () => {
    for (const level of ["pilot", "ace"] as BotLevel[]) {
      const cleared = [1, 2, 3, 4, 5].filter((seed) => playPond(seed, level).field.cleared).length;
      expect(cleared).toBeGreaterThanOrEqual(4);
    }
  });
});
