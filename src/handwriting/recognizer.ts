import { HANDWRITING } from "../config/constants";

/**
 * $P point-cloud recognizer (Vatavu, Anthony & Wobbrock, 2012), kept free of
 * Phaser so it can be unit-tested and reused (e.g. by a match server that
 * replays inputs).
 *
 * A drawing is turned into a cloud of N points (resampled along its strokes,
 * scaled to a unit box, centered) and compared to every template cloud by a
 * greedy nearest-point matching. The cloud forgets stroke order and direction
 * on purpose: a 0 drawn either way round, or a 4 drawn stem-first, match the
 * same template, so a few variants per digit are enough.
 */

export interface Point {
  x: number;
  y: number;
}
export type Stroke = Point[];

/** A cloud point remembers its stroke, so resampling never bridges a pen lift. */
interface CloudPoint extends Point {
  id: number;
}

export interface Template {
  digit: string;
  name: string;
  cloud: CloudPoint[];
}

export interface Recognition {
  /** The best digit, or null when nothing is close enough (show "?"). */
  digit: string | null;
  /** Cloud distance of the best match (lower = closer). */
  distance: number;
  /** Name of the best template (for tests and tuning). */
  name: string;
}

export function makeTemplate(
  digit: string,
  name: string,
  strokes: Stroke[],
  n: number = HANDWRITING.CLOUD_POINTS,
): Template {
  return { digit, name, cloud: toCloud(strokes, n) };
}

export function recognize(
  strokes: Stroke[],
  templates: readonly Template[],
  maxDistance: number = HANDWRITING.MAX_DISTANCE,
): Recognition {
  const n = templates[0]?.cloud.length ?? HANDWRITING.CLOUD_POINTS;
  const cloud = toCloud(strokes, n);
  let best: Recognition = { digit: null, distance: Infinity, name: "" };
  for (const t of templates) {
    const d = greedyCloudMatch(cloud, t.cloud, best.distance);
    if (d < best.distance) best = { digit: t.digit, distance: d, name: t.name };
  }
  if (best.distance > maxDistance) best.digit = null;
  return best;
}

/** Bounding box of some strokes. */
export function bounds(strokes: readonly Stroke[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of strokes) {
    for (const p of s) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Scratch-out: one stroke much wider than tall that sweeps sideways back and
 * forth (at least MIN_REVERSALS turns, each leg REVERSAL_PX long). No digit
 * does that: a 2 or 3 turns back too, but they are taller than wide.
 */
export function isScratch(stroke: Stroke, cfg = HANDWRITING.SCRATCH): boolean {
  const b = bounds([stroke]);
  const w = b.maxX - b.minX;
  const h = Math.max(1, b.maxY - b.minY);
  if (w < cfg.MIN_W || w / h < cfg.MIN_ASPECT) return false;
  let reversals = 0;
  let dir = 0; // +1 right, -1 left, 0 = not moving sideways yet
  let extreme = stroke[0].x; // farthest x of the current leg
  for (const p of stroke) {
    if (dir === 0) {
      if (Math.abs(p.x - extreme) >= cfg.REVERSAL_PX) {
        dir = Math.sign(p.x - extreme);
        extreme = p.x;
      }
    } else if ((p.x - extreme) * dir > 0) {
      extreme = p.x;
    } else if ((extreme - p.x) * dir >= cfg.REVERSAL_PX) {
      reversals++;
      dir = -dir;
      extreme = p.x;
    }
  }
  return reversals >= cfg.MIN_REVERSALS;
}

// ---------------------------------------------------------------------------
// $P internals
// ---------------------------------------------------------------------------

function toCloud(strokes: readonly Stroke[], n: number): CloudPoint[] {
  const pts: CloudPoint[] = [];
  strokes.forEach((s, id) => s.forEach((p) => pts.push({ x: p.x, y: p.y, id })));
  return translateToOrigin(scale(resample(pts, n)));
}

function resample(points: CloudPoint[], n: number): CloudPoint[] {
  const length = pathLength(points);
  if (points.length === 0) return [];
  if (length === 0) return Array.from({ length: n }, () => ({ ...points[0] }));
  const interval = length / (n - 1);
  const src = points.slice();
  const out: CloudPoint[] = [{ ...src[0] }];
  let acc = 0;
  for (let i = 1; i < src.length && out.length < n; i++) {
    const a = src[i - 1];
    const b = src[i];
    if (a.id !== b.id) continue;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d > 0 && acc + d >= interval) {
      const t = (interval - acc) / d;
      const q = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), id: b.id };
      out.push(q);
      src.splice(i, 0, q); // q starts the next segment
      acc = 0;
    } else {
      acc += d;
    }
  }
  // Float rounding can leave the last point off.
  while (out.length < n) out.push({ ...src[src.length - 1] });
  return out;
}

function pathLength(points: readonly CloudPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].id === points[i - 1].id) {
      d += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
  }
  return d;
}

/** Uniform scale into a unit box: keeps the aspect ratio, so a 1 stays thin. */
function scale(points: CloudPoint[]): CloudPoint[] {
  const b = bounds([points]);
  const size = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1;
  return points.map((p) => ({ x: (p.x - b.minX) / size, y: (p.y - b.minY) / size, id: p.id }));
}

function translateToOrigin(points: CloudPoint[]): CloudPoint[] {
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  return points.map((p) => ({ x: p.x - cx, y: p.y - cy, id: p.id }));
}

/** Try ~√n starting points in both directions; keep the best (lowest) sum. */
function greedyCloudMatch(a: CloudPoint[], b: CloudPoint[], bestSoFar: number): number {
  const n = a.length;
  const step = Math.max(1, Math.floor(Math.sqrt(n)));
  let min = bestSoFar;
  for (let i = 0; i < n; i += step) {
    min = Math.min(min, cloudDistance(a, b, i, min), cloudDistance(b, a, i, min));
  }
  return min;
}

/**
 * Match each point of `a` (from `start` on) to its nearest unmatched point of
 * `b`; earlier matches weigh more. Gives up once the sum passes `abandon`.
 */
function cloudDistance(a: CloudPoint[], b: CloudPoint[], start: number, abandon: number): number {
  const n = a.length;
  const matched = new Uint8Array(n);
  let sum = 0;
  let i = start;
  do {
    let index = -1;
    let min = Infinity;
    for (let j = 0; j < n; j++) {
      if (matched[j]) continue;
      const d = Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y);
      if (d < min) {
        min = d;
        index = j;
      }
    }
    matched[index] = 1;
    sum += (1 - ((i - start + n) % n) / n) * min;
    if (sum >= abandon) return sum;
    i = (i + 1) % n;
  } while (i !== start);
  return sum;
}
