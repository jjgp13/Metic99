/**
 * Central tuning + layout constants.
 * The world is a fixed virtual resolution that Phaser scales to fit any screen.
 */
export const GAME = {
  WIDTH: 480,
  HEIGHT: 720,
  BG_COLOR: "#05060f",
} as const;

export const PLAYER = {
  Y: 430, // fixed vertical line the ship rides on (keypad sits below it)
  MOVE_LERP: 0.22, // how snappily the ship slides toward a target (0..1)
  SHOOT_RANGE: 6, // px tolerance to consider "lined up" and fire
  // Playtest switch: 3 lives (classic) vs 1 (knockout, as leaned to for the
  // battle royale). With 1 life the RECOVERY freeze never runs: the only hit
  // ends the game, so slow time is the player's sole safety tool.
  LIVES: 3,
  FIRE_COOLDOWN: 250, // ms between shots
  SCALE: 2, // ship model scale (16px source art)
} as const;

export const BULLET = {
  SPEED: 700, // px/sec upward
  MUZZLE_OFFSET: 24, // px above the ship where bullets spawn
  // Hit box: a bullet hits an alien whose center is within HALF_W horizontally
  // and whose y the bullet swept past (±HALF_H) this frame. Matches the old
  // arcade overlap of a 16×32 bullet vs a 24×24 alien body.
  HIT_HALF_W: 20,
  HIT_HALF_H: 28,
} as const;

export const ENEMY = {
  HOME_TRIGGER_Y: 220, // y after which a descending alien speeds up toward the player
  SCALE: 1.5, // voxel-fallback alien body scale
  BALL_SPACING: 20, // px between adjacent number balls (centers)
  BALL_RADIUS: 9, // px; number ball size (drawn by render3d/NumberBall.ts)
  BALL_OFFSET_Y: 24, // px the ball row sits above a voxel-fallback body

  // Readability rule (docs/MULTIPLAYER_DESIGN.md §3): each alien owns a box
  // around its ball row and body (see MONSTERS). A move that would bring two
  // boxes closer than READ_GAP is not made: the alien holds that axis, and
  // sideways movers turn around, so ball rows never overlap by accident.
  READ_GAP: 8,
  // New aliens enter only where their horizontal sweep (zig-zag width, patrol
  // span) clears the sweep of every alien still above this y.
  ENTRY_ZONE_Y: 180,
  SPAWN_EDGE: 6, // px kept between a sweep and the field edge

  // 3+ ball sums are always lumberers; 2-ball sums pick a kind by weight.
  TWO_BALL_KINDS: { darter: 0.6, strafer: 0.4 } as Record<"darter" | "strafer", number>,

  // Spawn pacing is gated by the board's CURRENT cognitive load, not a blind
  // clock. Each alien contributes its THREAT_BY_BALLS weight; new spawns are
  // withheld while the live total is at/above the difficulty-scaled budget, so
  // the screen never floods and a hit stays recoverable.
  THREAT_BY_BALLS: { 2: 1, 3: 2, 4: 3 } as Record<number, number>,
  // Aliens carrying this many balls (or more) are "hard" — slow, multi-number
  // sums. Their concurrent count is capped so two never appear at once early on.
  HARD_BALL_THRESHOLD: 3,
  // While the board is at its threat ceiling, recheck this often (ms) instead of
  // waiting a full spawn interval, so deferred spawns don't pile up and burst.
  SPAWN_RETRY_MS: 350,
} as const;

/**
 * Monster kinds: each has its own model, movement pattern and readability box.
 * Box = HALF_W (widest body half-width; the ball row widens it for 3 balls),
 * BALLS_Y (ball-row center above the body; must match the model's
 * socket_balls) and BOTTOM (lowest body point below center), all in px.
 * SPEED multiplies the difficulty's fall/home speed.
 */
export const MONSTERS = {
  // 2 balls: fast zig-zag dive around its entry lane.
  darter: {
    MODEL: "alien_darter",
    HALF_W: 15,
    BALLS_Y: 28,
    BOTTOM: 19,
    SPEED: 1.25,
    ZIG_AMPLITUDE: 26, // px either side of its lane
    ZIG_SPEED: 70, // px/s sideways
  },
  // 3 balls: slow stop-and-go stomp (moves half of each cycle, same average).
  lumberer: {
    MODEL: "alien_lumberer",
    HALF_W: 27,
    BALLS_Y: 30,
    BOTTOM: 28,
    SPEED: 0.85,
    STOMP_MS: 1400, // one step + one pause
  },
  // 2 balls, Galaga-style: flies into a band at the top, patrols sideways for
  // DIFFICULTY.STRAFER_PATROL_MS (time to read its sum), shakes, then dives.
  strafer: {
    MODEL: "alien_strafer",
    HALF_W: 24,
    BALLS_Y: 30,
    BOTTOM: 20,
    ENTER_SPEED: 90, // px/s down into the band
    BAND_Y: { min: 110, max: 140 }, // body y of the patrol band
    PATROL_HALF: 60, // px either side of its entry x
    PATROL_SPEED: 60, // px/s
    WINDUP_MS: 600, // telegraph: hovers and shakes before the dive
    DIVE_SPEED: 1.6, // × home speed
  },
  // Bonus: crosses sideways, never reaches the player (non-lethal). Solving it
  // gives an ENERGY_BURST; left alone it just leaves. Doesn't count toward the
  // spawn caps, and stray bullets fly through it (it must be solved).
  drifter: {
    MODEL: "alien_drifter",
    HALF_W: 25,
    BALLS_Y: 26,
    BOTTOM: 25,
    BAND_Y: { min: 190, max: 260 },
    CROSS_SPEED: 45, // px/s (~11 s to cross)
    BOB_PX: 6,
    BOB_MS: 1800,
    FIRST_MS: 15000, // field time before the first one
    INTERVAL_MS: { min: 18000, max: 28000 }, // between drifters
    ENERGY_BURST: 40,
  },
} as const;

export type AlienKind = keyof typeof MONSTERS;

/**
 * Readability boxes for models that ability aliens wear (same fields as
 * MONSTERS; the box follows the model, the movement follows the kind).
 * Shielded's box includes its shield ring (RENDER3D.SHIELD_RADIUS).
 */
export const MODEL_BOXES: Record<string, { HALF_W: number; BALLS_Y: number; BOTTOM: number }> = {
  alien_shielded: { HALF_W: 23, BALLS_Y: 34, BOTTOM: 23 },
  alien_blinker: { HALF_W: 15, BALLS_Y: 30, BOTTOM: 19 },
  alien_splitter: { HALF_W: 22, BALLS_Y: 30, BOTTOM: 12 },
  alien_splitling: { HALF_W: 10, BALLS_Y: 26, BOTTOM: 12 },
};

/**
 * Monster abilities (src/objects/abilities.ts). Later these are the aliens
 * players send each other; in single player they join the run as difficulty
 * rises. Every hide is telegraphed and follows a fixed rhythm so it can be
 * learned; accidental overlap is still a bug.
 */
export const ABILITY = {
  // Difficulty d at which each ability starts appearing (earliest first).
  UNLOCK_AT: { shielded: 0.25, blinker: 0.4, splitter: 0.55 },
  // Chance that a spawn gets one of the unlocked abilities (lerped on d).
  CHANCE: { easy: 0.2, hard: 0.4 },
  // Ability aliens alive at once (the locked target doesn't count). A second one
  // is allowed only late in a run.
  SECOND_AT: 0.8,
  // Ability aliens always carry this many balls: the ability is the challenge.
  BALLS: 2,
  // Extra cognitive load an ability alien adds to the threat budget.
  THREAT: 1,
  // Kill score multiplier per ability (on top of the normal formula).
  SCORE_MULT: { shielded: 1.3, blinker: 1.5, splitter: 1.2 },
  // Movement: each ability rides on a monster kind's pattern. Harder-to-kill
  // abilities pick slow patterns and a lower SPEED (× the kind's own speed), so
  // they take longer to reach the player: Shielded needs two answers and
  // stomps; Blinker hides its sum, so it patrols the top band for longer and
  // dives slower; Splitter zig-zags a little slower than a darter.
  KIND: { shielded: "lumberer", blinker: "strafer", splitter: "darter" },
  SPEED: { shielded: 0.7, blinker: 0.6, splitter: 0.7 },
  PATROL_MULT: 1.5, // blinker (strafer) patrols this much longer
  // The model each ability wears, so the ability reads before it triggers.
  MODEL: { shielded: "alien_shielded", blinker: "alien_blinker", splitter: "alien_splitter" },
  // Shown once per run, the first time each ability appears.
  INTRO: {
    shielded: "SHIELDED · answer twice",
    blinker: "BLINKER · read it while its eyes are open",
    splitter: "SPLITTER · pops into two small aliens",
  },
  INTRO_Y: 80,
  INTRO_MS: 2600,
} as const;

/** Blinker: its balls close like eyelids on a fixed, learnable rhythm. */
export const BLINKER = {
  // The first open phase is longer so it can enter the screen and be read.
  FIRST_OPEN_MS: 3200,
  OPEN_MS: 2400,
  // Before closing, the lids flutter half-shut (the telegraph).
  WARN_MS: 600,
  WARN_FLUTTERS: 2,
  WARN_COVER: 0.4, // how far the lids dip while fluttering (1 = shut)
  LID_MS: 150, // close / open animation
  CLOSED_MS: 1100,
} as const;

/** Shielded: the first correct answer breaks the shield and rolls a new sum. */
export const SHIELD = {
  KNOCKBACK_PX: 24, // pushed up when the shield breaks...
  KNOCKBACK_MS: 180,
  REVEAL_MS: 600, // ...then holds still while the new sum pops in
} as const;

/** Splitter: destroyed, it pops into two 2-ball splitlings. */
export const SPLITTER = {
  CHILD_MODEL: "alien_splitling",
  SPREAD_PX: 46, // each splitling glides this far left/right of the parent
  // Closest a splitling lands to the field edge: its zig-zag sweep (~45 px)
  // plus ENEMY.SPAWN_EDGE. The pair shifts inward together to respect it.
  EDGE_PX: 52,
  GLIDE_MS: 420,
  // Splitlings never land closer to the player than this, so a point-blank
  // kill doesn't drop two fresh sums on top of the ship.
  MAX_CHILD_Y: 260,
  // A splitling whose landing box would break the readability rule (another
  // alien's box within READ_GAP) is not spawned.
} as const;

/**
 * Skill-based scoring. Points reward harder sums, faster solving, later game and
 * uninterrupted streaks:
 *
 *   points = BASE * ballCountBonus * speedBonus * difficultyMult * comboMult
 *
 * - ballCountBonus: harder (more-number) sums pay more.
 * - speedBonus: solving within FAST_MS pays FAST_MULT, decaying to SLOW_MULT by
 *   SLOW_MS (measured from when the alien spawned).
 * - difficultyMult: 1 + d, so late-game kills are worth up to ~2x.
 * - comboMult: consecutive kills without losing a life raise the multiplier by
 *   COMBO_STEP each, capped at COMBO_MAX; a hit resets the streak.
 */
export const SCORE = {
  BASE: 50,
  BALL_COUNT_BONUS: { 2: 1.0, 3: 1.6, 4: 2.4 } as Record<number, number>,
  FAST_MS: 1500, // solved at/under this -> full speed bonus
  SLOW_MS: 6000, // solved at/over this -> no speed bonus
  FAST_MULT: 2.0,
  SLOW_MULT: 1.0,
  COMBO_STEP: 0.25, // multiplier gained per consecutive kill
  COMBO_MAX: 4.0,
} as const;

/** Mastery ranks shown on game over, keyed by best-score thresholds. */
export const RANKS: ReadonlyArray<{ min: number; name: string }> = [
  { min: 0, name: "Rookie" },
  { min: 2000, name: "Cadet" },
  { min: 6000, name: "Pilot" },
  { min: 15000, name: "Ace" },
  { min: 30000, name: "Commander" },
  { min: 60000, name: "Legend" },
];

/** localStorage keys for the high score and persistent mastery stats. */
export const STORAGE = {
  HIGHSCORE: "metic-highscore",
  BEST_COMBO: "metic-best-combo",
  TOTAL_KILLS: "metic-total-kills",
  FASTEST_MS: "metic-fastest-ms",
  LAST_NAME: "metic-last-name", // remembers the player's last arcade initials
  LAST_LEN: "metic-last-len", // remembers the chosen initials length
  SHIP: "metic-ship", // player ship model picked on the menu
  INPUT_MODE: "metic-input", // "keys" (keypad) or "draw" (handwriting pad)
} as const;

/** Arcade global leaderboard (Supabase-backed). */
export const LEADERBOARD = {
  // Players choose how many initials to register, from MIN to MAX.
  NAME_LEN_MIN: 3,
  NAME_LEN_MAX: 6,
  NAME_LEN_DEFAULT: 5, // pre-selected length (classic arcade default)
  // Characters selectable per initials slot, in cycle order.
  CHARSET: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split(""),
  TOP_N: 20, // rows fetched/shown on the leaderboard screen
  MAX_SCORE: 1000000, // must match the Supabase score_range CHECK constraint
} as const;

/**
 * Difficulty ramp.
 *
 * Difficulty is a normalized value d(t) in [0,1) driven by a LOGISTIC (sigmoid)
 * curve of elapsed time. A sigmoid gives exactly the feel we want:
 *   - a gentle warm-up at the start (curve is nearly flat early),
 *   - a smooth acceleration through the middle,
 *   - a plateau near 1 so the game stays hard but never becomes impossible.
 *
 *   d(t) = 1 / (1 + e^(-k * (t - t0)))
 *
 * where t = seconds elapsed, t0 = MIDPOINT (where d = 0.5), and k = STEEPNESS
 * (larger k = sharper ramp). Every concrete parameter below is then linearly
 * interpolated between its `easy` and `hard` value using d.
 */
export const DIFFICULTY = {
  MIDPOINT: 50, // seconds until difficulty reaches the halfway point
  STEEPNESS: 0.055, // logistic k; controls how sharp the ramp is

  // px/sec — how fast aliens fall, then home toward the player.
  FALL_SPEED: { easy: 28, hard: 110 },
  HOME_SPEED: { easy: 45, hard: 150 },

  // ms between spawns (easy = slow/sparse, hard = fast/dense).
  SPAWN_INTERVAL: { easy: 2200, hard: 650 },

  // Hard cap on aliens alive at once, so the field never gets so crowded that a
  // single hit becomes unrecoverable. This is an absolute safety net; the threat
  // budget below is the primary pacing gate and usually binds first.
  MAX_ON_SCREEN: { easy: 4, hard: 8 },

  // Weighted cognitive-load ceiling on screen (see ENEMY.THREAT_BY_BALLS). New
  // spawns are held while live threat is at/above this, keeping mental load
  // bounded. Already-answered (locked, fleeing) aliens don't count.
  THREAT_BUDGET: { easy: 3, hard: 8 },

  // Difficulty at which a SECOND concurrent "hard" (multi-number) enemy is
  // allowed. Below this only one hard enemy can be on screen, so the player
  // never juggles two slow multi-number sums until very late game.
  SECOND_HARD_AT: 0.85,

  // Progression is SCORE-LED (the player earns difficulty), with a gentle
  // time-based floor so a struggling/idle player still sees a slow ramp.
  //   dScore = score / (score + SCORE_HALF)   (0 at start, 0.5 at SCORE_HALF)
  //   dTimeFloor = min(logistic(t), TIME_FLOOR_MAX)
  //   d = max(dScore, dTimeFloor)
  SCORE_HALF: 6000, // points at which score-driven difficulty reaches 0.5
  TIME_FLOOR_MAX: 0.4, // most the time floor alone can raise difficulty

  // Concurrent UNSOLVED aliens the player must juggle (not yet answered). This
  // is the primary spawn gate and is driven by score ALONE (dScore), so the
  // board opens up only as the player earns points: 1 → 2 → 3.
  MAX_UNSOLVED: { easy: 1, hard: 3 },

  // A sum needs at least two numbers, so always >= 2 balls.
  MIN_BALLS: 2,
  MAX_BALLS: { easy: 2, hard: 3 },
  MAX_DIGIT: { easy: 3, hard: 9 },

  // How long a strafer patrols the top band before diving (read time).
  STRAFER_PATROL_MS: { easy: 5000, hard: 2800 },
} as const;

/**
 * Hit-recovery: after losing a life on a crowded screen the player needs a
 * moment to recover. The whole field FREEZES for FREEZE_MS so there is time to
 * read and answer the next sum, then resumes at POST_HIT_FACTOR of normal speed
 * for the rest of the run (the difficulty curve keeps ramping underneath, so
 * absolute speed still climbs over time). The slowdown is flat, not stacking.
 */
export const RECOVERY = {
  FREEZE_MS: 3000, // field is completely frozen for this long after a hit
  POST_HIT_FACTOR: 0.8, // field speed multiplier once movement resumes
} as const;

/**
 * Energy: kills charge a meter the player chooses when to spend (slow time now;
 * sending aliens to opponents in the battle royale, see
 * docs/MULTIPLAYER_DESIGN.md). Harder, faster and streakier kills charge more:
 *
 *   gain = BASE * ballBonus * digitBonus * speedBonus * comboBonus
 *
 * - ballBonus: more numbers in the sum pay more.
 * - digitBonus: 1 for an average digit of 1, rising to DIGIT_MAX_MULT at 9.
 * - speedBonus: FAST_MULT when solved within SCORE.FAST_MS, decaying to
 *   SLOW_MULT by SCORE.SLOW_MS (same window as the score's speed bonus).
 * - comboBonus: +COMBO_STEP per consecutive kill, capped at COMBO_MAX.
 *
 * An easy early kill gives ~8 (about 0.7 s of SLOW or 0.3 s of FREEZE); a fast
 * 3-ball kill on a streak gives 30+.
 */
export const ENERGY = {
  MAX: 100,
  BASE: 6,
  BALL_BONUS: { 2: 1.0, 3: 1.6, 4: 2.2 } as Record<number, number>,
  DIGIT_MAX_MULT: 1.5,
  FAST_MULT: 1.5,
  SLOW_MULT: 1.0,
  COMBO_STEP: 0.1,
  COMBO_MAX: 2.0,
} as const;

/** The two ways to spend energy on time: each has its own button. */
export type SlowMode = "slow" | "freeze";

/**
 * Time powers: spend energy on the player's own field (aliens + spawn clock).
 * The ship and bullets keep full speed, and the difficulty clock keeps running.
 * Both are toggles that drain energy while on; only one runs at a time.
 * They trade efficiency for safety:
 * - slow: the economical option. Field at 30% for ~8 s per full bar
 *   (saves ~5.8 s of alien movement), but aliens still creep.
 * - freeze: the emergency option. Field fully stopped, but it burns twice as
 *   fast: ~4 s per full bar (saves ~4 s).
 */
export const SLOW_TIME = {
  MODES: {
    slow: { FACTOR: 0.3, PER_SEC: 12 },
    freeze: { FACTOR: 0, PER_SEC: 25 },
  } as Record<SlowMode, { FACTOR: number; PER_SEC: number }>,
  MIN_START: 10, // energy needed to switch either on (stops tap-flicker at empty)
} as const;

/**
 * Answer feedback: what the player sees while typing. The typed number turns
 * gold when it matches an alien (which gets lock-on brackets) and red when no
 * alien's answer can start with it (then it clears itself). The answer stays
 * shown until its alien dies, which pops the solved sum ("7 + 5 = 12").
 */
export const FEEDBACK = {
  COLOR: { typing: "#ffffff", match: "#ffd166", wrong: "#ef476f" },
  MATCH_POP_SCALE: 1.5, // typed number pops from this scale on a match
  MATCH_POP_MS: 180,
  WRONG_SHAKE_PX: 8,
  WRONG_CLEAR_MS: 450, // a wrong answer clears itself after this long
  FLY_MS: 240, // a matched number flies from the display to its alien
  RETICLE: {
    COLOR: 0xffd166,
    PAD: 5, // px around the alien's box (ball row + body)
    ARM: 9, // corner bracket arm length
    WIDTH: 3,
    SNAP_FROM: 1.8, // brackets start this much wider and snap in
    SNAP_MS: 160,
  },
  EQUATION: { FONT_PX: 18, POP_MS: 150, HOLD_MS: 450, FADE_MS: 850, RISE_PX: 34 },
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

/** How the player enters answers on screen (the keyboard works in both). */
export type InputMode = "keys" | "draw";

/** Number ball colors map to future math operations (sum/sub/mul/div). */
export const BALL_COLOR = {
  SUM: "blueBalls",
  SUB: "redBalls",
  MUL: "greenBalls",
  DIV: "yellowBalls",
} as const;

/**
 * 3D presentation (Three.js). The playfield keeps its 2D logical coordinates
 * (GAME.WIDTH × GAME.HEIGHT px); a perspective camera is placed so the z = 0
 * plane maps 1:1 onto the Phaser canvas, keeping the 2D HUD aligned with the
 * 3D world. Sprites are extruded into voxel models (1 voxel = 1 source pixel).
 */
export const RENDER3D = {
  FOV: 30, // vertical field of view (deg); narrow = subtle perspective
  MAX_PIXEL_RATIO: 2, // cap for high-DPI phones (fill-rate)

  // Model thickness in voxels.
  ALIEN_DEPTH: 6,
  SHIP_DEPTH: 6,
  BULLET_DEPTH: 2,

  // Number balls: glass spheres with the digit inside (render3d/NumberBall.ts).
  BALL_RADIUS: ENEMY.BALL_RADIUS,
  // Glass tint per ball texture key = math operation (see BALL_COLOR).
  BALL_TINT: {
    blueBalls: 0x3d8bff, // sum
    redBalls: 0xff4d5e, // subtraction
    greenBalls: 0x3ddc84, // multiplication
    yellowBalls: 0xffd23f, // division
  } as Record<string, number>,

  // Blender-built .glb models (public/assets/models/<name>.glb, see
  // docs/ART_SPEC.md). Any that fail to load fall back to sprite voxels.
  MODELS: [
    "ship_player",
    "ship_dart",
    "ship_pod",
    "alien_darter",
    "alien_lumberer",
    "alien_drifter",
    "alien_strafer",
    "alien_shielded",
    "alien_blinker",
    "alien_splitter",
    "alien_splitling",
  ],

  // Player ships selectable on the menu (model name + label). The first one is
  // the default. Icons: public/assets/icons/<model>.png (built with the models).
  SHIPS: [
    { model: "ship_player", name: "FALCON" },
    { model: "ship_dart", name: "DART" },
    { model: "ship_pod", name: "POD" },
  ],

  // Debris colors each monster model bursts into (model per kind: MONSTERS).
  ALIEN_MODELS: {
    alien_darter: [0xf2913d, 0x5a2d96, 0x7ff6ff],
    alien_lumberer: [0x2bb3a3, 0x1b7468, 0xf5f5f0],
    alien_drifter: [0x8e4fd8, 0xf29bc1, 0xff6be6],
    alien_strafer: [0xd63fa6, 0x5a2d96, 0x9aa0b5],
  } as Record<string, readonly number[]>,

  // Models worn by ability aliens (never picked at random), with debris colors.
  ABILITY_MODELS: {
    alien_shielded: [0x7d8196, 0x5a2d96, 0xff6be6],
    alien_blinker: [0xd63fa6, 0x5a2d96, 0xf5f5f0],
    alien_splitter: [0xf29bc1, 0xd63fa6, 0xff6be6],
    alien_splitling: [0xf29bc1, 0xd63fa6],
  } as Record<string, readonly number[]>,

  // Blinker ball lids: color, and how far back they rest when open (rad; a
  // little under π/2 so a thin lid rim shows at rest and marks the ball).
  BALL_LID_COLOR: 0xd63fa6,
  BALL_LID_OPEN_ANGLE: 1.2,
  // Shield bubble (never a ball color): radius clears the ball row above.
  SHIELD_COLOR: 0xff6be6,
  SHIELD_RADIUS: 21,
  SHIELD_SHARDS: 16,
  // New sum after a shield breaks: the balls pop in from this scale.
  SUM_POP_SCALE: 1.6,
  SUM_POP_MS: 260,

  // Idle motion: aliens sway (yaw) to show off their depth, and bank into
  // sideways moves like the ship.
  ALIEN_SWAY: 0.5, // rad
  ALIEN_SWAY_SPEED: 0.0025, // rad per ms
  ALIEN_BANK_PER_PXS: 0.006, // rad per px/s of sideways speed
  ALIEN_BANK_MAX: 0.5, // rad

  // Sine motion of the models' anim_* parts (docs/ART_SPEC.md §6).
  ANIM: {
    TAIL_WAG: 0.45, // darter tail, rad
    TAIL_SPEED: 0.012, // rad per ms
    LEG_SWING: 0.35, // lumberer legs, rad (synced to its stomp)
    STOMP_LIFT: 3, // px the lumberer's body rises while stepping
    SKIRT_SPIN: 0.0006, // drifter skirt, rad per ms
    SKIRT_PULSE: 0.1, // drifter skirt scale ±
    SKIRT_PULSE_SPEED: 0.004, // rad per ms
    WING_FLAP: 0.45, // strafer wings, rad
    WING_SPEED: 0.018, // rad per ms (doubles in windup/dive)
    WINDUP_SHAKE: 2.5, // px the strafer jitters before diving
  },
  // Ship banks toward where it is sliding.
  SHIP_BANK_PER_PX: 0.012,
  SHIP_BANK_MAX: 0.7, // rad
  SHIP_BANK_RESPONSE: 10, // 1/s, how fast bank follows its target

  STAR_COUNT: 260,
  STAR_NEAR_Z: -80,
  STAR_FAR_Z: -2600,
  STAR_DRIFT: 45, // world px/s; farther stars *look* slower (true parallax)

  // Answer stars (render3d/AnswerStars.ts): a pool of background stars that
  // gather into the typed answer behind the field, then burst when it's solved.
  // Kept dim and deep so the number balls stay the most readable thing.
  ANSWER_STARS: {
    COUNT: 170, // pool size; the ones not in the number drift as normal stars
    Z: -500, // depth of the pool (behind every alien)
    CENTER_Y: 250, // logical y the number is centered on
    DIGIT_H: 120, // logical px: digit glyph height
    DIGIT_ADVANCE: 88, // logical px between two digits' centers
    SAMPLE_PX: 7, // glyph sampling grid (logical px)
    MAX_PER_DIGIT: 48, // stars per digit
    GATHER_RATE: 16, // 1/s: how fast stars fly into the shape (~150 ms)
    // Point sizes as PointsMaterial counts them (like the starfield): at Z, a
    // size of 5 is about 1 logical px.
    SIZE_IDLE: 4,
    SIZE_FORMED: 28,
    BRIGHTNESS: 0.7, // formed star color multiplier (dim = background)
    COLORS: { typing: 0xbfd4ff, match: 0xffd166, wrong: 0xef476f },
    BURST_SPEED: { min: 250, max: 650 }, // world px/s outward when solved
    SCATTER_SPEED: { min: 60, max: 160 }, // wrong answer: a small, sad scatter
    FADE_RATE: 2, // 1/s: released stars fade back to plain stars
  },

  DEBRIS_COUNT: 22,
  DEBRIS_SIZE: 3,
  DEBRIS_SPEED: { min: 90, max: 320 }, // px/s
  DEBRIS_LIFE_MS: 650,
  FLASH_MS: 220,
  FLASH_INTENSITY: 6,
} as const;
