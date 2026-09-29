import { makeTemplate, type Point, type Stroke, type Template } from "./recognizer";

/**
 * Digit templates for the $P recognizer, drawn with a few line/arc/curve
 * helpers in a box about 60 wide × 100 tall (y down). Stroke order and
 * direction don't matter to $P, so variants only cover different SHAPES of a
 * digit (1 with/without a flag or base, open/closed 4, 7 with/without a bar…).
 */

const STEPS = 12;

/** Straight line. */
export function line(x0: number, y0: number, x1: number, y1: number): Point[] {
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS;
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
  });
}

/** Elliptic arc; angles in degrees, 0 = right, 90 = down (screen y). */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): Point[] {
  const steps = Math.max(4, Math.round((Math.abs(a1 - a0) / 360) * 32));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

/** Quadratic curve from p0 to p2 pulled toward p1. */
export function curve(p0: [number, number], p1: [number, number], p2: [number, number]): Point[] {
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS;
    const u = 1 - t;
    return {
      x: u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      y: u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    };
  });
}

/** A polyline through points (a stroke traced from real handwriting). */
export function path(points: Array<[number, number]>): Point[] {
  return points.slice(1).flatMap(([x, y], i) => {
    const seg = line(points[i][0], points[i][1], x, y);
    return i === 0 ? seg : seg.slice(1);
  });
}

/** Vertical figure eight (lemniscate of Gerono), one stroke. */
function figureEight(cx: number, cy: number, halfW: number, halfH: number): Point[] {
  return Array.from({ length: 49 }, (_, i) => {
    const t = Math.PI * 1.25 + (i / 48) * Math.PI * 2;
    return { x: cx + 2 * halfW * Math.sin(t) * Math.cos(t), y: cy + halfH * Math.sin(t) };
  });
}

/** Joins parts into one stroke. */
const pen = (...parts: Point[][]): Stroke => parts.flat();

export const DIGIT_SHAPES: ReadonlyArray<{ digit: string; name: string; strokes: Stroke[] }> = [
  { digit: "0", name: "0-oval", strokes: [arc(30, 50, 24, 50, -90, 270)] },
  { digit: "0", name: "0-round", strokes: [arc(40, 50, 38, 50, -90, 270)] },

  { digit: "1", name: "1-bar", strokes: [line(30, 0, 30, 100)] },
  { digit: "1", name: "1-slant", strokes: [line(40, 0, 24, 100)] },
  { digit: "1", name: "1-flag", strokes: [pen(line(14, 22, 32, 0), line(32, 0, 32, 100))] },
  {
    digit: "1",
    name: "1-base",
    strokes: [pen(line(14, 22, 32, 0), line(32, 0, 32, 100)), line(12, 100, 52, 100)],
  },

  {
    digit: "2",
    name: "2-angle",
    strokes: [pen(arc(30, 28, 25, 26, 190, 400), line(49, 45, 5, 100), line(5, 100, 58, 100))],
  },
  {
    digit: "2",
    name: "2-swan",
    strokes: [pen(arc(30, 28, 24, 26, 200, 360), curve([54, 28], [50, 62], [5, 100]), line(5, 100, 58, 100))],
  },

  { digit: "3", name: "3-round", strokes: [pen(arc(28, 25, 24, 23, 200, 450), arc(28, 73, 26, 25, 270, 520))] },
  {
    digit: "3",
    name: "3-flat",
    strokes: [pen(line(8, 0, 52, 0), line(52, 0, 26, 40), arc(28, 68, 26, 28, 270, 520))],
  },

  { digit: "4", name: "4-closed", strokes: [pen(line(40, 0, 4, 66), line(4, 66, 58, 66)), line(42, 0, 42, 100)] },
  { digit: "4", name: "4-open", strokes: [pen(line(10, 0, 5, 62), line(5, 62, 58, 62)), line(42, 12, 42, 100)] },
  { digit: "4", name: "4-short-bar", strokes: [pen(line(8, 0, 8, 58), line(8, 58, 46, 58)), line(46, 0, 46, 100)] },

  {
    digit: "5",
    name: "5-bar",
    strokes: [pen(line(12, 0, 9, 44), arc(28, 68, 25, 28, 225, 500)), line(12, 0, 52, 0)],
  },
  {
    digit: "5",
    name: "5-one",
    strokes: [pen(line(52, 0, 12, 0), line(12, 0, 9, 44), arc(28, 68, 25, 28, 225, 500))],
  },

  { digit: "6", name: "6-curve", strokes: [pen(curve([48, 0], [6, 20], [5, 72]), arc(30, 72, 25, 27, 180, -150))] },
  { digit: "6", name: "6-straight", strokes: [pen(line(42, 0, 8, 62), arc(30, 74, 24, 26, 200, -150))] },

  { digit: "7", name: "7-plain", strokes: [pen(line(5, 0, 55, 0), line(55, 0, 22, 100))] },
  { digit: "7", name: "7-bar", strokes: [pen(line(5, 0, 55, 0), line(55, 0, 22, 100)), line(22, 52, 56, 52)] },
  { digit: "7", name: "7-curve", strokes: [pen(line(5, 0, 55, 0), curve([55, 0], [30, 40], [28, 100]))] },

  { digit: "8", name: "8-one", strokes: [figureEight(30, 50, 26, 50)] },
  { digit: "8", name: "8-two", strokes: [arc(30, 24, 21, 24, 0, 360), arc(30, 74, 26, 26, 0, 360)] },

  { digit: "9", name: "9-stick", strokes: [pen(arc(30, 26, 24, 26, 0, -360), line(54, 26, 50, 100))] },
  { digit: "9", name: "9-curve", strokes: [pen(arc(30, 26, 24, 26, 0, -360), curve([54, 26], [54, 82], [20, 100]))] },

  // Styles traced from the owner's phone (samples/owner-phone-1.json).
  // 4 in one stroke: down-left, across (a bowl or a flat bar), up to the top
  // right, then back down the stem.
  { digit: "4", name: "4-one-bowl", strokes: [path([[19, 0], [0, 34], [18, 41], [49, 37], [72, 26], [81, 9], [70, 55], [56, 100]])] },
  { digit: "4", name: "4-one-flat", strokes: [path([[28, 15], [0, 50], [6, 52], [50, 50], [92, 45], [95, 0], [86, 50], [76, 96]])] },
  {
    digit: "3",
    name: "3-cusp",
    strokes: [path([[5, 8], [30, 0], [48, 5], [52, 20], [42, 35], [22, 48], [32, 48], [50, 56], [58, 72], [52, 88], [30, 98], [5, 100]])],
  },
  {
    digit: "2",
    name: "2-loop",
    strokes: [path([[12, 19], [43, 1], [65, 3], [72, 19], [63, 53], [40, 87], [22, 97], [5, 93], [0, 79], [15, 64], [50, 70], [91, 91], [100, 95]])],
  },
  { digit: "6", name: "6-big-loop", strokes: [path([[44, 0], [14, 30], [0, 78], [12, 97], [42, 100], [72, 87], [73, 62], [42, 57], [8, 82]])] },
  { digit: "7", name: "7-wide", strokes: [path([[0, 2], [100, 0], [52, 100]])] },
  // samples/owner-phone-2.json: a 1 whose flag is as long as half the stem, and
  // a 9 whose loop is a flat triangle closing into the stem.
  { digit: "1", name: "1-long-flag", strokes: [path([[0, 50], [40, 0], [20, 100]])] },
  {
    digit: "9",
    name: "9-flat-loop",
    strokes: [path([[48, 30], [19, 37], [0, 34], [3, 27], [26, 5], [41, 0], [42, 8], [34, 32], [27, 70], [35, 100]])],
  },
];

export const DIGIT_TEMPLATES: readonly Template[] = DIGIT_SHAPES.map((s) =>
  makeTemplate(s.digit, s.name, s.strokes),
);
