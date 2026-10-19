import type { BlinkTiming } from "../../objects/abilities";
import type { BossDef, LevelDef } from "../tuning/story";

/*
 * Level 6: THE VOLCANO (doodles: renderDoodle/levels/volcano.ts; rules for
 * its creatures: objects/volcanoTraits.ts, the boss: objects/dragon.ts).
 *
 * Math: the plan (docs/SOLO_MODES_DESIGN.md §3) brings multiplication (green
 * balls) in here. Operations come later as one shared piece for every level,
 * so for now this page is sums only, with 3-ball tortoises as its hard sums.
 */

/**
 * Fireflies flash together: one rhythm on the game clock for the whole
 * swarm (lit, flicker, dark), so every firefly on the page goes dark at the
 * same moment. Same shape as the Blinker's rhythm; FIRST_OPEN_MS = OPEN_MS
 * keeps it in step with the clock rather than with each firefly's spawn.
 */
export const FLASH: BlinkTiming = {
  FIRST_OPEN_MS: 2600,
  OPEN_MS: 2600,
  WARN_MS: 500, // the lantern flickers (the telegraph)…
  WARN_FLUTTERS: 3,
  WARN_COVER: 0.45,
  LID_MS: 120, // …dims…
  CLOSED_MS: 900, // …and stays dark
};

/** A creature that moves in hops: it sits still, then jumps (DX × its
 * heading, DY, alternating ±ARC_PX up and down), then sits again. The last
 * WARN_MS of each sit is its telegraph (the view swells it). */
export interface HopTiming {
  STICK_MS: number;
  WARN_MS: number;
  HOP_MS: number;
  DX: number;
  DY: number;
  ARC_PX: number;
}

/** Lava drips cling, swell and drop: ~68 px/s on average, a bit slower than
 * a darter here (~90), but in sudden 70 px drops. */
export const DRIP: HopTiming = { STICK_MS: 780, WARN_MS: 300, HOP_MS: 250, DX: 0, DY: 70, ARC_PX: 0 };

/** The bonus spark jumps across in hops (≈ the drifter's 45 px/s), resting
 * between them: the rests are when it can be read. */
export const SPARK: HopTiming = { STICK_MS: 1300, WARN_MS: 350, HOP_MS: 420, DX: 78, DY: 0, ARC_PX: 16 };

/**
 * The Dragon's fire breath (objects/dragon.ts): after walking WALK_PX
 * closer it stops and inhales (it shakes: the telegraph, its numbers still
 * readable), then breathes fire for BREATH_MS: its numbers melt in the
 * flames and re-form as a new sum, and the breath rears it back RECOIL_PX.
 */
export const DRAGON_BREATH = {
  WALK_PX: 50,
  INHALE_MS: 1200,
  BREATH_MS: 700,
  RECOIL_PX: 30,
} as const;

/** Level 6's boss: a dragon that breathes fire over its own numbers. */
const DRAGON: BossDef = {
  NAME: "DRAGON",
  MODEL: "boss_dragon",
  MECHANIC: "breath",
  BOX: { HALF_W: 46, BALLS_Y: 46, BOTTOM: 40 },
  KIND: "lumberer",
  // Six answers (the mole takes 5), so it is slower than the mole: ~13 px/s
  // walking at d 0.75 and less after its recoils, vs the mole's ~19.
  HP: 6,
  BALLS: 3,
  SPEED: 0.2,
  SCORE_MULT: 6,
  // After an answer it takes off in a burst of flame, flies to the other
  // side and up, then lands and holds still to be read.
  BURROW_UP_PX: 120,
  BURROW_MS: 900,
  REVEAL_MS: 1000,
  RETREAT_Y: 140,
  MIN_Y: 140,
};

/** Level 6: THE VOLCANO. */
export const VOLCANO: LevelDef = {
  NAME: "THE VOLCANO",
  PAGE: "volcano",
  SEED: 1006,
  PATH_MS: 200_000,
  D: { FROM: 0.6, TO: 0.75 },
  // Lava drips (darters) and fireflies (strafers); 3-ball sums are tortoises.
  TWO_BALL_KINDS: { darter: 0.55, strafer: 0.45, swooper: 0 },
  ABILITIES: [],
  DRIFTERS: true,
  SPECIES: {
    darter: { NAME: "lava drip", LAYOUT: "chain", TRAIT: "drip", INTRO: "LAVA DRIPS · they cling, swell… and drop" },
    strafer: { NAME: "firefly", TRAIT: "flash", SPEED: 0.8, INTRO: "FIREFLIES · they all go dark together" },
    lumberer: { NAME: "tortoise", TRAIT: "shell", SPEED: 0.45, INTRO: "LAVA TORTOISE · crack its shell, then answer again" },
    drifter: { NAME: "spark", LAYOUT: "eyes", TRAIT: "spark", INTRO: "SPARK · read it when it lands" },
  },
  BOSS: DRAGON,
};
