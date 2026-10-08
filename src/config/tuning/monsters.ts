// Monsters: kinds, movement, readability boxes and abilities.
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

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
  TWO_BALL_KINDS: { darter: 0.4, strafer: 0.3, swooper: 0.3 } as Record<
    "darter" | "strafer" | "swooper",
    number
  >,

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
  // 2 balls: flies in sideways from a screen edge through a band below the
  // top HUD, slows into its lane, then glides straight down. Its spawn needs
  // the whole flight path clear (Swarm.placeSwooper); a flight held up once it
  // is fully on screen just turns down where it is.
  swooper: {
    MODEL: "alien_swooper",
    HALF_W: 18,
    BALLS_Y: 28,
    BOTTOM: 16,
    SPEED: 0.9, // × fall/home speed once it turns down
    ENTER_SPEED: 120, // px/s sideways
    BRAKE_PX: 40, // slows over the last px before its lane…
    MIN_ENTER: 0.3, // …down to this share of ENTER_SPEED
    BAND_Y: { min: 100, max: 160 }, // body y of the flight (ball row clears the HUD)
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
  // Splitlings keep their parent's pace (ABILITY.SPEED.splitter) instead of
  // bursting out as full-speed darters (playtest: 123 px/s vs the parent's 67).
  CHILD_SPEED: 0.7,
  // After landing they hold still this long, so both new sums can be read.
  HATCH_MS: 700,
  // The second splitling lands this much higher, so the pair doesn't reach
  // the player at the same moment (playtest: 7 of 8 splitling hits were pairs).
  STAGGER_PX: 40,
  // Splitlings never land closer to the player than this, so a point-blank
  // kill doesn't drop two fresh sums on top of the ship.
  MAX_CHILD_Y: 260,
  // A splitling whose landing box would break the readability rule (another
  // alien's box within READ_GAP) is not spawned.
} as const;
