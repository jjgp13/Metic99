import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { LEADERBOARD } from "../config/constants";

/** Which board a score goes on: 0 = Endless, 1–10 = a story stage, 99 = a story run. */
export type Board = number;

/** The board of story stage `stage` (an index into LEVELS). */
export const stageBoard = (stage: number): Board => stage + 1;

/**
 * Global arcade leaderboard backed by Supabase.
 *
 * Reads (top scores, rank) go straight to Supabase with the anon public key —
 * they're public by design. WRITES are gated: a score can only be inserted
 * through a real, single-use match. `startMatch()` (called when a game begins)
 * asks the DB for a server-timestamped match id; `submitScore()` hands that id
 * to the `submit_run` SECURITY DEFINER function, which atomically consumes the
 * match, plausibility-checks the score against elapsed time, and inserts it.
 * Direct anon INSERT into `scores` is revoked in the DB, so a forged REST insert
 * with the public key no longer works. If the env vars are absent the
 * leaderboard simply disables itself so the game still runs locally.
 *
 * There is one board per `level` (LEADERBOARD.*_BOARD): Endless, each story
 * stage and the whole story run (supabase/story-boards.sql). A story run
 * holds several open matches at once, one per board it will submit to.
 * Endless (board 0) calls the functions without a level, so a game already
 * deployed keeps working once the database has the column (reading the top
 * scores per board needs the column: migrate first, then deploy).
 */

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** Match ids issued by `start_match`, by board; each is consumed by that
 * board's next `submitScore`. */
const openMatches = new Map<Board, string>();

/** The board as RPC arguments: none for Endless (see the note above). */
const levelArg = (board: Board) => (board === LEADERBOARD.ENDLESS_BOARD ? {} : { p_level: board });

function getClient(): SupabaseClient | null {
  if (!URL || !KEY) return null;
  if (!client) client = createClient(URL, KEY);
  return client;
}

/** True when Supabase credentials are configured at build time. */
export function isLeaderboardEnabled(): boolean {
  return Boolean(URL && KEY);
}

export interface ScoreRow {
  id?: number;
  name: string;
  score: number;
}

export interface SubmitResult {
  /** 1-based arcade rank for the submitted score (0 if unavailable). */
  rank: number;
  /** Current top rows for display. */
  top: ScoreRow[];
  /** Whether the insert itself succeeded. */
  ok: boolean;
  /** Primary key of the inserted row, for unambiguous highlighting. */
  rowId?: number;
}

/** Reject (resolve to fallback) if a promise takes too long, so the UI never hangs. */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/** Top `limit` scores on `board`, highest first. */
export async function getTop(board: Board = LEADERBOARD.ENDLESS_BOARD, limit: number = LEADERBOARD.TOP_N): Promise<ScoreRow[]> {
  const c = getClient();
  if (!c) return [];
  const query = (byLevel: boolean) => {
    const rows = c.from("scores").select("id,name,score");
    return (byLevel ? rows.eq("level", board) : rows)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);
  };
  let { data, error } = await query(true);
  // A database not yet migrated (supabase/story-boards.sql) has no `level`
  // column: every row there is an Endless score, so read them unfiltered.
  if (error && board === LEADERBOARD.ENDLESS_BOARD) ({ data, error } = await query(false));
  if (error) {
    console.error("[leaderboard] getTop failed:", error.message);
    return [];
  }
  return (data ?? []) as ScoreRow[];
}

/** Exact 1-based rank for a score on `board` (count of strictly-higher scores + 1). */
export async function getRank(score: number, board: Board = LEADERBOARD.ENDLESS_BOARD): Promise<number> {
  const c = getClient();
  if (!c) return 0;
  const { data, error } = await c.rpc("get_rank", { s: score, ...levelArg(board) });
  if (error || typeof data !== "number") {
    if (error) console.error("[leaderboard] getRank failed:", error.message);
    return 0;
  }
  return data;
}

/**
 * Begin a new run (or story stage) on `board`: ask the DB for a single-use,
 * server-timestamped match id and stash it for that board's next submit.
 * Safe to call when the leaderboard is disabled (no-op). Failures are
 * swallowed — the player just gets an unsaved score later.
 */
export async function startMatch(board: Board = LEADERBOARD.ENDLESS_BOARD): Promise<void> {
  openMatches.delete(board);
  const c = getClient();
  if (!c) return;
  try {
    const { data, error } = await c.rpc("start_match", levelArg(board));
    if (error) {
      console.error("[leaderboard] startMatch failed:", error.message);
      return;
    }
    if (typeof data === "string") openMatches.set(board, data);
  } catch (e) {
    console.error("[leaderboard] startMatch threw:", e);
  }
}

/**
 * Submit a run through the match gate, then fetch the resulting top board. The
 * server (submit_run) returns the rank and row id atomically; we fetch the top
 * separately for display. Network/validation failures degrade gracefully: `ok`
 * is false and rank/top are best-effort. A timeout guards against a hung network
 * leaving the player stuck on "submitting". The match id is single-use and is
 * cleared whether or not the submit succeeds.
 */
export async function submitScore(name: string, score: number, board: Board = LEADERBOARD.ENDLESS_BOARD): Promise<SubmitResult> {
  const c = getClient();
  const matchId = openMatches.get(board) ?? null;
  openMatches.delete(board);
  if (!c || !matchId) return { rank: 0, top: [], ok: false };

  const clean = name.toUpperCase().slice(0, LEADERBOARD.NAME_LEN_MAX);
  const clamped = Math.max(0, Math.min(LEADERBOARD.MAX_SCORE, Math.round(score)));

  const run = async (): Promise<SubmitResult> => {
    const { data, error } = await c.rpc("submit_run", {
      p_match: matchId,
      p_name: clean,
      p_score: clamped,
      ...levelArg(board),
    });
    if (error) {
      console.error("[leaderboard] submit failed:", error.message);
      const top = await getTop(board);
      return { rank: 0, top, ok: false };
    }
    // submit_run returns a single { row_id, rank } row.
    const row = Array.isArray(data) ? data[0] : data;
    const top = await getTop(board);
    return {
      rank: typeof row?.rank === "number" ? row.rank : 0,
      top,
      ok: true,
      rowId: row?.row_id as number | undefined,
    };
  };

  return withTimeout(run(), 7000, { rank: 0, top: [], ok: false });
}
