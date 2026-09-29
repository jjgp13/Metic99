import type { Solve } from "./Field";

/** Solve times for one ball count, in seconds. */
export interface SolveSummary {
  balls: number;
  count: number;
  median: number;
  p90: number;
}

/**
 * Summarize solve times by ball count, so a player's own numbers (dev console
 * at game over) can be compared with the bots' (`npm run bots`).
 */
export function summarizeSolves(solves: readonly Solve[]): SolveSummary[] {
  const byBalls = new Map<number, number[]>();
  for (const s of solves) {
    const list = byBalls.get(s.balls) ?? [];
    list.push(s.ms / 1000);
    byBalls.set(s.balls, list);
  }
  return [...byBalls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([balls, times]) => {
      times.sort((a, b) => a - b);
      return {
        balls,
        count: times.length,
        median: round2(quantile(times, 0.5)),
        p90: round2(quantile(times, 0.9)),
      };
    });
}

/** The q-quantile of sorted values (nearest rank). */
export function quantile(sorted: readonly number[], q: number): number {
  if (!sorted.length) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
