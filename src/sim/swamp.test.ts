import { describe, expect, it } from "vitest";
import { LEVELS, SIM, STORY, type BotLevel } from "../config/constants";
import { SLIME } from "../config/levels/swamp";
import { Boss } from "../objects/abilities";
import type Alien from "../objects/Alien";
import { MudHalf, MudMonster, SlimeSplit } from "../objects/swamp";
import { Bot } from "./Bot";
import { Field, type FieldEvent } from "./Field";

const STEP = SIM.STEP_MS;
const SWAMP = LEVELS.find((l) => l.PAGE === "swamp")!;

/** A bot plays the swamp until it clears it, is knocked out, or time runs
 * out; `each` sees the field after every step. */
function playSwamp(seed: number, level: BotLevel, each?: (field: Field) => void) {
  const field = new Field({ seed, level: SWAMP, lives: STORY.LIVES });
  const bot = Bot.forSeat(level, seed);
  const events: FieldEvent[] = [];
  const maxSteps = Math.round((SWAMP.PATH_MS * 3) / STEP);
  while (!field.knockedOut && !field.cleared && field.steps < maxSteps) {
    bot.update(field, STEP);
    field.step(STEP);
    events.push(...field.takeEvents());
    each?.(field);
  }
  return { field, events };
}

describe("story level 4, the mud swamp", () => {
  it("brings every creature, and no two boxes ever overlap", () => {
    const species = new Set<string>();
    let overlapSteps = 0;
    for (const seed of [1, 2, 3]) {
      const { events } = playSwamp(seed, "ace", (field) => {
        const live = field.aliens.filter((a) => a.active);
        if (live.some((a, i) => live.slice(i + 1).some((b) => a.overlaps(b)))) overlapSteps++;
      });
      for (const e of events) if (e.type === "spawned" && e.alien.species) species.add(e.alien.species);
    }
    expect([...species].sort()).toEqual(["firefly", "peeper", "slime", "snail", "turtle"]);
    expect(overlapSteps).toBe(0);
  });

  it("a slime pops into two little blobs that land up the field", () => {
    const landings: number[] = [];
    const host = {
      rerollSum: () => false,
      spawnSplitling: (_p: Alien, _x: number, y: number) => landings.push(y) > 0,
      spawnBossPart: () => null,
    };
    const slime = { x: 240, y: 420 } as Alien;
    new SlimeSplit().onKilled(slime, host);
    expect(landings).toHaveLength(2);
    for (const y of landings) expect(y).toBeLessThanOrEqual(SLIME.MAX_CHILD_Y);
  });

  it("the Mud Monster sinks, splits in two, and both halves must be beaten", () => {
    const { field, events } = playSwamp(7, "ace");
    expect(field.cleared).toBe(true);
    const whole = field.boss!;
    expect(whole.ability).toBeInstanceOf(MudMonster);
    const bossSolves = events.filter((e) => e.type === "solved" && e.alien.ability instanceof Boss);
    // 2 answers for the whole, 2 for each half.
    expect(bossSolves).toHaveLength(SWAMP.BOSS.HP + 2 * SWAMP.BOSS.PART!.HP);
    const halves = events.flatMap((e) => (e.type === "spawned" && e.alien.ability instanceof MudHalf ? [e.alien] : []));
    expect(halves).toHaveLength(2);
    // The level clears only on the last half's answer.
    const cleared = events.findIndex((e) => e.type === "levelCleared");
    const halfDown = events.flatMap((e, i) =>
      e.type === "solved" && !e.absorbed && e.alien.ability instanceof MudHalf ? [i] : [],
    );
    expect(halfDown).toHaveLength(2);
    const lastHalfDown = halfDown[1];
    expect(cleared).toBe(lastHalfDown + 1);
    expect(events.filter((e) => e.type === "levelCleared")).toHaveLength(1);
  });

  it("a half glops back up on its own side", () => {
    const xs = new Map<Alien, number[]>();
    playSwamp(7, "ace", (field) => {
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof MudHalf)) continue;
        if (!xs.has(a)) xs.set(a, []);
        xs.get(a)!.push(a.x);
      }
    });
    expect(xs.size).toBe(2);
    for (const seen of xs.values()) {
      // It glides out once at the split, then only moves up and down.
      const settled = seen.slice(60);
      expect(Math.max(...settled) - Math.min(...settled)).toBeLessThan(1);
    }
  });

  it("an ace clears it; a pilot sometimes does", () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    expect(seeds.filter((s) => playSwamp(s, "ace").field.cleared).length).toBeGreaterThanOrEqual(5);
    // Pilots lean on FREEZE here; with scarce energy (ENERGY.POWER_RATE) they
    // clear fewer swamps (1/6 at rate 0.4, 2+/6 at rate 1).
    expect(seeds.filter((s) => playSwamp(s, "pilot").field.cleared).length).toBeGreaterThanOrEqual(1);
  });
});
