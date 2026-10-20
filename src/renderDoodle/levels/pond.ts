import { BALL_LAYOUTS, DOODLE } from "../../config/constants";
import type Alien from "../../objects/Alien";
import type { CreatureLook, PageDef } from "../pages";
import type { DoodleRecipe, Pencil, Point } from "../pencil";

/**
 * Level 2, THE POND (config/levels/pond.ts): a watery page with lily pads,
 * reeds and ripples; goldfish whose numbers are the bubbles they blow,
 * dragonflies whose big eyes are their numbers, frogs whose spots are their
 * numbers, a duck that dives, and the BIG FROG. Creatures face down, toward
 * the player, except the side-view fish and duck (a kid draws those from the
 * side), which face the way they swim.
 */

const TAU = Math.PI * 2;
const C = {
  pad: "#6f9a4a",
  reed: "#8a9a4a",
  cattail: "#7a5236",
  ripple: "#6f9fb3",
  pebble: "#8a8578",
  petal: "#e88aa0",
  fish: "#f08a2c",
  fishFin: "#e0679f",
  dragonfly: "#2f9a95",
  wing: "#9cc7d6",
  frog: "#8aa83a",
  frogBelly: "#d9d98a",
  duck: "#a08a6a",
  duckHead: "#2f7f6f",
  bill: "#f0a03a",
  water: "#9cc3cf",
  tongue: "#e07a8a",
  bigFrog: "#6f8f2f",
};

// --- Props --------------------------------------------------------------------

/** A round pad with its notch, the vein lines meeting at the notch, turned
 * `turn` radians (pads bob round a little on the water). */
function padShape(r: number, turn = 0): Point[] {
  const pts: Point[] = [[0, 0]];
  for (let i = 0; i <= 10; i++) {
    const a = turn + 0.35 + (i / 10) * (TAU - 0.7);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

const LILY_PAD: DoodleRecipe = {
  w: 40,
  h: 40,
  draw(p, t) {
    const turn = Math.sin(t * TAU) * 0.12;
    p.shape(padShape(15, turn), C.pad, { hachureGap: 3 });
    for (const a of [2, 3.2, 4.4]) p.line(0, 0, Math.cos(a + turn) * 11, Math.sin(a + turn) * 11, { strokeWidth: 0.8 });
  },
};

const LILY_FLOWER: DoodleRecipe = {
  w: 44,
  h: 44,
  draw(p) {
    p.shape(padShape(17), C.pad, { hachureGap: 3.2 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      p.ellipse(-3 + Math.cos(a) * 5, -3 + Math.sin(a) * 5, 8, 8, C.petal, { strokeWidth: 0.9, hachureGap: 2 });
    }
    p.dot(-3, -3, 1.8, C.bill);
  },
};

const REEDS: DoodleRecipe = {
  w: 40,
  h: 50,
  draw(p, t) {
    const breeze = Math.sin(t * TAU) * 2;
    for (const [x, reedLean, tall] of [
      [-8, -4, 1],
      [-2, -1, 0],
      [4, 2, 1],
      [9, 5, 0],
    ]) {
      const lean = reedLean + breeze;
      p.curve(
        [
          [x, 22],
          [x + lean * 0.5, 4],
          [x + lean, -16],
        ],
        { stroke: C.reed, strokeWidth: 1.3 },
      );
      if (tall) p.ellipse(x + lean * 0.85, -12, 4, 11, C.cattail, { fillStyle: "solid", strokeWidth: 0.8 });
    }
  },
};

/** Rings spreading out: each frame they grow, and the loop ends one ring further. */
const RIPPLES: DoodleRecipe = {
  w: 62,
  h: 32,
  draw(p, t) {
    for (let ring = 1; ring <= 3; ring++) {
      const size = ring + t;
      p.ellipse(0, 0, 14 * size, 6.4 * size, undefined, { stroke: C.ripple, strokeWidth: 1 });
    }
  },
};

const PEBBLES: DoodleRecipe = {
  w: 34,
  h: 22,
  draw(p) {
    p.ellipse(-6, 2, 13, 9, C.pebble, { hachureGap: 3 });
    p.ellipse(6, -2, 9, 7, undefined);
    p.ellipse(4, 7, 6, 5, C.pebble, { hachureGap: 3 });
  },
};

/** Waves in the current. */
const WEED: DoodleRecipe = {
  w: 34,
  h: 40,
  draw(p, t) {
    const wave = Math.sin(t * TAU) * 2.5;
    for (const side of [-1, 1]) {
      p.curve(
        [
          [side * 2, 16],
          [side * 7 + wave * 0.5, 4],
          [side * 2 - wave * 0.5, -6],
          [side * 7 + wave, -16],
        ],
        { stroke: C.pad, strokeWidth: 1.2 },
      );
    }
  },
};

// --- Drifts (renderDoodle/drifts.ts) ------------------------------------------

/** A lily petal floating on the water, turning slowly. */
const FLOATING_PETAL: DoodleRecipe = {
  w: 14,
  h: 10,
  draw(p) {
    p.ellipse(0, 0, 11, 6, C.petal, { strokeWidth: 0.9, hachureGap: 2 });
  },
};

// --- Creatures ------------------------------------------------------------------

/** How far bubble `i` wobbles at boil point t (higher bubbles wobble more). */
const bubbleWobble = (i: number, t: number) =>
  Math.sin(TAU * t + i * 1.7) * BALL_LAYOUTS.chain.WIGGLE_PX * Math.min(1, 0.5 + i * 0.5);

/** Goldfish, drawn from the side swimming toward `dir`; its number balls are
 * the bubbles it blows, rising in a column above it. */
function fishDoodle(balls: number, dir: 1 | -1): DoodleRecipe {
  const L = BALL_LAYOUTS.chain;
  const top = -L.FIRST_Y + (balls - 1) * L.GAP + 14;
  return {
    w: 56,
    h: 2 * Math.max(top, L.BOTTOM + 4),
    draw(p, t) {
      const swish = Math.sin(TAU * t) * 3; // the tail flicks as the frames go round
      const tail: Point[] = [
        [-dir * 14, 8],
        [-dir * 26, 0 + swish],
        [-dir * 26, 16 + swish],
      ];
      p.shape(tail, C.fishFin, { hachureGap: 2.2 });
      p.ellipse(0, 8, 32, 17, C.fish, { hachureGap: 2.2, hachureAngle: 60 });
      p.curve(
        [
          [-dir * 2, 1],
          [dir * 2, -3],
          [dir * 6, 1],
        ],
        { strokeWidth: 1 },
      ); // top fin
      p.paper(dir * 9, 6, 6, { strokeWidth: 0.9 });
      p.dot(dir * 9.5, 6, 1.4);
      p.circle(dir * 18, 1, 4, undefined, { strokeWidth: 0.8 }); // a small bubble on its way up
    },
  };
}

const FISH: CreatureLook = {
  variant: (a) => `${a.ballCount}:${a.heading}`,
  recipe: (a) => fishDoodle(a.ballCount, a.heading),
  ballNudge: (i, t) => [bubbleWobble(i, t), 0],
};

/** Dragonfly facing down: its two big eyes are its numbers; four wings that
 * blur as the frames go round, and a long tail behind. */
const DRAGONFLY_DOODLE: DoodleRecipe = {
  w: 60,
  h: 60,
  draw(p, t) {
    const eyes = BALL_LAYOUTS.eyes;
    const beat = 0.75 + 0.25 * Math.abs(Math.sin(TAU * t * 2));
    for (const side of [-1, 1]) {
      // Front wings angle forward, back wings back; they blur as they beat.
      for (const [y, tilt, len] of [
        [-4, 5, 25],
        [0, -7, 22],
      ]) {
        const tip = len * beat;
        const wing: Point[] = [
          [side * 3, y],
          [side * (5 + tip * 0.5), y + tilt * 0.5 - 4],
          [side * (4 + tip), y + tilt - 2],
          [side * (4 + tip), y + tilt + 3],
          [side * (5 + tip * 0.5), y + tilt * 0.5 + 4],
        ];
        p.shape(wing, C.wing, { hachureGap: 2.6, strokeWidth: 0.9 });
      }
    }
    p.ellipse(0, -16, 6, 26, C.dragonfly, { fillStyle: "solid", strokeWidth: 1 }); // tail
    for (let i = 0; i < 3; i++) p.line(-3, -22 + i * 5, 3, -22 + i * 5, { strokeWidth: 0.7 });
    p.ellipse(0, -1, 11, 13, C.dragonfly, { hachureGap: 2 }); // thorax
    p.ellipse(0, eyes.EYE_Y + 1, eyes.EYE_DX * 2 + 16, 16, C.dragonfly, { hachureGap: 2.4 }); // head behind the eyes
  },
};

const DRAGONFLY: CreatureLook = {
  variant: () => "eyes",
  recipe: () => DRAGONFLY_DOODLE,
};

/** Frog facing down; its number balls are the spots on its back. Sitting it
 * crouches on a ripple; mid-hop its legs stretch out. */
function frogDoodle(balls: number, hopping: boolean): DoodleRecipe {
  const L = BALL_LAYOUTS.cluster;
  const rows = Math.ceil(balls / 2);
  const back = -(L.FIRST_Y - (rows - 1) * L.GAP_Y) + 15;
  return {
    w: 80,
    h: 2 * Math.max(back + 10, L.BOTTOM + 8),
    draw(p) {
      if (!hopping) p.ellipse(0, 4, 74, 34, undefined, { stroke: C.ripple, strokeWidth: 0.9 });
      for (const side of [-1, 1]) {
        if (hopping) {
          // Hind legs kicked straight back, front legs reaching ahead.
          p.curve(
            [
              [side * 18, -back + 16],
              [side * 24, -back + 2],
              [side * 22, -back - 10],
            ],
            { strokeWidth: 3 },
          );
          toes(p, side * 22, -back - 10, side, -1);
          p.line(side * 14, 18, side * 20, 30, { strokeWidth: 2.2 });
          toes(p, side * 20, 30, side, 1);
        } else {
          // Hind legs folded at its sides, feet forward by its front legs.
          p.curve(
            [
              [side * 22, -14],
              [side * 36, -2],
              [side * 32, 16],
            ],
            { strokeWidth: 3 },
          );
          toes(p, side * 32, 16, side, 1);
          p.line(side * 15, 17, side * 21, 26, { strokeWidth: 2.2 });
          toes(p, side * 21, 26, side, 1);
        }
      }
      p.ellipse(0, (-back + 6) / 2 + 3, 50, back + 8, C.frog, { hachureGap: 2.3 }); // back
      p.ellipse(0, 15, 36, 18, C.frog, { hachureGap: 2.3, hachureAngle: 40 }); // head
      for (const side of [-1, 1]) {
        p.paper(side * 11, 19, 9, { strokeWidth: 1.1 }); // bulging eyes
        p.dot(side * 11, 20, 1.6);
      }
      p.curve(
        [
          [-9, 23],
          [0, 25],
          [9, 23],
        ],
        { strokeWidth: 0.9 },
      ); // mouth
    },
  };
}

/** Three webbed toes at (x, y), splayed outward and toward `dy` (+1 front). */
function toes(p: Pencil, x: number, y: number, side: number, dy: number): void {
  for (const k of [-1, 0, 1]) p.line(x, y, x + side * (3 + k * 2.5), y + dy * (5 - Math.abs(k)), { strokeWidth: 1 });
}

const hopping = (a: Alien) => Math.sin(a.gait) > 0; // the lumberer moves while sin(gait) > 0

const FROG: CreatureLook = {
  variant: (a) => `${a.ballCount}:${hopping(a) ? "hop" : "sit"}`,
  recipe: (a) => frogDoodle(a.ballCount, hopping(a)),
};

/** Duck from the side, swimming toward `dir`, a number ball on each wing;
 * dipping its head before a dive, or bottoms-up under the water. */
function duckDoodle(dir: 1 | -1, state: "paddle" | "dip" | "under"): DoodleRecipe {
  return {
    w: 84,
    h: 58,
    draw(p, t) {
      const lap = Math.sin(TAU * t) * 2;
      for (const [w, y] of [
        [70, 20],
        [52, 25],
      ]) {
        p.curve(
          [
            [-w / 2, y],
            [-w / 4, y - 2 + lap],
            [w / 4, y + 2 - lap],
            [w / 2, y],
          ],
          { stroke: C.ripple, strokeWidth: 1 },
        );
      }
      if (state === "under") {
        // Bottoms up: a tail and two kicking feet above the water.
        const tail: Point[] = [
          [-8, 16],
          [8, 16],
          [dir * -2, -2],
        ];
        p.shape(tail, C.duck, { hachureGap: 2.2 });
        for (const side of [-1, 1]) p.line(side * 4, 4, side * (9 + lap), -6, { stroke: C.bill, strokeWidth: 2 });
        return;
      }
      const tail: Point[] = [
        [-dir * 22, 2],
        [-dir * 36, -8],
        [-dir * 26, 12],
      ];
      p.shape(tail, C.duck, { hachureGap: 2.4 });
      p.ellipse(0, 4, 60, 26, C.duck, { hachureGap: 2.4 });
      const head: Point = state === "dip" ? [dir * 30, 10] : [dir * 25, -12];
      p.line(dir * 20, -2, head[0], head[1] + 4, { strokeWidth: 4, stroke: C.duckHead }); // neck
      p.circle(head[0], head[1], 15, C.duckHead, { hachureGap: 2 });
      p.dot(head[0] + dir * 2, head[1] - 2, 1.3);
      p.shape(
        [
          [head[0] + dir * 6, head[1] - 1],
          [head[0] + dir * 14, head[1] + 2],
          [head[0] + dir * 6, head[1] + 4],
        ],
        C.bill,
        { fillStyle: "solid", strokeWidth: 0.9 },
      );
    },
  };
}

const duckState = (a: Alien) => {
  const cover = a.ability?.cover ?? 0;
  return cover >= 1 ? "under" : cover > 0 ? "dip" : "paddle";
};

const DUCK: CreatureLook = {
  variant: (a) => `${a.heading}:${duckState(a)}`,
  recipe: (a) => duckDoodle(a.heading, duckState(a)),
  coverInk: C.water,
  hidesBalls: true,
};

// --- Boss: the BIG FROG ---------------------------------------------------------

/** A huge frog facing the player; its balls ride on its back. Its throat
 * puffs and its tongue flicks out as the frames go round. */
const BIG_FROG: DoodleRecipe = {
  w: 130,
  h: 118,
  draw(p, t) {
    const puff = 0.5 + 0.5 * Math.sin(TAU * t);
    for (const side of [-1, 1]) {
      // Huge hind legs folded at its sides, feet forward by its front legs.
      p.curve(
        [
          [side * 40, -22],
          [side * 62, -4],
          [side * 56, 26],
        ],
        { strokeWidth: 4 },
      );
      for (const k of [-1, 0, 1]) p.line(side * 56, 26, side * (60 + k * 4), 34 - Math.abs(k) * 2, { strokeWidth: 1.6 });
      p.line(side * 26, 34, side * 34, 48, { strokeWidth: 3 });
      for (const k of [-1, 0, 1]) p.line(side * 34, 48, side * (38 + k * 4), 54 - Math.abs(k) * 2, { strokeWidth: 1.4 });
    }
    p.ellipse(0, -2, 92, 82, C.bigFrog, { hachureGap: 2.2 });
    for (const [x, y] of [
      [-28, 0],
      [30, -6],
      [-6, 6],
    ])
      p.dot(x, y, 3, "#4f6a20");
    p.ellipse(0, 30, 22 + 10 * puff, 10 + 6 * puff, C.frogBelly, { fillStyle: "solid", strokeWidth: 1 }); // throat
    for (const side of [-1, 1]) {
      p.paper(side * 24, 14, 22, { strokeWidth: 1.6 }); // big bulging eyes
      p.dot(side * 24, 16, 3.2);
      p.curve(
        [
          [side * 14, 6],
          [side * 24, 2],
          [side * 34, 6],
        ],
        { strokeWidth: 1.6 },
      ); // grumpy brows
    }
    p.curve(
      [
        [-32, 24],
        [0, 29],
        [32, 24],
      ],
      { strokeWidth: 1.6 },
    ); // wide mouth
    if (Math.sin(TAU * t) > 0.8) {
      p.curve(
        [
          [0, 28],
          [3, 40],
          [0, 52],
        ],
        { stroke: C.tongue, strokeWidth: 3 },
      );
      p.dot(0, 53, 3.4, C.tongue);
    }
  },
};

/** The Big Frog in mid-leap after an answer: belly up in the air above its
 * shadow, legs spread (its numbers are hidden until it lands). */
const BIG_FROG_LEAP: DoodleRecipe = {
  w: 130,
  h: 118,
  draw(p, t) {
    p.ellipse(0, 40, 70, 16, undefined, { stroke: DOODLE.GRAPHITE_LIGHT, strokeWidth: 1, strokeLineDash: [4, 4] });
    const kick = Math.sin(TAU * t) * 4;
    for (const side of [-1, 1]) {
      p.line(side * 24, -24, side * (52 + kick), -48, { strokeWidth: 3 });
      p.line(side * 22, 12, side * (44 - kick), 30, { strokeWidth: 2.6 });
    }
    p.ellipse(0, -8, 70, 64, C.bigFrog, { hachureGap: 2.4 });
    p.ellipse(0, -4, 40, 38, C.frogBelly, { hachureGap: 2.6, hachureAngle: 30 });
    for (const side of [-1, 1]) p.paper(side * 18, 16, 16, { strokeWidth: 1.4 });
    for (const side of [-1, 1]) p.dot(side * 18, 18, 2.6);
  },
};

export const POND_PAGE: PageDef = {
  paper: "#e8f1ee",
  rule: "rgba(92, 145, 205, 0.32)",
  margin: "rgba(214, 84, 84, 0.32)",
  props: [
    { recipe: LILY_PAD, weight: 4, fps: 1.5 },
    { recipe: LILY_FLOWER, weight: 1.2 },
    { recipe: REEDS, weight: 2, fps: 3 },
    { recipe: RIPPLES, weight: 2.5, fps: 3 },
    { recipe: PEBBLES, weight: 1.2 },
    { recipe: WEED, weight: 1.5, fps: 2 },
  ],
  propGap: 44,
  drifts: [{ recipe: FLOATING_PETAL, count: 3, vx: 9, vy: 5, swayPx: 6, swayHz: 0.2, spinPerS: 0.3 }],
  creatures: { fish: FISH, dragonfly: DRAGONFLY, frog: FROG, duck: DUCK },
  bosses: { boss_frog: { up: BIG_FROG, hidden: BIG_FROG_LEAP } },
};
