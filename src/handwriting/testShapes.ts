import { arc, curve, line } from "./digitTemplates";
import type { Point, Stroke } from "./recognizer";

/**
 * Test-only digits drawn in styles that differ from the templates (other
 * proportions, reversed directions and stroke orders, slants), plus a seeded
 * "hand" that distorts them. Used by the unit tests and for tuning.
 */

const pen = (...parts: Point[][]): Stroke => parts.flat();
const reverse = (s: Stroke): Stroke => s.slice().reverse();

export const TEST_SHAPES: ReadonlyArray<{ digit: string; strokes: Stroke[] }> = [
  { digit: "0", strokes: [arc(30, 50, 21, 46, -80, -440)] }, // other way round, overlapping
  { digit: "0", strokes: [arc(30, 50, 30, 44, 250, 600)] },
  { digit: "1", strokes: [line(20, 0, 34, 100)] },
  { digit: "1", strokes: [pen(line(22, 14, 32, 0), line(32, 0, 30, 100))] },
  { digit: "1", strokes: [line(30, 0, 30, 100), line(18, 100, 44, 100)] },
  { digit: "2", strokes: [pen(arc(30, 30, 28, 30, 180, 390), curve([56, 40], [30, 70], [4, 100]), line(4, 100, 50, 98))] },
  { digit: "2", strokes: [reverse(pen(arc(28, 26, 22, 24, 200, 380), line(50, 34, 8, 100), line(8, 100, 56, 100)))] },
  { digit: "3", strokes: [pen(arc(30, 22, 18, 20, 210, 440), arc(30, 68, 28, 30, 270, 510))] },
  { digit: "3", strokes: [reverse(pen(arc(28, 26, 26, 24, 190, 445), arc(28, 74, 26, 24, 275, 525)))] },
  { digit: "4", strokes: [line(40, 0, 40, 100), pen(line(40, 0, 2, 70), line(2, 70, 52, 70))] }, // stem first
  { digit: "4", strokes: [pen(line(6, 4, 6, 56), line(6, 56, 56, 56)), line(40, 0, 42, 100)] },
  { digit: "5", strokes: [pen(line(10, 2, 8, 40), arc(26, 66, 24, 28, 230, 490)), line(56, 0, 10, 2)] },
  { digit: "5", strokes: [pen(line(50, 0, 14, 0), line(14, 0, 12, 38), arc(30, 66, 22, 30, 225, 505))] },
  { digit: "6", strokes: [pen(curve([44, 0], [4, 30], [8, 74]), arc(30, 70, 24, 30, 180, -170))] },
  { digit: "6", strokes: [reverse(pen(curve([50, 4], [10, 14], [6, 70]), arc(28, 74, 22, 24, 180, -140)))] },
  { digit: "7", strokes: [pen(line(4, 6, 56, 0), line(56, 0, 30, 100))] },
  { digit: "7", strokes: [pen(line(8, 0, 52, 0), line(52, 0, 18, 100)), line(16, 50, 48, 50)] },
  { digit: "8", strokes: [arc(30, 22, 17, 22, 0, 360), arc(30, 70, 28, 30, 0, 360)] },
  { digit: "8", strokes: [pen(arc(30, 25, 20, 25, 90, 450), arc(30, 75, 24, 25, 270, 630))] },
  { digit: "9", strokes: [pen(arc(28, 24, 24, 24, 10, -350), line(52, 20, 40, 100))] },
  { digit: "9", strokes: [pen(arc(30, 30, 26, 30, 0, 360), line(56, 30, 56, 100))] },
];

/** Seeded PRNG (mulberry32) so tests are deterministic. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A shaky hand: rotate, stretch, shear, then jitter every point, and scale to
 * `heightPx` logical px (the size a player draws on the pad), offset to (ox, oy).
 */
export function distort(strokes: Stroke[], rand: () => number, heightPx = 90, ox = 0, oy = 0): Stroke[] {
  const spread = (k: number) => (rand() * 2 - 1) * k;
  const rot = (spread(10) * Math.PI) / 180;
  const sx = 1 + spread(0.2);
  const sy = 1 + spread(0.12);
  const shear = spread(0.2);
  const k = heightPx / 100;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return strokes.map((s) =>
    s.map((p) => {
      const x = (p.x - 30) * sx + shear * (p.y - 50);
      const y = (p.y - 50) * sy;
      return {
        x: ox + (x * cos - y * sin) * k + spread(1.5),
        y: oy + (x * sin + y * cos) * k + spread(1.5),
      };
    }),
  );
}
