import { describe, expect, it } from "vitest";
import { SimClock } from "./SimClock";

describe("SimClock", () => {
  it("runs one step per whole step of real time and keeps the rest", () => {
    const clock = new SimClock(10, 8);
    let steps = 0;
    clock.advance(25, () => void steps++);
    expect(steps).toBe(2);
    expect(clock.alpha).toBeCloseTo(0.5);
    clock.advance(5, () => void steps++);
    expect(steps).toBe(3);
    expect(clock.alpha).toBeCloseTo(0);
  });

  it("drops time beyond maxStepsPerFrame after a stall", () => {
    const clock = new SimClock(10, 3);
    let steps = 0;
    clock.advance(1000, () => void steps++);
    expect(steps).toBe(3);
  });

  it("stops early when a step returns false", () => {
    const clock = new SimClock(10, 8);
    let steps = 0;
    clock.advance(50, () => ++steps < 2);
    expect(steps).toBe(2);
  });
});
