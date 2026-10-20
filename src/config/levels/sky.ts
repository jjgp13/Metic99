import type { BossDef, LevelDef } from "../tuning/story";
import { OWNER_WAVE } from "../tuning/waves";

/*
 * Level 7: THE WINDY SKY (doodles: renderDoodle/levels/sky.ts; rules for its
 * creatures and the wind: objects/skyTraits.ts, the boss: objects/stormCloud.ts).
 *
 * Math: the plan (docs/SOLO_MODES_DESIGN.md §3) mixes × with + here (green
 * and blue balls on one page). Operations come later as one shared piece for
 * every level, so for now this page is sums only, with 3-bow kites as its
 * hard sums.
 *
 * The page's signature is the WIND: one rhythm on the game clock for the
 * whole sky (calm, then the wind picks up, then a gust), the gusts blowing
 * from the left and the right in turn. Every creature meets a gust its own
 * way: kites climb in it, swallows ride it down, paper planes and the
 * balloon are swept across, and the Storm Cloud drifts with it.
 */

/** The wind: CALM_MS of calm, WARN_MS of the wind picking up (swirls: the
 * telegraph), then a GUST_MS gust. Gust n blows right for even n, left for
 * odd n, so its direction can be learned too. */
export const SKY_WIND = {
  CALM_MS: 5600,
  WARN_MS: 1000,
  GUST_MS: 1400,
  /** A push never takes a creature closer than this to the field's edge. */
  EDGE_PX: 6,
} as const;

/** Kite (trait "sky_kite"): its numbers are the bows on its tail. On its
 * string it climbs and swings with each gust; then the string snaps (the
 * strafer's windup: it jerks) and it tumbles down, swinging side to side. */
export const KITE = {
  GUST_DX: 56, // swung this far with the gust…
  LIFT_PX: 22, // …and lifted this much (a kite climbs in the wind)
  GUST_MS: 1100,
  MIN_Y: 105, // never lifted above this y (its tail stays under the top HUD)
  TUMBLE_PACE: 0.6, // × the strafer's dive once the string snaps
  SWING_PX: 22, // sideways swings while it tumbles…
  SWING_MS: 1100, // …one swing there and back
  DRIFT_PX_S: 40, // a gust carries a falling kite along this fast
} as const;

/** Swallow (trait "sky_swoop"): its eyes are its numbers. It rides the gust:
 * when one blows, it swoops down and across with it. That is the gust's
 * danger, so answer a low swallow while the wind picks up. */
export const SWOOP = {
  DX: 34,
  DOWN_PX: 46,
  MS: 800,
} as const;

/** Paper plane (trait "sky_loop"): a number on each wing. Once it has turned
 * down, every EVERY_PX of descent it noses up (NOSE_MS: the telegraph) and
 * loops the loop: up and over by UP_PX, forward 2 × DX, LOOP_MS in all. A
 * gust sweeps it sideways (it is only paper). */
export const LOOP = {
  FIRST_PX: 70,
  EVERY_PX: 130,
  NOSE_MS: 350,
  UP_PX: 44,
  DX: 26,
  LOOP_MS: 1000,
  GUST_DX: 48,
  GUST_MS: 900,
} as const;

/** Hot-air balloon (the bonus, trait "sky_balloon"): a gust carries it far
 * along (with its drift: it may leave the page early; against it: it stays
 * longer). */
export const BALLOON = {
  GUST_DX: 90,
  GUST_MS: 1300,
} as const;

/**
 * The STORM CLOUD (mechanic "sky_storm", objects/stormCloud.ts): it drifts
 * down and with the wind. Every RAIN_EVERY_MS (field time, while none of its
 * raindrops is falling, counted once it is on the page) it rumbles (it darkens and shakes, RUMBLE_MS: the
 * telegraph; its numbers stay readable), then THUNDER: lightning strikes and
 * a raindrop falls out of it, a 2-ball sum of its own. The storm is over only
 * when the cloud and its last raindrop are both answered.
 */
export const STORM = {
  GUST_DX: 36,
  GUST_MS: 1200,
  RAIN_EVERY_MS: 4000,
  RUMBLE_MS: 1300,
  FLASH_MS: 450, // the bolt shows this long (view)
  RETRY_MS: 600, // no room for a raindrop: rumble again this soon
  DROP_REVEAL_MS: 500, // a new raindrop holds a moment so its sum can be read
} as const;

/** A raindrop out of the storm (mechanic "sky_raindrop"): one answer. If it
 * reaches the ship it splashes (a life), evaporates back up and falls again. */
const RAINDROP: BossDef = {
  NAME: "RAINDROP",
  INTRO: "RAINDROPS · answer every drop to win",
  MODEL: "boss_raindrop",
  MECHANIC: "sky_raindrop",
  BOX: { HALF_W: 19, BALLS_Y: 10, BOTTOM: 22 },
  KIND: "lumberer", // it wobbles down in drips
  HP: 1,
  BALLS: 2,
  SPEED: 0.6,
  SCORE_MULT: 1.5,
  BURROW_UP_PX: 0,
  BURROW_MS: 700, // evaporating back up after a splash
  REVEAL_MS: 500,
  RETREAT_Y: 190,
  MIN_Y: 150,
};

/** Level 7's boss: a thundercloud that rains raindrops (its minions). */
const STORM_CLOUD: BossDef = {
  NAME: "STORM CLOUD",
  INTRO: "THUNDER · every rumble drops a raindrop",
  MODEL: "boss_storm",
  MECHANIC: "sky_storm",
  BOX: { HALF_W: 52, BALLS_Y: 30, BOTTOM: 30 },
  KIND: "lumberer",
  // Five answers plus a raindrop after each of the first four (~9 in all,
  // the dragon takes 6): as slow as the dragon.
  HP: 5,
  BALLS: 3,
  SPEED: 0.2,
  SCORE_MULT: 6,
  // After an answer lightning splits it and it blows to the other side and
  // up, then gathers itself and holds still to be read.
  BURROW_UP_PX: 110,
  BURROW_MS: 900,
  REVEAL_MS: 900,
  RETREAT_Y: 140,
  MIN_Y: 140,
  PART: RAINDROP,
};

/** Level 7: THE WINDY SKY. */
export const SKY: LevelDef = {
  NAME: "THE WINDY SKY",
  PAGE: "sky",
  SEED: 1007,
  PATH_MS: 78_000,
  D: { FROM: 0.65, TO: 0.8 },
  WAVES: { PROFILE: OWNER_WAVE, PEAK: 3 },
  // Swallows (darters), kites (strafers) and paper planes (swoopers); 3-ball
  // sums are big kites with three bows on their tails.
  TWO_BALL_KINDS: { darter: 0.35, strafer: 0.35, swooper: 0.3 },
  ABILITIES: [],
  DRIFTERS: true,
  SPECIES: {
    darter: { NAME: "swallow", LAYOUT: "eyes", TRAIT: "sky_swoop", SPEED: 0.68, INTRO: "SWALLOWS · when the wind blows, they swoop" },
    strafer: { NAME: "kite", LAYOUT: "chain", TRAIT: "sky_kite", INTRO: "KITES · the numbers ride on their tails" },
    lumberer: { NAME: "kite", LAYOUT: "chain", TRAIT: "sky_kite", SPEED: 0.7, INTRO: "KITES · the numbers ride on their tails" },
    swooper: { NAME: "paper plane", LAYOUT: "wings", TRAIT: "sky_loop", INTRO: "PAPER PLANES · they loop the loop" },
    drifter: { NAME: "balloon", LAYOUT: "eyes", TRAIT: "sky_balloon", INTRO: "BALLOON · catch it before the wind does" },
  },
  BOSS: STORM_CLOUD,
};
