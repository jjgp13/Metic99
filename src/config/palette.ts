/**
 * The UI's named colors. Use these instead of hex literals, so a color has one
 * meaning and one place to change it (docs/ENGINEERING.md §1).
 *
 * Reserved: red, green and yellow are the colors of future number balls
 * (subtraction, multiplication, division; docs/ART_SPEC.md §4), so nothing
 * else in play uses them for meaning. That is why attacks are orange and
 * incoming attacks pink rather than red.
 *
 * 3D model colors (debris, shields, ball tints) stay in RENDER3D: they belong
 * to the models, not to the UI.
 */
export const PALETTE = {
  /** The page behind everything; also text outlines. */
  BACKGROUND: 0x05060f,
  /** Buttons, bars and other surfaces. */
  PANEL: 0x1b2340,
  /** A pressed key, a lit border, a surface's outline. */
  PANEL_LIGHT: 0x33406e,
  /** The main UI accent: titles, key borders, the difficulty bar. */
  ACCENT: 0x4ea1ff,
  /** "Yes / good / yours": a matching answer, score, badges, your target. */
  GOLD: 0xffd166,
  /** "No / bad": a wrong answer, game over, danger on a tile. */
  DANGER: 0xef476f,
  /** Power energy: the meter, energy pops. */
  ENERGY: 0x5ef0ff,
  /** Battle: attacks sent, attackers, the attack gauge. */
  ATTACK: 0xff8c42,
  /** Battle: attacks waiting to land on you. */
  INCOMING: 0xff5c8a,
  /** The drifter's bonus energy burst. */
  BONUS: 0xff6be6,
  TEXT: 0xffffff,
  /** Hints, labels and anything secondary. */
  TEXT_MUTED: 0x8893b5,
} as const;

/** A palette color as a CSS string ("#ffd166"), for Phaser text and the DOM. */
export function css(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
