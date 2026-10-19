import type { BossDef, LevelDef } from "../tuning/story";

/*
 * Level 8: THE SNOWY MOUNTAIN (doodles: renderDoodle/levels/snow.ts; rules
 * for its creatures: objects/snowTraits.ts, the boss: objects/yeti.ts).
 *
 * Everything on a snowy slope slides, rolls and gathers speed, so every
 * creature here says "answer me early": a penguin's belly-slide jumps it
 * closer, a snowball picks up another number, an ice block speeds up.
 *
 * Math: the plan (docs/SOLO_MODES_DESIGN.md §3) mixes the operations met so
 * far up here (sums, subtraction, multiplication). Operations come later as
 * one shared piece for every level, so for now this page is sums only, with
 * 3-ball ice blocks and grown snowballs as its hard sums.
 */

/**
 * Penguins waddle (their kind's zig-zag at SpeciesDef.SPEED), and every
 * WADDLE_MS of waddling they stop and lean forward (WARN_MS, the telegraph),
 * belly-slide SLIDE_PX closer in SLIDE_MS, then get back up (GETUP_MS).
 * All in field time, so a line of penguins slides together.
 */
export const PENGUIN_SLIDE = {
  WADDLE_MS: 1900,
  WARN_MS: 500,
  SLIDE_PX: 70,
  SLIDE_MS: 380,
  GETUP_MS: 350,
} as const;

/**
 * Snowballs roll in from a side and then down. Once their body passes
 * GROW_Y they pick up one more number (their old numbers stay, so the sum
 * so far still counts), and the bigger snowball rolls at GROWN_PACE
 * (harder to beat → slower: the owner's rule).
 */
export const SNOWBALL_GROW = {
  GROW_Y: 250,
  GROWN_PACE: 0.5,
} as const;

/**
 * Ice blocks have no brakes: their stomp-and-slide runs at FROM_PACE at the
 * top of the field and speeds up steadily to TO_PACE at the ship's line
 * (about the plain lumberer's pace on average).
 */
export const ICE_SLIDE = {
  FROM_PACE: 0.4,
  TO_PACE: 1.0,
} as const;

/** The bonus snowflake drifts across on the wind: calm (readable) for
 * CALM_MS at CALM_PACE, then a gust blows it along for GUST_MS at GUST_PACE
 * (≈ the plain drifter's crossing time overall). */
export const SNOWFLAKE_GUST = {
  CALM_MS: 2200,
  CALM_PACE: 0.45,
  GUST_MS: 900,
  GUST_PACE: 2.2,
} as const;

/**
 * The YETI's stomp (objects/yeti.ts): after walking WALK_PX closer it stops
 * and raises its fists (WINDUP_MS, it shakes: the telegraph), then stomps and
 * throws a snowball (from THROW_FROM_PX beside its box, so the two boxes
 * stay apart) THROW_DX to the side (gliding THROW_MS), never lower
 * than THROW_MAX_Y (so the snowball has time before it grows). At most
 * MAX_THROWN of its snowballs are on the field at once.
 */
export const YETI_STOMP = {
  WALK_PX: 45,
  WINDUP_MS: 1000,
  STOMP_MS: 450,
  THROW_FROM_PX: 50,
  THROW_DX: 150,
  THROW_MS: 600,
  THROW_MAX_Y: 175,
  MAX_THROWN: 1,
} as const;

/** Level 8's boss: a big clumsy yeti that stomps and throws snowballs. */
const YETI: BossDef = {
  NAME: "YETI",
  MODEL: "boss_yeti",
  MECHANIC: "snow_stomp",
  BOX: { HALF_W: 48, BALLS_Y: 50, BOTTOM: 40 },
  KIND: "lumberer",
  // Seven answers (the dragon takes 6), so it is the slowest boss yet:
  // ×0.17 vs the dragon's ×0.2 (owner's rule: more answers, slower).
  HP: 7,
  BALLS: 3,
  SPEED: 0.17,
  SCORE_MULT: 7,
  // After an answer it dives into a snowdrift, tunnels to the other side
  // and up, then bursts out and holds still to be read.
  BURROW_UP_PX: 120,
  BURROW_MS: 900,
  REVEAL_MS: 1000,
  RETREAT_Y: 140,
  MIN_Y: 140,
};

/** Level 8: THE SNOWY MOUNTAIN. */
export const SNOW: LevelDef = {
  NAME: "THE SNOWY MOUNTAIN",
  PAGE: "snow",
  SEED: 1008,
  PATH_MS: 135_000,
  D: { FROM: 0.7, TO: 0.85 },
  // Penguins (darters) and snowballs (swoopers); 3-ball sums are ice blocks.
  TWO_BALL_KINDS: { darter: 0.55, strafer: 0, swooper: 0.45 },
  ABILITIES: [],
  DRIFTERS: true,
  SPECIES: {
    darter: {
      NAME: "penguin",
      LAYOUT: "chain",
      TRAIT: "snow_slide",
      SPEED: 0.4,
      MARCH: { SIZE: 3, CHANCE: 0.3 },
      INTRO: "PENGUINS · they waddle… lean… and SLIDE",
    },
    swooper: {
      NAME: "snowball",
      TRAIT: "snow_grow",
      SPEED: 0.75,
      // Sized for 3 balls from the start: it grows into it.
      BOX: { HALF_W: 31, BALLS_Y: 18, BOTTOM: 16 },
      INTRO: "SNOWBALLS · answer before they pick up a number",
    },
    lumberer: {
      NAME: "ice block",
      TRAIT: "snow_ice",
      BOX: { HALF_W: 32, BALLS_Y: 16, BOTTOM: 24 },
      INTRO: "ICE BLOCK · no brakes: it slides faster and faster",
    },
    drifter: { NAME: "snowflake", LAYOUT: "eyes", TRAIT: "snow_gust", INTRO: "SNOWFLAKE · read it between gusts" },
  },
  BOSS: YETI,
};
