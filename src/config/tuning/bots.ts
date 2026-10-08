// Bot players (src/sim/Bot.ts).
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

import type { TargetStrategy } from "./battle";

/**
 * Bot players (src/sim/Bot.ts, docs/MULTIPLAYER_DESIGN.md §7). A bot solves
 * like a person: notice an alien (REACTION), work out the sum (THINK_BASE +
 * PER_ADD per addition, i.e. balls - 1, + PER_CARRY per carry, spread
 * log-normally by NOISE), type
 * it (PER_KEY per digit), and sometimes get it wrong (ERROR_RATE: off by 1 or
 * 10), noticing after NOTICE_WRONG. FOCUS = chance it goes for the most
 * dangerous alien rather than any readable one, and that it drops what it is
 * thinking about when a clearly worse threat appears. Times in ms of game time.
 *
 * Calibrated on the owner's logged runs (2026-09-29), measured as "answer
 * time" (from an alien becoming readable, or the previous answer, to the
 * typed answer matching it): the owner answers 2-ball sums in 1.15 s and
 * 3-ball sums in 2.27 s, so each addition costs about the same. ACE ≈ the
 * owner, PILOT ≈ 1.5× slower. ROOKIE is a guess (no beginner runs yet).
 *
 * Powers (M4), also from the owner's runs: FREEZE when at least
 * FREEZE_MIN_OPEN unanswered aliens are on screen and the nearest is within
 * FREEZE_AT_PX of the ship (owner: 2 aliens, ~170 px), or a single one is
 * within PANIC_PX; keep answering while frozen and unfreeze once the board is
 * clear (owner: ~3.2 s later). Both after REACTION, like any decision.
 * MISS_DANGER: chance a bot doesn't notice a dangerous moment at all and
 * plays on without freezing (6 of the owner's 9 hits came with energy to
 * spare and FREEZE off; a bot that never misses outlived the owner 2×; at
 * 0.2 the ace matches the owner: ~290 s, ~80k points, frozen 25% of the time).
 *
 * SEND (M6): in a battle, press SEND (the strongest affordable tier) once
 * energy reaches SEND_AT while the board is calm (no freeze wanted), after
 * REACTION. A guess to tune with `npm run match`. TARGETING (M7): the
 * strategy a bot aims with, set once at the start (rookies random, pilots
 * counter their attackers, aces finish off whoever is in danger).
 */
export const BOT = {
  LEVELS: {
    rookie: {
      REACTION: 700,
      THINK_BASE: 600,
      PER_ADD: 900,
      PER_CARRY: 300,
      NOISE: 0.35,
      PER_KEY: 220,
      ERROR_RATE: 0.12,
      NOTICE_WRONG: 700,
      FREEZE_AT_PX: 100,
      MISS_DANGER: 0.3,
      PANIC_PX: 50,
      FOCUS: 0.6,
      SEND_AT: 100,
      TARGETING: "random" as TargetStrategy,
    },
    pilot: {
      REACTION: 400,
      THINK_BASE: 0,
      PER_ADD: 1200,
      PER_CARRY: 400,
      NOISE: 0.3,
      PER_KEY: 150,
      ERROR_RATE: 0.06,
      NOTICE_WRONG: 500,
      FREEZE_AT_PX: 140,
      MISS_DANGER: 0.15,
      PANIC_PX: 70,
      FOCUS: 0.85,
      SEND_AT: 75,
      TARGETING: "attackers" as TargetStrategy,
    },
    ace: {
      REACTION: 200,
      THINK_BASE: 0,
      PER_ADD: 900,
      PER_CARRY: 300,
      NOISE: 0.25,
      PER_KEY: 100,
      ERROR_RATE: 0.02,
      NOTICE_WRONG: 300,
      FREEZE_AT_PX: 170,
      MISS_DANGER: 0.2,
      PANIC_PX: 90,
      FOCUS: 0.98,
      SEND_AT: 60,
      TARGETING: "kos" as TargetStrategy,
    },
  },
  // A mistake is off by 10 this often (else off by 1).
  TENS_SLIP: 0.3,
  // A strafer about to dive counts as this many px closer when picking targets.
  DIVE_DANGER_PX: 200,
  // While still thinking, a newly seen alien this much more dangerous (px)
  // makes the bot switch to it (with chance FOCUS), dropping its thinking.
  SWITCH_MARGIN_PX: 120,
  // Balls hidden more than this (Blinker lids) can't be read.
  MAX_READ_COVER: 0.5,
  // Time powers (FREEZE, SLOW): unanswered aliens on screen that make a bot
  // consider one (with each level's FREEZE_AT_PX / PANIC_PX / MISS_DANGER).
  FREEZE_MIN_OPEN: 2,
  // The other effects, same for every level. "Danger" is the y of the lowest
  // lethal alien not yet answered (the ship's line is PLAYER.Y = 430).
  POWER: {
    BLAST_Y: 340, // blast (full bar) when danger passes this with 2+ unanswered,
    BLAST_LAST_Y: 385, // or with any number once it passes this
  },
} as const;

export type BotLevel = keyof typeof BOT.LEVELS;
