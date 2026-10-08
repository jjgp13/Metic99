// How the player enters an answer and sees it: feedback, handwriting.
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

import { PALETTE, css } from "../palette";

/**
 * Answer feedback: what the player sees while typing. The typed number turns
 * gold when it matches an alien (which gets lock-on brackets) and red when no
 * alien's answer can start with it (then it clears itself). The answer stays
 * shown until its alien dies, which pops the solved sum ("7 + 5 = 12").
 */
export const FEEDBACK = {
  COLOR: { typing: css(PALETTE.TEXT), match: css(PALETTE.GOLD), wrong: css(PALETTE.DANGER) },
  MATCH_POP_SCALE: 1.5, // typed number pops from this scale on a match
  MATCH_POP_MS: 180,
  WRONG_SHAKE_PX: 8,
  WRONG_CLEAR_MS: 450, // a wrong answer clears itself after this long
  FLY_MS: 240, // a matched number flies from the display to its alien
  RETICLE: {
    COLOR: PALETTE.GOLD,
    PAD: 5, // px around the alien's box (ball row + body)
    ARM: 9, // corner bracket arm length
    WIDTH: 3,
    SNAP_FROM: 1.8, // brackets start this much wider and snap in
    SNAP_MS: 160,
  },
  EQUATION: { FONT_PX: 18, POP_MS: 150, HOLD_MS: 450, FADE_MS: 850, RISE_PX: 34 },
  // HUD and pops drawn over the field fade to ALPHA while an alien's box
  // (ball row + body) is under them, so they never hide a sum (owner's
  // playtest: numbers sat under the top HUD half of every run). MS = fade time.
  DUCK: { ALPHA: 0.12, MS: 90 },
} as const;

/**
 * Handwriting input (src/handwriting/, src/ui/DrawPad.ts): the player draws
 * digits on a pad in the keypad area; a $P point-cloud recognizer reads them.
 * A finished stroke joins the current digit if it overlaps it sideways, or
 * starts the next digit if it lies to its right. After a pause every digit is
 * read, left to right, and sent as typed digits.
 */
export const HANDWRITING = {
  PAUSE_MS: 300, // quiet time after the last stroke before the ink is read
  // A stroke to the right of the current digit that overlaps it sideways by
  // less than this fraction (of the narrower of the two) starts the next digit,
  // so "12" can be written without a pause. A 4's stem or a 5's or 7's bar
  // overlaps its digit fully. Thin strokes (a 1) count as MIN_STROKE_W wide.
  NEW_DIGIT_OVERLAP: 0.35,
  MIN_STROKE_W: 12,
  // A thin stroke (narrower than MIN_STROKE_W) that reaches within TOUCH_PX
  // of the digit's right edge is its stem drawn separately (a 9 or a 4), not
  // a new 1.
  TOUCH_PX: 6,
  MAX_DIGITS: 2,
  MIN_INK_PX: 10, // ink smaller than this (a tap) is ignored
  // Recognizer ($P): points per resampled cloud and the largest cloud distance
  // still accepted (bigger = too unlike every template: shows "?").
  CLOUD_POINTS: 32,
  MAX_DISTANCE: 2.0,
  // Scratch-out = clear: one stroke this much wider than tall that turns back
  // sideways at least MIN_REVERSALS times (each leg ≥ REVERSAL_PX).
  SCRATCH: { MIN_ASPECT: 1.6, MIN_W: 50, MIN_REVERSALS: 2, REVERSAL_PX: 10 },
  INK: {
    COLOR: 0x5ef0ff,
    CORE_PX: 4,
    GLOW_PX: 14,
    GLOW_ALPHA: 0.22,
    UNKNOWN_COLOR: 0xef476f,
    FADE_MS: 180, // read ink fades while its stars fly off
  },
  PAD_FILL: 0x0b1024,
  PAD_ALPHA: 0.45, // see-through so the answer stars show where the ink was
} as const;

/**
 * Handwriting lab (`?lab=draw`, scenes/HandwritingLabScene.ts): asks for each
 * digit ROUNDS times in random order, then a few 2-digit NUMBERS, on the same
 * pad as the game, and exports the ink as JSON for tests and tuning.
 */
export const HANDWRITING_LAB = {
  ROUNDS: 3,
  NUMBERS: ["14", "27", "49", "58", "71", "96"],
} as const;

/** How the player enters answers on screen (the keyboard works in both). */
export type InputMode = "keys" | "draw";
