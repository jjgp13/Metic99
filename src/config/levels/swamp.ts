import type { BlinkTiming } from "../../objects/abilities";
import type { BossDef, LevelDef } from "../tuning/story";

/**
 * Level 4: THE MUD SWAMP (doodles: renderDoodle/levels/swamp.ts; its own
 * rules: objects/swamp.ts). Planned math: + and − (docs/SOLO_MODES_DESIGN.md
 * §3); sums only until subtraction lands as its own shared piece.
 */

/** Each half of the Mud Monster after it splits: a smaller mud blob with a
 * 2-ball sum that sinks once and glops back up before it's beaten. */
const MUD_HALF: BossDef = {
  NAME: "MUD MONSTER SPLITS",
  MODEL: "boss_mud_half",
  MECHANIC: "mud_half",
  // Half of the whole's box, so both halves start inside it (MUD_SPLIT).
  BOX: { HALF_W: 19, BALLS_Y: 34, BOTTOM: 22 },
  KIND: "lumberer",
  HP: 2,
  BALLS: 2,
  SPEED: 0.4,
  SCORE_MULT: 3,
  BURROW_UP_PX: 90,
  BURROW_MS: 700,
  REVEAL_MS: 800,
  RETREAT_Y: 150,
  MIN_Y: 140,
};

/**
 * Level 4's boss: a mud monster that sinks into the swamp after its first
 * answer, then splits in two after its second. Both halves must be beaten:
 * 2 + 2 × 2 = 6 answers (the mole takes 5), so it is slower than the mole.
 */
const MUD_MONSTER: BossDef = {
  NAME: "MUD MONSTER",
  MODEL: "boss_mud",
  MECHANIC: "split",
  BOX: { HALF_W: 44, BALLS_Y: 52, BOTTOM: 36 },
  KIND: "lumberer",
  HP: 2,
  BALLS: 3,
  SPEED: 0.4,
  SCORE_MULT: 3,
  BURROW_UP_PX: 100,
  BURROW_MS: 900,
  REVEAL_MS: 900,
  RETREAT_Y: 140,
  MIN_Y: 150,
  PART: MUD_HALF,
};

/** How the Mud Monster splits (objects/swamp.ts). */
export const MUD_SPLIT = {
  // Each half starts this far left/right of the whole's center (inside the
  // whole's box, so it is clear of everyone), then glides out to SPREAD_PX.
  START_PX: 25,
  SPREAD_PX: 75,
  GLIDE_MS: 500,
} as const;

/** The slime blob pops into two little blobs (the Splitter's splitlings):
 * they never land lower than this y (Endless: SPLITTER.MAX_CHILD_Y 260), so
 * there's time to read both new sums. */
export const SLIME = { MAX_CHILD_Y: 190 } as const;

/** The peeper ducks its eyes (its numbers) under the mud on this rhythm. */
export const PEEK: BlinkTiming = {
  FIRST_OPEN_MS: 4200, // time to come in and be read
  OPEN_MS: 2600,
  WARN_MS: 700, // bubbles, then it ducks (the telegraph)
  WARN_FLUTTERS: 2,
  WARN_COVER: 0.35,
  LID_MS: 200,
  CLOSED_MS: 1000,
};

/** The firefly's light flickers out now and then (its numbers go dark). */
export const GLOW: BlinkTiming = {
  FIRST_OPEN_MS: 3000,
  OPEN_MS: 2200,
  WARN_MS: 500,
  WARN_FLUTTERS: 3,
  WARN_COVER: 0.5,
  LID_MS: 120,
  CLOSED_MS: 800,
};

export const SWAMP: LevelDef = {
  NAME: "THE MUD SWAMP",
  PAGE: "swamp",
  SEED: 1004,
  PATH_MS: 200_000,
  // Bots (20 seeds): pilot clears 15/20, ace 20/20, rookie 0/20 (out in ~1.5
  // min). Starts below level 3's end because every creature has a trait;
  // from d 0.5 (the last fifth) 3-ball turtles join.
  D: { FROM: 0.3, TO: 0.55 },
  // Peepers (strafers), slime blobs (darters) and snails (swoopers). Slimes
  // are the rarest: their splitlings are what hits pilots most.
  TWO_BALL_KINDS: { darter: 0.3, strafer: 0.4, swooper: 0.3 },
  ABILITIES: [],
  DRIFTERS: true,
  // Each creature's trait makes it harder to beat, so it moves slower (SPEED,
  // the same numbers as the matching ABILITY.SPEED).
  SPECIES: {
    darter: { NAME: "slime", TRAIT: "split", SPEED: 0.7, INTRO: "SLIME BLOBS · pop into two" },
    strafer: {
      NAME: "peeper",
      LAYOUT: "eyes",
      TRAIT: "peek",
      SPEED: 0.6,
      INTRO: "PEEPERS · their eyes duck under the mud",
    },
    swooper: { NAME: "snail", TRAIT: "shell", SPEED: 0.7, INTRO: "MUD SNAILS · knock off the shell, then again" },
    lumberer: { NAME: "turtle", INTRO: "BOG TURTLES · three numbers on the shell" },
    drifter: { NAME: "firefly", LAYOUT: "wings", TRAIT: "glow", INTRO: "FIREFLY · catch it while it glows" },
  },
  BOSS: MUD_MONSTER,
};
