import type Phaser from "phaser";
import { PALETTE, css } from "../config/palette";

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

/** The one font the game uses. */
export const FONT_FAMILY = "monospace";

/**
 * The game's text style: monospace at `sizePx` in `color` (a PALETTE color or
 * a CSS string). `extra` adds or overrides fields (bold, align, outline…).
 *
 *   this.add.text(x, y, "PAUSED", textStyle(28, PALETTE.ACCENT, { align: "center" }))
 */
export function textStyle(sizePx: number, color: number | string = PALETTE.TEXT, extra: TextStyle = {}): TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${sizePx}px`,
    color: typeof color === "number" ? css(color) : color,
    ...extra,
  };
}

/** A dark outline that keeps text readable over the 3D field. */
export function outline(thicknessPx = 4): TextStyle {
  return { stroke: css(PALETTE.BACKGROUND), strokeThickness: thicknessPx };
}
