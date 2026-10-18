// Netcode: online play (docs/NETCODE.md). Shared by the client and the
// server. Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

export const NET = {
  // Steps between state fingerprints (60 = once per game second). A mismatch
  // then lands within 1 s of its cause, and the list stays short enough to
  // read on a phone.
  FINGERPRINT_EVERY: 60,

  // Bump when a message changes shape: client and server must speak the same
  // version (the hello is rejected otherwise).
  PROTOCOL_VERSION: 2,
  // Where the client finds the server: same host as the page, this path.
  WS_PATH: "/ws",
  // Port of the game server (it also serves the built game).
  SERVER_PORT: 8787,

  // --- Capacity (an experiment on a free server: cap, don't grow) ---
  // Matches the server runs at once (env MAX_ROOMS overrides). Each is ~8
  // fields at 60 Hz; past this, newcomers queue or hear "busy".
  MAX_ROOMS: 3,

  // --- Lobby ---
  // Seats in a match; empty ones are filled with bots.
  SEATS: 8,
  // A match starts this long after the first player joins (anyone can start
  // it sooner), so friends have time to join.
  LOBBY_WAIT_MS: 30_000,
  // Bot levels that fill empty seats, in seat order after the players.
  FILL_BOTS: ["ace", "pilot", "pilot", "rookie", "ace", "pilot", "rookie", "pilot"],
  // Longest player name (letters and digits).
  NAME_MAX: 8,

  // --- The match on the server ---
  // Tiles (what everyone sees of everyone) go out every this many steps
  // (6 = 10 times a second): enough for the opponent board, small on the wire.
  TILES_EVERY_STEPS: 6,
  // A client may claim at most this many steps more than the server's clock
  // allows (network jitter): a speed hack can't run its field faster.
  MAX_AHEAD_STEPS: 30,
  // A client that hasn't reported a step for this long is replaced by a bot
  // (otherwise its field would never be knocked out and the match never end).
  SILENT_TAKEOVER_MS: 5_000,
  // A message (attack, standing) must be applied within this many of the
  // client's steps after it was sent, or the client is cheating (delaying
  // attacks) or broken; it is then replaced by a bot.
  MESSAGE_DEADLINE_STEPS: 180,
  // The level of the bot that takes over from a player who left.
  TAKEOVER_BOT: "pilot",

  // --- The client ---
  // How often the client sends its inputs and step (ms). Inputs are also
  // sent at once when the player acts.
  SEND_EVERY_MS: 50,
  // Ping for the round-trip time shown in the lobby and the dev overlay.
  PING_EVERY_MS: 1_000,
} as const;
