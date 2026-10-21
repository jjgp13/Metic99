import { describe, expect, it } from "vitest";
import { SIM, STORY, type BotLevel } from "../config/constants";
import { TREETOPS, OWL_RIDDLE } from "../config/levels/treetops";
import { WiseOwl } from "../objects/owlBoss";
import { HeadTurn, Leap } from "../objects/treetopsTraits";
import { Bot } from "./Bot";
import { Field, type FieldEvent } from "./Field";

const STEP = SIM.STEP_MS;

/** A bot plays level 3 until it clears it, is knocked out, or time runs out. */
function playLevel(seed: number, level: BotLevel, watch?: (field: Field, events: FieldEvent[]) => void) {
  const field = new Field({ seed, level: TREETOPS, lives: STORY.LIVES });
  const bot = Bot.forSeat(level, seed);
  const events: FieldEvent[] = [];
  const maxSteps = Math.round((TREETOPS.PATH_MS * 3) / STEP);
  while (!field.knockedOut && !field.cleared && field.steps < maxSteps) {
    bot.update(field, STEP);
    field.step(STEP);
    const stepEvents = field.takeEvents();
    events.push(...stepEvents);
    watch?.(field, stepEvents);
  }
  return { field, events };
}

describe("story level 3: the treetops", () => {
  it("brings every creature, keeps every box readable, and birds fly in flocks", () => {
    const species = new Set<string>();
    let overlapSteps = 0;
    let flockBirds = 0;
    // Rookies leave the most creatures on the page at once.
    for (const [seed, level] of [[1, "ace"], [2, "ace"], [3, "rookie"], [4, "rookie"]] as const) {
      playLevel(seed, level, (field, events) => {
        for (const e of events) {
          if (e.type !== "spawned") continue;
          if (e.alien.species) species.add(e.alien.species);
          // A follower spawns in the same step as its leader, right above it.
          if (e.alien.species === "bird" && e.alien.y < -e.alien.bottom - 10) flockBirds++;
        }
        const live = field.aliens.filter((a) => a.active);
        if (live.some((a, i) => live.slice(i + 1).some((b) => a.overlaps(b)))) overlapSteps++;
      });
    }
    expect([...species].sort()).toEqual(["bird", "hummingbird", "owl", "squirrel"]);
    expect(overlapSteps).toBe(0);
    expect(flockBirds).toBeGreaterThan(0);
  });

  it("squirrels leap sideways from branch to branch", () => {
    let leaps = 0;
    const lastX = new Map<object, number>();
    playLevel(4, "ace", (field) => {
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof Leap) || a.mode !== "move") continue;
        const before = lastX.get(a);
        if (before !== undefined && Math.abs(a.x - before) > 2) leaps++; // a whole step sideways
        lastX.set(a, a.x);
      }
    });
    expect(leaps).toBeGreaterThan(0);
  });

  it("owls hide their numbers while perched, never while they swoop", () => {
    let hidden = 0;
    let hiddenSwooping = 0;
    for (const seed of [5, 1, 2, 3]) playLevel(seed, "ace", (field) => {
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof HeadTurn) || a.ability.cover < 1) continue;
        hidden++;
        if (a.mode === "windup" || a.mode === "dive") hiddenSwooping++;
      }
    });
    expect(hidden).toBeGreaterThan(0);
    expect(hiddenSwooping).toBe(0);
  });

  it("the Great Owl asks riddles: the answer is its missing number, and it can be beaten", () => {
    let cleared = 0;
    let riddles = 0;
    let badRiddles = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const { field, events } = playLevel(seed, "ace", (f, stepEvents) => {
        for (const e of stepEvents) {
          if (e.type !== "solved" || e.alien !== f.boss) continue;
          // What was typed: the second eye's number, not the total.
          riddles++;
          const [, missing] = e.digits;
          if (e.digits.length !== 2 || missing < OWL_RIDDLE.MIN_ANSWER) badRiddles++;
        }
        const boss = f.boss;
        if (boss?.active && boss.ability instanceof WiseOwl && boss.ability.riddle) {
          if (boss.result !== boss.digits[1] || boss.ability.ballText(1, boss.digits[1]) !== "?") badRiddles++;
        }
      });
      if (!field.cleared) continue;
      cleared++;
      expect(field.boss!.ability).toBeInstanceOf(WiseOwl);
      const answers = events.filter((e) => e.type === "solved" && e.alien === field.boss);
      expect(answers).toHaveLength(TREETOPS.BOSS.HP);
      expect(events[events.length - 1].type).toBe("levelCleared");
    }
    expect(cleared).toBeGreaterThanOrEqual(3);
    expect(riddles).toBeGreaterThan(0);
    expect(badRiddles).toBe(0);
  });
});
