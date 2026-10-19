import { BALL_LAYOUTS, DOODLE } from "../../config/constants";
import type Alien from "../../objects/Alien";
import { Shielded } from "../../objects/abilities";
import { Hops, type HopPhase } from "../../objects/volcanoTraits";
import type { CreatureLook, PageDef } from "../pages";
import type { DoodleRecipe, Point } from "../pencil";

/**
 * Level 6, THE VOLCANO (config/levels/volcano.ts): warm ash-orange paper
 * with lava cracks, rocks, smoke and embers; lava drips that are their
 * numbers, fireflies whose lanterns hold them, lava tortoises with number
 * rocks on their shells, a spark whose eyes are its numbers, and the DRAGON.
 * Fire is drawn in oranges, peach and plum: red and yellow mean math
 * operations (docs/ART_SPEC.md §4), so they stay off the creatures.
 */

const TAU = Math.PI * 2;
const C = {
  lava: "#f08a2c",
  crust: "#8a4b2a",
  glow: "#ffb86b",
  ash: "#7d746c",
  rock: "#5b5650",
  smoke: "#a39a92",
  plum: "#6e3f73",
  bug: "#5a4a52",
  belly: "#e8873a",
};

// --- Props --------------------------------------------------------------------

const LAVA_CRACK: DoodleRecipe = {
  w: 64,
  h: 26,
  draw(p) {
    const crack: Point[] = [
      [-28, 2],
      [-16, -4],
      [-8, 4],
      [4, -3],
      [14, 5],
      [28, -2],
    ];
    for (let i = 1; i < crack.length; i++) {
      const [x1, y1] = crack[i - 1];
      const [x2, y2] = crack[i];
      p.line(x1, y1, x2, y2, { stroke: C.lava, strokeWidth: 2.2 });
    }
    p.line(-8, 4, -12, 11, { stroke: C.lava, strokeWidth: 1.4 }); // a side crack
    p.line(4, -3, 8, -10, { stroke: C.lava, strokeWidth: 1.4 });
  },
};

const ROCK: DoodleRecipe = {
  w: 34,
  h: 26,
  draw(p) {
    p.shape(
      [
        [-13, 8],
        [-10, -4],
        [-2, -9],
        [8, -6],
        [13, 6],
      ],
      C.rock,
      { hachureGap: 2.6 },
    );
    p.line(-2, -9, 1, 2, { strokeWidth: 0.9 });
  },
};

const SMOKE_PUFF: DoodleRecipe = {
  w: 40,
  h: 34,
  draw(p) {
    p.circle(-7, 4, 14, undefined, { stroke: C.smoke });
    p.circle(4, 0, 17, undefined, { stroke: C.smoke });
    p.circle(0, -10, 11, undefined, { stroke: C.smoke });
    p.curve(
      [
        [9, -10],
        [13, -14],
        [10, -17],
      ],
      { stroke: C.smoke, strokeWidth: 1 },
    );
  },
};

const EMBERS: DoodleRecipe = {
  w: 34,
  h: 30,
  draw(p) {
    for (const [x, y, r] of [
      [-10, 6, 1.8],
      [-3, -4, 1.4],
      [6, 3, 2],
      [11, -8, 1.3],
      [1, 10, 1.2],
    ])
      p.dot(x, y, r, C.lava);
  },
};

const LITTLE_VOLCANO: DoodleRecipe = {
  w: 50,
  h: 40,
  draw(p) {
    p.shape(
      [
        [-22, 14],
        [-6, -8],
        [6, -8],
        [22, 14],
      ],
      C.ash,
      { hachureGap: 3.2, hachureAngle: 60 },
    );
    p.curve(
      [
        [-2, -8],
        [-4, -2],
        [-1, 4],
      ],
      { stroke: C.lava, strokeWidth: 1.8 },
    ); // a lava run down the side
    p.circle(2, -14, 8, undefined, { stroke: C.smoke });
  },
};

const OBSIDIAN: DoodleRecipe = {
  w: 22,
  h: 26,
  draw(p) {
    p.shape(
      [
        [0, -10],
        [7, 2],
        [2, 10],
        [-6, 4],
      ],
      C.plum,
      { hachureGap: 2 },
    );
  },
};

// --- Creatures ------------------------------------------------------------------

/** Where a hopping creature is (the trait owns it; null outside a level). */
const hopPhase = (a: Alien): HopPhase => (a.ability instanceof Hops ? a.ability.phase : "rest");

/**
 * Lava drip: its body is its two numbers, a bulb around the lower one and a
 * neck around the upper one, hanging from a thread of lava. It clings
 * ("rest"), swells (the "warn" before a drop) and stretches as it drops.
 */
function dripDoodle(phase: HopPhase): DoodleRecipe {
  const L = BALL_LAYOUTS.chain;
  const low = L.FIRST_Y;
  const high = L.FIRST_Y - L.GAP;
  const swell = phase === "warn" ? 1.18 : 1;
  const stretch = phase === "hop" ? 1.2 : 1;
  return {
    w: 40,
    h: 2 * 50,
    draw(p, t) {
      const wobble = phase === "warn" ? Math.sin(TAU * t * 2) * 1.5 : 0;
      if (phase !== "hop") {
        p.curve(
          [
            [0, high - 12],
            [wobble, high - 22],
            [0, high - 34],
          ],
          { stroke: C.lava, strokeWidth: 2 },
        ); // the thread it hangs from
      } else {
        for (const x of [-9, 9]) p.line(x, high - 6, x, high - 20, { strokeWidth: 0.9 }); // falling fast
      }
      p.ellipse(0, high - 1, 20, 24 * stretch, C.lava, { hachureGap: 2.2, hachureAngle: 70 });
      p.ellipse(wobble, low + 2 * swell, 27 * swell, 26 * swell * stretch, C.lava, { hachureGap: 2.2 });
      p.dot(-7, low + 9, 1.2, C.crust);
      p.dot(6, high + 3, 1.4, C.crust); // cooled crust spots
      for (const side of [-1, 1]) p.dot(side * 4, low + 14 * swell, 1.3);
      if (phase === "hop") p.circle(0, low + 18 * swell, 3, undefined, { strokeWidth: 0.9 }); // "oh!"
    },
  };
}

const DRIP: CreatureLook = {
  variant: (a) => hopPhase(a),
  recipe: (a) => dripDoodle(hopPhase(a)),
};

/** Firefly: a little beetle whose lantern (its tail) holds the numbers; the
 * lantern glows, flickers and goes dark with the whole swarm. */
function fireflyDoodle(lit: boolean): DoodleRecipe {
  return {
    w: 64,
    h: 2 * 46,
    draw(p, t) {
      const flap = Math.sin(TAU * t);
      for (const side of [-1, 1]) {
        p.ellipse(side * (20 + flap), -12, 24, 12 + 3 * flap, undefined, { strokeWidth: 1 }); // wings
        p.curve(
          [
            [side * 3, 12],
            [side * 7, 18],
            [side * 11, 19],
          ],
          { strokeWidth: 1 },
        ); // antennae
      }
      if (lit) {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          p.line(Math.cos(a) * 29, -30 + Math.sin(a) * 18, Math.cos(a) * 33, -30 + Math.sin(a) * 21, {
            stroke: C.lava,
            strokeWidth: 1,
          }); // glow rays
        }
      }
      p.ellipse(0, -30, 50, 30, lit ? C.glow : C.bug, lit ? { hachureGap: 2.6 } : { hachureGap: 1.6 }); // the lantern
      p.ellipse(0, -7, 16, 18, C.bug, { hachureGap: 2 });
      p.circle(0, 8, 14, C.bug, { fillStyle: "solid" });
      for (const side of [-1, 1]) p.paper(side * 3.5, 9, 5, { strokeWidth: 0.6 });
    },
  };
}

const FIREFLY_LIT = fireflyDoodle(true);
const FIREFLY_DARK = fireflyDoodle(false);
const dark = (a: Alien) => (a.ability?.cover ?? 0) >= 0.5;

const FIREFLY: CreatureLook = {
  variant: (a) => (dark(a) ? "dark" : "lit"),
  recipe: (a) => (dark(a) ? FIREFLY_DARK : FIREFLY_LIT),
  coverInk: C.bug,
};

/** Lava tortoise: a cooled-rock shell with its numbers set in it like
 * glowing stones, on stubby legs. Once answered, the shell is cracked. */
function tortoiseDoodle(cracked: boolean): DoodleRecipe {
  return {
    w: 72,
    h: 2 * 48,
    draw(p, t) {
      for (const [side, y, k] of [
        [-1, -2, 0],
        [1, -2, 1],
        [-1, -28, 1],
        [1, -28, 0],
      ]) {
        const step = Math.sin(TAU * t + k * Math.PI) * 3; // diagonal pairs step together
        p.ellipse(side * 29, y + step, 12, 10, C.ash, { hachureGap: 2.6 });
      }
      p.circle(0, 19, 18, C.ash, { hachureGap: 2.4 }); // head
      for (const side of [-1, 1]) p.dot(side * 4, 22, 1.4);
      p.ellipse(0, -18, 62, 52, C.rock, { hachureGap: 2.8 });
      // Lava glowing in the seams between the shell's plates.
      p.curve(
        [
          [-26, -8],
          [-8, -4],
          [8, -4],
          [26, -8],
        ],
        { stroke: C.lava, strokeWidth: 1.6 },
      );
      p.line(-10, -4, -12, 6, { stroke: C.lava, strokeWidth: 1.3 });
      p.line(10, -4, 12, 6, { stroke: C.lava, strokeWidth: 1.3 });
      if (cracked) {
        p.line(-16, -40, -6, -14, { strokeWidth: 1.6 });
        p.line(-6, -14, -14, -6, { strokeWidth: 1.4 });
        p.line(14, -38, 6, -20, { strokeWidth: 1.4 });
      }
    },
  };
}

const TORTOISE_SHELL = tortoiseDoodle(false);
const TORTOISE_CRACKED = tortoiseDoodle(true);
const shellUp = (a: Alien) => a.ability instanceof Shielded && a.ability.shieldUp;

const TORTOISE: CreatureLook = {
  variant: (a) => (shellUp(a) ? "shell" : "cracked"),
  recipe: (a) => (shellUp(a) ? TORTOISE_SHELL : TORTOISE_CRACKED),
};

/** Spark: a little flame whose two eyes are its numbers. It leans and trails
 * embers as it jumps, and flares up just before the next jump. */
function sparkDoodle(phase: HopPhase): DoodleRecipe {
  const E = BALL_LAYOUTS.eyes;
  const flare = phase === "warn" ? 1.15 : 1;
  const lean = phase === "hop" ? 7 : 0;
  return {
    w: 2 * 34,
    h: 2 * 36,
    draw(p, t) {
      const flick = Math.sin(TAU * t) * 2;
      const flame: Point[] = [
        [lean + flick, -28 * flare],
        [10, -10],
        [20, 6],
        [16, 18],
        [0, 22],
        [-16, 18],
        [-20, 6],
        [-10, -10],
      ];
      p.shape(flame, C.lava, { hachureGap: 2.6, hachureAngle: 80 });
      p.shape(
        [
          [lean * 0.6 - flick, -14 * flare],
          [6, -2],
          [0, 2],
          [-6, -2],
        ],
        C.glow,
        { fillStyle: "solid", strokeWidth: 0.8 },
      ); // its hot core
      p.curve(
        [
          [-4, E.EYE_Y + 11],
          [0, E.EYE_Y + 13],
          [4, E.EYE_Y + 11],
        ],
        { strokeWidth: 1 },
      ); // a grin under its eyes
      if (phase === "hop") for (const k of [-1, 1]) p.dot(-lean * 2 + k * 6, 26, 1.4, C.lava); // trailing embers
    },
  };
}

const SPARK: CreatureLook = {
  variant: (a) => hopPhase(a),
  recipe: (a) => sparkDoodle(hopPhase(a)),
};

// --- Boss: the DRAGON -------------------------------------------------------------

/** A plum dragon facing the player: bat wings, horns, an orange belly, a row
 * of spines along its back where its three numbers ride, smoke from its
 * nostrils. */
const DRAGON: DoodleRecipe = {
  w: 116,
  h: 2 * 66,
  draw(p, t) {
    const beat = Math.sin(TAU * t) * 4; // the wings beat as the frames go round
    for (const side of [-1, 1]) {
      const wing: Point[] = [
        [side * 18, -28],
        [side * 50, -44 - beat],
        [side * 52, -18 - beat],
        [side * 44, -4],
        [side * 34, -10],
        [side * 24, 0],
      ];
      p.shape(wing, C.belly, { hachureGap: 3, hachureAngle: side * 50 });
      p.line(side * 18, -28, side * 50, -44 - beat, { strokeWidth: 1.6 }); // the wing's arm
      p.shape(
        [
          [side * 16, 14],
          [side * 26, 18],
          [side * 24, 26],
          [side * 14, 22],
        ],
        C.plum,
        { fillStyle: "solid" },
      ); // feet
    }
    for (const x of [-30, -10, 10, 30]) {
      p.shape(
        [
          [x - 5, -54],
          [x, -62],
          [x + 5, -54],
        ],
        C.plum,
        { fillStyle: "solid", strokeWidth: 0.9 },
      ); // back spines between the numbers
    }
    p.ellipse(0, -18, 58, 66, C.plum, { hachureGap: 2.2 });
    p.ellipse(0, -6, 26, 34, C.belly, { hachureGap: 2.4, hachureAngle: 10 }); // belly
    p.ellipse(0, 26, 38, 28, C.plum, { hachureGap: 2 }); // head
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 10, 16],
          [side * 20, 6],
          [side * 16, 18],
        ],
        DOODLE.PAPER,
        { fillStyle: "solid", strokeWidth: 1 },
      ); // horns
      p.paper(side * 8, 22, 9, { strokeWidth: 1.1 });
      p.dot(side * 8, 23, 1.6);
      p.dot(side * 4, 35, 1.2); // nostrils
      p.curve(
        [
          [side * 4, 38],
          [side * (7 + beat * 0.5), 44],
          [side * 4, 50],
        ],
        { stroke: C.smoke, strokeWidth: 1.1 },
      ); // smoke curls
    }
  },
};

/** The dragon rearing back in its own fire: wings up, jaws open, a cone of
 * flame roaring down at the player (taking off after an answer, or
 * breathing fire over its numbers). */
const DRAGON_FIRE: DoodleRecipe = {
  w: 120,
  h: 2 * 70,
  draw(p, t) {
    const roar = Math.sin(TAU * t) * 4;
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 16, -26],
          [side * 52, -58],
          [side * 50, -28],
          [side * 28, -12],
        ],
        C.belly,
        { hachureGap: 3 },
      ); // wings raised
    }
    p.ellipse(0, -28, 46, 50, C.plum, { hachureGap: 2.2 });
    // The flame cone, from the open mouth down, with three licking tongues.
    const cone: Point[] = [
      [-8, 14],
      [-34 - roar, 56],
      [-18, 50],
      [-12, 66 + roar],
      [0, 54],
      [12, 66 - roar],
      [18, 50],
      [34 + roar, 56],
      [8, 14],
    ];
    p.shape(cone, C.lava, { hachureGap: 2.2, hachureAngle: 88 });
    p.shape(
      [
        [-5, 18],
        [-14, 46],
        [0, 40],
        [14, 46],
        [5, 18],
      ],
      C.glow,
      { fillStyle: "solid", strokeWidth: 0.8 },
    ); // the white-hot middle
    p.ellipse(0, 2, 34, 24, C.plum, { hachureGap: 2 }); // head
    p.shape(
      [
        [-9, 8],
        [9, 8],
        [0, 16],
      ],
      DOODLE.GRAPHITE,
      { fillStyle: "solid" },
    ); // open jaws
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 9, -6],
          [side * 19, -16],
          [side * 15, -4],
        ],
        DOODLE.PAPER,
        { fillStyle: "solid", strokeWidth: 1 },
      ); // horns
      p.line(side * 4, -1, side * 11, 1, { strokeWidth: 1.6 }); // squeezed-shut eyes
    }
    for (const [x, y, d] of [
      [-34, -10, 16],
      [36, -8, 14],
      [-4, -60, 18],
    ])
      p.circle(x + roar * 0.5, y, d, undefined, { stroke: C.smoke });
  },
};

export const VOLCANO_PAGE: PageDef = {
  paper: "#f6e2cc",
  rule: "rgba(150, 110, 90, 0.26)",
  margin: "rgba(214, 84, 84, 0.35)",
  props: [
    { recipe: LAVA_CRACK, weight: 3 },
    { recipe: ROCK, weight: 3 },
    { recipe: SMOKE_PUFF, weight: 2 },
    { recipe: EMBERS, weight: 2.5 },
    { recipe: LITTLE_VOLCANO, weight: 1 },
    { recipe: OBSIDIAN, weight: 1.5 },
  ],
  propGap: 46,
  creatures: { "lava drip": DRIP, firefly: FIREFLY, tortoise: TORTOISE, spark: SPARK },
  bosses: { boss_dragon: { up: DRAGON, hidden: DRAGON_FIRE } },
};
