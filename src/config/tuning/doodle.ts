// The doodle playfield (`?art=doodle`): pencil drawings on notebook paper.
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

/**
 * Colors are CSS strings: the doodle view draws on a plain 2D canvas, not
 * through Phaser. Monster inks follow docs/ART_SPEC.md §4 (no ball colors).
 */
export const DOODLE = {
  // The sheet of paper behind the field.
  PAPER: "#f8f4e8",
  RULE: "rgba(92, 145, 205, 0.35)", // the blue lines
  RULE_GAP: 26, // px between lines
  RULE_TOP: 58, // first line (a notebook leaves a header strip)
  MARGIN: "rgba(214, 84, 84, 0.45)", // the red margin line
  MARGIN_X: 34,
  GRAIN_DOTS: 1600, // faint specks of paper grain

  // Pencil.
  GRAPHITE: "#33312e",
  GRAPHITE_LIGHT: "#8a857c",
  /** Line "boil": the strokes are redrawn this many times a second, each time
   * with a slightly different wobble, the way a hand-drawn animation shimmers. */
  BOIL_FPS: 10,
  /** Pre-drawn wobble variants of every doodle (frames of the boil cycle). */
  BOIL_FRAMES: 6,
  /** Cap on device pixels per CSS pixel (high-DPI phones: fill-rate). */
  MAX_PIXEL_RATIO: 2,

  // Colored pencil per monster (outline stays graphite).
  INK: {
    darter: "#f08a2c",
    lumberer: "#1f9e8f",
    strafer: "#c93d9a",
    swooper: "#2a8f9e",
    drifter: "#8e4fd8",
    ship: "#7d6bd6",
  } as Record<string, string>,
  /** Ability aliens wear a generic doodle in their model's color. */
  ABILITY_INK: {
    alien_shielded: "#7d8196",
    alien_blinker: "#c93d9a",
    alien_splitter: "#e0679f",
    alien_splitling: "#e0679f",
  } as Record<string, string>,

  // Number balls: circled handwritten digits. The ring carries the operation's
  // color; the digit is near-black ink so it reads first.
  FONT: "Patrick Hand",
  BALL_RING: {
    blueBalls: "#2563d9", // sum
    redBalls: "#d93636", // subtraction
    greenBalls: "#1f9e4a", // multiplication
    yellowBalls: "#d9a400", // division
  } as Record<string, string>,
  BALL_INK: "#14213d",
  BALL_FONT_PX: 17,
  BALL_POP_MS: 260, // a new sum (shield broke) pops in from bigger

  // Marks.
  TARGET: "#e09b00", // the lock-on circle (gold marker)
  TARGET_SNAP_MS: 160,
  SHIELD: "#c93d9a",
  SENT: "#ff8c42", // battle: an alien another player sent
  BULLET: "#33312e",
  SHIP_SHIELD: "#e09b00",

  // The typed answer, written big and faint on the paper behind the field
  // (the doodle version of the answer stars).
  ANSWER_Y: 250,
  ANSWER_FONT_PX: 150,
  ANSWER_ALPHA: { typing: 0.16, match: 0.3, wrong: 0.3 },
  ANSWER_COLOR: { typing: "#33312e", match: "#e09b00", wrong: "#d93636" },
  SOLVED_MS: 600, // a solved answer fades out with a tick

  // Explosions: a scribbled star, pencil lines flying out, a word.
  BURST_MS: 520,
  BURST_RADIUS: 30,
  BURST_SPECKS: 12,
  BURST_WORDS: ["pop!", "zap!", "boom", "pow!"],
} as const;
