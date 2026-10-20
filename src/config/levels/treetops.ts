import type { BossDef, LevelDef } from "../tuning/story";
import { OWNER_WAVE } from "../tuning/waves";

/**
 * Level 3: THE TREETOPS (doodles: renderDoodle/levels/treetops.ts; traits:
 * objects/treetops.ts; boss: objects/owlBoss.ts). Its creatures:
 * - squirrels leap in from the tree trunks at the page's edge, then climb
 *   down and leap sideways from branch to branch, acorns (numbers) in paws;
 * - owls perch at the top and turn their heads away (numbers hidden), but
 *   always look at you when they swoop down;
 * - birds fly in flocks of up to three, a number on each wing;
 * - a hummingbird (bonus) darts across, hovering between darts.
 *
 * Planned math (docs/SOLO_MODES_DESIGN.md §3): this level adds subtraction
 * (red balls, bigger number first) once operations land as their own shared
 * piece. Sums only for now.
 */

/** Squirrel: after turning down it leaps to a new branch every EVERY_PX of
 * descent, sideways by PX (the other way each time, or away from an edge),
 * then freezes a moment. The numbers never hide: the leap is the challenge. */
export const LEAP = {
  FIRST_PX: 60, // descent before the first branch
  EVERY_PX: 120, // between branches
  PX: 70, // sideways…
  DROP_PX: 14, // …and a little down
  MS: 380, // the leap
  LAND_MS: 500, // freezes after landing (the doodle looks around)
  CROUCH_PX: 16, // the doodle crouches this close above a branch (telegraph)
  EDGE_PX: 6, // closest its box lands to the field edge
} as const;

/** Owl: turns its head away on a rhythm (same shape as BLINKER) while it
 * flies in and perches, never while it winds up or dives. */
export const HEAD_TURN = {
  FIRST_OPEN_MS: 3000, // time to fly in and be read
  OPEN_MS: 2600,
  WARN_MS: 500, // a glance aside before it turns (the telegraph)
  WARN_FLUTTERS: 1,
  WARN_COVER: 0.35,
  LID_MS: 250, // turning around / back
  CLOSED_MS: 900,
} as const;

/** Hummingbird: darts DART_PX ahead, then hovers HOVER_MS, every EVERY_PX
 * of crossing (it drifts slowly in between, like any drifter). */
export const HOVER = {
  FIRST_PX: 40, // on screen before its first dart
  EVERY_PX: 110,
  DART_PX: 80,
  DART_MS: 350,
  HOVER_MS: 1000,
} as const;

/** The Great Owl's blink: its eyes are its numbers. Every answer makes it
 * blink faster (OPEN_MS shrinks by SHRINK_MS per answer, down to MIN_OPEN_MS). */
/**
 * The Great Owl's riddle (objects/owlBoss.ts): "WHO?". Its eyes show one
 * number and a "?", its belly the total ("= 8"); the answer is the missing
 * number (8 - 3 = 5), never below MIN_ANSWER. Its eyes stay open while it
 * perches (the riddle is its trick, not blinking), shut while it flies.
 */
export const OWL_RIDDLE = {
  MIN_ANSWER: 2,
} as const;

/** Level 3's boss: a great owl perched high in the tree, asking riddles.
 * Each answer but the last ruffles it: it flies to a branch on the other side
 * (eyes shut while flying) and asks a new one. Six answers, and a riddle is
 * harder than a sum, so it hops down slower than the mole (owner's rule). */
const GREAT_OWL: BossDef = {
  NAME: "GREAT OWL",
  INTRO: "WHO? · answer the missing number",
  MODEL: "boss_owl",
  MECHANIC: "riddle",
  // Its two eyes are its ball row (BALLS_Y above the body center).
  BOX: { HALF_W: 44, BALLS_Y: 22, BOTTOM: 40 },
  KIND: "lumberer",
  HP: 6,
  BALLS: 2,
  SPEED: 0.35,
  SCORE_MULT: 6,
  BURROW_UP_PX: 120,
  BURROW_MS: 900,
  REVEAL_MS: 900,
  RETREAT_Y: 150,
  MIN_Y: 150,
};

export const TREETOPS: LevelDef = {
  NAME: "THE TREETOPS",
  PAGE: "treetops",
  SEED: 1003,
  PATH_MS: 88_000,
  // Two unsolved at a time from the start (level 1 mostly had one). Bots
  // (20 seeds): rookie clears 10/20 (level 1: 16/20), pilot 19/20, ace 20/20.
  D: { FROM: 0.3, TO: 0.45 },
  WAVES: { PROFILE: OWNER_WAVE, PEAK: 3 },
  // Birds (darters), owls (strafers), squirrels (swoopers).
  TWO_BALL_KINDS: { darter: 0.3, strafer: 0.3, swooper: 0.4 },
  ABILITIES: [],
  DRIFTERS: true,
  // Owner's rule: the harder a creature is to beat, the slower it moves. A
  // flock of three fast darters knocked every rookie out (0/20), so birds
  // glide at 0.6; owls hide their eyes, 0.9; a squirrel's landings already
  // slow it down.
  SPECIES: {
    swooper: { NAME: "squirrel", LAYOUT: "eyes", TRAIT: "leap", INTRO: "SQUIRRELS · they leap branch to branch" },
    strafer: { NAME: "owl", LAYOUT: "eyes", TRAIT: "headTurn", SPEED: 0.9, INTRO: "OWLS · read them while they look at you" },
    darter: { NAME: "bird", LAYOUT: "wings", SPEED: 0.6, MARCH: { SIZE: 3, CHANCE: 0.3 }, INTRO: "BIRDS · fly in flocks" },
    drifter: { NAME: "hummingbird", TRAIT: "hover", INTRO: "HUMMINGBIRD · catch it while it hovers" },
  },
  BOSS: GREAT_OWL,
};
