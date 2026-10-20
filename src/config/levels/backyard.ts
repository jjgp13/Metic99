import { OWNER_WAVE, type BossDef, type LevelDef } from "../tuning/story";

/** Level 1's boss: a giant mole that digs around the backyard. */
const GIANT_MOLE: BossDef = {
  NAME: "GIANT MOLE",
  MODEL: "boss_mole",
  MECHANIC: "burrow",
  BOX: { HALF_W: 42, BALLS_Y: 50, BOTTOM: 36 },
  KIND: "lumberer",
  HP: 5,
  BALLS: 3,
  SPEED: 0.45,
  SCORE_MULT: 5,
  BURROW_UP_PX: 110,
  BURROW_MS: 800,
  REVEAL_MS: 900,
  RETREAT_Y: 140,
  MIN_Y: 140,
};

/** Level 1: THE BACKYARD (doodles: renderDoodle/levels/backyard.ts). */
export const BACKYARD: LevelDef = {
  NAME: "THE BACKYARD",
  PAGE: "backyard",
  SEED: 1001,
  // Owner's playtest: 3 min to the mole was too long and too easy. Bots
  // (12 seeds): rookie 4/12, pilot and ace 12/12; an ace clears in ~2:10.
  PATH_MS: 85_000,
  D: { FROM: 0.1, TO: 0.35 },
  WAVES: { PROFILE: OWNER_WAVE, PEAK: 2 },
  // Bugs: beetles (darters) and worms (swoopers); no divers yet.
  TWO_BALL_KINDS: { darter: 0.6, strafer: 0, swooper: 0.4 },
  ABILITIES: [],
  DRIFTERS: true,
  SPECIES: {
    darter: { NAME: "beetle", LAYOUT: "eyes", MARCH: { SIZE: 2, CHANCE: 0.35 }, INTRO: "BEETLES · their eyes are the numbers" },
    swooper: { NAME: "worm", LAYOUT: "chain", INTRO: "WORMS · made of numbers" },
    drifter: { NAME: "butterfly", LAYOUT: "wings", TRAIT: "wings", INTRO: "BUTTERFLY · read it while its wings are open" },
  },
  BOSS: GIANT_MOLE,
};
