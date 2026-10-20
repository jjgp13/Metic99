import type { BossDef, LevelDef } from "../tuning/story";
import { OWNER_WAVE } from "../tuning/waves";

/**
 * The Giant Mole's molehills (objects/mole.ts): whack-a-mole. Three hills
 * across the page; it peeks out of one (numbers readable, still), ducks,
 * and digs to another, which shakes and spits dirt while it comes (the
 * telegraph: look there). Each new hill is STEP_DOWN_PX closer. Its sum
 * never changes between peeks, so a sum read once can be typed any time.
 * A dig stopped short by a creature (readability rule) goes on in
 * RETRY_DIG_MS tries for up to EXTRA_DIG_MS more, then it pops out there.
 */
export const MOLE_HILLS = {
  X: [96, 240, 384],
  PEEK_MS: 2400,
  DUCK_MS: 200,
  DIG_MS: 450,
  STEP_DOWN_PX: 30,
  RETRY_DIG_MS: 150,
  EXTRA_DIG_MS: 600,
} as const;

/** Level 1's boss: a giant mole that pops out of its molehills. */
const GIANT_MOLE: BossDef = {
  NAME: "GIANT MOLE",
  INTRO: "WHACK-A-MOLE · watch the hill that shakes",
  MODEL: "boss_mole",
  MECHANIC: "molehills",
  BOX: { HALF_W: 42, BALLS_Y: 50, BOTTOM: 36 },
  KIND: "lumberer",
  HP: 4, // 5 before the molehills: hiding between peeks made the fight ~5 s longer
  BALLS: 3,
  SPEED: 0.45,
  SCORE_MULT: 5,
  BURROW_UP_PX: 110,
  BURROW_MS: 800,
  REVEAL_MS: MOLE_HILLS.PEEK_MS, // unused: a new sum gets a whole peek
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
