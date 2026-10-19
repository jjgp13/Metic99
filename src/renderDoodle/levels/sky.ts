import { BALL_LAYOUTS, DOODLE, GAME } from "../../config/constants";
import { STORM } from "../../config/levels/sky";
import type Alien from "../../objects/Alien";
import { Loop, Swoop, Windy, type PlanePose, type WindPhase } from "../../objects/skyTraits";
import { StormCloud } from "../../objects/stormCloud";
import type { BossLook, CreatureLook, PageDef } from "../pages";
import type { DoodleRecipe, Pencil, Point } from "../pencil";

/**
 * Level 7, THE WINDY SKY (config/levels/sky.ts): pale sky-tinted paper with
 * clouds, wind swirls, far-off birds and a kite string; kites whose numbers
 * are the bows on their tails, swallows whose eyes are their numbers, paper
 * planes with a number on each wing, a hot-air balloon, and the STORM CLOUD
 * with its raindrops. Every creature shows the wind: a swirl while it picks
 * up (the telegraph), swooshes while the gust blows. Sky blue is the sum
 * balls' color (docs/ART_SPEC.md §4), so the paper is only a pale tint and
 * the creatures are magenta, orange, plum and lavender.
 */

const TAU = Math.PI * 2;
const C = {
  cloud: "#a9b0bf",
  kite: "#c2569b",
  kiteDark: "#8e3b72",
  bow: "#f08a2c",
  swallow: "#4b3f5e",
  throat: "#f2b48a",
  plane: "#b8a9d9",
  balloon: "#c2569b",
  balloonStripe: "#f08a2c",
  basket: "#8a6a3f",
  storm: "#5f6475",
  stormDark: "#454a5a",
  bolt: "#ffb86b",
  rain: "#9a93bd",
  wind: "#7d8597",
  sun: "#e8873a",
};

/** A cache of doodles by variant (each is drawn once, then copied). */
function cached<K extends string>(make: (key: K) => DoodleRecipe): (key: K) => DoodleRecipe {
  const memo = new Map<K, DoodleRecipe>();
  return (key) => {
    let r = memo.get(key);
    if (!r) memo.set(key, (r = make(key)));
    return r;
  };
}

/** Swooshes on the upwind side (`dir` = where the wind blows): one swirl
 * while the wind picks up, three long swooshes in the gust. */
function windLines(p: Pencil, phase: WindPhase, dir: 1 | -1, halfW: number, t: number): void {
  if (phase === "calm") return;
  const from = -dir * (halfW + 6);
  if (phase === "warn") {
    const s = 1 + Math.sin(TAU * t) * 0.15;
    p.curve(
      [
        [from - dir * 10, -6],
        [from, -10 * s],
        [from + dir * 4, -4],
        [from - dir * 2, 0],
        [from - dir * 4, -5],
      ],
      { stroke: C.wind, strokeWidth: 1 },
    );
    return;
  }
  for (const [y, len] of [
    [-14, 22],
    [0, 30],
    [14, 20],
  ]) {
    const x0 = from - dir * len - dir * 4 * Math.sin(TAU * t + y);
    p.curve(
      [
        [x0, y],
        [from - (dir * len) / 2, y - 3],
        [from, y + 1],
      ],
      { stroke: C.wind, strokeWidth: 1.1 },
    );
  }
}

/** The wind a creature is in, as a variant key ("calm", "warn1", "gust-1"…). */
const windKey = (a: Alien): string => {
  const w = a.ability instanceof Windy ? a.ability.wind : null;
  return !w || w.phase === "calm" ? "calm" : `${w.phase}${w.dir}`;
};
const parseWind = (key: string): [WindPhase, 1 | -1] =>
  key === "calm" ? ["calm", 1] : [key.startsWith("warn") ? "warn" : "gust", key.endsWith("-1") ? -1 : 1];

// --- Props --------------------------------------------------------------------

const CLOUD: DoodleRecipe = {
  w: 70,
  h: 36,
  draw(p) {
    p.curve(
      [
        [-30, 10],
        [-30, 0],
        [-20, -6],
        [-12, -14],
        [2, -14],
        [10, -6],
        [22, -8],
        [30, 2],
        [26, 10],
      ],
      { stroke: C.cloud, strokeWidth: 1.3 },
    );
    p.line(-30, 10, 26, 10, { stroke: C.cloud, strokeWidth: 1.1 });
  },
};

const SWIRL: DoodleRecipe = {
  w: 50,
  h: 26,
  draw(p) {
    p.curve(
      [
        [-22, 4],
        [-4, 2],
        [8, -2],
        [12, -8],
        [6, -11],
        [2, -6],
        [6, -3],
      ],
      { stroke: C.wind, strokeWidth: 1.1 },
    );
    p.curve(
      [
        [-14, 10],
        [4, 9],
        [20, 6],
      ],
      { stroke: C.wind, strokeWidth: 0.9 },
    );
  },
};

const FAR_BIRDS: DoodleRecipe = {
  w: 46,
  h: 24,
  draw(p) {
    for (const [x, y, s] of [
      [-12, 2, 1],
      [2, -6, 0.8],
      [14, 4, 0.7],
    ]) {
      p.curve(
        [
          [x - 6 * s, y - 2 * s],
          [x - 2 * s, y - 3 * s],
          [x, y],
        ],
        { strokeWidth: 1 },
      );
      p.curve(
        [
          [x, y],
          [x + 2 * s, y - 3 * s],
          [x + 6 * s, y - 2 * s],
        ],
        { strokeWidth: 1 },
      );
    }
  },
};

/** A kite far away, its long string curving down off the page. */
const FAR_KITE: DoodleRecipe = {
  w: 50,
  h: 80,
  draw(p) {
    p.shape(
      [
        [10, -36],
        [16, -28],
        [10, -18],
        [4, -28],
      ],
      C.kite,
      { hachureGap: 2.2 },
    );
    p.curve(
      [
        [10, -18],
        [4, -2],
        [-8, 16],
        [-14, 38],
      ],
      { strokeWidth: 0.8 },
    );
    p.curve(
      [
        [10, -36],
        [14, -40],
        [12, -44],
      ],
      { strokeWidth: 0.8 },
    );
  },
};

const SUN: DoodleRecipe = {
  w: 40,
  h: 40,
  draw(p) {
    p.circle(0, 0, 18, undefined, { stroke: C.sun, strokeWidth: 1.2 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      p.line(Math.cos(a) * 12, Math.sin(a) * 12, Math.cos(a) * 17, Math.sin(a) * 17, { stroke: C.sun, strokeWidth: 1 });
    }
  },
};

const DANDELION_SEED: DoodleRecipe = {
  w: 24,
  h: 30,
  draw(p) {
    p.line(0, 10, 0, -4, { strokeWidth: 0.8 });
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + ((i - 2.5) / 5) * 1.6;
      p.line(0, -4, Math.cos(a) * 8, -4 + Math.sin(a) * 8, { strokeWidth: 0.6 });
    }
  },
};

// --- Creatures ------------------------------------------------------------------

/** The kite's tail flutters: ball i swings this far sideways (the tip most;
 * within the chain layout's WIGGLE_PX). */
const tailFlutter = (i: number, t: number): number => Math.sin(TAU * t + i * 1.3) * Math.min(3, i * 1.4);

type KitePose = "fly" | "tumble";

/**
 * Kite: a magenta diamond with cross spars and a smile, its tail rising
 * behind it with an orange bow by each number. Flying, its string runs down
 * toward the kid holding it; tumbling, the snapped string whips about.
 */
const kiteDoodle = cached((key: `${number}:${KitePose}:${string}`) => {
  const [n, pose, wind] = key.split(":") as [string, KitePose, string];
  const L = BALL_LAYOUTS.chain;
  const balls = Number(n);
  const [phase, dir] = parseWind(wind);
  return {
    w: 2 * 48,
    h: 2 * (L.GAP * balls + 34),
    draw(p, t) {
      // The tail, through every number, with a bow beside each.
      const tail: Point[] = [[0, -4]];
      for (let i = 0; i < balls; i++) tail.push([tailFlutter(i, t), L.FIRST_Y - i * L.GAP]);
      const tip = L.FIRST_Y - (balls - 1) * L.GAP;
      tail.push([tailFlutter(balls, t) * 1.5, tip - 14]);
      p.curve(tail, { strokeWidth: 1 });
      for (let i = 0; i < balls; i++) {
        const [x, y] = [tailFlutter(i, t), L.FIRST_Y - i * L.GAP];
        for (const side of [-1, 1]) {
          p.shape(
            [
              [x + side * 10, y],
              [x + side * 17, y - 4],
              [x + side * 17, y + 4],
            ],
            C.bow,
            { fillStyle: "solid", strokeWidth: 0.8 },
          );
        }
      }
      const tilt = pose === "tumble" ? Math.sin(TAU * t) * 5 : 0;
      p.shape(
        [
          [tilt, -4],
          [17, 7 + tilt * 0.4],
          [-tilt, 25],
          [-17, 7 - tilt * 0.4],
        ],
        C.kite,
        { hachureGap: 2.2 },
      );
      p.line(tilt, -4, -tilt, 24, { stroke: C.kiteDark, strokeWidth: 1 }); // spars
      p.line(-17, 7 - tilt * 0.4, 17, 7 + tilt * 0.4, { stroke: C.kiteDark, strokeWidth: 1 });
      for (const side of [-1, 1]) p.dot(side * 4, 9, 1.2);
      if (pose === "fly") {
        p.curve(
          [
            [-1, 13],
            [0, 15],
            [1, 13],
          ],
          { strokeWidth: 0.9 },
        ); // a smile
        p.curve(
          [
            [-tilt, 24],
            [-4, 34],
            [-2, 44],
          ],
          { strokeWidth: 0.8 },
        ); // its string, down to the kid holding it
      } else {
        p.circle(0, 15, 4, undefined, { strokeWidth: 0.9 }); // "oh!"
        const whip = Math.sin(TAU * t) * 8;
        p.curve(
          [
            [-tilt, 24],
            [whip, 30],
            [-whip, 36],
          ],
          { strokeWidth: 0.8 },
        ); // the snapped string
      }
      windLines(p, phase, dir, 18, t);
    },
  };
});

const KITE_LOOK: CreatureLook = {
  variant: (a) => `${a.ballCount}:${a.mode === "dive" ? "tumble" : "fly"}:${windKey(a)}`,
  recipe: (a) => kiteDoodle(`${a.ballCount}:${a.mode === "dive" ? "tumble" : "fly"}:${windKey(a)}`),
  ballNudge: (i, t) => [tailFlutter(i, t), 0],
};

type SwallowPose = "fly" | "swoop";

/**
 * Swallow: a plum bird diving at you, big-headed, its two eyes its numbers;
 * a peach throat, long swept wings and a forked tail. Swooping on a gust it
 * spreads its wings flat and glides down with it.
 */
const swallowDoodle = cached((key: `${SwallowPose}:${string}`) => {
  const [pose, wind] = key.split(":") as [SwallowPose, string];
  const [phase, dir] = parseWind(wind);
  const E = BALL_LAYOUTS.eyes;
  return {
    w: 2 * 46,
    h: 2 * 40,
    draw(p, t) {
      const flap = pose === "fly" ? Math.sin(TAU * t) * 4 : 0;
      for (const side of [-1, 1]) {
        const wing: Point[] =
          pose === "swoop"
            ? [
                [side * 12, 0],
                [side * 42, -2],
                [side * 36, -10],
                [side * 12, -10],
              ]
            : [
                [side * 12, -2],
                [side * 36, -10 + flap],
                [side * 30, -18 + flap],
                [side * 12, -12],
              ];
        p.shape(wing, C.swallow, { hachureGap: 2, hachureAngle: side * 40 });
        // The forked tail.
        p.shape(
          [
            [0, -14],
            [side * 9, -32],
            [side * 3, -16],
          ],
          C.swallow,
          { fillStyle: "solid", strokeWidth: 0.9 },
        );
      }
      p.ellipse(0, -6, 20, 22, C.swallow, { hachureGap: 2 }); // back
      p.ellipse(0, E.EYE_Y, 44, 36, C.swallow, { hachureGap: 3.4 }); // the big head
      p.ellipse(0, E.EYE_Y + 14, 18, 10, C.throat, { fillStyle: "solid", strokeWidth: 0.8 });
      p.shape(
        [
          [-3, E.EYE_Y + 18],
          [3, E.EYE_Y + 18],
          [0, E.EYE_Y + 24],
        ],
        C.bow,
        { fillStyle: "solid", strokeWidth: 0.8 },
      ); // beak
      if (pose === "swoop") for (const x of [-16, 16]) p.line(x, -30, x, -42, { strokeWidth: 0.9 }); // speed lines
      windLines(p, phase, dir, 30, t);
    },
  };
});

const swallowPose = (a: Alien): SwallowPose => (a.ability instanceof Swoop && a.ability.swooping(a) ? "swoop" : "fly");

const SWALLOW: CreatureLook = {
  variant: (a) => `${swallowPose(a)}:${windKey(a)}`,
  recipe: (a) => swallowDoodle(`${swallowPose(a)}:${windKey(a)}`),
};

/**
 * Paper plane: a folded sheet of notebook paper, nose toward you, a number
 * on each wing. Nosing up it foreshortens; looping it shows its underside
 * with a curly loop arrow.
 */
const planeDoodle = cached((key: `${PlanePose}:${string}`) => {
  const [pose, wind] = key.split(":") as [PlanePose, string];
  const [phase, dir] = parseWind(wind);
  const W = BALL_LAYOUTS.wings;
  return {
    w: 2 * 50,
    h: 2 * 40,
    draw(p, t) {
      const nose = pose === "nose" ? 12 : pose === "glide" ? 26 : 20;
      const upside = pose === "up" || pose === "over";
      p.shape(
        [
          [0, nose],
          [32, -18],
          [0, -10],
          [-32, -18],
        ],
        upside ? C.plane : DOODLE.PAPER,
        upside ? { hachureGap: 2.8 } : { fillStyle: "solid" },
      );
      p.line(0, nose, 0, -10, { strokeWidth: 1.1 }); // the middle fold
      for (const side of [-1, 1]) {
        p.line(side * 4, nose - 6, side * 22, -14, { stroke: DOODLE.GRAPHITE_LIGHT, strokeWidth: 0.8 }); // wing folds
        p.line(side * (W.WING_DX + 6), W.WING_Y + 12, side * (W.WING_DX + 10), W.WING_Y + 16, { strokeWidth: 0.6 });
      }
      for (const y of [-14, -6, 2]) p.line(-24, y, -20, y + 1, { stroke: "rgba(120,150,190,0.5)", strokeWidth: 0.6 }); // notebook lines
      if (upside) {
        p.curve(
          [
            [-10, -26],
            [-4, -36],
            [6, -34],
            [8, -26],
          ],
          { strokeWidth: 1 },
        ); // the loop arrow
        p.line(8, -26, 4, -29, { strokeWidth: 1 });
      }
      if (pose === "nose") for (const x of [-8, 8]) p.line(x, nose + 6, x, nose + 12, { strokeWidth: 0.8 });
      windLines(p, phase, dir, 34, t);
    },
  };
});

const planePose = (a: Alien): PlanePose => (a.ability instanceof Loop ? a.ability.pose : "glide");

const PAPER_PLANE: CreatureLook = {
  variant: (a) => `${planePose(a)}:${windKey(a)}`,
  recipe: (a) => planeDoodle(`${planePose(a)}:${windKey(a)}`),
};

/** Hot-air balloon (the bonus): a striped balloon with its two numbers
 * painted on it, a little basket hanging under. */
const balloonDoodle = cached((wind: string) => {
  const [phase, dir] = parseWind(wind);
  return {
    w: 2 * 40,
    h: 2 * 40,
    draw(p, t) {
      const sway = Math.sin(TAU * t) * 1.5;
      p.ellipse(0, 2, 46, 44, C.balloon, { hachureGap: 3 });
      for (const x of [-12, 12]) {
        p.curve(
          [
            [x * 0.4, -19],
            [x, 2],
            [x * 0.4, 22],
          ],
          { stroke: C.balloonStripe, strokeWidth: 1.6 },
        );
      }
      for (const side of [-1, 1]) p.line(side * 8, 22, side * 5 + sway, 28, { strokeWidth: 0.8 }); // ropes
      p.shape(
        [
          [-6 + sway, 28],
          [6 + sway, 28],
          [5 + sway, 35],
          [-5 + sway, 35],
        ],
        C.basket,
        { hachureGap: 1.8 },
      );
      windLines(p, phase, dir, 26, t);
    },
  };
});

const BALLOON_LOOK: CreatureLook = {
  variant: windKey,
  recipe: (a) => balloonDoodle(windKey(a)),
};

// --- Boss: the STORM CLOUD -----------------------------------------------------

const CLOUD_PUFFS: Point[] = [
  [-56, 10],
  [-58, -8],
  [-44, -26],
  [-26, -38],
  [-6, -46],
  [16, -44],
  [34, -36],
  [52, -22],
  [58, -2],
  [52, 16],
  [30, 22],
  [0, 24],
  [-30, 22],
];

/** The storm: a big slate thundercloud with angry eyebrows and a frown, its
 * three numbers riding along its top, rain falling from its belly. */
const STORM_UP: DoodleRecipe = {
  w: 2 * 64,
  h: 2 * 56,
  draw(p, t) {
    const puff = Math.sin(TAU * t) * 1.5;
    p.shape(
      CLOUD_PUFFS.map(([x, y]) => [x * (1 + puff / 60), y] as Point),
      C.storm,
      { hachureGap: 2.6, hachureAngle: -30 },
    );
    for (const [x, y, d] of [
      [-36, -14, 30],
      [0, -26, 38],
      [34, -12, 30],
    ])
      p.circle(x, y, d, undefined, { stroke: C.stormDark, strokeWidth: 0.9 }); // inner puffs
    for (const side of [-1, 1]) {
      p.line(side * 22, -6, side * 8, 0, { strokeWidth: 2 }); // angry eyebrows
      p.paper(side * 14, 4, 9, { strokeWidth: 1 });
      p.dot(side * 13, 5, 1.6);
    }
    p.curve(
      [
        [-10, 16],
        [0, 11],
        [10, 16],
      ],
      { strokeWidth: 1.4 },
    ); // frown
    for (const x of [-38, -20, 22, 40]) {
      const y0 = 24 + ((t * 12 + x) % 6);
      p.line(x, y0, x - 3, y0 + 8, { stroke: C.rain, strokeWidth: 1 }); // rain
    }
  },
};

/** After an answer: lightning splits the cloud into two puffs with a bolt
 * crackling between them, and the wind blows it away. */
const STORM_SPLIT: DoodleRecipe = {
  w: 2 * 66,
  h: 2 * 56,
  draw(p, t) {
    const jolt = Math.sin(TAU * t) * 3;
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 8, 14],
          [side * 10, -20],
          [side * 26, -36],
          [side * 46, -30],
          [side * 58, -10],
          [side * 50, 12],
        ],
        C.storm,
        { hachureGap: 2.6 },
      );
      p.line(side * 26, -6, side * 34, -2, { strokeWidth: 1.6 }); // dizzy eyes
      p.line(side * 26, -2, side * 34, -6, { strokeWidth: 1.6 });
    }
    p.shape(
      [
        [-2 + jolt, -40],
        [8, -14],
        [0, -12],
        [6, 18],
        [-8, -8],
        [0, -10],
      ],
      C.bolt,
      { fillStyle: "solid", strokeWidth: 1 },
    );
  },
};

/** Under the field while the storm is up: rain falling from it (slanted by
 * the wind), and the lightning bolt when it thunders, with the page lit up. */
function drawStorm(ctx: CanvasRenderingContext2D, boss: Alien, alpha: number): void {
  if (!(boss.ability instanceof StormCloud)) return;
  const cloud = boss.ability;
  const x = boss.viewX(alpha);
  const y = boss.viewY(alpha);
  const slant = cloud.wind.phase === "gust" ? cloud.wind.dir * 10 : 2;
  const now = performance.now();
  ctx.save();
  ctx.strokeStyle = "rgba(122, 116, 170, 0.32)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 18; i++) {
    const rx = x - 50 + ((i * 37) % 100);
    const ry = y + 34 + ((now / 4 + i * 53) % 220);
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + slant * 0.6, ry + 10);
  }
  ctx.stroke();
  if (cloud.flashLeftMs > 0 && cloud.boltTo) {
    const k = cloud.flashLeftMs / STORM.FLASH_MS;
    ctx.fillStyle = `rgba(255, 248, 230, ${0.35 * k})`;
    ctx.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT); // the flash lights the page
    const [bx, by] = cloud.boltTo;
    ctx.strokeStyle = `rgba(232, 135, 58, ${k})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 22);
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const zig = i === steps ? 0 : (i % 2 ? 9 : -9);
      ctx.lineTo(x + (bx - x) * f + zig, y + 22 + (by - 24 - (y + 22)) * f);
    }
    ctx.stroke();
  }
  ctx.restore();
}

const STORM_LOOK: BossLook = { up: STORM_UP, hidden: STORM_SPLIT, under: drawStorm };

/** A raindrop out of the storm: a lavender drop with its two numbers inside
 * and a worried little face. */
const RAINDROP: DoodleRecipe = {
  w: 2 * 30,
  h: 2 * 42,
  draw(p, t) {
    const wob = Math.sin(TAU * t) * 1.2;
    p.shape(
      [
        [0, -36],
        [12, -20],
        [22 + wob, -4],
        [20, 10],
        [8, 20],
        [-8, 20],
        [-20, 10],
        [-22 - wob, -4],
        [-12, -20],
      ],
      C.rain,
      { hachureGap: 3, hachureAngle: 70 },
    );
    for (const side of [-1, 1]) p.dot(side * 4, 8, 1.2);
    p.curve(
      [
        [-3, 14],
        [0, 12],
        [3, 14],
      ],
      { strokeWidth: 0.9 },
    );
    p.curve(
      [
        [-12, -14],
        [-15, -6],
        [-14, 2],
      ],
      { stroke: DOODLE.PAPER, strokeWidth: 1.6 },
    ); // a shine
  },
};

/** A raindrop that splashed on the ship, rising back up as vapor. */
const VAPOR: DoodleRecipe = {
  w: 2 * 26,
  h: 2 * 30,
  draw(p, t) {
    for (const x of [-10, 0, 10]) {
      const w = Math.sin(TAU * t + x) * 3;
      p.curve(
        [
          [x, 18],
          [x + w, 6],
          [x - w, -6],
          [x + w, -18],
        ],
        { stroke: C.rain, strokeWidth: 1.3 },
      );
    }
  },
};

export const SKY_PAGE: PageDef = {
  paper: "#eef4f8",
  rule: "rgba(120, 150, 190, 0.26)",
  margin: "rgba(214, 84, 84, 0.3)",
  props: [
    { recipe: CLOUD, weight: 4 },
    { recipe: SWIRL, weight: 3 },
    { recipe: FAR_BIRDS, weight: 2 },
    { recipe: FAR_KITE, weight: 1 },
    { recipe: DANDELION_SEED, weight: 1.5 },
    { recipe: SUN, weight: 0.4 },
  ],
  propGap: 48,
  creatures: { kite: KITE_LOOK, swallow: SWALLOW, "paper plane": PAPER_PLANE, balloon: BALLOON_LOOK },
  bosses: { boss_storm: STORM_LOOK, boss_raindrop: { up: RAINDROP, hidden: VAPOR } },
};
