import { describe, expect, it } from "vitest";
import { RateLimit } from "./RateLimit";

describe("RateLimit (token bucket)", () => {
  it("lets a normal client through: 22 messages a second for a minute", () => {
    const limit = new RateLimit(60, 120, 0);
    for (let ms = 0; ms < 60_000; ms += 1000 / 22) expect(limit.take(ms)).toBe(true);
  });

  it("allows a burst, then refuses a flood", () => {
    const limit = new RateLimit(60, 120, 0);
    let allowed = 0;
    for (let i = 0; i < 1000; i++) if (limit.take(0)) allowed++;
    expect(allowed).toBe(120);
  });

  it("refills over time", () => {
    const limit = new RateLimit(60, 120, 0);
    for (let i = 0; i < 120; i++) limit.take(0);
    expect(limit.take(0)).toBe(false);
    expect(limit.take(1000)).toBe(true); // a second later: 60 new tokens
  });
});
