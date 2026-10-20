import type { BlinkTiming } from "../../objects/abilities";
import type { BossDef, LevelDef } from "../tuning/story";
import { OWNER_WAVE } from "../tuning/waves";

/*
 * Level 10: THE KID'S BEDROOM, the finale (doodles:
 * renderDoodle/levels/bedroom.ts; rules for its toys: objects/bedroom.ts).
 * At night the toys come alive, and under the bed something is waiting.
 *
 * Math: the plan (docs/SOLO_MODES_DESIGN.md §3) mixes all four operations
 * here. Operations come later as one shared piece for every level, so for
 * now this page is sums only, its hard sums carried by 3-ball teddy bears.
 */

/** Wind-up soldier (trait "bedroom_windup"): marches while its key turns,
 * slows down as the spring runs out (the telegraph), stands still while the
 * key is wound again, then marches on. All times are field time, so a line
 * of soldiers that came in together stops and starts together. */
export const WINDUP = {
  WALK_MS: 2200, // marching at full speed
  SLOW_MS: 700, // the spring runs down: slower and slower
  STOP_MS: 900, // stopped while its key is wound
} as const;

/** Jack-in-the-box (trait "bedroom_jack"): a closed box (its numbers hidden
 * inside) cranks its handle, the box shakes for WARN_MS (the telegraph),
 * then POP: the jack springs out with his eyes (the numbers) and the box
 * jumps POP_PX closer. He stays out OPEN_MS, then squeezes back in. */
export const JACK = {
  CRANK_MS: 1000, // closed, the handle turning…
  WARN_MS: 400, // …the last of it shaking
  POP_MS: 260,
  POP_PX: 80,
  OPEN_MS: 2100, // out: the time to read him
  DUCK_MS: 250, // squeezing back in
} as const;

/** Rubber ball (trait "bedroom_bounce"): it rolls in from a side (the
 * swooper's flight in), then bounces down the page, DX sideways and DY down
 * per bounce, off the page's edges and off other toys. It squashes on each
 * landing; the view draws the arc's height ARC_PX. */
export const BOUNCE = {
  HOP_MS: 460,
  SQUASH_MS: 150,
  DX: 34,
  DY: 44,
  ARC_PX: 14,
} as const;

/** Teddy bear (trait "bedroom_nap"): waddles side to side, yawns, then sits
 * down for a nap. Its numbers (three tummy buttons) stay readable: the nap
 * is breathing room for the hardest sums on the page. */
export const NAP = {
  WALK_MS: 3000, // waddling (the last YAWN_MS of it yawning)
  YAWN_MS: 600,
  NAP_MS: 1500,
  WADDLE_PX: 6, // sideways sway…
  WADDLE_MS: 1400, // …one step left and right (the lumberer's stomp)
} as const;

/** Paper plane (the bonus, trait "bedroom_loop"): glides across the room
 * and every EVERY_MS flies a loop-the-loop of RADIUS_PX. */
export const LOOP = {
  EVERY_MS: 2600,
  LOOP_MS: 1100,
  RADIUS_PX: 20,
} as const;

/** The monster's eyes peek out from the dark under the bed and duck back
 * in on a fixed rhythm (narrowing first: the telegraph). Real time, like
 * the Blinker: FREEZE stops the bed, not the eyes. */
export const PEEK: BlinkTiming = {
  FIRST_OPEN_MS: 3400,
  OPEN_MS: 2800,
  WARN_MS: 500,
  WARN_FLUTTERS: 2,
  WARN_COVER: 0.4,
  LID_MS: 200,
  CLOSED_MS: 1000,
};

/** After each answer but the last, the monster flings a toy out from under
 * the bed as it comes back up: one of the level's toys, by turn
 * (soldier, ball…), landing beside the bed; it holds still HOLD_MS. */
export const TOY_THROW = {
  KINDS: ["darter", "swooper"] as const,
  GAP_PX: 10, // between the bed's box and the toy's
  HOLD_MS: 600,
} as const;

/** Both phases of the boss share one box: the monster climbs out from
 * exactly where the bed was, so it always has room there. */
const BED_BOX = { HALF_W: 60, BALLS_Y: 30, BOTTOM: 36 };

/**
 * Phase 2: out from under the bed, in full. It hides nothing now and has
 * fewer answers left, so it is faster (owner's rule: the more answers, the
 * slower); after each answer it leaps across and holds still to be read.
 */
const MONSTER_OUT: BossDef = {
  NAME: "OUT FROM UNDER THE BED",
  MODEL: "boss_bedmonster",
  MECHANIC: "burrow",
  BOX: BED_BOX,
  KIND: "lumberer",
  HP: 3,
  BALLS: 3,
  SPEED: 0.32,
  SCORE_MULT: 8,
  BURROW_UP_PX: 100,
  BURROW_MS: 800,
  REVEAL_MS: 900,
  RETREAT_Y: 150,
  MIN_Y: 150,
};

/**
 * The finale's boss (mechanic "bedroom_underbed", objects/bedroom.ts): a bed
 * that creeps toward the player with the monster hiding under it. Only its
 * three eyes (the numbers) peek out of the dark, and duck back in. After
 * each answer it scoots across and up and flings a toy out (TOY_THROW). Its
 * last answer flips the bed: the monster climbs out in full (PART), and the
 * story ends when that is beaten too. Seven answers in all, the most of any
 * boss, so the bed is the slowest boss of all.
 */
const UNDER_THE_BED: BossDef = {
  NAME: "UNDER-THE-BED MONSTER",
  MODEL: "boss_underbed",
  MECHANIC: "bedroom_underbed",
  BOX: BED_BOX,
  KIND: "lumberer",
  HP: 4,
  BALLS: 3,
  SPEED: 0.18,
  SCORE_MULT: 6,
  BURROW_UP_PX: 110,
  BURROW_MS: 900,
  REVEAL_MS: 1000,
  RETREAT_Y: 150,
  MIN_Y: 150,
  PART: MONSTER_OUT,
};

/** Level 10: THE KID'S BEDROOM, the last page of the story. */
export const BEDROOM: LevelDef = {
  NAME: "THE KID'S BEDROOM",
  PAGE: "bedroom",
  SEED: 1010,
  PATH_MS: 65_000,
  D: { FROM: 0.8, TO: 0.95 },
  WAVES: { PROFILE: OWNER_WAVE, PEAK: 3 },
  // Soldiers (darters), jacks-in-the-box (strafers) and rubber balls
  // (swoopers); 3-ball sums are teddy bears.
  TWO_BALL_KINDS: { darter: 0.4, strafer: 0.3, swooper: 0.3 },
  ABILITIES: [],
  DRIFTERS: true,
  SPECIES: {
    darter: {
      NAME: "toy soldier",
      LAYOUT: "chain",
      TRAIT: "bedroom_windup",
      SPEED: 0.6,
      MARCH: { SIZE: 3, CHANCE: 0.25 },
      INTRO: "TOY SOLDIERS · they stop when their key runs down",
    },
    strafer: {
      NAME: "jack-in-the-box",
      LAYOUT: "eyes",
      TRAIT: "bedroom_jack",
      INTRO: "JACK-IN-THE-BOX · read him when he pops out",
    },
    swooper: {
      NAME: "rubber ball",
      LAYOUT: "eyes",
      TRAIT: "bedroom_bounce",
      INTRO: "RUBBER BALL · boing, boing, boing",
    },
    lumberer: {
      NAME: "teddy bear",
      LAYOUT: "cluster",
      TRAIT: "bedroom_nap",
      SPEED: 0.8,
      INTRO: "TEDDY BEAR · it waddles, then naps",
    },
    drifter: {
      NAME: "paper plane",
      LAYOUT: "wings",
      TRAIT: "bedroom_loop",
      INTRO: "PAPER PLANE · it loops the loop",
    },
  },
  BOSS: UNDER_THE_BED,
};
