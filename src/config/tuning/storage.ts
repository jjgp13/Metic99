// Browser storage keys and the online leaderboard.
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

/** localStorage keys for the high score and persistent mastery stats. */
export const STORAGE = {
  HIGHSCORE: "metic-highscore",
  BEST_COMBO: "metic-best-combo",
  TOTAL_KILLS: "metic-total-kills",
  FASTEST_MS: "metic-fastest-ms",
  LAST_NAME: "metic-last-name", // remembers the player's last arcade initials
  LAST_LEN: "metic-last-len", // remembers the chosen initials length
  SHIP: "metic-ship", // player ship model picked on the menu
  POWER: "metic-power", // power picked on the menu (POWER_KINDS)
  INPUT_MODE: "metic-input", // "keys" (keypad) or "draw" (handwriting pad)
  HW_LAB: "metic-hw-lab", // handwriting lab samples in progress (?lab=draw)
} as const;

/** Arcade global leaderboard (Supabase-backed). */
export const LEADERBOARD = {
  // Players choose how many initials to register, from MIN to MAX.
  NAME_LEN_MIN: 3,
  NAME_LEN_MAX: 6,
  NAME_LEN_DEFAULT: 5, // pre-selected length (classic arcade default)
  // Characters selectable per initials slot, in cycle order.
  CHARSET: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split(""),
  TOP_N: 20, // rows fetched/shown on the leaderboard screen
  MAX_SCORE: 1000000, // must match the Supabase score_range CHECK constraint
} as const;
