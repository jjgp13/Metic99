import { BALL_LAYOUTS, DOODLE } from "../../config/constants";
import type Alien from "../../objects/Alien";
import { Shielded } from "../../objects/abilities";
import type { CreatureLook, PageDef } from "../pages";
import type { DoodleRecipe, Point } from "../pencil";

/**
 * Level 4, THE MUD SWAMP (config/levels/swamp.ts): a muddy page with
 * puddles, bubbles, cattails and logs; slime blobs that pop into two,
 * peepers whose eyes (their numbers) duck under the mud, snails that lose
 * their shell, bog turtles, a firefly whose light flickers out, and the MUD
 * MONSTER that splits in two. Creatures face down, toward the player.
 */

const TAU = Math.PI * 2;
const C = {
  mud: "#7a5c3e",
  mudDark: "#5a4330",
  reed: "#8a8a52",
  cattail: "#6b4a2e",
  bubble: "#9a8a70",
  // Same pink as the splitlings the slime pops into (DOODLE.ABILITY_INK).
  slime: "#e0679f",
  peeper: "#8b6b45",
  shell: "#c98a4a",
  snail: "#b9a07a",
  turtle: "#d98c3a",
  turtleSkin: "#8f8a7a",
  glow: "#f2a33a",
  wing: "#a7a39a",
  dark: "#4a4038",
};

// --- Props --------------------------------------------------------------------

const PUDDLE: DoodleRecipe = {
  w: 50,
  h: 26,
  draw(p, t) {
    const spread = 6 + 4 * t; // its ripple widens, then a new one starts
    const edge: Point[] = [
      [-22, 2],
      [-16, -7],
      [-2, -9],
      [12, -7],
      [22, -1],
      [16, 8],
      [-4, 9],
      [-18, 7],
    ];
    p.shape(edge, C.mud, { hachureGap: 3.2, hachureAngle: 10 });
    p.curve(
      [
        [-spread, -2],
        [0, -4],
        [spread, -2],
      ],
      { strokeWidth: 0.8 },
    ); // a ripple
  },
};

/** Mud bubbles: each one swells, then pops and starts again, out of step. */
const BUBBLES: DoodleRecipe = {
  w: 30,
  h: 30,
  draw(p, t) {
    for (const [x, y, d, offset] of [
      [-6, 4, 10, 0],
      [5, -2, 7, 0.5],
      [2, -10, 4, 0.25],
      [-9, -7, 3, 0.75],
    ]) {
      const grown = (t + offset) % 1;
      if (grown > 0.15) p.circle(x, y, d * grown, undefined, { strokeWidth: 1 });
    }
  },
};

const CATTAILS: DoodleRecipe = {
  w: 34,
  h: 46,
  draw(p, t) {
    const breeze = Math.sin(t * TAU) * 2;
    for (const [x, stalkLean, top] of [
      [-5, -4, -16],
      [2, 1, -20],
      [7, 5, -12],
    ]) {
      const lean = stalkLean + breeze;
      p.curve(
        [
          [x, 20],
          [x + lean * 0.4, 4],
          [x + lean, top],
        ],
        { stroke: C.reed, strokeWidth: 1.3 },
      );
      p.ellipse(x + lean, top - 4, 4, 10, C.cattail, { fillStyle: "solid" });
    }
  },
};

const LOG: DoodleRecipe = {
  w: 64,
  h: 24,
  draw(p) {
    p.shape(
      [
        [-26, -6],
        [24, -8],
        [26, 6],
        [-24, 8],
      ],
      C.cattail,
      { hachureGap: 3.4, hachureAngle: 0 },
    );
    p.ellipse(25, -1, 8, 14, C.mud, { hachureGap: 2 }); // the cut end
    p.line(-10, -2, 6, -3, { strokeWidth: 0.8 }); // bark
  },
};

const REEDS: DoodleRecipe = {
  w: 34,
  h: 30,
  draw(p) {
    for (const [x, lean] of [
      [-8, -6],
      [-3, -2],
      [3, 2],
      [8, 7],
    ]) {
      p.line(x, 12, x + lean, -12, { stroke: C.reed, strokeWidth: 1.2 });
    }
  },
};

const STEPPING_STONES: DoodleRecipe = {
  w: 54,
  h: 22,
  draw(p) {
    p.ellipse(-16, 3, 14, 9, undefined);
    p.ellipse(0, -3, 12, 8, undefined);
    p.ellipse(16, 2, 13, 9, undefined);
  },
};

// --- Drifts (renderDoodle/drifts.ts) ------------------------------------------

/** A wisp of swamp mist, drifting low across the page. */
const MIST: DoodleRecipe = {
  w: 80,
  h: 16,
  draw(p) {
    p.curve(
      [
        [-36, 3],
        [-20, -3],
        [-4, 2],
        [12, -3],
        [26, 2],
        [36, -1],
      ],
      { stroke: C.bubble, strokeWidth: 1.4, roughness: 1.6 },
    );
    p.curve(
      [
        [-22, 6],
        [-6, 4],
        [10, 7],
      ],
      { stroke: C.bubble, strokeWidth: 0.9 },
    );
  },
};

// --- Creatures ------------------------------------------------------------------

/** Slime blob: a pink drippy blob whose numbers float in its top; beaten,
 * it pops into two little blobs (the Splitter's splitlings). */
const SLIME_DOODLE: DoodleRecipe = {
  w: 46,
  h: 74,
  draw(p, t) {
    const wob = Math.sin(TAU * t) * 1.5;
    const body: Point[] = [
      [0, -42 - wob],
      [13, -36],
      [19 + wob, -18],
      [17, 2],
      [19, 14],
      [12, 19 + wob],
      [6, 15],
      [0, 20],
      [-7, 15],
      [-13, 19 - wob],
      [-19, 12],
      [-17, -2],
      [-19 - wob, -20],
      [-12, -36],
    ];
    p.shape(body, C.slime, { hachureGap: 2.6, hachureAngle: 60 });
    // A face low on the blob, near the player.
    for (const side of [-1, 1]) {
      p.paper(side * 6, 4, 8);
      p.dot(side * 6, 5, 1.6);
    }
    p.curve(
      [
        [-4, 11],
        [0, 13],
        [4, 11],
      ],
      { strokeWidth: 0.9 },
    );
  },
};

const SLIME: CreatureLook = {
  variant: () => "2",
  recipe: () => SLIME_DOODLE,
};

/** Peeper: a frog in the mud; its eyes are its two numbers. */
const PEEPER_OPEN: DoodleRecipe = {
  w: 50,
  h: 50,
  draw(p, t) {
    const eyes = BALL_LAYOUTS.eyes;
    const throat = 1 + 0.08 * Math.sin(TAU * t);
    // The mud ring it sits in, then its head; the eyes sit on top.
    p.ellipse(0, 10, 44, 18, C.mud, { hachureGap: 3.4, hachureAngle: 5 });
    p.ellipse(0, 4, 34 * throat, 24, C.peeper, { hachureGap: 2.4 });
    for (const side of [-1, 1]) p.circle(side * eyes.EYE_DX, eyes.EYE_Y - 1, 24, C.peeper, { hachureGap: 2.2 });
    p.curve(
      [
        [-10, 14],
        [0, 17],
        [10, 14],
      ],
      { strokeWidth: 1 },
    ); // its wide mouth
  },
};

/** Peeper ducked under: just bubbles and the top of its head. */
const PEEPER_DUCKED: DoodleRecipe = {
  w: 50,
  h: 50,
  draw(p, t) {
    p.ellipse(0, 10, 44, 18, C.mud, { hachureGap: 3.4, hachureAngle: 5 });
    p.ellipse(0, 6, 28, 10, C.peeper, { hachureGap: 2.4 });
    const rise = (t * 8) % 8;
    p.circle(-8, -2 - rise, 5, undefined, { strokeWidth: 0.9 });
    p.circle(7, -6 - rise * 0.6, 4, undefined, { strokeWidth: 0.9 });
  },
};

const ducked = (a: Alien) => (a.ability?.cover ?? 0) >= 0.5;

const PEEPER: CreatureLook = {
  variant: (a) => (ducked(a) ? "ducked" : "open"),
  recipe: (a) => (ducked(a) ? PEEPER_DUCKED : PEEPER_OPEN),
  coverInk: C.mud, // the mud closes over its eyes
};

/** Snail: a spiral shell with its numbers riding on top, eye stalks in front. */
function snailDoodle(shell: boolean): DoodleRecipe {
  return {
    w: 44,
    h: 74,
    draw(p, t) {
      const stalk = Math.sin(TAU * t) * 1.5;
      // The foot, longer once it's a slug.
      p.ellipse(0, shell ? 4 : -2, 18, shell ? 26 : 38, C.snail, { hachureGap: 2.6, hachureAngle: 80 });
      for (const side of [-1, 1]) {
        p.line(side * 3, 14, side * 7 + stalk * side, 22, { strokeWidth: 1.1 });
        p.dot(side * 7 + stalk * side, 23, 1.8);
      }
      if (shell) {
        p.circle(0, -12, 34, C.shell, { hachureGap: 2.4 });
        p.curve(
          [
            [0, -12],
            [5, -15],
            [3, -22],
            [-6, -20],
            [-9, -11],
            [-3, -1],
            [9, -3],
          ],
          { strokeWidth: 1.1 },
        ); // the spiral
      } else {
        // Its shell got knocked off: little pieces left behind.
        p.line(-14, -16, -10, -19, { strokeWidth: 1 });
        p.line(12, -18, 15, -14, { strokeWidth: 1 });
      }
    },
  };
}

const SNAIL_SHELL = snailDoodle(true);
const SNAIL_SLUG = snailDoodle(false);
const hasShell = (a: Alien) => a.ability instanceof Shielded && a.ability.shieldUp;

const SNAIL: CreatureLook = {
  variant: (a) => (hasShell(a) ? "shell" : "slug"),
  recipe: (a) => (hasShell(a) ? SNAIL_SHELL : SNAIL_SLUG),
};

/** Bog turtle: three numbers on its domed shell, stomping on four legs. */
const TURTLE_DOODLE: DoodleRecipe = {
  w: 64,
  h: 70,
  draw(p, t) {
    for (const [sx, sy, phase] of [
      [-1, -1, 0],
      [1, 1, 0],
      [1, -1, Math.PI],
      [-1, 1, Math.PI],
    ]) {
      const step = Math.sin(TAU * t + phase) * 2;
      p.ellipse(sx * 24, sy * 12 + 2 + step, 12, 10, C.turtleSkin, { hachureGap: 2.6 });
    }
    p.circle(0, 22, 16, C.turtleSkin, { hachureGap: 2.4 }); // head
    for (const side of [-1, 1]) p.dot(side * 4, 24, 1.4);
    p.ellipse(0, -4, 52, 44, C.turtle, { hachureGap: 2.6 });
    p.shape(
      [
        [-8, -12],
        [8, -12],
        [12, 0],
        [0, 8],
        [-12, 0],
      ],
      undefined,
      { strokeWidth: 0.9 },
    ); // a plate on its shell
  },
};

const TURTLE: CreatureLook = {
  variant: (a) => String(a.ballCount),
  recipe: () => TURTLE_DOODLE,
};

/** Firefly: a number on each wing and a glowing tail; when its light goes
 * out, the numbers go dark too. */
function fireflyDoodle(lit: boolean): DoodleRecipe {
  return {
    w: 64,
    h: 54,
    draw(p, t) {
      const W = BALL_LAYOUTS.wings;
      const flap = 0.9 + 0.1 * Math.cos(TAU * t);
      for (const side of [-1, 1]) {
        p.ellipse(side * W.WING_DX, W.WING_Y, 28 * flap, 24, C.wing, { hachureGap: 3.4 });
        p.line(side * 2, -12, side * 6, -20, { strokeWidth: 1 }); // antennae
      }
      p.ellipse(0, -4, 7, 18, DOODLE.GRAPHITE, { fillStyle: "solid" });
      if (lit) {
        p.circle(0, 14, 22, C.glow, { hachureGap: 1.8 }); // the glow
        p.circle(0, 12, 11, C.glow, { fillStyle: "solid" });
      } else {
        p.circle(0, 12, 11, C.dark, { hachureGap: 2.2 });
      }
    },
  };
}

const FIREFLY_LIT = fireflyDoodle(true);
const FIREFLY_DARK = fireflyDoodle(false);
const unlit = (a: Alien) => (a.ability?.cover ?? 0) >= 0.5;

const FIREFLY: CreatureLook = {
  variant: (a) => (unlit(a) ? "dark" : "lit"),
  recipe: (a) => (unlit(a) ? FIREFLY_DARK : FIREFLY_LIT),
  coverInk: C.dark,
};

// --- Boss: the MUD MONSTER ------------------------------------------------------

/** A big drippy mud heap with grabby arms, two eyes and a wide grin. */
const MUD_MONSTER: DoodleRecipe = {
  w: 112,
  h: 100,
  draw(p, t) {
    const drip = Math.sin(TAU * t) * 2;
    for (const side of [-1, 1]) {
      // Arms reaching down, dripping.
      p.curve(
        [
          [side * 30, -2],
          [side * 46, 8 + drip * side],
          [side * 44, 26],
        ],
        { strokeWidth: 5, stroke: C.mudDark },
      );
      p.ellipse(side * 44, 30 + drip, 6, 9, C.mudDark, { fillStyle: "solid" });
    }
    const body: Point[] = [
      [0, -40],
      [20, -36],
      [36, -20],
      [38, 6],
      [34, 28],
      [22, 36 + drip],
      [10, 30],
      [0, 37],
      [-12, 31],
      [-24, 36 - drip],
      [-35, 26],
      [-38, 2],
      [-34, -22],
      [-18, -37],
    ];
    p.shape(body, C.mud, { hachureGap: 2.4 });
    for (const side of [-1, 1]) {
      p.paper(side * 13, -4, 16);
      p.dot(side * 13, -2, 2.6);
    }
    p.curve(
      [
        [-18, 14],
        [-8, 20],
        [8, 20],
        [18, 14],
      ],
      { strokeWidth: 1.6 },
    ); // the grin
    for (const [x, y] of [
      [-22, -24],
      [18, -28],
      [26, -8],
    ])
      p.circle(x, y, 5, undefined, { strokeWidth: 0.9 }); // bubbles in its mud
  },
};

/** The Mud Monster sunk into the swamp: a bubbling puddle. */
function mudPuddle(w: number): DoodleRecipe {
  return {
    w: w + 20,
    h: w * 0.6 + 20,
    draw(p, t) {
      p.ellipse(0, 8, w, w * 0.4, C.mud, { hachureGap: 3, hachureAngle: 15 });
      for (let i = 0; i < 3; i++) {
        const rise = ((t + i / 3) % 1) * w * 0.25;
        p.circle((i - 1) * w * 0.25, 2 - rise, 4 + i * 2, undefined, { strokeWidth: 0.9 });
      }
    },
  };
}

/** Half of the Mud Monster: a smaller heap with one big eye, still grinning. */
const MUD_HALF: DoodleRecipe = {
  w: 56,
  h: 64,
  draw(p, t) {
    const drip = Math.sin(TAU * t) * 1.5;
    const body: Point[] = [
      [0, -26],
      [14, -20],
      [19, -2],
      [17, 16],
      [9, 22 + drip],
      [0, 18],
      [-9, 22 - drip],
      [-17, 15],
      [-19, -4],
      [-13, -21],
    ];
    p.shape(body, C.mud, { hachureGap: 2.4 });
    p.paper(0, -4, 14);
    p.dot(0, -2, 2.4);
    p.curve(
      [
        [-8, 9],
        [0, 13],
        [8, 9],
      ],
      { strokeWidth: 1.3 },
    );
  },
};

export const SWAMP_PAGE: PageDef = {
  paper: "#e7dfc6",
  rule: "rgba(110, 120, 90, 0.3)",
  margin: "rgba(160, 96, 60, 0.35)",
  props: [
    { recipe: PUDDLE, weight: 3, fps: 2 },
    { recipe: BUBBLES, weight: 2.5, fps: 2 },
    { recipe: CATTAILS, weight: 3, fps: 2.5 },
    { recipe: LOG, weight: 1 },
    { recipe: REEDS, weight: 2 },
    { recipe: STEPPING_STONES, weight: 1 },
  ],
  propGap: 46,
  drifts: [{ recipe: MIST, count: 3, vx: 7, vy: -2, swayPx: 4, swayHz: 0.1 }],
  creatures: { slime: SLIME, peeper: PEEPER, snail: SNAIL, turtle: TURTLE, firefly: FIREFLY },
  bosses: {
    boss_mud: { up: MUD_MONSTER, hidden: mudPuddle(84) },
    boss_mud_half: { up: MUD_HALF, hidden: mudPuddle(40) },
  },
};
