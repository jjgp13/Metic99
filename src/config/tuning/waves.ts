// Story waves (docs/SOLO_MODES_DESIGN.md): how a level's pressure comes and
// goes. Re-exported by config/constants.ts. Kept apart from story.ts, which
// re-exports LEVELS: the level files import OWNER_WAVE from here, and
// importing a value from story.ts would make an import loop (story.ts →
// levels → story.ts) that crashes the built game at startup.

/**
 * One stretch of a level's wave (owner's playtest: "small spikes and then
 * rest, then increase gradually, then a burst and then rest again"):
 * - rest: one sum at a time, slow spawns;
 * - spike: a short push (WAVES.SPIKE);
 * - ramp: climbs from rest to WAVES.RAMP_TOP across the stretch;
 * - burst: the level's peak, as many sums as WavesDef.PEAK.
 */
export type WaveKind = "rest" | "spike" | "ramp" | "burst";

export interface WaveSegment {
  KIND: WaveKind;
  /** Its share of the path (any unit: the shares are scaled to PATH_MS). */
  SHARE: number;
}

/** How a level's pressure comes and goes along its path. */
export interface WavesDef {
  /** The stretches in order, from the start of the path to the boss. */
  PROFILE: readonly WaveSegment[];
  /** Unsolved sums at once in a burst (rest is always WAVES.REST_UNSOLVED). */
  PEAK: number;
}

/**
 * The waves' numbers (WaveKind). A stretch pushes with an intensity from 0
 * (rest) to 1 (burst), and the intensity sets the two knobs the owner
 * picked: how many unsolved sums may be up at once, and how fast they come.
 * Speed and sum size keep following the level's D underneath.
 */
export const WAVES = {
  /** A spike's intensity, and where a ramp ends. */
  SPIKE: 0.6,
  RAMP_TOP: 0.7,
  /** Unsolved sums at once while resting (a burst: the level's PEAK). */
  REST_UNSOLVED: 1,
  /** × the spawn interval at rest and at a full burst. */
  INTERVAL_X: { REST: 1.5, BURST: 0.55 },
} as const;

/** The owner's wave: two small spikes with rests, a climb, a burst, a rest
 * before the boss. Shares are seconds of an 85 s path. */
export const OWNER_WAVE: readonly WaveSegment[] = [
  { KIND: "rest", SHARE: 8 }, // warm-up under the level banner
  { KIND: "spike", SHARE: 6 },
  { KIND: "rest", SHARE: 10 },
  { KIND: "spike", SHARE: 6 },
  { KIND: "rest", SHARE: 10 },
  { KIND: "ramp", SHARE: 22 },
  { KIND: "burst", SHARE: 14 },
  { KIND: "rest", SHARE: 9 }, // a breath before the boss
];
