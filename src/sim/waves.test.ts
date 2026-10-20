import { describe, expect, it } from "vitest";
import { LEVELS, OWNER_WAVE } from "../config/constants";
import { waveAt } from "./waves";

describe("story waves", () => {
  it("each push peaks higher than the one before, and every rest is back at the base", () => {
    // A push = the stretches between two rests; its peak = its highest point.
    const peaks: number[] = [];
    let inPush = false;
    for (let p = 0; p < 1; p += 0.001) {
      const w = waveAt(OWNER_WAVE, p);
      if (w.kind === "rest") {
        expect(w.intensity).toBe(0);
        inPush = false;
        continue;
      }
      if (!inPush) peaks.push(0);
      inPush = true;
      peaks[peaks.length - 1] = Math.max(peaks[peaks.length - 1], w.intensity);
    }
    expect(peaks.length).toBe(3);
    for (let i = 1; i < peaks.length; i++) expect(peaks[i]).toBeGreaterThan(peaks[i - 1]);
    expect(peaks[peaks.length - 1]).toBe(1);
  });

  it("level 1's stretches fall on whole bars at 120 BPM (a bar = 2 s)", () => {
    const backyard = LEVELS[0];
    const at = (s: number) => waveAt(backyard.WAVES.PROFILE, (s * 1000) / backyard.PATH_MS);
    expect(backyard.PATH_MS).toBe(88_000); // 44 bars of 2 s
    expect(at(4)).toEqual({ kind: "rest", height: 0, intensity: 0 });
    expect(at(12)).toEqual({ kind: "spike", height: 0.35, intensity: 0.35 });
    expect(at(20).kind).toBe("rest");
    expect(at(32)).toEqual({ kind: "spike", height: 0.7, intensity: 0.7 });
    expect(at(44).kind).toBe("rest");
    expect(at(56).intensity).toBeCloseTo(0.5);
    expect(at(72)).toEqual({ kind: "burst", height: 1, intensity: 1 });
    expect(at(84).kind).toBe("rest");
  });
});
