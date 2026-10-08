// The battle royale: matches, targeting, SEND and the battle HUDs.
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

import { PALETTE, css } from "../palette";
import { PLAYER } from "./game";

/**
 * A battle-royale match (src/sim/Match.ts, docs/MULTIPLAYER_DESIGN.md §6):
 * N fields on one seed, one life each, the last one standing wins.
 */
export const MATCH = {
  PLAYERS: 8,
  LIVES: 1,
  // dMatch = min(MAX, dKO + dOvertime), see config/difficulty.ts matchPressure.
  PRESSURE: {
    KO_MAX: 0.6, // pressure from KOs when only two players are left
    OVERTIME_AT_MS: 180_000, // then the match clock adds pressure too...
    OVERTIME_RAMP_MS: 120_000, // ...+1 per this long
    MAX: 0.99,
  },
  // Bots in the seats beside the player (GameScene battle mode).
  OPPONENTS: ["ace", "ace", "pilot", "pilot", "pilot", "rookie", "rookie"] as const,
  // The curve tops out at speeds a perfect player (or a script) survives
  // forever, so from SUDDEN_DEATH_AT_MS the aliens also speed up without
  // limit: field speed × (1 + minutes past it × PER_MIN). Matches between
  // people end long before; this bounds a match's length for a server.
  SUDDEN_DEATH_AT_MS: 300_000,
  SUDDEN_DEATH_PER_MIN: 1,
  // Targeting (M7, Tetris 99): each player aims their attacks by a strategy or
  // at one opponent picked by hand. Targets are re-picked this often, and at
  // once when the target is knocked out.
  RETARGET_MS: 1500,
  // KO credit: the sender of the alien that did it, else the last player who
  // attacked the victim within this long.
  KO_CREDIT_MS: 10_000,
  // Badges: a KO earns the victim's badge points + 1. Badge levels 1–4 at
  // these points, each +BADGE_BONUS attack (Tetris 99: up to +100%).
  BADGE_STEPS: [2, 4, 8, 16],
  BADGE_BONUS: 0.25,
  // Defense bonus: each player beyond the first targeting you adds this to
  // your attacks, up to DEFENSE_MAX.
  DEFENSE_BONUS: 0.25,
  DEFENSE_MAX: 0.75,
  // An attack's weight = cost × (1 + bonus): its aliens' cancel cost, plus one
  // extra darter per EXTRA_ALIEN_PER of weight above the cost.
  EXTRA_ALIEN_PER: 25,
  // An attack weighs ATTACK_MULT × its cost before bonuses (a balance lever).
  ATTACK_MULT: 1,
} as const;

/** How a player aims their attacks (Tetris 99's four strategies). */
export type TargetStrategy = "random" | "kos" | "attackers" | "badges";
export const TARGET_STRATEGIES: readonly TargetStrategy[] = ["random", "kos", "attackers", "badges"];

/**
 * The phone battle HUD (src/ui/battleViews.ts, M8): a dock under the energy
 * meter, the only strip of a portrait screen that is never over the field,
 * so it never hides a sum and never has to duck. Left to right: the aim chip
 * (tap = next strategy), one tile per opponent (tap = aim at them), players
 * left + a one-line KO feed. Incoming attacks glow on the field's side edges
 * (they are what a kill can still cancel) and vibrate the phone. Being aimed
 * at is shown on the tiles, not the edges: in simulated matches it flips on
 * and off ~10×/min (targets are re-picked every 1.5 s), so a glow for it
 * would be noise.
 */
export const BATTLE_HUD = {
  // Under the energy meter (at KEYPAD_AREA.BOTTOM + 22 = PLAYER.Y + 236, ± its
  // cost mark) to the bottom of the canvas.
  DOCK: { TOP: PLAYER.Y + 249, BOTTOM: 717, MARGIN: 6 },
  CHIP_W: 72, // the aim chip
  INFO_W: 54, // players left + KO feed
  GAP: 5, // between the chip, the tiles and the info
  TILE_GAP: 4,
  TILE_MAX_W: 52,
  // A tile fills from the bottom with its player's danger (0 = calm, 1 = an
  // unanswered alien at their ship) in these colors; the incoming attacks
  // still to land stack on top in the incoming pink, full at INCOMING_FULL.
  // Same colors as the desktop board (BATTLE_BOARD.COLOR): danger ends in
  // its danger red, attacks sent are orange, attacks waiting to land pink.
  DANGER: { CALM: 0x3b4f8a, WARN: PALETTE.GOLD, CRITICAL: PALETTE.DANGER, CALM_TO: 0.4, WARN_AT: 0.7, CRITICAL_AT: 0.85 },
  INCOMING_FULL: 100,
  ATTACK: PALETTE.ATTACK,
  INCOMING: PALETTE.INCOMING,
  BADGE: PALETTE.GOLD,
  FLASH_MS: 600, // a tile's flash when it sends to you, you send to it, or it falls
  FEED_MS: 2600, // how long a KO stays in the feed
  // Side-edge glow (incoming pink) while attacks are queued for you: brighter with more
  // incoming (full at FULL_AT energy), a flash when one is sent. It spans the
  // field's height and dims next to any of your aliens, so balls near an
  // edge (a swooper flying in) stay clear.
  GLOW: { W: 12, TOP: 60, BOTTOM: PLAYER.Y + 30, FULL_AT: 50, ALPHA: 0.45, FLASH_MS: 700, DUCK_PX: 44 },
  // navigator.vibrate patterns (ms on/off). Phones without it (iPhone) skip.
  VIBRATE: {
    ATTACK_PULSE: 40, // one pulse per 25 energy of an attack sent to you, max 3
    ATTACK_GAP: 60,
    KO: [20, 40, 20], // you knocked someone out
    OUT: [220], // you are out
    WIN: [60, 60, 60, 60, 200],
  },
} as const;

/**
 * The desktop opponent board (src/ui/OpponentBoard.ts): the other players'
 * tiles in the empty space left and right of the portrait game canvas, shown
 * while both sides have room for a column. Sizes in CSS px.
 */
export const BATTLE_BOARD = {
  // Full tiles (mini field + info column) need this much room each side
  // (after GAP + EDGE) and canvas height...
  MIN_SIDE_W: 230,
  FULL_MIN_H: 520,
  // ...compact tiles (mini field + name row) this much, e.g. a claude.ai
  // Artifact panel. Below MIN_H the tiles would be too small to read.
  COMPACT_MIN_W: 120,
  COMPACT_MAX_W: 190,
  COMPACT_MIN_FIELD: 90, // narrowest mini field worth showing
  MIN_H: 400,
  // In a landscape window without room even for compact tiles, the game may
  // shrink to this fraction of its width to make room for them.
  MIN_GAME_SCALE: 0.75,
  MAX_TILE_W: 330,
  MAX_TILE_H: 176,
  FIELD_SHARE: 0.45, // the mini field's share of the tile width (at most)
  GAP: 14, // between the canvas and the columns, and between tiles
  EDGE: 12, // kept free at the window's edge
  FLASH_MS: 1100, // an attack's label on the sender/receiver tile
  FEED_LINES: 5, // KO feed lines kept
  COLOR: {
    DOT: "#d8defa", // an alien on a tile
    SENT: css(PALETTE.ATTACK), // a sent alien, the attack gauge, attackers
    INCOMING: css(PALETTE.INCOMING), // attacks waiting to land
    TARGET: css(PALETTE.GOLD), // your target (the lock-on brackets' gold)
    DANGER: "239, 71, 111", // rgb of the danger wash rising from the tile's bottom
    ENERGY: css(PALETTE.ENERGY),
    BADGE: "#c9b8ff",
  },
  // Short names of the targeting strategies on a tile.
  AIM_LABEL: { random: "RANDOM", kos: "KOs", attackers: "ATTACKERS", badges: "BADGES" },
} as const;

/** What a sent alien is: a plain darter, or an alien with one of the abilities
 * (picked by the sender from all of them, unlocked or not). */
export type SentKind = "darter" | "ability";

/**
 * SEND (docs/MULTIPLAYER_DESIGN.md §6): the attack gauge spent on aliens for
 * an opponent's field. One button; a tap sends the strongest tier the energy
 * buys, holding it steps down to cheaper ones. The table is content: new
 * monsters add rows. A tier's cost is split evenly over its aliens (that is
 * how much of the receiver's kill energy cancels each one).
 */
export const SEND = {
  // SEND spends the attack gauge, not the power's energy (owner's pick,
  // 2026-09-30: with one shared meter, sending never paid). Kills fill it
  // with what's left after paying off incoming; overflow is lost.
  GAUGE_MAX: 100,
  TIERS: [
    { COST: 25, ALIENS: ["darter"] },
    { COST: 50, ALIENS: ["ability"] },
    { COST: 100, ALIENS: ["ability", "ability"] },
  ] as { COST: number; ALIENS: SentKind[] }[],
  // Time in the receiver's incoming queue before landing (the warning, and
  // online it hides lag); shorter as match pressure rises (lerped on dMatch).
  DELAY_MS: { easy: 3000, hard: 1500 },
  STAGGER_MS: 600, // between the aliens of one attack
  HOLD_MS: 350, // holding the button this long starts stepping down tiers...
  HOLD_STEP_MS: 450, // ...one tier per this long
} as const;
