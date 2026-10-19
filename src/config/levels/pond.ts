import type { BossDef, LevelDef } from "../tuning/story";

/**
 * The Big Frog moves only by leaps: it sits (time to read its sum), puffs its
 * throat to croak (the telegraph), then leaps down and across to the next
 * lily pad. Its pace is LEAP_PX per sit + croak + leap (owner's rule: it
 * takes more answers than the mole, so it is slower: ~13 px/s vs ~20).
 */
export interface BigFrogDef extends BossDef {
  /** It leaps onto the page down to MIN_Y, this fast. */
  ENTER_MS: number;
  SIT_MS: number;
  CROAK_MS: number;
  LEAP_MS: number;
  /** Each leap: this far toward the ship and this far sideways (it zig-zags
   * between lily pads, turning back at the edges). */
  LEAP_PX: number;
  LEAP_SIDE_PX: number;
}

/** Level 2's boss: a big frog that croaks and leaps from pad to pad. */
const BIG_FROG: BigFrogDef = {
  NAME: "BIG FROG",
  MODEL: "boss_frog",
  MECHANIC: "leap",
  // Its balls ride on its back, at the top of its body.
  BOX: { HALF_W: 46, BALLS_Y: 34, BOTTOM: 40 },
  KIND: "lumberer",
  HP: 6,
  BALLS: 4,
  SPEED: 0, // no walking: the leaps below are all its moves
  SCORE_MULT: 6,
  // After an answer it jumps back up and across (numbers hidden in the air).
  BURROW_UP_PX: 110,
  BURROW_MS: 800,
  REVEAL_MS: 900,
  RETREAT_Y: 140,
  MIN_Y: 140,
  ENTER_MS: 900,
  SIT_MS: 1900,
  CROAK_MS: 700,
  LEAP_MS: 450,
  LEAP_PX: 40,
  LEAP_SIDE_PX: 60,
};

/** The frog hops like any lumberer but sits longer after each hop, the more
 * spots it carries (owner's rule: harder to solve = slower; trait "hop"). */
export const FROG = {
  SIT_PER_BALL_MS: 250, // 3 spots: +750 ms per hop (×0.65 pace), 4: +1000 (×0.58)
} as const;

/** The dragonfly darts down in zips, hovering between them (trait "dart"). */
export const DRAGONFLY = {
  DART_PX: 64, // down per dart…
  DART_SIDE_PX: 26, // …and this far to alternate sides
  DART_MS: 220,
  HOVER_MS: 520, // then it hangs in the air: time to read it
  EDGE_PX: 30, // never darts closer to the field's edge than this
} as const;

/** The duck paddles across and now and then dives, popping up further
 * along (trait "dive"); its numbers are hidden while it's under. */
export const DUCK = {
  FIRST_PADDLE_MS: 3400, // time to paddle in and be read
  PADDLE_MS: 2600,
  WARN_MS: 500, // it tips its head down first (the telegraph)
  WARN_COVER: 0.3,
  DIVE_MS: 900,
  DIVE_PX: 70, // how far it swims underwater
} as const;

/**
 * Level 2: THE POND (doodles: renderDoodle/levels/pond.ts). Sums only, now
 * with 3–4 balls (frogs). Planned math for later levels: subtraction joins
 * in level 3 (docs/SOLO_MODES_DESIGN.md §3).
 */
export const POND: LevelDef = {
  NAME: "THE POND",
  PAGE: "pond",
  SEED: 1002,
  PATH_MS: 200_000,
  D: { FROM: 0.1, TO: 0.28 },
  MAX_BALLS: 4,
  // Fish (darters) and dragonflies (strafers); 3–4 ball sums are frogs.
  TWO_BALL_KINDS: { darter: 0.55, strafer: 0.45, swooper: 0 },
  ABILITIES: [],
  DRIFTERS: true,
  SPECIES: {
    darter: { NAME: "fish", LAYOUT: "chain", MARCH: { SIZE: 3, CHANCE: 0.15 }, INTRO: "FISH · their numbers are bubbles · they swim in schools" },
    strafer: { NAME: "dragonfly", LAYOUT: "eyes", TRAIT: "dart", INTRO: "DRAGONFLY · darts down, hovers in between" },
    lumberer: { NAME: "frog", LAYOUT: "cluster", TRAIT: "hop", INTRO: "FROGS · 3 or 4 spots to add · read them while they sit" },
    drifter: { NAME: "duck", LAYOUT: "wings", TRAIT: "dive", INTRO: "DUCK · it dives! read it while it paddles" },
  },
  BOSS: BIG_FROG,
};
