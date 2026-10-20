import { describe, expect, it } from "vitest";
import { GAME, LEVELS, SIM, STORY, type BotLevel } from "../config/constants";
import { LOOP } from "../config/levels/bedroom";
import type Alien from "../objects/Alien";
import { Boss } from "../objects/abilities";
import { Bounce, JackInTheBox, LoopTheLoop, Nap, UnderTheBed, Windup } from "../objects/bedroom";
import { Bot } from "./Bot";
import { Field, type FieldEvent } from "./Field";

const STEP = SIM.STEP_MS;
// Found by page, not index: levels 7–9 are built alongside it.
const BEDROOM = LEVELS.find((l) => l.PAGE === "bedroom")!;

/** A bot plays the bedroom until it clears it, is knocked out, or time runs
 * out; `watch` sees the field after every step. */
function playLevel(seed: number, level: BotLevel, watch?: (field: Field) => void) {
  const field = new Field({ seed, level: BEDROOM, lives: STORY.LIVES });
  const bot = Bot.forSeat(level, seed);
  const events: FieldEvent[] = [];
  const maxSteps = Math.round((BEDROOM.PATH_MS * 4) / STEP);
  while (!field.knockedOut && !field.cleared && field.steps < maxSteps) {
    bot.update(field, STEP);
    field.step(STEP);
    events.push(...field.takeEvents());
    watch?.(field);
  }
  return { field, events };
}

/** Nobody plays: the toys come down untouched (99 lives). */
function watchUnplayed(seed: number, steps: number, watch: (field: Field, before: Map<Alien, [number, number]>) => void) {
  const field = new Field({ seed, level: BEDROOM, lives: 99 });
  while (field.steps < steps) {
    const before = new Map(field.aliens.map((a) => [a, [a.x, a.y] as [number, number]]));
    field.step(STEP);
    watch(field, before);
  }
}

/** Play (as an ace) until the bed is up. */
function untilBoss(seed: number): Field {
  const field = new Field({ seed, level: BEDROOM, lives: 99 });
  const bot = Bot.forSeat("ace", seed);
  while (!field.boss && field.steps < 80_000) {
    bot.update(field, STEP);
    field.step(STEP);
  }
  return field;
}

describe("story level 10: the kid's bedroom", () => {
  it("is the last level of the story", () => {
    expect(LEVELS[LEVELS.length - 1]).toBe(BEDROOM);
  });

  it("brings all its toys, each with its trait, and keeps every box readable", () => {
    const traits = new Map<string, string>();
    let overlapSteps = 0;
    for (const seed of [1, 2, 3]) {
      playLevel(seed, "ace", (field) => {
        const live = field.aliens.filter((a) => a.active);
        for (const a of live) if (a.species) traits.set(a.species, a.ability?.kind ?? "");
        if (live.some((a, i) => live.slice(i + 1).some((b) => a.overlaps(b)))) overlapSteps++;
      });
    }
    expect(Object.fromEntries(traits)).toEqual({
      "toy soldier": "bedroom_windup",
      "jack-in-the-box": "bedroom_jack",
      "rubber ball": "bedroom_bounce",
      "teddy bear": "bedroom_nap",
      "paper plane": "bedroom_loop",
    });
    expect(overlapSteps).toBe(0);
  });

  it("soldiers that march in together run down and stop together", () => {
    let comparedSteps = 0;
    let stopped = 0;
    for (const seed of [1, 2, 3, 4]) {
      const lines = new Map<number, Alien[]>(); // by spawn time
      watchUnplayed(seed, 20_000, (field) => {
        for (const a of field.aliens) {
          if (!(a.ability instanceof Windup) || field.aliens.indexOf(a) < 0) continue;
          const line = lines.get(a.spawnedAt) ?? [];
          if (!line.includes(a)) line.push(a);
          lines.set(a.spawnedAt, line);
        }
        for (const line of lines.values()) {
          const live = line.filter((a) => a.active);
          if (live.length < 2) continue;
          const phases = live.map((a) => (a.ability as Windup).phase);
          expect(new Set(phases).size).toBe(1);
          comparedSteps++;
          if (phases[0] === "stop") stopped++;
        }
      });
    }
    expect(comparedSteps).toBeGreaterThan(0); // a line came
    expect(stopped).toBeGreaterThan(0); // and stood still together
  });

  it("a stopped soldier doesn't move", () => {
    let stoppedSteps = 0;
    watchUnplayed(2, 8000, (field, before) => {
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof Windup) || !before.has(a) || field.recovering) continue;
        if (a.ability.phase !== "stop") continue;
        expect([a.x, a.y]).toEqual(before.get(a));
        stoppedSteps++;
      }
    });
    expect(stoppedSteps).toBeGreaterThan(0);
  });

  it("a jack-in-the-box hides its numbers while shut and only moves when it pops", () => {
    let shut = 0;
    let open = 0;
    watchUnplayed(3, 12_000, (field, before) => {
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof JackInTheBox) || !before.has(a)) continue;
        const jack = a.ability;
        if (jack.phase === "crank") {
          expect(jack.cover).toBe(1);
          shut++;
        }
        if (jack.phase === "open") {
          expect(jack.cover).toBe(0);
          open++;
        }
        // (Hit recovery pushes every monster back up; that isn't the box moving.)
        if (jack.phase !== "pop" && !field.recovering) expect([a.x, a.y]).toEqual(before.get(a));
      }
    });
    expect(shut).toBeGreaterThan(0);
    expect(open).toBeGreaterThan(0);
  });

  it("a rubber ball bounces down and off the page's edges", () => {
    const lastDx = new Map<Alien, number>();
    let turns = 0;
    let bounced = 0;
    watchUnplayed(4, 20_000, (field, before) => {
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof Bounce) || !before.has(a) || a.mode === "enter") continue;
        expect(a.x - a.halfW).toBeGreaterThanOrEqual(-1);
        expect(a.x + a.halfW).toBeLessThanOrEqual(GAME.WIDTH + 1);
        const dx = a.x - before.get(a)![0];
        if (Math.abs(dx) < 0.01) continue;
        bounced++;
        const prev = lastDx.get(a);
        if (prev !== undefined && Math.sign(prev) !== Math.sign(dx)) turns++;
        lastDx.set(a, dx);
      }
    });
    expect(bounced).toBeGreaterThan(0);
    expect(turns).toBeGreaterThan(0);
  });

  it("a teddy bear holds still while it naps", () => {
    let napSteps = 0;
    watchUnplayed(5, 12_000, (field, before) => {
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof Nap) || !before.has(a) || field.recovering) continue;
        if (a.ability.phase !== "nap") continue;
        expect([a.x, a.y]).toEqual(before.get(a));
        napSteps++;
      }
    });
    expect(napSteps).toBeGreaterThan(0);
  });

  it("the paper plane loops the loop", () => {
    const loopFrom = new Map<Alien, number>();
    let looped = 0;
    watchUnplayed(6, 30_000, (field) => {
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof LoopTheLoop)) continue;
        if (a.ability.loop === null) {
          loopFrom.delete(a);
          continue;
        }
        const from = loopFrom.get(a) ?? a.y;
        loopFrom.set(a, from);
        if (a.y < from - LOOP.RADIUS_PX) looped++; // over the top of its loop
      }
    });
    expect(looped).toBeGreaterThan(0);
  });

  it("the monster's eyes peek out of the dark under the bed, and duck back in", () => {
    const field = untilBoss(7);
    const bed = field.boss!;
    expect(bed.ability).toBeInstanceOf(UnderTheBed);
    const covers = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      field.step(STEP);
      if (!(bed.ability as Boss).burrowing) covers.add(bed.ability!.cover);
    }
    expect(covers.has(0)).toBe(true);
    expect(covers.has(1)).toBe(true);
  });

  it("an ace clears it on 5 seeds: the bed throws toys, then the monster climbs out", () => {
    const part = BEDROOM.BOSS.PART!;
    let thrown = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const { field, events } = playLevel(seed, "ace");
      expect(field.cleared).toBe(true);
      const bossAnswers = events.filter((e) => e.type === "solved" && e.alien.ability instanceof Boss);
      expect(bossAnswers).toHaveLength(BEDROOM.BOSS.HP + part.HP);
      const out = events.filter((e) => e.type === "spawned" && e.alien.model === part.MODEL);
      expect(out).toHaveLength(1);
      // A toy flung from under the bed lands beside it, not at the top.
      const bossIn = events.findIndex((e) => e.type === "spawned" && e.alien === field.boss);
      thrown += events
        .slice(bossIn)
        .filter((e) => e.type === "spawned" && e.alien.species !== null && e.alien.lethal && e.alien.y > 0).length;
      expect(events[events.length - 1].type).toBe("levelCleared");
    }
    expect(thrown).toBeGreaterThan(0);
  });
});
