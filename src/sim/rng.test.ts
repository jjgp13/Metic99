import { describe, expect, it } from "vitest";
import { Rng, SpawnStreams } from "./rng";

const draw = (rng: Rng, n: number) => Array.from({ length: n }, () => rng.next());

describe("Rng", () => {
  it("repeats the same numbers for the same seed", () => {
    expect(draw(new Rng(42), 20)).toEqual(draw(new Rng(42), 20));
  });

  it("gives different numbers for different seeds", () => {
    expect(draw(new Rng(1), 5)).not.toEqual(draw(new Rng(2), 5));
  });

  // A future server must roll exactly what the browser rolled. If this fails,
  // the generator changed and every seeded run changed with it.
  it("keeps its golden output", () => {
    const rng = new Rng(12345);
    expect(Array.from({ length: 5 }, () => rng.int(0, 1_000_000))).toMatchInlineSnapshot(`
      [
        979729,
        306752,
        484205,
        817935,
        509428,
      ]
    `);
  });

  it("int() covers both ends and stays in range", () => {
    const rng = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(1, 9);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(9);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("is roughly uniform", () => {
    const rng = new Rng(99);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 40_000; i++) counts[rng.int(0, 3)]++;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(400);
  });

  it("derive() is stable per key and independent across keys", () => {
    expect(draw(Rng.derive(5, 2, 12, 0), 5)).toEqual(draw(Rng.derive(5, 2, 12, 0), 5));
    const a = draw(Rng.derive(5, 2, 12, 0), 5);
    expect(draw(Rng.derive(5, 2, 13, 0), 5)).not.toEqual(a);
    expect(draw(Rng.derive(5, 2, 12, 1), 5)).not.toEqual(a);
    expect(draw(Rng.derive(6, 2, 12, 0), 5)).not.toEqual(a);
  });

  it("pick() and chance() use the stream", () => {
    const items = ["a", "b", "c"] as const;
    expect(Array.from({ length: 10 }, (_, i) => new Rng(i).pick(items))).toEqual(
      Array.from({ length: 10 }, (_, i) => new Rng(i).pick(items)),
    );
    const rng = new Rng(3);
    const hits = Array.from({ length: 10_000 }, () => rng.chance(0.25)).filter(Boolean).length;
    expect(Math.abs(hits - 2500)).toBeLessThan(200);
  });
});

describe("SpawnStreams", () => {
  it("rolls the same first try for the Nth spawn, whatever the retries before it", () => {
    const direct = new SpawnStreams(9, 2);
    direct.next();
    direct.succeeded();
    const withRetries = new SpawnStreams(9, 2);
    withRetries.next();
    withRetries.next();
    withRetries.next();
    withRetries.succeeded();
    expect(draw(withRetries.next(), 5)).toEqual(draw(direct.next(), 5));
  });

  it("rolls fresh numbers on a retry", () => {
    const s = new SpawnStreams(9, 2);
    expect(draw(s.next(), 5)).not.toEqual(draw(s.next(), 5));
  });
});
