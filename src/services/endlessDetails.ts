/**
 * What an Endless score was played with (supabase/endless-details.sql): the
 * pure half of the leaderboard's Endless details, so it can be unit-tested
 * without a database. `leaderboard.ts` is the shell that sends and reads them.
 */
export interface EndlessDetails {
  /** Ship model id (RENDER3D.SHIPS[].model). */
  ship: string;
  /** Power kind (POWER_KINDS). */
  power: string;
  /** Endless theme id (THEMES): "plain" or a story world's page id. */
  theme: string;
  /** How long the run lasted on the game clock (pauses excluded). */
  survivalMs: number;
}

/** The details as submit_run arguments; none when there are no details
 * (story and battle boards, which keep the old call shape). */
export function detailArgs(details?: EndlessDetails): Record<string, string | number> {
  if (!details) return {};
  return {
    p_ship: details.ship,
    p_power: details.power,
    p_theme: details.theme,
    p_survival_ms: Math.max(0, Math.round(details.survivalMs)),
  };
}

/**
 * A score row's embedded `endless_runs` as details, or null when it has none
 * (an older score, or another board). Supabase returns a one-to-one embed as
 * an object, but an array is accepted too in case it isn't detected as one.
 */
export function parseDetails(raw: unknown): EndlessDetails | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const { ship, power, theme, survival_ms } = row as Record<string, unknown>;
  if (typeof ship !== "string" || typeof power !== "string" || typeof theme !== "string") return null;
  if (typeof survival_ms !== "number") return null;
  return { ship, power, theme, survivalMs: survival_ms };
}

/** A survival time as the board shows it: "0:42", "12:05", "1:02:05". */
export function formatSurvival(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = `${total % 60}`.padStart(2, "0");
  return h > 0 ? `${h}:${`${m}`.padStart(2, "0")}:${s}` : `${m}:${s}`;
}
