import type { Stroke } from "./recognizer";

/**
 * Recorded handwriting (from the lab page, `?lab=draw`): what the player was
 * asked to draw, what the pad read, and the raw ink per digit group. Points are
 * whole logical px relative to the pad's top-left, stored flat ([x, y, x, y…])
 * to keep a phone's export small enough to paste into a chat.
 */
export interface SampleFile {
  kind: "metic-handwriting";
  version: 1;
  date: string;
  pad: { w: number; h: number };
  samples: Sample[];
}

export interface Sample {
  expected: string;
  /** What the pad entered, or null for "?". */
  read: string | null;
  /** Digit groups → strokes → flat points. */
  groups: number[][][];
}

export function encodeGroups(groups: readonly Stroke[][], originX: number, originY: number): number[][][] {
  return groups.map((g) => g.map((s) => s.flatMap((p) => [Math.round(p.x - originX), Math.round(p.y - originY)])));
}

export function decodeGroups(groups: number[][][], originX = 0, originY = 0): Stroke[][] {
  return groups.map((g) =>
    g.map((flat) => {
      const s: Stroke = [];
      for (let i = 0; i + 1 < flat.length; i += 2) s.push({ x: flat[i] + originX, y: flat[i + 1] + originY });
      return s;
    }),
  );
}
