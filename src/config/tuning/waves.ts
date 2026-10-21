// Story waves (docs/SOLO_MODES_DESIGN.md): how a level's pressure comes and
// goes. Re-exported by config/constants.ts. Kept apart from story.ts so the
// level files can import OWNER_WAVE without touching story.ts while it loads
// (an import loop there once crashed the built game at startup).

/**
 * One stretch of a level's wave (owner's playtests: "small spikes and then
 * rest, then increase gradually, then a burst and then rest again", and
 * each peak bigger than the one before, back to the same base between):
 * - rest: back to the base (WavesDef.BASE sums at once, slow spawns);
 * - spike: a push held at its HEIGHT;
 * - ramp: climbs from the base to its HEIGHT across the stretch;
 * - burst: the level's top (WavesDef.PEAK sums at once, fast spawns).
 * HEIGHT is how hard a push is, from 0 (the base) to 1 (a burst).
 */
export type WaveKind = "rest" | "spike" | "ramp" | "burst";

/** Its share of the path (any unit: the shares are scaled to PATH_MS). */
export type WaveSegment =
  | { KIND: "rest" | "burst"; SHARE: number }
  | { KIND: "spike" | "ramp"; SHARE: number; HEIGHT: number };

/** How a level's pressure comes and goes along its path. The profile is the
 * shape (shared by every level); BASE and PEAK are the level's scale. */
export interface WavesDef {
  /** The stretches in order, from the start of the path to the boss. */
  PROFILE: readonly WaveSegment[];
  /** Unsolved sums at once while resting. */
  BASE: number;
  /** Unsolved sums at once in a burst (a push of HEIGHT h: in between). */
  PEAK: number;
}

/**
 * The waves' numbers (WaveKind). A stretch pushes with an intensity from 0
 * (rest) to 1 (burst), and the intensity sets the two knobs the owner
 * picked: how many unsolved sums may be up at once (BASE → PEAK), and how
 * fast they come. Speed and sum size keep following the level's D underneath.
 */
export const WAVES = {
  /** × the spawn interval at rest and at a full burst. */
  INTERVAL_X: { REST: 1.5, BURST: 0.55 },
} as const;

/**
 * The owner's wave: three pushes, each bigger than the one before, with a
 * rest back to the base after each, then a breath before the boss. Shares
 * are bars of level 1's song (120 BPM: a bar = 2 s, an 88 s path), in
 * 4-bar phrases so each stretch is one chord progression or two
 * (`npm run waves` prints every level's timeline in seconds).
 */
export const OWNER_WAVE: readonly WaveSegment[] = [
  { KIND: "rest", SHARE: 4 }, // warm-up under the level banner
  { KIND: "spike", SHARE: 4, HEIGHT: 0.35 }, // wave 1: a taste
  { KIND: "rest", SHARE: 4 },
  { KIND: "spike", SHARE: 8, HEIGHT: 0.7 }, // wave 2: bigger, longer
  { KIND: "rest", SHARE: 4 },
  { KIND: "ramp", SHARE: 8, HEIGHT: 1 }, // wave 3: climb to the top…
  { KIND: "burst", SHARE: 8 }, // …and hold it
  { KIND: "rest", SHARE: 4 }, // a breath before the boss
];
