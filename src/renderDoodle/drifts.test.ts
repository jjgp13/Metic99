import { describe, expect, it } from "vitest";
import { GAME } from "../config/constants";
import { DriftLayer, type DriftDef } from "./drifts";

const dot = { w: 10, h: 10, draw() {} };

/** A seeded stand-in for Math.random, so the test always rolls the same. */
function fakeRandom(seed = 1): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

describe("DriftLayer", () => {
  it("scatters `count` drifts per def over the screen", () => {
    const defs: DriftDef[] = [
      { recipe: dot, count: 3, vx: 0, vy: 20 },
      { recipe: dot, count: 2, vx: 15, vy: 0 },
    ];
    const layer = new DriftLayer(defs, fakeRandom());
    expect(layer.drifts.map((d) => d.index)).toEqual([0, 0, 0, 1, 1]);
    for (const d of layer.drifts) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x).toBeLessThanOrEqual(GAME.WIDTH);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeLessThanOrEqual(GAME.HEIGHT);
    }
  });

  it("brings drifts back in, so they stay near the screen forever", () => {
    const defs: DriftDef[] = [
      { recipe: dot, count: 4, vx: 0, vy: 40 }, // snow falls
      { recipe: dot, count: 4, vx: -30, vy: -10, swayPx: 8, swayHz: 0.3 }, // seeds blow up-left
    ];
    const layer = new DriftLayer(defs, fakeRandom(7));
    for (let i = 0; i < 60 * 120; i++) layer.step(1 / 60); // two minutes
    for (const d of layer.drifts) {
      const margin = d.def.recipe.w + (d.def.swayPx ?? 0) + 1;
      expect(d.x).toBeGreaterThan(-margin);
      expect(d.x).toBeLessThan(GAME.WIDTH + margin);
      expect(d.y).toBeGreaterThan(-d.def.recipe.h - 1);
      expect(d.y).toBeLessThan(GAME.HEIGHT + d.def.recipe.h + 1);
    }
  });

  it("re-enters on the side a drift came from", () => {
    const layer = new DriftLayer([{ recipe: dot, count: 1, vx: 0, vy: 50 }], fakeRandom(3));
    const flake = layer.drifts[0];
    flake.y = GAME.HEIGHT + flake.def.recipe.h - 0.1;
    layer.step(0.1);
    expect(flake.y).toBe(-flake.def.recipe.h); // back in at the top
  });
});
