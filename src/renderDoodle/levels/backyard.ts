import { BALL_LAYOUTS, DOODLE } from "../../config/constants";
import type Alien from "../../objects/Alien";
import type { CreatureLook, PageDef } from "../pages";
import type { DoodleRecipe, Point } from "../pencil";

/**
 * Level 1, THE BACKYARD (config/levels/backyard.ts): a sunny dirt page with
 * pebbles and grass, beetles whose eyes are their numbers, worms made of
 * numbers, a butterfly that folds its wings over its numbers, and the GIANT
 * MOLE. Creatures face down, toward the player.
 */

const TAU = Math.PI * 2;
const C = {
  dirt: "#8a6a4a",
  grass: "#7a9a3a",
  leaf: "#c98a3a",
  daisy: "#d9b44a",
  beetle: "#6a4c93",
  beetleHead: "#4d4258",
  spots: "#e8873a",
  worm: "#e0879a",
  wing: "#e8873a",
  wingDots: "#8e4fd8",
  mole: "#6b5a4e",
  moleNose: "#e88aa0",
};

// --- Props --------------------------------------------------------------------

const PEBBLES: DoodleRecipe = {
  w: 34,
  h: 22,
  draw(p) {
    p.ellipse(-6, 2, 14, 10, C.dirt, { hachureGap: 3 });
    p.ellipse(7, -2, 10, 8, undefined);
    p.ellipse(4, 7, 7, 5, C.dirt, { hachureGap: 3 });
  },
};

/** Sways in the breeze: the blade tips swing a few px as the frames go round. */
const GRASS_TUFT: DoodleRecipe = {
  w: 34,
  h: 26,
  draw(p, t) {
    const breeze = Math.sin(t * TAU) * 2.5;
    for (const [x, lean] of [
      [-6, -5],
      [-2, -2],
      [2, 1],
      [6, 5],
    ]) {
      p.curve(
        [
          [x, 10],
          [x + lean * 0.4 + breeze * 0.4, 0],
          [x + lean + breeze, -10],
        ],
        { stroke: C.grass, strokeWidth: 1.3 },
      );
    }
  },
};

/** Nods: the flower head turns a little back and forth. */
const DAISY: DoodleRecipe = {
  w: 26,
  h: 26,
  draw(p, t) {
    const nod = Math.sin(t * TAU) * 0.25;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + nod;
      p.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 6, 6, undefined, { strokeWidth: 1 });
    }
    p.circle(0, 0, 5, C.daisy, { fillStyle: "solid", strokeWidth: 0.8 });
  },
};

const CLOD: DoodleRecipe = {
  w: 30,
  h: 20,
  draw(p) {
    const lump: Point[] = [
      [-11, 4],
      [-7, -4],
      [1, -6],
      [9, -2],
      [11, 4],
    ];
    p.shape(lump, C.dirt, { hachureGap: 2.6, hachureAngle: 20 });
  },
};

/** Marches: each frame the ants step along, and the loop ends one ant further. */
const ANT_TRAIL: DoodleRecipe = {
  w: 64,
  h: 20,
  draw(p, t) {
    for (let i = 0; i < 5; i++) {
      const step = i + t;
      const x = -26 + step * 12;
      const y = Math.sin(step * 1.3) * 4;
      p.dot(x, y, 1.6);
      p.dot(x + 3, y, 1.2);
    }
  },
};

const TWIG: DoodleRecipe = {
  w: 46,
  h: 20,
  draw(p) {
    p.curve(
      [
        [-20, 4],
        [-4, 0],
        [18, -4],
      ],
      { stroke: C.dirt, strokeWidth: 1.8 },
    );
    p.line(2, -1, 9, -8, { stroke: C.dirt, strokeWidth: 1.2 });
  },
};

// --- Drifts (renderDoodle/drifts.ts) ------------------------------------------

/** A dandelion seed: a stalk under a little fluffy parachute. */
const DANDELION_SEED: DoodleRecipe = {
  w: 16,
  h: 20,
  draw(p) {
    p.line(0, 8, 0, -3, { strokeWidth: 0.9 });
    p.dot(0, 8, 1.2);
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      p.line(0, -3, Math.cos(a) * 6, -3 + Math.sin(a) * 6, { strokeWidth: 0.6, roughness: 0.6 });
    }
  },
};

/** A leaf that flutters down, flipping (it looks thinner mid-flip). */
const FALLING_LEAF: DoodleRecipe = {
  w: 22,
  h: 14,
  draw(p, t) {
    const flip = 0.45 + 0.55 * Math.abs(Math.cos(t * Math.PI));
    const h = 8 * flip;
    p.shape(
      [
        [-9, 0],
        [-3, -h / 2],
        [6, -h / 3],
        [9, 0],
        [6, h / 3],
        [-3, h / 2],
      ],
      C.leaf,
      { hachureGap: 2.6, strokeWidth: 1 },
    );
    p.line(-9, 0, 8, 0, { strokeWidth: 0.7 });
  },
};

// --- Creatures ------------------------------------------------------------------

/** Beetle: a round shell on six scuttling legs; its two ball eyes are its sum. */
const BEETLE_DOODLE: DoodleRecipe = {
  w: 44,
  h: 48,
  draw(p, t) {
    const eyes = BALL_LAYOUTS.eyes;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        // Legs on each side step in turn, opposite sides out of phase.
        const swing = Math.sin(TAU * t + i * 2.1 + (side > 0 ? Math.PI : 0)) * 3;
        const y = -14 + i * 7;
        p.line(side * 12, y, side * 20, y + swing, { strokeWidth: 1.2 });
      }
      const wag = Math.sin(TAU * t + side) * 2;
      p.curve(
        [
          [side * 12, eyes.EYE_Y + 8],
          [side * 16 + wag, eyes.EYE_Y + 13],
          [side * 19 + wag, eyes.EYE_Y + 14],
        ],
        { strokeWidth: 1 },
      ); // antennae
    }
    p.ellipse(0, -7, 26, 28, C.beetle, { hachureGap: 2.2 });
    p.line(0, -20, 0, 4, { strokeWidth: 1.1 }); // the split between the wing cases
    for (const [x, y] of [
      [-6, -12],
      [5, -8],
      [-5, -2],
    ])
      p.dot(x, y, 1.8, C.spots);
    // The head the ball eyes sit in.
    p.ellipse(0, eyes.EYE_Y + 1, eyes.EYE_DX * 2 + 18, 20, C.beetleHead, { hachureGap: 2.4 });
  },
};

const BEETLE: CreatureLook = {
  variant: () => "eyes",
  recipe: () => BEETLE_DOODLE,
};

/** How far a worm segment sways at boil point t (the head barely moves). */
const wormSway = (i: number, t: number) => Math.sin(TAU * t + i * 1.1) * BALL_LAYOUTS.chain.WIGGLE_PX;

/** Worm: its body is its number balls, a pink segment around each one. */
function wormDoodle(balls: number): DoodleRecipe {
  const L = BALL_LAYOUTS.chain;
  const top = -L.FIRST_Y + (balls - 1) * L.GAP + 14;
  return {
    w: 34,
    h: 2 * Math.max(top, L.BOTTOM + 2),
    draw(p, t) {
      for (let i = balls - 1; i >= 0; i--) {
        p.circle(wormSway(i + 1, t), L.FIRST_Y - i * L.GAP, 25, C.worm, { hachureGap: 2.4, hachureAngle: 60 });
      }
      p.circle(0, 6, 17, C.worm, { hachureGap: 2.4, hachureAngle: 60 }); // head
      for (const side of [-1, 1]) p.dot(side * 3, 6, 1.4);
      p.curve(
        [
          [-3, 10],
          [0, 12],
          [3, 10],
        ],
        { strokeWidth: 0.9 },
      ); // a smile
    },
  };
}

const WORM: CreatureLook = {
  variant: (a) => String(a.ballCount),
  recipe: (a) => wormDoodle(a.ballCount),
  ballNudge: (i, t) => [wormSway(i + 1, t), 0],
};

/** Butterfly with open wings: one number ball on each upper wing. */
const BUTTERFLY_OPEN: DoodleRecipe = {
  w: 62,
  h: 54,
  draw(p, t) {
    const W = BALL_LAYOUTS.wings;
    const flap = 0.9 + 0.1 * Math.cos(TAU * t);
    for (const side of [-1, 1]) {
      p.ellipse(side * W.WING_DX, W.WING_Y, 26 * flap, 28, C.wing, { hachureGap: 2.6 });
      p.ellipse(side * 11, 13, 16 * flap, 16, C.wing, { hachureGap: 2.6 });
      p.dot(side * 11, 14, 2.2, C.wingDots);
      p.curve(
        [
          [side * 1.5, -12],
          [side * 4, -18],
          [side * 7, -21],
        ],
        { strokeWidth: 1 },
      ); // antennae
    }
    p.ellipse(0, 2, 5, 26, DOODLE.GRAPHITE, { fillStyle: "solid" });
  },
};

/** Butterfly with its wings folded up over its numbers. */
const BUTTERFLY_FOLDED: DoodleRecipe = {
  w: 62,
  h: 54,
  draw(p) {
    for (const side of [-1, 1]) {
      p.ellipse(side * 5, -8, 10, 34, C.wing, { hachureGap: 2.2 });
      p.curve(
        [
          [side * 1.5, -12],
          [side * 4, -18],
          [side * 7, -21],
        ],
        { strokeWidth: 1 },
      );
    }
    p.ellipse(0, 2, 5, 26, DOODLE.GRAPHITE, { fillStyle: "solid" });
  },
};

const folded = (a: Alien) => (a.ability?.cover ?? 0) >= 0.5;

const BUTTERFLY: CreatureLook = {
  variant: (a) => (folded(a) ? "folded" : "open"),
  recipe: (a) => (folded(a) ? BUTTERFLY_FOLDED : BUTTERFLY_OPEN),
  coverInk: C.wing,
  hidesBalls: true,
};

// --- Boss: the GIANT MOLE -------------------------------------------------------

/** A big round digger facing the player: pink nose, shovel claws, glasses. */
const MOLE: DoodleRecipe = {
  w: 104,
  h: 96,
  draw(p, t) {
    const dig = Math.sin(TAU * t) * 3; // the claws paddle as the frames go round
    for (const side of [-1, 1]) {
      const claw: Point[] = [
        [side * 26, 10 + dig * side],
        [side * 46, 16 + dig * side],
        [side * 44, 30 + dig * side],
        [side * 30, 30 + dig * side],
      ];
      p.shape(claw, DOODLE.PAPER, { fillStyle: "solid" });
      for (const k of [0, 1, 2]) {
        p.line(side * (32 + k * 5), 30 + dig * side, side * (31 + k * 5), 36 + dig * side, { strokeWidth: 1.2 });
      }
    }
    p.circle(0, 0, 76, C.mole, { hachureGap: 2.2 });
    p.ellipse(0, 14, 40, 30, DOODLE.PAPER, { fillStyle: "solid", strokeWidth: 1 }); // snout
    p.ellipse(0, 24, 14, 10, C.moleNose, { fillStyle: "solid" });
    for (const side of [-1, 1]) {
      p.circle(side * 12, -6, 12, DOODLE.PAPER, { fillStyle: "solid", strokeWidth: 1.4 }); // glasses
      p.line(side * 9, -6, side * 15, -6, { strokeWidth: 1.6 }); // squint
      for (const k of [-1, 1]) p.line(side * 9, 18 + k * 3, side * 26, 15 + k * 6, { strokeWidth: 0.8 }); // whiskers
    }
    p.line(-6, -6, 6, -6, { strokeWidth: 1.2 }); // glasses bridge
    p.shape(
      [
        [-3, 30],
        [3, 30],
        [0, 35],
      ],
      DOODLE.PAPER,
      { fillStyle: "solid", strokeWidth: 0.9 },
    ); // one tooth
  },
};

/** A mound of dirt with clods flying off: the mole digging underground. */
const DIRT_MOUND: DoodleRecipe = {
  w: 96,
  h: 64,
  draw(p, t) {
    p.ellipse(0, 8, 76, 34, C.mole, { hachureGap: 3, hachureAngle: 30 });
    for (let i = 0; i < 4; i++) {
      const a = Math.PI + (i / 3) * Math.PI + t * 2;
      const r = 30 + 6 * Math.sin(TAU * t + i);
      p.ellipse(Math.cos(a) * r, -6 + Math.sin(a) * r * 0.5, 7, 5, C.mole, { fillStyle: "solid" });
    }
  },
};

export const BACKYARD_PAGE: PageDef = {
  paper: "#f3ead6",
  rule: "rgba(120, 140, 170, 0.28)",
  margin: "rgba(214, 84, 84, 0.35)",
  props: [
    { recipe: PEBBLES, weight: 3 },
    { recipe: GRASS_TUFT, weight: 4, fps: 3 },
    { recipe: DAISY, weight: 1.5, fps: 2 },
    { recipe: CLOD, weight: 2 },
    { recipe: ANT_TRAIL, weight: 1, fps: 4 },
    { recipe: TWIG, weight: 1.5 },
  ],
  propGap: 46,
  drifts: [
    { recipe: DANDELION_SEED, count: 3, vx: 14, vy: -5, swayPx: 8, swayHz: 0.25 },
    { recipe: FALLING_LEAF, count: 1, vx: 10, vy: 16, swayPx: 18, swayHz: 0.2, spinPerS: 0.5, fps: 3 },
  ],
  creatures: { beetle: BEETLE, worm: WORM, butterfly: BUTTERFLY },
  bosses: { boss_mole: { up: MOLE, hidden: DIRT_MOUND } },
};
