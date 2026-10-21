import { describe, expect, it } from "vitest";
import { LEVEL_CLEAR, PLAYER } from "../config/constants";
import { shipLaunchPose } from "./shipLaunch";

describe("shipLaunchPose", () => {
  const goneAt = LEVEL_CLEAR.SQUASH_MS + LEVEL_CLEAR.FLY_MS;

  it("starts as the ship at rest", () => {
    expect(shipLaunchPose(0)).toEqual({ liftPx: -0, scaleX: 1, scaleY: 1, shiverPx: 0, trail: 0 });
  });

  it("squashes down (wider, flatter, a little lower) before it leaves", () => {
    const p = shipLaunchPose(LEVEL_CLEAR.SQUASH_MS - 1);
    expect(p.liftPx).toBeLessThan(0);
    expect(p.scaleY).toBeLessThan(1);
    expect(p.scaleX).toBeGreaterThan(1);
    expect(p.trail).toBe(0);
  });

  it("climbs faster and faster", () => {
    const step = LEVEL_CLEAR.FLY_MS / 4;
    const lifts = [1, 2, 3, 4].map((i) => shipLaunchPose(LEVEL_CLEAR.SQUASH_MS + i * step).liftPx);
    const gains = lifts.slice(1).map((l, i) => l - lifts[i]);
    expect(gains[1]).toBeGreaterThan(gains[0]);
    expect(gains[2]).toBeGreaterThan(gains[1]);
  });

  it("is above the top edge when the launch says it's gone, and keeps going", () => {
    const y = (ms: number) => PLAYER.Y - shipLaunchPose(ms).liftPx;
    expect(y(goneAt)).toBeCloseTo(-LEVEL_CLEAR.EXIT_MARGIN_PX);
    expect(y(goneAt + 200)).toBeLessThan(y(goneAt));
  });
});
