/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL (public). Empty disables the global leaderboard. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon public key. Safe to ship; protected by row-level security. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "json": load 3D models as base64 JSON (the playtest Artifact build). */
  readonly VITE_MODEL_PACK?: string;
  /** Online play: the game server's WebSocket URL (wss://host/ws). Empty =
   * the page's own host (the game server serves the page). */
  readonly VITE_NET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The git commit this build came from (vite.config.ts). */
declare const __BUILD_ID__: string;
/** A hash of the rule source files (vite.config.ts): online, client and
 * server must have the same one. */
declare const __RULES_ID__: string;
