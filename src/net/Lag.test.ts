import { describe, expect, it, vi } from "vitest";
import { Lag } from "./Lag";

describe("Lag (fake network delay)", () => {
  it("keeps order under heavy jitter, like a real socket", async () => {
    vi.useFakeTimers();
    const lag = new Lag(20, 200);
    const seen: number[] = [];
    for (let i = 0; i < 200; i++) lag.later(() => seen.push(i));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(seen).toEqual(Array.from({ length: 200 }, (_, i) => i));
    vi.useRealTimers();
  });

  it("does nothing when off", () => {
    const seen: number[] = [];
    new Lag(0, 0).later(() => seen.push(1));
    expect(seen).toEqual([1]);
  });
});
