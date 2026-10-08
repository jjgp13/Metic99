// The playfield, the ship, its bullets and the fixed rule step.
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

export const GAME = {
  WIDTH: 480,
  HEIGHT: 720,
  BG_COLOR: "#05060f",
} as const;

export const PLAYER = {
  Y: 430, // fixed vertical line the ship rides on (keypad sits below it)
  MOVE_LERP: 0.22, // how snappily the ship slides toward a target (0..1)
  SHOOT_RANGE: 6, // px tolerance to consider "lined up" and fire
  // Playtest switch: 3 lives (classic) vs 1 (knockout, as leaned to for the
  // battle royale). With 1 life the RECOVERY freeze never runs: the only hit
  // ends the game, so slow time is the player's sole safety tool.
  LIVES: 3,
  FIRE_COOLDOWN: 250, // ms between shots
  SCALE: 2, // ship model scale (16px source art)
} as const;

/**
 * The game rules advance in fixed steps (docs/MULTIPLAYER_DESIGN.md §8): the
 * same inputs then give the same run on a 60 Hz laptop and a 120 Hz phone. The
 * renderer draws between the last two steps, so motion stays smooth.
 */
export const SIM = {
  STEP_MS: 1000 / 60,
  // After a stall (tab switch, slow device) run at most this many steps in one
  // frame; the rest of the time is dropped so the game can't spiral behind.
  MAX_STEPS_PER_FRAME: 8,
} as const;

/** The box under the ship that holds the keypad or the drawing pad, with the
 * POWER buttons in its side gutters. */
export const KEYPAD_AREA = {
  TOP: PLAYER.Y + 52,
  BOTTOM: PLAYER.Y + 214,
  PAD_W: 352, // drawing pad width (the keypad's 3 columns)
} as const;

export const BULLET = {
  SPEED: 700, // px/sec upward
  MUZZLE_OFFSET: 24, // px above the ship where bullets spawn
  // Hit box: a bullet hits an alien whose center is within HALF_W horizontally
  // and whose y the bullet swept past (±HALF_H) this frame. Matches the old
  // arcade overlap of a 16×32 bullet vs a 24×24 alien body.
  HIT_HALF_W: 20,
  HIT_HALF_H: 28,
} as const;

/**
 * Hit-recovery: after losing a life on a crowded screen the player needs a
 * moment to recover. The whole field FREEZES for FREEZE_MS so there is time to
 * read and answer the next sum, then resumes at POST_HIT_FACTOR of normal speed
 * for the rest of the run (the difficulty curve keeps ramping underneath, so
 * absolute speed still climbs over time). The slowdown is flat, not stacking.
 */
export const RECOVERY = {
  FREEZE_MS: 3000, // field is completely frozen for this long after a hit
  POST_HIT_FACTOR: 0.8, // field speed multiplier once movement resumes
} as const;
