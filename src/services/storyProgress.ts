import { STORAGE, STORY } from "../config/constants";

/**
 * Story progress kept across visits in localStorage: how far the player has
 * got and their best score on each stage, for the story map.
 *
 * Same split as masteryStats.ts (a "functional core, imperative shell"):
 * `mergeLevel` / `mergeRun` are pure, `recordLevel` / `recordStoryRun` read
 * and write the browser storage.
 */
export interface StoryProgress {
  /** Index of the furthest stage reached (0 = only stage 1). It goes one past
   * the last stage once the final boss is beaten. */
  furthest: number;
  /** Best points scored in each stage (0 = never played), by stage index. */
  best: number[];
  /** Best whole-run total. */
  bestRun: number;
}

export const NO_PROGRESS: StoryProgress = { furthest: 0, best: [], bestRun: 0 };

/** The progress after one stage ended: `score` points in stage `stage`, and
 * whether its boss was beaten (which opens the next stage). */
export function mergeLevel(prior: StoryProgress, stage: number, score: number, cleared: boolean): StoryProgress {
  const best = [...prior.best];
  while (best.length <= stage) best.push(0);
  best[stage] = Math.max(best[stage], score);
  const furthest = cleared ? Math.max(prior.furthest, stage + 1) : prior.furthest;
  return { ...prior, best, furthest };
}

/** The progress after a whole run ended, and whether it set a new best run. */
export function mergeRun(prior: StoryProgress, total: number): { progress: StoryProgress; newBest: boolean } {
  return {
    progress: { ...prior, bestRun: Math.max(prior.bestRun, total) },
    newBest: total > 0 && total > prior.bestRun,
  };
}

/** What an island on the map shows. */
export type IslandState = "cleared" | "reached" | "unreached";

export function islandState(progress: StoryProgress, stage: number): IslandState {
  if (stage < progress.furthest) return "cleared";
  return stage === progress.furthest ? "reached" : "unreached";
}

export function loadStoryProgress(): StoryProgress {
  try {
    const raw = localStorage.getItem(STORAGE.STORY);
    if (!raw) return NO_PROGRESS;
    return parseProgress(JSON.parse(raw));
  } catch {
    // Storage blocked or the saved value is broken: start from stage 1.
    return NO_PROGRESS;
  }
}

/** Add one finished stage to the stored progress; returns the new progress. */
export function recordLevel(stage: number, score: number, cleared: boolean): StoryProgress {
  const progress = mergeLevel(loadStoryProgress(), stage, score, cleared);
  save(progress);
  return progress;
}

/** Add one finished run to the stored progress; true if it's a new best run. */
export function recordStoryRun(total: number): boolean {
  const { progress, newBest } = mergeRun(loadStoryProgress(), total);
  save(progress);
  return newBest;
}

/** Only trust numbers from storage: a hand-edited value must not break the map. */
export function parseProgress(value: unknown): StoryProgress {
  const v = (value ?? {}) as Partial<Record<keyof StoryProgress, unknown>>;
  const count = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  return {
    furthest: Math.min(count(v.furthest), STORY.STAGES),
    best: Array.isArray(v.best) ? v.best.slice(0, STORY.STAGES).map(count) : [],
    bestRun: count(v.bestRun),
  };
}

/**
 * The story run in progress, saved when each level starts (and when one is
 * cleared, as the next level), so a run left in the middle continues from
 * the start of that level with the lives and score it had there. A game
 * over or the end of the story deletes it.
 */
export interface SavedRun {
  /** Index into LEVELS of the level to play next. */
  level: number;
  lives: number;
  score: number;
  /** Points scored in each level already finished. */
  levelScores: number[];
}

export function saveRun(run: SavedRun): void {
  try {
    localStorage.setItem(STORAGE.STORY_SAVE, JSON.stringify(run));
  } catch {
    // Not saved (private mode / quota): the run just can't be continued.
  }
}

export function loadSavedRun(): SavedRun | null {
  try {
    const raw = localStorage.getItem(STORAGE.STORY_SAVE);
    return raw ? parseSavedRun(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearSavedRun(): void {
  try {
    localStorage.removeItem(STORAGE.STORY_SAVE);
  } catch {
    // Nothing to clear.
  }
}

/** A saved run from storage, or null if it doesn't make sense (no lives left,
 * a level that doesn't exist): a hand-edited value must not start a broken run. */
export function parseSavedRun(value: unknown): SavedRun | null {
  const v = (value ?? {}) as Partial<Record<keyof SavedRun, unknown>>;
  const whole = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : -1);
  const level = whole(v.level);
  const lives = whole(v.lives);
  const score = whole(v.score);
  if (level < 0 || level >= STORY.STAGES || lives < 1 || lives > STORY.LIVES || score < 0) return null;
  const levelScores = Array.isArray(v.levelScores) ? v.levelScores.map(whole).map((n) => Math.max(0, n)) : [];
  return { level, lives, score, levelScores: levelScores.slice(0, level) };
}

function save(progress: StoryProgress): void {
  try {
    localStorage.setItem(STORAGE.STORY, JSON.stringify(progress));
  } catch {
    // Not saved (private mode / quota); the run itself still counts.
  }
}
