// Score and mastery ranks.
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

/**
 * Skill-based scoring. Points reward harder sums, faster solving, later game and
 * uninterrupted streaks:
 *
 *   points = BASE * ballCountBonus * speedBonus * difficultyMult * comboMult
 *
 * - ballCountBonus: harder (more-number) sums pay more.
 * - speedBonus: solving within FAST_MS pays FAST_MULT, decaying to SLOW_MULT by
 *   SLOW_MS (measured from when the alien spawned).
 * - difficultyMult: 1 + d, so late-game kills are worth up to ~2x.
 * - comboMult: consecutive kills without losing a life raise the multiplier by
 *   COMBO_STEP each, capped at COMBO_MAX; a hit resets the streak.
 */
export const SCORE = {
  BASE: 50,
  BALL_COUNT_BONUS: { 2: 1.0, 3: 1.6, 4: 2.4 } as Record<number, number>,
  FAST_MS: 1500, // solved at/under this -> full speed bonus
  SLOW_MS: 6000, // solved at/over this -> no speed bonus
  FAST_MULT: 2.0,
  SLOW_MULT: 1.0,
  COMBO_STEP: 0.25, // multiplier gained per consecutive kill
  COMBO_MAX: 4.0,
} as const;

/** Mastery ranks shown on game over, keyed by best-score thresholds. */
export const RANKS: ReadonlyArray<{ min: number; name: string }> = [
  { min: 0, name: "Rookie" },
  { min: 2000, name: "Cadet" },
  { min: 6000, name: "Pilot" },
  { min: 15000, name: "Ace" },
  { min: 30000, name: "Commander" },
  { min: 60000, name: "Legend" },
];
