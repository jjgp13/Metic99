import { GAME, KEYPAD_AREA, PLAYER } from "../../config/constants";

/**
 * Where the in-game HUD sits (480×720 logical px). The field is the top part
 * of the screen down to the ship's line (PLAYER.Y), with the top HUD over it
 * (score, progress bar, energy meter; it ducks under aliens). Under the
 * field, from top to bottom: the answer row, the keypad (or drawing pad) with
 * a gutter on each side, and a strip for the key hint or the battle dock.
 */

/** Drawing order: higher draws on top. The 3D field is under all of these. */
export const DEPTH = {
  /** Over the 3D field, under the HUD: lock-on brackets, the power's tint. */
  FIELD_OVERLAY: 4,
  HUD: 5,
  /** Small pops beside the meter. */
  POP: 6,
  /** The pause screen. */
  PAUSE: 9,
  /** The game-over screen (its dimmer is one below). */
  GAME_OVER: 11,
} as const;

/** The row between the ship and the keypad: the typed answer in the middle,
 * the drawing pad's C on the left, the KEYPAD/DRAW switch on the right. */
export const ANSWER_Y = PLAYER.Y + 36;

/** The tall buttons beside the keypad (POWER, or SEND in a battle). */
export const GUTTER = {
  W: 48,
  LEFT_X: 30,
  RIGHT_X: GAME.WIDTH - 30,
  TOP: KEYPAD_AREA.TOP,
  BOTTOM: KEYPAD_AREA.BOTTOM,
  H: KEYPAD_AREA.BOTTOM - KEYPAD_AREA.TOP,
  CENTER_Y: (KEYPAD_AREA.TOP + KEYPAD_AREA.BOTTOM) / 2,
} as const;

/**
 * The energy meter in the top HUD, under the progress bar (y 44), where the
 * eyes already are: under the keypad it went unseen in playtests. The power's
 * name sits left of it, the value right of it.
 */
export const METER = {
  LABEL_X: 12,
  X: 62,
  W: GAME.WIDTH - 62 - 44,
  Y: 57,
  H: 10,
  VALUE_X: GAME.WIDTH - 12,
} as const;

/** Solo: the key hint in the strip under the keypad (a battle puts its dock there). */
export const KEY_HINT_Y = KEYPAD_AREA.BOTTOM + 30;
