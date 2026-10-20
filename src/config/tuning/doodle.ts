// The doodle playfield (the default art; `?art=3d` for the old look): pencil drawings on notebook paper.
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
    // The player's ships, one doodle each (picked on the menu).
    falcon: "#7d6bd6",
    dart: "#5f6b7d",
    pod: "#c07a3e",
    canopy: "#2a8f9e",
    flame: "#f08a2c",
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

  // The ship when an alien gets through.
  HURT_KICK_PX: 14, // the ship is knocked down this far, then springs back
  HURT_KICK_MS: 260,
  HURT_BLINK_HZ: 8, // blinks while the field is frozen after a hit
  HURT_WORDS: ["ouch!", "oof!", "ow!"],
  DIZZY_STARS: 3, // stars circling the dazed ship
  DIZZY_RADIUS: 22,
  DIZZY_TURNS_PER_S: 0.8,
  // Knocked out: the ship snaps in two and the halves tumble off.
  DOWN_BURST_RADIUS: 46,
  DOWN_PIECE_SPEED: 70, // px/s sideways
  DOWN_PIECE_SPIN: 2.6, // rad/s
  DOWN_GRAVITY: 260, // px/s²
  DOWN_WORDS: ["KABOOM!", "CRASH!", "BOOM!"],
  // A level cleared: the ship blasts off the top (timing in LEVEL_CLEAR).
  LAUNCH_WORDS: ["zoom!", "whoosh!"],
  LAUNCH_WORD_DX: 62, // written this far right of the ship, clear of it
  /** Speed lines under the flying ship: [x offset px, length share, width px]. */
  SPEED_LINES: [
    [-15, 0.55, 1.2],
    [-7, 1, 1.7],
    [0, 0.7, 1.2],
    [7, 0.9, 1.7],
    [15, 0.5, 1.2],
  ],
  SPEED_LINE_ALPHA: 0.75,
  LAUNCH_FLAME_PX: 22, // the flame under it, at full trail

  // Story pages (renderDoodle/pages.ts): the page scrolls as the path goes by.
  PAGE_SCROLL_PX_PER_S: 22,
  PAGE_PROP_ALPHA: 0.5, // props stay faint: the numbers must win
  PAGE_DRIFT_ALPHA: 0.4, // drifts move, which draws the eye, so they are fainter still
  // A boss's answers left, as pips under it.
  BOSS_PIP_R: 4,
  BOSS_PIP_GAP: 12,
} as const;
