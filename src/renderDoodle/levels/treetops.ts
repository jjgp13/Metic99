import { BALL_LAYOUTS, DOODLE } from "../../config/constants";
import type Alien from "../../objects/Alien";
import { Leap } from "../../objects/treetopsTraits";
import type { CreatureLook, PageDef } from "../pages";
import type { DoodleRecipe, Point } from "../pencil";

/**
 * Level 3, THE TREETOPS (config/levels/treetops.ts): a leafy page with
 * branches, acorns and nests; squirrels holding two acorns (their numbers),
 * owls whose eyes are their numbers, birds with a number on each wing, a
 * hummingbird, and the GREAT OWL. Creatures face down, toward the player.
 */

const TAU = Math.PI * 2;
const C = {
  leaf: "#7f9a4a",
  bark: "#8a6a4a",
  acorn: "#b07a3a",
  cap: "#6e5238",
  squirrel: "#c0763a",
  belly: "#e9c9a0",
  owl: "#8a6f5a",
  owlFace: "#d9c3a5",
  beak: "#e8a33a",
  bird: "#8e4fd8",
  birdBreast: "#e8873a",
  hummer: "#c2408a",
  hummerThroat: "#3aa0a0",
  greatOwl: "#6b5a4e",
};

// --- Props --------------------------------------------------------------------

/** A leaf with its middle vein and a few side veins. */
const LEAF: DoodleRecipe = {
  w: 34,
  h: 22,
  draw(p) {
    const outline: Point[] = [
      [-14, 0],
      [-6, -7],
      [6, -7],
      [14, 0],
      [6, 7],
      [-6, 7],
    ];
    p.shape(outline, C.leaf, { hachureGap: 3 });
    p.line(-14, 0, 14, 0, { strokeWidth: 1 });
    for (const x of [-6, 0, 6]) {
      p.line(x, 0, x + 4, -5, { strokeWidth: 0.8 });
      p.line(x, 0, x + 4, 5, { strokeWidth: 0.8 });
    }
  },
};

/** A branch with a fork and a leaf at its tip. */
const BRANCH: DoodleRecipe = {
  w: 80,
  h: 34,
  draw(p) {
    p.curve(
      [
        [-36, 10],
        [-10, 4],
        [14, -2],
        [34, -8],
      ],
      { stroke: C.bark, strokeWidth: 2.4 },
    );
    p.line(2, 1, 14, -12, { stroke: C.bark, strokeWidth: 1.6 });
    p.ellipse(18, -14, 12, 7, C.leaf, { hachureGap: 2.6 });
    p.ellipse(36, -10, 10, 6, C.leaf, { hachureGap: 2.6 });
  },
};

const ACORN: DoodleRecipe = {
  w: 18,
  h: 22,
  draw(p) {
    p.ellipse(0, 3, 10, 12, C.acorn, { hachureGap: 2.4 });
    p.ellipse(0, -3, 12, 6, C.cap, { hachureGap: 1.8, hachureAngle: 45 });
    p.line(0, -6, 1, -9, { strokeWidth: 1.2 });
  },
};

/** A nest of scribbled twigs with two eggs in it. */
const NEST: DoodleRecipe = {
  w: 46,
  h: 30,
  draw(p) {
    p.ellipse(-4, -2, 9, 11, undefined, { strokeWidth: 1 });
    p.ellipse(5, -3, 9, 11, undefined, { strokeWidth: 1 });
    p.ellipse(0, 4, 38, 16, C.bark, { hachureGap: 3, hachureAngle: 15 });
    for (const [x1, x2] of [
      [-18, 10],
      [-12, 18],
      [-16, 6],
    ]) {
      p.line(x1, 4, x2, 8, { strokeWidth: 0.8 });
    }
  },
};

/** An oak leaf: wavy lobes. */
const OAK_LEAF: DoodleRecipe = {
  w: 30,
  h: 34,
  draw(p) {
    const lobes: Point[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * TAU;
      const r = 10 + 3 * Math.cos(a * 4);
      lobes.push([Math.sin(a) * r * 0.75, -Math.cos(a) * r * 1.2]);
    }
    p.shape(lobes, C.leaf, { hachureGap: 2.8, hachureAngle: 30 });
    p.line(0, 14, 0, -12, { strokeWidth: 0.9 });
  },
};

const FEATHER: DoodleRecipe = {
  w: 16,
  h: 34,
  draw(p) {
    p.ellipse(0, -2, 8, 26, undefined, { strokeWidth: 1 });
    p.line(0, 14, 0, -14, { strokeWidth: 1 });
    for (const y of [-8, -2, 4]) p.line(0, y, 3, y - 3, { strokeWidth: 0.7 });
  },
};

// --- Creatures ------------------------------------------------------------------

type SquirrelPose = "run" | "crouch" | "leap";

/**
 * Squirrel: a big bushy tail, ears up, two acorns held in its paws. The
 * acorns are its number balls (the "eyes" layout's two spots at its front),
 * so the doodle only adds their caps. Crouched before a leap (the
 * telegraph), stretched out while flying in from the trunk.
 */
function squirrelDoodle(pose: SquirrelPose): DoodleRecipe {
  const eyes = BALL_LAYOUTS.eyes;
  const squash = pose === "crouch" ? 3 : pose === "leap" ? -3 : 0;
  return {
    w: 56,
    h: 62,
    draw(p, t) {
      // The tail flicks as the frames go round; straight up when crouched.
      const flick = pose === "crouch" ? 4 : Math.sin(TAU * t) * 2;
      const tail: Point[] = [
        [8, -12 + squash],
        [20 + flick, -18],
        [24 + flick, -30],
        [14 + flick, -30],
        [10, -22],
        [4, -16 + squash],
      ];
      p.shape(tail, C.squirrel, { hachureGap: 2, hachureAngle: 60 });
      p.curve(
        [
          [12 + flick, -28],
          [18 + flick, -24],
          [20 + flick, -18],
        ],
        { strokeWidth: 0.8 },
      );
      p.ellipse(0, -16 + squash, 20, 18 - squash, C.squirrel, { hachureGap: 2.4 }); // back
      p.circle(0, -6 + squash, 18, C.squirrel, { hachureGap: 2.4 }); // head
      p.ellipse(0, -4 + squash, 9, 8, C.belly, { fillStyle: "solid", strokeWidth: 0.8 }); // snout
      for (const side of [-1, 1]) {
        const ear: Point[] = [
          [side * 3, -13 + squash],
          [side * 7, -20 + squash],
          [side * 8, -12 + squash],
        ];
        p.shape(ear, C.squirrel, { fillStyle: "solid", strokeWidth: 1 });
        p.dot(side * 4, -9 + squash, 1.4); // eyes
        // Paws round the acorns, which ride in front of its chin.
        p.ellipse(side * (eyes.EYE_DX + 9), eyes.EYE_Y + 2, 6, 7, C.squirrel, { fillStyle: "solid", strokeWidth: 0.9 });
        p.ellipse(side * eyes.EYE_DX, eyes.EYE_Y - 9, 17, 7, C.cap, { hachureGap: 1.6, hachureAngle: 45 }); // acorn cap
        p.line(side * eyes.EYE_DX, eyes.EYE_Y - 12, side * (eyes.EYE_DX + 1), eyes.EYE_Y - 15, { strokeWidth: 1.1 });
      }
      p.dot(0, -1 + squash, 1.2); // nose
    },
  };
}

const squirrelPose = (a: Alien): SquirrelPose => {
  if (a.mode === "enter") return "leap";
  return a.ability instanceof Leap && a.ability.crouching(a) ? "crouch" : "run";
};

const SQUIRREL_POSES: Record<SquirrelPose, DoodleRecipe> = {
  run: squirrelDoodle("run"),
  crouch: squirrelDoodle("crouch"),
  leap: squirrelDoodle("leap"),
};

const SQUIRREL: CreatureLook = {
  variant: squirrelPose,
  recipe: (a) => SQUIRREL_POSES[squirrelPose(a)],
};

type OwlPose = "perch" | "turned" | "swoop";

/**
 * Owl: a round feathered body with ear tufts; its two ball eyes are its sum,
 * each in a pale eye disc. Turned, it shows the back of its head (no face:
 * the numbers are hidden); swooping, its wings are swept back.
 */
function owlDoodle(pose: OwlPose): DoodleRecipe {
  const eyes = BALL_LAYOUTS.eyes;
  return {
    w: 56,
    h: 56,
    draw(p, t) {
      const flap = pose === "perch" ? Math.sin(TAU * t) * 3 : 0;
      for (const side of [-1, 1]) {
        const wing: Point[] =
          pose === "swoop"
            ? [
                [side * 12, -10],
                [side * 24, -22],
                [side * 18, 4],
              ]
            : [
                [side * 14, -10],
                [side * 25, -2 + flap],
                [side * 20, 12 + flap],
                [side * 13, 8],
              ];
        p.shape(wing, C.owl, { hachureGap: 2.2, hachureAngle: side * 40 });
        // Ear tufts.
        const tuft: Point[] = [
          [side * 6, -18],
          [side * 13, -25],
          [side * 13, -15],
        ];
        p.shape(tuft, C.owl, { fillStyle: "solid", strokeWidth: 1 });
      }
      p.ellipse(0, -2, 32, 38, C.owl, { hachureGap: 2.4 });
      if (pose === "turned") {
        // The back of its head: feathers where the face was.
        for (const [x, y] of [
          [-6, 0],
          [6, 0],
          [0, 8],
          [-4, 14],
          [4, 14],
        ]) {
          p.curve(
            [
              [x - 3, y - 2],
              [x, y + 1],
              [x + 3, y - 2],
            ],
            { strokeWidth: 0.9 },
          );
        }
        return;
      }
      for (const side of [-1, 1]) p.circle(side * eyes.EYE_DX, eyes.EYE_Y, 23, C.owlFace, { fillStyle: "solid", strokeWidth: 1 });
      const beak: Point[] = [
        [-3, eyes.EYE_Y + 8],
        [3, eyes.EYE_Y + 8],
        [0, eyes.EYE_Y + 14],
      ];
      p.shape(beak, C.beak, { fillStyle: "solid", strokeWidth: 0.9 });
    },
  };
}

const owlPose = (a: Alien): OwlPose => {
  if ((a.ability?.cover ?? 0) >= 0.5) return "turned";
  return a.mode === "windup" || a.mode === "dive" ? "swoop" : "perch";
};

const OWL_POSES: Record<OwlPose, DoodleRecipe> = {
  perch: owlDoodle("perch"),
  turned: owlDoodle("turned"),
  swoop: owlDoodle("swoop"),
};

const OWL: CreatureLook = {
  variant: owlPose,
  recipe: (a) => OWL_POSES[owlPose(a)],
  coverInk: C.owl,
  hidesBalls: true,
};

/** Bird: spread wings with a number ball on each, a fanned tail, beak down. */
const BIRD_DOODLE: DoodleRecipe = {
  w: 70,
  h: 58,
  draw(p, t) {
    const W = BALL_LAYOUTS.wings;
    const flap = Math.sin(TAU * t) * 4;
    const tail: Point[] = [
      [-4, -10],
      [-9, -24],
      [9, -24],
      [4, -10],
    ];
    p.shape(tail, C.bird, { hachureGap: 2.2, hachureAngle: 80 });
    for (const side of [-1, 1]) {
      const wing: Point[] = [
        [side * 4, -6],
        [side * (W.WING_DX + 4), W.WING_Y - 12 - flap],
        [side * 32, W.WING_Y - 4 - flap],
        [side * (W.WING_DX + 8), W.WING_Y + 12],
        [side * 4, 6],
      ];
      p.shape(wing, C.bird, { hachureGap: 2.4, hachureAngle: side * 30 });
    }
    p.ellipse(0, 0, 13, 24, C.birdBreast, { hachureGap: 2 });
    p.circle(0, 13, 12, C.bird, { hachureGap: 2 }); // head
    for (const side of [-1, 1]) p.dot(side * 2.5, 13, 1.2);
    const beak: Point[] = [
      [-2, 18],
      [2, 18],
      [0, 23],
    ];
    p.shape(beak, C.beak, { fillStyle: "solid", strokeWidth: 0.8 });
  },
};

const BIRD: CreatureLook = {
  variant: () => "fly",
  recipe: () => BIRD_DOODLE,
};

/** Hummingbird: a tiny body under its numbers, a long beak pointing the way
 * it flies and blurred wings. */
function hummingbirdDoodle(dir: 1 | -1): DoodleRecipe {
  return {
    w: 60,
    h: 54,
    draw(p, t) {
      const blur = Math.sin(TAU * t * 2);
      for (const k of [0, 1]) {
        const lift = (k === 0 ? 1 : -1) * 6 + blur * 3;
        p.ellipse(-dir * 2, -6 - lift * 0.4, 10, 22, undefined, { strokeWidth: 0.7, roughness: 1.6 });
      }
      p.ellipse(0, 4, 22, 13, C.hummer, { hachureGap: 1.8 });
      p.ellipse(dir * 6, 5, 7, 7, C.hummerThroat, { fillStyle: "solid", strokeWidth: 0.8 });
      p.circle(dir * 10, 0, 10, C.hummer, { hachureGap: 1.8 }); // head
      p.dot(dir * 11, -1, 1.2);
      p.line(dir * 14, 1, dir * 27, 4, { strokeWidth: 1.3 }); // the long beak
      const tail: Point[] = [
        [-dir * 9, 4],
        [-dir * 19, 0],
        [-dir * 18, 10],
      ];
      p.shape(tail, C.hummer, { fillStyle: "solid", strokeWidth: 0.9 });
    },
  };
}

const HUMMINGBIRD_DOODLES = { 1: hummingbirdDoodle(1), [-1]: hummingbirdDoodle(-1) } as Record<1 | -1, DoodleRecipe>;

const HUMMINGBIRD: CreatureLook = {
  variant: (a) => (a.heading > 0 ? "R" : "L"),
  recipe: (a) => HUMMINGBIRD_DOODLES[a.heading],
};

// --- Boss: the GREAT OWL --------------------------------------------------------

/** The eye spots (ball row) of the Great Owl: BossDef.BOX.BALLS_Y above its
 * center, BALL_SPACING apart (config/levels/treetops.ts). */
const EYE_Y = -22;
const EYE_DX = 10;

/** A huge owl perched on a branch, ear tufts up; its eyes are its numbers. */
const GREAT_OWL: DoodleRecipe = {
  w: 112,
  h: 112,
  draw(p, t) {
    const ruffle = Math.sin(TAU * t) * 2;
    p.curve(
      [
        [-52, 42],
        [0, 38],
        [52, 44],
      ],
      { stroke: C.bark, strokeWidth: 3 },
    ); // its branch
    for (const side of [-1, 1]) {
      const wing: Point[] = [
        [side * 30, -20],
        [side * 48, 0 + ruffle],
        [side * 40, 30],
        [side * 26, 28],
      ];
      p.shape(wing, C.greatOwl, { hachureGap: 2.2, hachureAngle: side * 40 });
      const tuft: Point[] = [
        [side * 14, -38],
        [side * 28, -52],
        [side * 30, -34],
      ];
      p.shape(tuft, C.greatOwl, { fillStyle: "solid", strokeWidth: 1.2 });
      for (const k of [-1, 0, 1]) p.line(side * 10 + k * 3, 34, side * 10 + k * 4, 42, { strokeWidth: 1.4 }); // talons
    }
    p.ellipse(0, 0, 76, 84, C.greatOwl, { hachureGap: 2.2 });
    p.ellipse(0, 16, 44, 40, C.owlFace, { hachureGap: 3, hachureAngle: 10 }); // belly
    for (const [x, y] of [
      [-10, 10],
      [6, 12],
      [-4, 22],
      [10, 24],
    ]) {
      p.curve(
        [
          [x - 3, y - 2],
          [x, y + 1],
          [x + 3, y - 2],
        ],
        { strokeWidth: 0.9 },
      );
    }
    p.ellipse(0, EYE_Y, 62, 38, C.owlFace, { fillStyle: "solid", strokeWidth: 1.3 }); // the face disc
    for (const side of [-1, 1]) p.circle(side * EYE_DX, EYE_Y, 26, DOODLE.PAPER, { fillStyle: "solid", strokeWidth: 2.2 });
    const beak: Point[] = [
      [-4, EYE_Y + 11],
      [4, EYE_Y + 11],
      [0, EYE_Y + 19],
    ];
    p.shape(beak, C.beak, { fillStyle: "solid", strokeWidth: 1 });
  },
};

/** The Great Owl flying to another branch: wings spread, eyes shut. */
const GREAT_OWL_FLYING: DoodleRecipe = {
  w: 150,
  h: 100,
  draw(p, t) {
    const flap = Math.sin(TAU * t) * 8;
    for (const side of [-1, 1]) {
      const wing: Point[] = [
        [side * 20, -14],
        [side * 50, -30 - flap],
        [side * 70, -16 - flap],
        [side * 56, 4],
        [side * 22, 12],
      ];
      p.shape(wing, C.greatOwl, { hachureGap: 2.4, hachureAngle: side * 30 });
      for (const k of [0, 1, 2]) p.line(side * (36 + k * 9), -2 - flap * 0.5, side * (42 + k * 9), 6, { strokeWidth: 0.9 });
    }
    p.ellipse(0, 0, 50, 64, C.greatOwl, { hachureGap: 2.2 });
    p.ellipse(0, -12, 40, 26, C.owlFace, { fillStyle: "solid", strokeWidth: 1.2 });
    for (const side of [-1, 1]) {
      p.curve(
        [
          [side * 13, -12],
          [side * 8, -9],
          [side * 3, -12],
        ],
        { strokeWidth: 1.6 },
      ); // shut eyes
    }
    p.shape(
      [
        [-3, -6],
        [3, -6],
        [0, 0],
      ],
      C.beak,
      { fillStyle: "solid", strokeWidth: 0.9 },
    );
  },
};

export const TREETOPS_PAGE: PageDef = {
  paper: "#eef3df",
  rule: "rgba(110, 140, 120, 0.3)",
  margin: "rgba(214, 84, 84, 0.32)",
  props: [
    { recipe: LEAF, weight: 4 },
    { recipe: OAK_LEAF, weight: 2 },
    { recipe: BRANCH, weight: 2.5 },
    { recipe: ACORN, weight: 2 },
    { recipe: NEST, weight: 0.8 },
    { recipe: FEATHER, weight: 1 },
  ],
  propGap: 44,
  creatures: { squirrel: SQUIRREL, owl: OWL, bird: BIRD, hummingbird: HUMMINGBIRD },
  bosses: { boss_owl: { up: GREAT_OWL, hidden: GREAT_OWL_FLYING } },
};
