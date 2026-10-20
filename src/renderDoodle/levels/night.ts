import { BALL_LAYOUTS } from "../../config/constants";
import { MOON_PHASES } from "../../config/levels/night";
import type Alien from "../../objects/Alien";
import { Moon } from "../../objects/moon";
import { Bounce, March, Warp } from "../../objects/nightTraits";
import type { BossLook, CreatureLook, PageDef } from "../pages";
import type { DoodleRecipe, Point } from "../pencil";

/**
 * Level 9, THE NIGHT SKY (config/levels/night.ts): a dusky blue-grey page
 * with stars, constellations, a crescent and a ringed planet; little
 * invaders (a nod to the original Metic) whose eyes are their numbers, big
 * three-eyed invaders, comets with their numbers in their tails, UFOs, a
 * shooting star, and THE MOON, read only where it's lit. Dark is a mood:
 * the paper stays light enough for graphite, and the number balls keep
 * their white paper. No blue, red, green or yellow creatures: those are
 * the balls' operation colors (docs/ART_SPEC.md §4).
 */

const TAU = Math.PI * 2;
const C = {
  star: "#fff6e0",
  starInk: "#f2c79a",
  lavender: "#b9a6e8",
  planet: "#d9946a",
  ring: "#8f7bc4",
  invader: "#9d4fb8",
  bigInvader: "#2f9a8e",
  cometHead: "#c9bdf0",
  tail: "#f4f0ff",
  ufo: "#7d8296",
  dome: "#cdbff2",
  light: "#f0913a",
  wish: "#f7c9a0",
  cap: "#d07aa8",
  cloud: "#8d93ab",
  moonLit: "rgba(250, 244, 222, 0.95)",
  moonGlow: "rgba(255, 250, 228, 0.28)",
  moonShadow: "rgba(38, 44, 74, 0.86)",
};

/** A five-pointed star with outer radius `r` around (x, y). */
function starPoints(x: number, y: number, r: number, spin = 0): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 10; i++) {
    const a = spin - Math.PI / 2 + (i / 10) * TAU;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return pts;
}

// --- Props --------------------------------------------------------------------

const STAR: DoodleRecipe = {
  w: 26,
  h: 26,
  draw(p) {
    p.shape(starPoints(0, 0, 10), C.star, { fillStyle: "solid", strokeWidth: 1 });
  },
};

const TWINKLE: DoodleRecipe = {
  w: 22,
  h: 22,
  draw(p) {
    p.line(-8, 0, 8, 0, { stroke: C.star, strokeWidth: 1.6 });
    p.line(0, -8, 0, 8, { stroke: C.star, strokeWidth: 1.6 });
    p.line(-4, -4, 4, 4, { stroke: C.star, strokeWidth: 1 });
    p.line(-4, 4, 4, -4, { stroke: C.star, strokeWidth: 1 });
  },
};

/** A little constellation: dots joined by dashed lines (the Dipper-ish). */
const CONSTELLATION: DoodleRecipe = {
  w: 80,
  h: 50,
  draw(p) {
    const pts: Point[] = [
      [-34, -10],
      [-20, -16],
      [-6, -12],
      [6, -2],
      [10, 14],
      [30, 16],
      [32, 0],
    ];
    for (let i = 1; i < pts.length; i++) {
      p.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], {
        stroke: C.star,
        strokeWidth: 0.9,
        strokeLineDash: [3, 4],
      });
    }
    p.line(32, 0, 6, -2, { stroke: C.star, strokeWidth: 0.9, strokeLineDash: [3, 4] });
    for (const [x, y] of pts) p.dot(x, y, 2.2, C.star);
  },
};

const CRESCENT: DoodleRecipe = {
  w: 40,
  h: 40,
  draw(p) {
    p.shape(
      [
        [2, -15],
        [-8, -11],
        [-13, -2],
        [-11, 8],
        [-3, 14],
        [6, 14],
        [-2, 7],
        [-5, -1],
        [-3, -9],
      ],
      C.star,
      { fillStyle: "solid", strokeWidth: 1 },
    );
  },
};

const PLANET: DoodleRecipe = {
  w: 60,
  h: 36,
  draw(p) {
    p.circle(0, 0, 24, C.planet, { hachureGap: 2.4 });
    p.ellipse(0, 1, 52, 12, undefined, { stroke: C.ring, strokeWidth: 1.6 });
  },
};

/** A tiny paper rocket, the kind drawn in a margin. */
const ROCKET: DoodleRecipe = {
  w: 30,
  h: 44,
  draw(p) {
    p.shape(
      [
        [0, -18],
        [6, -6],
        [6, 10],
        [-6, 10],
        [-6, -6],
      ],
      C.lavender,
      { hachureGap: 2.6 },
    );
    p.circle(0, -3, 6, undefined, { strokeWidth: 0.9 }); // porthole
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 6, 4],
          [side * 11, 12],
          [side * 6, 10],
        ],
        C.planet,
        { fillStyle: "solid", strokeWidth: 0.9 },
      ); // fins
    }
    p.curve(
      [
        [-3, 12],
        [0, 19],
        [3, 12],
      ],
      { stroke: C.starInk, strokeWidth: 1.2 },
    ); // flame
  },
};

// --- Creatures ------------------------------------------------------------------

const E = BALL_LAYOUTS.eyes;
const marchFrame = (a: Alien) => (a.ability instanceof March ? a.ability.frame : 0);

/**
 * Invader: a blocky little crab from the arcade, its two eyes are its
 * numbers. Two frames, like the original: claws and legs swap each step.
 */
function invaderDoodle(frame: number): DoodleRecipe {
  return {
    w: 60,
    h: 2 * 34,
    draw(p) {
      const body: Point[] = [
        [-15, -12],
        [15, -12],
        [15, -5],
        [23, -5],
        [23, 22],
        [15, 22],
        [15, 26],
        [-15, 26],
        [-15, 22],
        [-23, 22],
        [-23, -5],
        [-15, -5],
      ];
      p.shape(body, C.invader, { hachureGap: 2.6, hachureAngle: -60 });
      for (const side of [-1, 1]) {
        p.line(side * 7, -12, side * 12, -21, { strokeWidth: 1.3 }); // antennae
        p.dot(side * 12, -22, 1.8);
        // Claws up on one step, down on the next.
        const clawY = frame ? -8 : 14;
        p.line(side * 23, 8, side * 28, clawY, { strokeWidth: 1.6 });
        // Legs out, then in.
        const out = frame ? 6 : -4;
        p.line(side * 10, 26, side * (12 + out), 32, { strokeWidth: 1.4 });
        p.line(side * 3, 26, side * (3 + out / 2), 31, { strokeWidth: 1.2 });
      }
    },
  };
}

const INVADER_FRAMES = [invaderDoodle(0), invaderDoodle(1)];

const INVADER: CreatureLook = {
  variant: (a) => String(marchFrame(a)),
  recipe: (a) => INVADER_FRAMES[marchFrame(a)],
  coverInk: C.invader,
};

/** Big invader: a squid-shaped one whose three numbers ride on stalks over
 * its dome; tentacles wave with each step. */
function bigInvaderDoodle(frame: number): DoodleRecipe {
  return {
    w: 76,
    h: 2 * 46,
    draw(p) {
      p.shape(
        [
          [-24, 12],
          [-26, 0],
          [-18, -14],
          [-6, -20],
          [6, -20],
          [18, -14],
          [26, 0],
          [24, 12],
        ],
        C.bigInvader,
        { hachureGap: 2.4 },
      );
      for (const x of [-20, 0, 20]) p.line(x * 0.7, -18, x, -22, { strokeWidth: 1.2 }); // stalks
      for (const side of [-1, 1]) {
        p.paper(side * 9, -2, 9, { strokeWidth: 1 });
        p.dot(side * 9, -1, 1.7); // its own eyes
      }
      p.line(-6, 6, 6, 6, { strokeWidth: 1.4 }); // mouth
      for (let i = 0; i < 4; i++) {
        const x = -18 + i * 12;
        const swing = (frame ? 1 : -1) * (i % 2 ? 4 : -4);
        p.curve(
          [
            [x, 12],
            [x + swing, 20],
            [x - swing * 0.5, 27],
          ],
          { strokeWidth: 1.4 },
        );
      }
    },
  };
}

const BIG_FRAMES = [bigInvaderDoodle(0), bigInvaderDoodle(1)];

const BIG_INVADER: CreatureLook = {
  variant: (a) => String(marchFrame(a)),
  recipe: (a) => BIG_FRAMES[marchFrame(a)],
};

const L = BALL_LAYOUTS.chain;
const cometDir = (a: Alien) => (a.ability instanceof Bounce && a.ability.dir !== 0 ? a.ability.dir : a.heading);

/** Comet: an icy little head with a face, its numbers riding in the long
 * glowing tail behind it (the tail leans away from where it's flying). */
function cometDoodle(balls: number, dir: number): DoodleRecipe {
  const topBall = L.FIRST_Y - (balls - 1) * L.GAP;
  const tailTop = topBall - 26;
  const lean = -dir * 14;
  return {
    w: 70,
    h: 2 * Math.max(-tailTop + 6, 24),
    draw(p, t) {
      for (const k of [-1, 0, 1]) {
        const wob = Math.sin(TAU * t + k) * 2;
        p.curve(
          [
            [k * 6, 2],
            [k * 9 + lean * 0.4 + wob, topBall + 10],
            [k * 12 + lean + wob, tailTop],
          ],
          { stroke: C.tail, strokeWidth: k === 0 ? 2.4 : 1.4 },
        );
      }
      p.circle(0, 6, 20, C.cometHead, { hachureGap: 2, hachureAngle: 30 });
      for (const side of [-1, 1]) p.dot(side * 3.5, 6, 1.4);
      p.curve(
        [
          [-3, 10],
          [0, 12],
          [3, 10],
        ],
        { strokeWidth: 0.9 },
      );
    },
  };
}

const COMET: CreatureLook = {
  variant: (a) => `${a.ballCount}:${cometDir(a)}`,
  recipe: (a) => cometDoodle(a.ballCount, cometDir(a)),
};

const warpPhase = (a: Alien) => (a.ability instanceof Warp ? a.ability.phase : "fly");

/** UFO: a saucer with a glass dome (a tiny pilot inside) and rim lights; the
 * lights spin before it warps; while it warps only a dotted ghost is left. */
function ufoDoodle(phase: "fly" | "warn" | "warp"): DoodleRecipe {
  return {
    w: 64,
    h: 2 * 34,
    draw(p, t) {
      if (phase === "warp") {
        p.ellipse(0, 4, 50, 16, undefined, { strokeWidth: 1, strokeLineDash: [3, 5] });
        for (let i = 0; i < 5; i++) {
          const a = TAU * (i / 5 + t);
          p.dot(Math.cos(a) * 26, 2 + Math.sin(a) * 10, 1.4, C.star);
        }
        return;
      }
      p.ellipse(0, -4, 24, 20, C.dome, { hachureGap: 2.4 });
      p.circle(0, -5, 8, C.bigInvader, { fillStyle: "solid", strokeWidth: 0.8 }); // the pilot
      p.ellipse(0, 4, 52, 16, C.ufo, { hachureGap: 2.2, hachureAngle: 10 });
      const spin = phase === "warn" ? t * 5 : 0;
      for (let i = 0; i < 5; i++) {
        const x = Math.cos(Math.PI * ((i + 0.5) / 5 + spin)) * 20;
        p.dot(x, 6, phase === "warn" ? 2.4 : 1.6, C.light);
      }
      if (phase === "warn") {
        for (const side of [-1, 1]) p.line(side * 28, 4, side * 34, 2, { stroke: C.light, strokeWidth: 1.2 });
      }
    },
  };
}

const UFO_FRAMES = { fly: ufoDoodle("fly"), warn: ufoDoodle("warn"), warp: ufoDoodle("warp") };

const UFO: CreatureLook = {
  variant: (a) => warpPhase(a),
  recipe: (a) => UFO_FRAMES[warpPhase(a)],
  hidesBalls: true, // it's gone while it warps
};

const burnt = (a: Alien) => (a.ability?.cover ?? 0) >= 0.5;

/** Shooting star: a plump star whose eyes are its numbers, a trail of
 * sparks behind it; burning out, it shrinks and smokes. */
function wishDoodle(dir: number, burning: boolean): DoodleRecipe {
  const s = burning ? 0.8 : 1;
  return {
    w: 110,
    h: 2 * 34,
    draw(p, t) {
      for (const k of [0, 1, 2]) {
        const x = -dir * (24 + k * 10);
        p.line(x + dir * 6, 4 - k * 3, x - dir * 10, -2 - k * 5, { stroke: burning ? C.cloud : C.star, strokeWidth: 1.6 - k * 0.3 });
      }
      p.shape(starPoints(0, 6, 26 * s, Math.sin(TAU * t) * 0.08), burning ? C.cloud : C.wish, { hachureGap: 2.4 });
      p.curve(
        [
          [-4, E.EYE_Y + 11],
          [0, E.EYE_Y + 13],
          [4, E.EYE_Y + 11],
        ],
        { strokeWidth: 1 },
      );
    },
  };
}

const WISH: CreatureLook = {
  variant: (a) => `${a.heading}:${burnt(a) ? "out" : "lit"}`,
  recipe: (a) => wishDoodle(a.heading, burnt(a)),
  coverInk: C.cloud,
};

// --- Boss: THE MOON -----------------------------------------------------------------

const R = MOON_PHASES.FACE_R;

/** The Moon's face in pencil: craters, a sleepy face under its numbers and
 * a striped nightcap. The light and the shadow are painted under it (by
 * `paintFace`), so the pencil lines stay crisp on top. */
const MOON_FACE: DoodleRecipe = {
  w: 2 * 60,
  h: 2 * 62,
  draw(p, t) {
    p.circle(0, 0, 2 * R, undefined, { strokeWidth: 1.8 });
    for (const [x, y, d] of [
      [-22, 16, 9],
      [24, 12, 7],
      [14, 28, 6],
      [-8, 30, 5],
    ])
      p.circle(x, y, d, undefined, { strokeWidth: 0.8 });
    for (const side of [-1, 1]) {
      p.curve(
        [
          [side * 13, 6],
          [side * 9, 9],
          [side * 5, 6],
        ],
        { strokeWidth: 1.3 },
      ); // sleepy eyes
    }
    p.curve(
      [
        [-7, 18],
        [0, 22],
        [7, 18],
      ],
      { strokeWidth: 1.2 },
    ); // a small smile
    // Its nightcap, flopping over to the left with a pompom.
    const flop = Math.sin(TAU * t) * 2;
    p.shape(
      [
        [-28, -28],
        [8, -42],
        [-14, -52],
        [-40, -50 + flop],
      ],
      C.cap,
      { hachureGap: 2.2 },
    );
    p.line(-20, -32, -2, -45, { strokeWidth: 0.9 });
    p.circle(-44, -48 + flop, 9, C.star, { fillStyle: "solid", strokeWidth: 1 });
  },
};

/** Behind its cloud (after an answer): a fluffy cloud, the cap poking out. */
const MOON_CLOUD: DoodleRecipe = {
  w: 2 * 64,
  h: 2 * 44,
  draw(p, t) {
    p.shape(
      [
        [-28, -48],
        [-6, -40],
        [-30, -32],
      ],
      C.cap,
      { hachureGap: 2.2 },
    );
    const bob = Math.sin(TAU * t) * 1.5;
    for (const [x, y, d] of [
      [-30, 6, 34],
      [-10, -8, 42],
      [14, -4, 40],
      [34, 8, 30],
      [0, 12, 44],
    ])
      p.circle(x, y + bob, d, C.cloud, { hachureGap: 3, hachureAngle: 20 });
    p.curve(
      [
        [-8, 2],
        [-4, 4],
        [0, 2],
      ],
      { strokeWidth: 0.9 },
    );
  },
};

/** The moon's light and shadow, painted under its pencil face: a soft halo,
 * the lit face, and the shadow band between two half-ellipse terminators
 * (exactly where the rules dim its numbers). */
function paintFace(ctx: CanvasRenderingContext2D, boss: Alien, alpha: number): void {
  if (!(boss.ability instanceof Moon) || boss.ability.burrowing) return;
  const x = boss.viewX(alpha);
  const y = boss.viewY(alpha);
  ctx.save();
  ctx.fillStyle = C.moonGlow;
  ctx.beginPath();
  ctx.arc(x, y, R + 12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.moonLit;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  ctx.fill();
  const [a, b] = boss.ability.shadow;
  if (b > a) {
    ctx.fillStyle = C.moonShadow;
    ctx.beginPath();
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const dy = -R + (2 * R * i) / steps;
      const w = Math.sqrt(Math.max(0, R * R - dy * dy));
      ctx.lineTo(x + (2 * a - 1) * w, y + dy); // the left edge, top to bottom
    }
    for (let i = steps; i >= 0; i--) {
      const dy = -R + (2 * R * i) / steps;
      const w = Math.sqrt(Math.max(0, R * R - dy * dy));
      ctx.lineTo(x + (2 * b - 1) * w, y + dy); // the right edge, back up
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

const MOON_LOOK: BossLook = { up: MOON_FACE, hidden: MOON_CLOUD, under: paintFace };

export const NIGHT_PAGE: PageDef = {
  paper: "#aab4ca",
  rule: "rgba(236, 240, 255, 0.32)",
  margin: "rgba(214, 110, 160, 0.4)",
  props: [
    { recipe: STAR, weight: 3 },
    { recipe: TWINKLE, weight: 3 },
    { recipe: CONSTELLATION, weight: 1.5 },
    { recipe: CRESCENT, weight: 1 },
    { recipe: PLANET, weight: 1 },
    { recipe: ROCKET, weight: 0.6 },
  ],
  propGap: 44,
  creatures: {
    invader: INVADER,
    "big invader": BIG_INVADER,
    comet: COMET,
    ufo: UFO,
    "shooting star": WISH,
  },
  bosses: { boss_moon: MOON_LOOK },
};
