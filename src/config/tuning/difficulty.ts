// The difficulty curve's numbers (the curve itself: config/difficulty.ts).
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

/**
 * Difficulty ramp.
 *
 * Difficulty is a normalized value d(t) in [0,1) driven by a LOGISTIC (sigmoid)
 * curve of elapsed time. A sigmoid gives exactly the feel we want:
 *   - a gentle warm-up at the start (curve is nearly flat early),
 *   - a smooth acceleration through the middle,
 *   - a plateau near 1 so the game stays hard but never becomes impossible.
 *
 *   d(t) = 1 / (1 + e^(-k * (t - t0)))
 *
 * where t = seconds elapsed, t0 = MIDPOINT (where d = 0.5), and k = STEEPNESS
 * (larger k = sharper ramp). Every concrete parameter below is then linearly
 * interpolated between its `easy` and `hard` value using d.
 */
export const DIFFICULTY = {
  MIDPOINT: 50, // seconds until difficulty reaches the halfway point
  STEEPNESS: 0.055, // logistic k; controls how sharp the ramp is

  // px/sec — how fast aliens fall, then home toward the player.
  FALL_SPEED: { easy: 28, hard: 110 },
  HOME_SPEED: { easy: 45, hard: 150 },

  // ms between spawns (easy = slow/sparse, hard = fast/dense).
  SPAWN_INTERVAL: { easy: 2200, hard: 650 },

  // Hard cap on aliens alive at once, so the field never gets so crowded that a
  // single hit becomes unrecoverable. This is an absolute safety net; the threat
  // budget below is the primary pacing gate and usually binds first.
  MAX_ON_SCREEN: { easy: 4, hard: 8 },

  // Weighted cognitive-load ceiling on screen (see ENEMY.THREAT_BY_BALLS). New
  // spawns are held while live threat is at/above this, keeping mental load
  // bounded. Already-answered (locked, fleeing) aliens don't count.
  THREAT_BUDGET: { easy: 3, hard: 8 },

  // Difficulty at which a SECOND concurrent "hard" (multi-number) enemy is
  // allowed. Below this only one hard enemy can be on screen, so the player
  // never juggles two slow multi-number sums until very late game.
  SECOND_HARD_AT: 0.85,

  // Progression is SCORE-LED (the player earns difficulty), with a gentle
  // time-based floor so a struggling/idle player still sees a slow ramp.
  //   dScore = score / (score + SCORE_HALF)   (0 at start, 0.5 at SCORE_HALF)
  //   dTimeFloor = min(logistic(t), TIME_FLOOR_MAX)
  //   d = max(dScore, dTimeFloor)
  SCORE_HALF: 6000, // points at which score-driven difficulty reaches 0.5
  TIME_FLOOR_MAX: 0.4, // most the time floor alone can raise difficulty

  // Concurrent UNSOLVED aliens the player must juggle (not yet answered). This
  // is the primary spawn gate and is driven by score ALONE (dScore), so the
  // board opens up only as the player earns points: 1 → 2 → 3.
  MAX_UNSOLVED: { easy: 1, hard: 3 },

  // A sum needs at least two numbers, so always >= 2 balls.
  MIN_BALLS: 2,
  MAX_BALLS: { easy: 2, hard: 3 },
  MAX_DIGIT: { easy: 3, hard: 9 },

  // How long a strafer patrols the top band before diving (read time).
  STRAFER_PATROL_MS: { easy: 5000, hard: 2800 },
} as const;
