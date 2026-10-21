import type { BlinkTiming } from "../../objects/abilities";
import type { BossDef, LevelDef } from "../tuning/story";
import { OWNER_WAVE } from "../tuning/waves";

/**
 * Level 5: THE DARK CAVE (doodles: renderDoodle/levels/cave.ts).
 * Planned math (docs/SOLO_MODES_DESIGN.md §3): + and −. Sums only until
 * operations land as their own shared piece; then the cave mixes in red
 * subtraction balls.
 */

/** Bat (trait "roost", objects/caveTraits.ts): flies to the ceiling, hangs
 * upside down asleep, wakes with a shake (the telegraph), then drops and
 * flutters down. Its numbers are always readable: the danger is the drop. */
export const BAT = {
  HANG_MS: 3400, // asleep on the ceiling: the time to read it
  WAKE_MS: 700, // shakes awake before it lets go
  DROP_PACE: 0.65, // × the strafer's dive speed
  FLUTTER_PX: 9, // sideways flutter while it drops…
  FLUTTER_MS: 520, // …one flap this long
} as const;

/** Glowworm (trait "glowworm"): its body is its numbers and they glow on and off
 * on a fixed rhythm (bright → flicker → dark → bright). The first glow is
 * long, so it can be read as it comes in; the sum never changes while dark. */
export const GLOW: BlinkTiming & { PACE: number } = {
  FIRST_OPEN_MS: 4200,
  OPEN_MS: 3200,
  WARN_MS: 700, // the flicker before it goes dark (the telegraph)
  WARN_FLUTTERS: 3,
  WARN_COVER: 0.45,
  LID_MS: 260, // fading out / back in
  CLOSED_MS: 1000,
  // It hides its numbers, so it moves slower (owner's balance rule).
  PACE: 0.6,
};

/**
 * Cave Troll (mechanic "lamp", objects/caveTroll.ts): a lamp hangs from the
 * cave roof and its beam sweeps back and forth at a steady speed. The troll's
 * numbers show only while the beam is on them, and the light stuns it: it
 * stands still while lit and stomps on in the dark. Each answer makes it
 * angrier (its stomps speed up).
 */
export const TROLL_LAMP = {
  PIVOT_Y: -24, // the lamp hangs above the top edge, at the middle
  SWEEP_DEG: 56, // the beam swings this far either side of straight down…
  PERIOD_MS: 7000, // …one full swing there and back, at a steady speed
  CONE_DEG: 26, // half the beam's width
  EDGE_DEG: 5, // numbers fade in/out over this much at the beam's edge
  RAGE_PER_ANSWER: 0.12, // stomps this much faster after each answer
} as const;

const CAVE_TROLL: BossDef = {
  NAME: "CAVE TROLL",
  INTRO: "LAMPLIGHT · read it in the lamp's beam",
  MODEL: "boss_troll",
  MECHANIC: "lamp",
  BOX: { HALF_W: 46, BALLS_Y: 56, BOTTOM: 40 },
  KIND: "lumberer",
  // More answers than the mole (5), so it moves slower (owner's rule).
  HP: 6,
  BALLS: 3,
  SPEED: 0.3,
  SCORE_MULT: 6,
  BURROW_UP_PX: 120, // after an answer it staggers across and back up…
  BURROW_MS: 900,
  REVEAL_MS: 700, // …then catches its breath
  RETREAT_Y: 150,
  MIN_Y: 150,
};

export const CAVE: LevelDef = {
  NAME: "THE DARK CAVE",
  PAGE: "cave",
  SEED: 1005,
  PATH_MS: 70_000,
  // Bots (20 seeds, starting here with 3 lives): rookie clears 2/20, pilot
  // 18/20 (losing ~1 life), ace 20/20. d 0.5 → 0.65 left pilots 1/20.
  D: { FROM: 0.45, TO: 0.6 },
  WAVES: { PROFILE: OWNER_WAVE, BASE: 1, PEAK: 3 },
  // Bats (strafers) and glowworms (darters swinging on their threads; 3-ball
  // sums are big glowworms that lower themselves in jerks).
  TWO_BALL_KINDS: { darter: 0.45, strafer: 0.55, swooper: 0 },
  ABILITIES: [],
  DRIFTERS: true,
  SPECIES: {
    strafer: { NAME: "bat", LAYOUT: "wings", TRAIT: "roost", INTRO: "BATS · they hang, wake up, then drop" },
    darter: { NAME: "glowworm", LAYOUT: "chain", TRAIT: "glowworm", INTRO: "GLOWWORMS · read them while they glow" },
    lumberer: { NAME: "glowworm", LAYOUT: "chain", TRAIT: "glowworm", INTRO: "GLOWWORMS · read them while they glow" },
    drifter: { NAME: "minecart", LAYOUT: "eyes", INTRO: "MINE CART · its wheels are the numbers" },
  },
  BOSS: CAVE_TROLL,
};
