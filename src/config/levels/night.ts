import type { BossDef, LevelDef } from "../tuning/story";

/*
 * Level 9: THE NIGHT SKY (doodles: renderDoodle/levels/night.ts; rules for
 * its creatures: objects/nightTraits.ts, the boss: objects/moon.ts).
 *
 * Math: the plan (docs/SOLO_MODES_DESIGN.md §3) mixes all four operations
 * here (blue + red + green + yellow balls). Operations come later as one
 * shared piece for every level, so for now this page is sums only.
 */

/**
 * Invaders (a nod to the original Metic): they move only in steps, on a
 * beat, like Space Invaders: down, SIDE_STEPS steps one way, down,
 * SIDE_STEPS back. A row that came in together steps together. The beat
 * quickens as they come down (up to QUICKEN shorter at the ship's line), so
 * an invader left too long marches faster and faster.
 */
export interface MarchTiming {
  BEAT_MS: number;
  STEP_MS: number;
  SIDE_STEPS: number;
  DX: number;
  DY: number;
  QUICKEN: number;
}

/** Little invaders: ~30 px/s at the top, ~55 near the ship. */
export const INVADER_MARCH: MarchTiming = {
  BEAT_MS: 400,
  STEP_MS: 110,
  SIDE_STEPS: 2,
  DX: 14,
  DY: 48,
  QUICKEN: 0.5,
};

/** Big invaders carry 3-ball sums, so they march slower (owner's rule). */
export const BIG_INVADER_MARCH: MarchTiming = { ...INVADER_MARCH, BEAT_MS: 640, DY: 40 };

/** Comets streak in from a side and keep flying on a slant, bouncing off
 * the page's edges and off other creatures (px/s sideways while falling). */
export const COMET = { SLANT_PX_S: 70, EDGE_PX: 4 } as const;

/**
 * UFOs patrol the top like any strafer, but every EVERY_MS of patrol they
 * warp: their lights spin for WARN_MS (the telegraph, numbers still
 * readable), then they vanish and reappear PX away (toward the roomier
 * side of the page) after WARP_MS. Their sum never changes.
 */
export const UFO_WARP = { EVERY_MS: 1300, WARN_MS: 500, WARP_MS: 280, PX: 120 } as const;

/**
 * The bonus shooting star crosses fast (PACE × the drifter's speed),
 * falling DROP_PX on the way, and burns out: its numbers fade from
 * BURN_FROM to BURN_TO of the way across. Make a wish (answer) before that.
 */
export const WISH = { PACE: 1.7, DROP_PX: 70, BURN_FROM: 0.45, BURN_TO: 0.8 } as const;

/**
 * THE MOON's phases (objects/moon.ts): a shadow sweeps across its face,
 * left to right: full (all three numbers lit) → waning (the shadow comes in
 * from the left and the numbers go dark one by one) → new moon (all dark)
 * → waxing (the shadow leaves to the right, the left number first) → full.
 * Its numbers show only on the lit part, and its sum never changes while
 * dark, so a number read before the shadow took it still counts.
 * Each answer shortens the full moon and lengthens the dark.
 */
export const MOON_PHASES = {
  /** The face's radius (the view draws it; the rules light the balls on it). */
  FACE_R: 40,
  FULL_MS: 3000,
  WANE_MS: 1300,
  NEW_MS: 1000,
  WAX_MS: 1300,
  /** Per answer taken: the full moon this much shorter (down to MIN_FULL_MS)… */
  FULL_LOSS_MS: 250,
  MIN_FULL_MS: 2000,
  /** …and the new moon this much longer. */
  NEW_GAIN_MS: 150,
} as const;

/** Level 9's boss: the Moon, read only where it is lit. */
const MOON: BossDef = {
  NAME: "THE MOON",
  MODEL: "boss_moon",
  MECHANIC: "night_phases",
  // Its numbers ride across the upper half of its face.
  BOX: { HALF_W: 44, BALLS_Y: 18, BOTTOM: 42 },
  KIND: "lumberer",
  // Six answers and its numbers go dark: the slowest boss so far for its d
  // (~15 px/s at d 0.9; the dragon walks ~13 at d 0.75).
  HP: 6,
  BALLS: 3,
  SPEED: 0.3,
  SCORE_MULT: 6,
  // After an answer it slips behind a cloud, drifts to the other side and
  // up, and comes out full.
  BURROW_UP_PX: 120,
  BURROW_MS: 900,
  REVEAL_MS: 900,
  RETREAT_Y: 150,
  MIN_Y: 150,
};

/** Level 9: THE NIGHT SKY. */
export const NIGHT: LevelDef = {
  NAME: "THE NIGHT SKY",
  PAGE: "night",
  SEED: 1009,
  PATH_MS: 140_000,
  D: { FROM: 0.75, TO: 0.9 },
  // Invaders (darters), comets (swoopers) and UFOs (strafers); 3-ball sums
  // are big invaders.
  TWO_BALL_KINDS: { darter: 0.45, strafer: 0.25, swooper: 0.3 },
  ABILITIES: [],
  DRIFTERS: true,
  SPECIES: {
    darter: {
      NAME: "invader",
      LAYOUT: "eyes",
      TRAIT: "night_march",
      MARCH: { SIZE: 3, CHANCE: 0.6, ROW: true },
      INTRO: "INVADERS · they march in step… faster as they come down",
    },
    lumberer: { NAME: "big invader", TRAIT: "night_bigMarch", INTRO: "BIG INVADER · three eyes, slow march" },
    swooper: {
      NAME: "comet",
      LAYOUT: "chain",
      TRAIT: "night_bounce",
      SPEED: 0.9,
      INTRO: "COMETS · they bounce off the edges",
    },
    strafer: { NAME: "ufo", TRAIT: "night_warp", SPEED: 0.95, INTRO: "UFOS · lights spin… and it warps" },
    drifter: {
      NAME: "shooting star",
      LAYOUT: "eyes",
      TRAIT: "night_wish",
      INTRO: "SHOOTING STAR · make a wish before it burns out",
    },
  },
  BOSS: MOON,
};
