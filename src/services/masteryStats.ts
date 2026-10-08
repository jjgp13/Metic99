import { RANKS, STORAGE } from "../config/constants";

/**
 * Personal bests kept across runs in localStorage (shown on game over).
 *
 * Split in two on purpose (a "functional core, imperative shell"):
 * `mergeRun` is a pure function (easy to read and to test), and
 * `recordRun` is the thin part that reads and writes the browser storage.
 */
export interface Mastery {
  highScore: number;
  bestCombo: number;
  totalKills: number;
  /** 0 = no solve recorded yet. */
  fastestSolveMs: number;
}

/** What one finished run adds to the stats. */
export interface RunResult {
  score: number;
  bestCombo: number;
  kills: number;
  /** Infinity when the run solved nothing. */
  fastestSolveMs: number;
}

/** The stats after `run`, and whether it set a new high score. */
export function mergeRun(prior: Mastery, run: RunResult): { mastery: Mastery; newHighScore: boolean } {
  const fastestSolveMs =
    run.fastestSolveMs === Infinity
      ? prior.fastestSolveMs
      : prior.fastestSolveMs === 0
        ? run.fastestSolveMs
        : Math.min(prior.fastestSolveMs, run.fastestSolveMs);
  return {
    mastery: {
      highScore: Math.max(run.score, prior.highScore),
      bestCombo: Math.max(run.bestCombo, prior.bestCombo),
      totalKills: prior.totalKills + run.kills,
      fastestSolveMs,
    },
    newHighScore: run.score > 0 && run.score >= prior.highScore,
  };
}

/** The mastery rank name for a best score (RANKS in constants). */
export function rankFor(highScore: number): string {
  return RANKS.reduce((name, rank) => (highScore >= rank.min ? rank.name : name), RANKS[0].name);
}

/** Add a finished run to the stored stats; returns the updated stats. */
export function recordRun(run: RunResult): { mastery: Mastery; newHighScore: boolean } {
  const result = mergeRun(loadMastery(), run);
  saveMastery(result.mastery);
  return result;
}

/** The best score so far (0 when none), e.g. for the menu. */
export function storedHighScore(): number {
  return loadMastery().highScore;
}

const KEYS: Record<keyof Mastery, string> = {
  highScore: STORAGE.HIGHSCORE,
  bestCombo: STORAGE.BEST_COMBO,
  totalKills: STORAGE.TOTAL_KILLS,
  fastestSolveMs: STORAGE.FASTEST_MS,
};

function loadMastery(): Mastery {
  const read = (key: string) => Number(localStorage.getItem(key) ?? 0);
  return {
    highScore: read(KEYS.highScore),
    bestCombo: read(KEYS.bestCombo),
    totalKills: read(KEYS.totalKills),
    fastestSolveMs: read(KEYS.fastestSolveMs),
  };
}

function saveMastery(m: Mastery): void {
  for (const field of Object.keys(KEYS) as (keyof Mastery)[]) {
    localStorage.setItem(KEYS[field], String(m[field]));
  }
}
