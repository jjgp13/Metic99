import { ABILITY, DIFFICULTY, MATCH } from "./constants";

export interface DifficultyParams {
  /** Normalized difficulty in [0,1). 0 = easiest, approaches 1 with score/time. */
  d: number;
  fallSpeed: number;
  homeSpeed: number;
  spawnInterval: number;
  maxBalls: number;
  maxDigit: number;
  maxOnScreen: number;
  /** Weighted cognitive-load ceiling on screen; spawns wait above it. */
  threatBudget: number;
  /** Max concurrent "hard" (multi-number) aliens allowed right now. */
  maxHardOnScreen: number;
  /** Max concurrent UNSOLVED aliens (primary spawn gate); score-driven, 1→3. */
  maxUnsolved: number;
  /** How long a strafer patrols before diving (its read time). */
  straferPatrolMs: number;
  /** Chance a spawn gets one of the unlocked monster abilities. */
  abilityChance: number;
  /** Max concurrent ability aliens (1, then 2 late in a run). */
  maxAbilityOnScreen: number;
}

type Range = { easy: number; hard: number };

/**
 * Score-led difficulty curve with a gentle time floor. See DIFFICULTY in
 * constants.ts for the rationale.
 *
 *   dScore     = score / (score + SCORE_HALF)        // earned via points
 *   dTimeFloor = min(logistic(t), TIME_FLOOR_MAX)    // slow ramp for everyone
 *   d          = max(dScore, dTimeFloor)             // monotonic, never drops
 *
 * Most params lerp on the blended `d`, but `maxUnsolved` uses `dScore` ALONE so
 * the number of simultaneous unsolved sums grows only as the player scores.
 *
 * In a battle, `dMatch` (see `matchPressure`) joins both maxes: it is the one
 * thing that raises a field's difficulty from outside, so a match always ends.
 */
export function difficultyAt(elapsedMs: number, score = 0, dMatch = 0): DifficultyParams {
  const t = elapsedMs / 1000; // seconds
  const dTime = 1 / (1 + Math.exp(-DIFFICULTY.STEEPNESS * (t - DIFFICULTY.MIDPOINT)));
  const dTimeFloor = Math.min(dTime, DIFFICULTY.TIME_FLOOR_MAX);
  const dScore = score / (score + DIFFICULTY.SCORE_HALF); // 0 at score 0, →1
  const d = Math.max(dScore, dTimeFloor, dMatch);
  const dUnsolved = Math.max(dScore, dMatch);

  const lerp = (r: Range, x: number = d) => r.easy + (r.hard - r.easy) * x;

  return {
    d,
    fallSpeed: lerp(DIFFICULTY.FALL_SPEED),
    homeSpeed: lerp(DIFFICULTY.HOME_SPEED),
    spawnInterval: lerp(DIFFICULTY.SPAWN_INTERVAL),
    maxBalls: Math.round(lerp(DIFFICULTY.MAX_BALLS)),
    maxDigit: Math.round(lerp(DIFFICULTY.MAX_DIGIT)),
    maxOnScreen: Math.round(lerp(DIFFICULTY.MAX_ON_SCREEN)),
    threatBudget: lerp(DIFFICULTY.THREAT_BUDGET),
    // Stay at a single hard enemy until late game, then allow a second.
    maxHardOnScreen: d < DIFFICULTY.SECOND_HARD_AT ? 1 : 2,
    // Score (or match pressure) opens up concurrent unsolved sums (1 → 2 → 3).
    maxUnsolved: Math.round(lerp(DIFFICULTY.MAX_UNSOLVED, dUnsolved)),
    straferPatrolMs: lerp(DIFFICULTY.STRAFER_PATROL_MS),
    abilityChance: lerp(ABILITY.CHANCE),
    maxAbilityOnScreen: d < ABILITY.SECOND_AT ? 1 : 2,
  };
}

/**
 * Battle pressure on every field still in the match (docs/MULTIPLAYER_DESIGN.md
 * §6): it rises as players drop out, and in overtime with the match clock, so
 * a match of strong players still ends. 0 outside a match.
 *
 *   dKO       = KO_MAX · (players out) / (players − 2)   (KO_MAX with 2 left)
 *   dOvertime = (t − OVERTIME_AT) / OVERTIME_RAMP, from OVERTIME_AT on
 *   dMatch    = min(MAX, dKO + dOvertime)
 */
export function matchPressure(elapsedMs: number, alive: number, total: number): number {
  if (total <= 1) return 0;
  const dKO = total > 2 ? (MATCH.PRESSURE.KO_MAX * (total - alive)) / (total - 2) : 0;
  const dOvertime = Math.max(0, elapsedMs - MATCH.PRESSURE.OVERTIME_AT_MS) / MATCH.PRESSURE.OVERTIME_RAMP_MS;
  return Math.min(MATCH.PRESSURE.MAX, dKO + dOvertime);
}

/** Sudden death: how much faster a battle field runs (1 before it starts). */
export function suddenDeathSpeed(elapsedMs: number): number {
  const past = Math.max(0, elapsedMs - MATCH.SUDDEN_DEATH_AT_MS);
  return 1 + (past / 60_000) * MATCH.SUDDEN_DEATH_PER_MIN;
}
