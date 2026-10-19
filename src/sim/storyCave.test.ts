import { describe, expect, it } from "vitest";
import { SIM, STORY, type BotLevel } from "../config/constants";
import { CAVE } from "../config/levels/cave";
import type Alien from "../objects/Alien";
import { Roost, type BatPhase } from "../objects/caveTraits";
import { CaveTroll } from "../objects/caveTroll";
import { Bot } from "./Bot";
import { Field, type FieldEvent } from "./Field";

const STEP = SIM.STEP_MS;

/** A bot plays the cave until it clears it, is knocked out, or time runs out;
 * `watch` sees the field after every step. */
function playCave(seed: number, level: BotLevel, watch?: (field: Field) => void) {
  const field = new Field({ seed, level: CAVE, lives: STORY.LIVES });
  const bot = Bot.forSeat(level, seed);
  const events: FieldEvent[] = [];
  const maxSteps = Math.round((CAVE.PATH_MS * 3) / STEP);
  while (!field.knockedOut && !field.cleared && field.steps < maxSteps) {
    bot.update(field, STEP);
    field.step(STEP);
    events.push(...field.takeEvents());
    watch?.(field);
  }
  return { field, events };
}

describe("story level 5: the dark cave", () => {
  it("brings its creatures and keeps every box readable", () => {
    const species = new Set<string>();
    let overlapSteps = 0;
    for (const seed of [1, 2, 3]) {
      playCave(seed, "ace", (field) => {
        const live = field.aliens.filter((a) => a.active);
        for (const a of live) if (a.species) species.add(a.species);
        if (live.some((a, i) => live.slice(i + 1).some((b) => a.overlaps(b)))) overlapSteps++;
      });
    }
    expect([...species].sort()).toEqual(["bat", "glowworm", "minecart"]);
    expect(overlapSteps).toBe(0);
  });

  it("bats hang still, wake with a shake, then drop", () => {
    const seen = new Map<Alien, BatPhase[]>();
    let movedWhileHanging = 0;
    const last = new Map<Alien, [number, number]>();
    playCave(4, "rookie", (field) => {
      for (const a of field.aliens) {
        if (!a.active || !(a.ability instanceof Roost)) continue;
        const phases = seen.get(a) ?? [];
        const phase = a.ability.phase;
        if (phases[phases.length - 1] !== phase) phases.push(phase);
        seen.set(a, phases);
        const prev = last.get(a);
        // (Hit recovery pushes every monster back up; that isn't the bat moving.)
        if (phase === "hang" && prev && !field.recovering && (prev[0] !== a.x || prev[1] !== a.y)) movedWhileHanging++;
        if (phase === "wake") expect(a.mode).toBe("windup");
        if (phase === "drop") expect(a.mode).toBe("dive");
        if (phase === "hang") last.set(a, [a.x, a.y]);
        else last.delete(a);
      }
    });
    const lives = [...seen.values()];
    expect(lives.some((p) => p.join() === "fly,hang,wake,drop")).toBe(true);
    // Every bat goes through its life in order (it may be shot at any point).
    for (const p of lives) expect("fly,hang,wake,drop".startsWith(p.join())).toBe(true);
    expect(movedWhileHanging).toBe(0);
  });

  it("glowworms go dark now and then, and light up again", () => {
    let dark = 0;
    let lit = 0;
    playCave(5, "ace", (field) => {
      for (const a of field.aliens) {
        if (!a.active || a.species !== "glowworm") continue;
        if (a.ability!.cover >= 1) dark++;
        else if (a.ability!.cover === 0) lit++;
      }
    });
    expect(dark).toBeGreaterThan(0);
    expect(lit).toBeGreaterThan(dark); // mostly readable
  });

  it("the troll can be read only in the beam, and stands still while lit", () => {
    let litSteps = 0;
    let darkSteps = 0;
    let movedWhileLit = 0;
    let before: [number, number] | null = null;
    const { field, events } = playCave(7, "ace", (f) => {
      const troll = f.boss;
      if (!troll?.active || !(troll.ability instanceof CaveTroll) || troll.ability.burrowing) {
        before = null;
        return;
      }
      const lit = troll.ability.cover < 0.5;
      if (lit) litSteps++;
      else darkSteps++;
      if (lit && before && f.lockedTarget !== troll && (before[0] !== troll.x || before[1] !== troll.y)) {
        movedWhileLit++;
      }
      before = lit ? [troll.x, troll.y] : null;
    });
    expect(field.cleared).toBe(true);
    expect(litSteps).toBeGreaterThan(0);
    expect(darkSteps).toBeGreaterThan(litSteps); // the lamp is a narrow beam
    expect(movedWhileLit).toBe(0);
    const bossAnswers = events.filter((e) => e.type === "solved" && e.alien === field.boss);
    expect(bossAnswers).toHaveLength(CAVE.BOSS.HP);
  });

  it("an ace clears it on most seeds", () => {
    const cleared = [1, 2, 3, 4, 5].filter((seed) => playCave(seed, "ace").field.cleared).length;
    expect(cleared).toBeGreaterThanOrEqual(4);
  });
});
