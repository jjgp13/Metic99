import { BALL_LAYOUTS, DOODLE } from "../../config/constants";
import { SNOWBALL_GROW } from "../../config/levels/snow";
import type Alien from "../../objects/Alien";
import { IceSlide, PenguinSlide, SnowballGrow, SnowflakeGust, slopeProgress, type PenguinPhase } from "../../objects/snowTraits";
import { Yeti } from "../../objects/yeti";
import type { BossLook, CreatureLook, PageDef } from "../pages";
import type { DoodleRecipe, Point } from "../pencil";

/**
 * Level 8, THE SNOWY MOUNTAIN (config/levels/snow.ts): cold white paper
 * with faint snowflakes, pine trees, snowy rocks, peaks and ski tracks;
 * penguins whose white bellies hold their numbers, snowballs with numbers
 * stuck in them, ice blocks with numbers frozen inside, a snowflake whose
 * eyes are its numbers, and the YETI. Snow and ice are drawn in slate,
 * frost grey and teal: the sum balls are blue (docs/ART_SPEC.md §4), so a
 * blue creature would compete with its own numbers.
 */

const TAU = Math.PI * 2;
const C = {
  slate: "#6d7f94",
  frost: "#a9b6c4",
  ice: "#7fb8b4",
  pine: "#56705f",
  bark: "#7a5a3c",
  rock: "#7d746c",
  beak: "#e8873a",
  fur: "#9aa5b1",
  face: "#6e5a73",
  tuxedo: "#3d3b45",
};

// --- Props --------------------------------------------------------------------

/** Turns slowly: one arm's gap per loop, so the loop is seamless. */
const SNOWFLAKE_PROP: DoodleRecipe = {
  w: 30,
  h: 30,
  draw(p, t) {
    for (let i = 0; i < 6; i++) {
      const a = ((i + t) / 6) * TAU;
      const [x, y] = [Math.cos(a) * 11, Math.sin(a) * 11];
      p.line(0, 0, x, y, { stroke: C.slate, strokeWidth: 1 });
      p.line(x * 0.6, y * 0.6, x * 0.6 + Math.cos(a + 0.9) * 4, y * 0.6 + Math.sin(a + 0.9) * 4, {
        stroke: C.slate,
        strokeWidth: 0.8,
      });
    }
  },
};

const PINE: DoodleRecipe = {
  w: 40,
  h: 54,
  draw(p) {
    p.line(0, 14, 0, 22, { stroke: C.bark, strokeWidth: 2.4 });
    for (const [y, half] of [
      [14, 16],
      [2, 13],
      [-10, 9],
    ]) {
      p.shape(
        [
          [-half, y],
          [0, y - 16],
          [half, y],
        ],
        C.pine,
        { hachureGap: 2.8 },
      );
      p.curve(
        [
          [-half * 0.5, y - 8],
          [0, y - 14],
          [half * 0.5, y - 8],
        ],
        { strokeWidth: 0.9 },
      ); // snow on the branches
    }
  },
};

const SNOWY_ROCK: DoodleRecipe = {
  w: 36,
  h: 26,
  draw(p) {
    p.shape(
      [
        [-14, 8],
        [-11, -3],
        [-3, -8],
        [8, -6],
        [14, 7],
      ],
      C.rock,
      { hachureGap: 2.6 },
    );
    p.shape(
      [
        [-11, -3],
        [-3, -8],
        [8, -6],
        [5, -2],
        [-4, -3],
      ],
      DOODLE.PAPER,
      { fillStyle: "solid", strokeWidth: 0.9 },
    ); // its snow cap
  },
};

const SKI_TRACKS: DoodleRecipe = {
  w: 40,
  h: 60,
  draw(p) {
    for (const dx of [-3, 3]) {
      p.curve(
        [
          [dx - 8, -26],
          [dx + 6, -10],
          [dx - 6, 8],
          [dx + 8, 26],
        ],
        { stroke: C.frost, strokeWidth: 1 },
      );
    }
  },
};

const PEAK: DoodleRecipe = {
  w: 60,
  h: 40,
  draw(p) {
    p.shape(
      [
        [-26, 14],
        [-6, -14],
        [4, -4],
        [10, -10],
        [26, 14],
      ],
      C.slate,
      { hachureGap: 3.4, hachureAngle: 60 },
    );
    p.shape(
      [
        [-12, -6],
        [-6, -14],
        [0, -8],
        [-5, -5],
      ],
      DOODLE.PAPER,
      { fillStyle: "solid", strokeWidth: 0.9 },
    ); // snowy top
  },
};

/** A snowdrift with powder blowing off its crest. */
const DRIFT: DoodleRecipe = {
  w: 56,
  h: 22,
  draw(p, t) {
    p.curve(
      [
        [-22, 6],
        [-12, -2],
        [-2, 2],
        [8, -5],
        [22, 5],
      ],
      { stroke: C.frost, strokeWidth: 1.2 },
    );
    for (const [x, y] of [
      [-10, -2],
      [6, -6],
      [16, -1],
    ])
      p.dot(x + t * 8, y - t * 2, 0.9, C.frost);
  },
};

// --- Drifts (renderDoodle/drifts.ts) ------------------------------------------

/** A snowflake far away: just a soft dot. */
const FLAKE_DOT: DoodleRecipe = {
  w: 6,
  h: 6,
  draw(p) {
    p.circle(0, 0, 5, C.frost, { fillStyle: "solid", stroke: C.slate, strokeWidth: 0.8 });
  },
};

/** A snowflake up close: a little six-armed star. */
const FLAKE_STAR: DoodleRecipe = {
  w: 14,
  h: 14,
  draw(p) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      p.line(-Math.cos(a) * 5, -Math.sin(a) * 5, Math.cos(a) * 5, Math.sin(a) * 5, {
        stroke: C.slate,
        strokeWidth: 1.1,
        roughness: 0.5,
      });
    }
  },
};

// --- Creatures ------------------------------------------------------------------

const penguinPhase = (a: Alien): PenguinPhase => (a.ability instanceof PenguinSlide ? a.ability.phase : "waddle");

/**
 * Penguin, waddling down the page head first: its two numbers sit on its
 * white belly (the chain layout), an orange beak and feet below. Before a
 * slide it crouches with its flippers swept back ("warn"), then lies flat
 * and shoots forward with its flippers out ("slide").
 */
function penguinDoodle(phase: PenguinPhase): DoodleRecipe {
  const L = BALL_LAYOUTS.chain;
  const midY = L.FIRST_Y - L.GAP / 2;
  const long = phase === "slide" ? 1.15 : 1;
  const crouch = phase === "warn" ? 0.92 : 1;
  return {
    w: 60,
    h: 2 * 56,
    draw(p, t) {
      const step = Math.sin(TAU * t) * 3;
      if (phase === "slide") {
        for (const x of [-8, 0, 8]) p.line(x, midY - 32, x, midY - 38, { stroke: C.frost, strokeWidth: 1 }); // snow spray
      } else {
        for (const side of [-1, 1]) {
          p.ellipse(side * 6, 17 + (phase === "waddle" ? side * step : 0), 7, 5, C.beak, { fillStyle: "solid", strokeWidth: 0.8 });
        }
      }
      // Flippers: hanging (waddle), swept back (warn), out to the sides (slide).
      for (const side of [-1, 1]) {
        const tip: Point =
          phase === "slide" ? [side * 26, midY + 2] : phase === "warn" ? [side * 20, midY - 22] : [side * 19, midY + 8 + side * step];
        p.shape(
          [
            [side * 12, midY - 10],
            tip,
            [side * 12, midY + 6],
          ],
          C.tuxedo,
          { fillStyle: "solid", strokeWidth: 0.9 },
        );
      }
      p.ellipse(0, midY, 30 * crouch, 50 * long, C.tuxedo, { hachureGap: 1.6 });
      p.ellipse(0, midY, 22 * crouch, 42 * long, DOODLE.PAPER, { fillStyle: "solid", strokeWidth: 0.8 }); // belly
      p.circle(0, 9, 18, C.tuxedo, { fillStyle: "solid" }); // head
      for (const side of [-1, 1]) p.paper(side * 4, 8, 5, { strokeWidth: 0.6 });
      for (const side of [-1, 1]) p.dot(side * 4, 8.5, 1);
      p.shape(
        [
          [-3, 13],
          [0, 20],
          [3, 13],
        ],
        C.beak,
        { fillStyle: "solid", strokeWidth: 0.8 },
      );
    },
  };
}

const PENGUIN: CreatureLook = {
  variant: (a) => penguinPhase(a),
  recipe: (a) => penguinDoodle(penguinPhase(a)),
};

/** A snowball's size: 0..2 while it rolls toward the grow line, 3 once grown. */
function snowballSize(a: Alien): number {
  if (a.ability instanceof SnowballGrow && a.ability.grown) return 3;
  const p = (a.y - 100) / (SNOWBALL_GROW.GROW_Y - 100);
  return Math.max(0, Math.min(2, Math.floor(p * 3)));
}

/**
 * Snowball: a ball of snow with its numbers stuck in it and two coal eyes,
 * rolling down (its roll lines turn as the frames go round). It swells as it
 * nears the line where it picks up a number, and is biggest once it has.
 */
function snowballDoodle(size: number): DoodleRecipe {
  const d = [38, 44, 50, 66][size];
  const cy = -12;
  return {
    w: 76,
    h: 2 * 46,
    draw(p, t) {
      p.circle(0, cy, d, C.frost, { hachureGap: 3.2, hachureAngle: 20 });
      for (let i = 0; i < 3; i++) {
        const a = TAU * (t / 3 + i / 3);
        const r = d * 0.38;
        p.curve(
          [
            [Math.cos(a) * r, cy + Math.sin(a) * r],
            [Math.cos(a + 0.4) * (r + 2), cy + Math.sin(a + 0.4) * (r + 2)],
            [Math.cos(a + 0.8) * r, cy + Math.sin(a + 0.8) * r],
          ],
          { stroke: C.slate, strokeWidth: 0.9 },
        ); // it's rolling
      }
      for (const side of [-1, 1]) p.dot(side * 6, cy + d * 0.36, 1.6); // coal eyes, under the numbers
      if (size === 3) for (const side of [-1, 1]) p.dot(side * 24, cy - 22, 1.2, C.slate); // snow flying off
    },
  };
}

const SNOWBALL: CreatureLook = {
  variant: (a) => `s${snowballSize(a)}`,
  recipe: (a) => snowballDoodle(snowballSize(a)),
};

const iceFast = (a: Alien) => a.ability instanceof IceSlide && slopeProgress(a) > 0.55;

/**
 * Ice block: a cube of ice with its numbers frozen inside, a worried face and
 * little feet. Low on the slope (going fast) it has speed lines and sweat.
 */
function iceDoodle(fast: boolean): DoodleRecipe {
  return {
    w: 80,
    h: 2 * 46,
    draw(p, t) {
      if (fast) for (const x of [-20, -6, 8, 22]) p.line(x, -34, x, -44, { stroke: C.slate, strokeWidth: 1 });
      const step = Math.sin(TAU * t) * 2;
      for (const side of [-1, 1]) p.ellipse(side * 14, 16 + side * step, 12, 7, C.slate, { hachureGap: 2 });
      p.shape(
        [
          [-31, -30],
          [31, -31],
          [32, 12],
          [-32, 13],
        ],
        C.ice,
        { hachureGap: 3.4, hachureAngle: 60 },
      );
      p.line(-26, -26, -18, -26, { strokeWidth: 1.4 }); // shine
      p.line(-27, -22, -27, -14, { strokeWidth: 1.4 });
      for (const side of [-1, 1]) p.dot(side * 8, 1, 1.6);
      p.curve(
        fast
          ? [
              [-5, 9],
              [0, 6],
              [5, 9],
            ]
          : [
              [-5, 7],
              [0, 9],
              [5, 7],
            ],
        { strokeWidth: 1 },
      ); // worried when it's fast, smug while slow
      if (fast) p.dot(22, 0, 1.6, C.slate); // a sweat drop
    },
  };
}

const ICE_SLOW = iceDoodle(false);
const ICE_FAST = iceDoodle(true);

const ICE_BLOCK: CreatureLook = {
  variant: (a) => (iceFast(a) ? "fast" : "slow"),
  recipe: (a) => (iceFast(a) ? ICE_FAST : ICE_SLOW),
};

const gusting = (a: Alien) => a.ability instanceof SnowflakeGust && a.ability.gusting;

/** Snowflake: six branching arms around its two eye-numbers and a smile;
 * in a gust it turns and wind lines blow past it. */
function snowflakeDoodle(gust: boolean): DoodleRecipe {
  const E = BALL_LAYOUTS.eyes;
  return {
    w: 2 * 36,
    h: 2 * 34,
    draw(p, t) {
      const turn = gust ? TAU * t * 0.15 : 0;
      for (let i = 0; i < 6; i++) {
        const a = turn + (i / 6) * TAU + Math.PI / 6;
        const [x, y] = [Math.cos(a) * 26, E.EYE_Y + Math.sin(a) * 24];
        p.line(Math.cos(a) * 12, E.EYE_Y + Math.sin(a) * 11, x, y, { stroke: C.slate, strokeWidth: 1.5 });
        for (const k of [-1, 1]) {
          const bx = Math.cos(a) * 20;
          const by = E.EYE_Y + Math.sin(a) * 18;
          p.line(bx, by, bx + Math.cos(a + k * 0.8) * 6, by + Math.sin(a + k * 0.8) * 6, {
            stroke: C.slate,
            strokeWidth: 1,
          });
        }
      }
      p.curve(
        [
          [-4, E.EYE_Y + 11],
          [0, E.EYE_Y + 13],
          [4, E.EYE_Y + 11],
        ],
        { strokeWidth: 1 },
      );
      if (gust) {
        for (const y of [-14, 0, 14]) p.curve([[-34, y], [-26, y - 3], [-18, y]], { stroke: C.frost, strokeWidth: 1 });
      }
    },
  };
}

const FLAKE_CALM = snowflakeDoodle(false);
const FLAKE_GUST = snowflakeDoodle(true);

const SNOWFLAKE: CreatureLook = {
  variant: (a) => (gusting(a) ? "gust" : "calm"),
  recipe: (a) => (gusting(a) ? FLAKE_GUST : FLAKE_CALM),
};

// --- Boss: the YETI ---------------------------------------------------------------

/** A shaggy yeti facing the player: a big fur body (its three numbers ride
 * in a row on its shoulders), long arms with fists, horns, a plum face with
 * a fanged grin, and big feet. */
const YETI: DoodleRecipe = {
  w: 124,
  h: 2 * 66,
  draw(p, t) {
    const sway = Math.sin(TAU * t) * 2;
    // A jagged fur outline: points around an oval, every other one pushed out.
    const fur: Point[] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const r = i % 2 === 0 ? 1 : 1.12;
      fur.push([Math.cos(a) * 36 * r, -10 + Math.sin(a) * 42 * r]);
    }
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 30, -26],
          [side * 50, -6 + sway * side],
          [side * 52, 20 + sway * side],
          [side * 40, 22],
          [side * 34, 0],
        ],
        C.fur,
        { hachureGap: 2.6, hachureAngle: side * 50 },
      ); // arms
      p.circle(side * 47, 26 + sway * side, 16, C.fur, { hachureGap: 1.8 }); // fists
      p.ellipse(side * 16, 34, 22, 14, C.fur, { hachureGap: 2 }); // feet
    }
    p.shape(fur, C.fur, { hachureGap: 2.4, hachureAngle: 70 });
    p.ellipse(0, 12, 40, 30, C.face, { hachureGap: 2 }); // face
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 14, -2],
          [side * 26, -16],
          [side * 20, 0],
        ],
        DOODLE.PAPER,
        { fillStyle: "solid", strokeWidth: 1 },
      ); // horns
      p.paper(side * 8, 6, 9, { strokeWidth: 1 });
      p.dot(side * 8, 7, 1.7);
    }
    p.curve(
      [
        [-11, 18],
        [0, 24],
        [11, 18],
      ],
      { strokeWidth: 1.4 },
    ); // grin
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 7, 19],
          [side * 5, 25],
          [side * 3, 20],
        ],
        DOODLE.PAPER,
        { fillStyle: "solid", strokeWidth: 0.8 },
      ); // fangs
    }
  },
};

/** Tunneling through the snow: a moving drift with its horns poking out and
 * snow flying up. */
const YETI_DRIFT: DoodleRecipe = {
  w: 110,
  h: 2 * 44,
  draw(p, t) {
    const puff = Math.sin(TAU * t) * 3;
    p.curve(
      [
        [-46, 16],
        [-24, -6],
        [0, -12],
        [24, -6],
        [46, 16],
      ],
      { strokeWidth: 1.6 },
    );
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 6, -10],
          [side * 16, -24],
          [side * 12, -8],
        ],
        DOODLE.PAPER,
        { fillStyle: "solid", strokeWidth: 1 },
      ); // horns poking out
    }
    for (const [x, y, d] of [
      [-30, -22, 14],
      [28, -24, 12],
      [0, -34, 16],
    ])
      p.circle(x + puff, y - puff, d, undefined, { stroke: C.frost }); // snow flying up
  },
};

/** The stomp: rings of shaking snow spread out from its feet, under everything. */
function drawStomp(ctx: CanvasRenderingContext2D, boss: Alien, alpha: number): void {
  if (!(boss.ability instanceof Yeti) || !boss.ability.stomping) return;
  const x = boss.viewX(alpha);
  const y = boss.viewY(alpha) + 34;
  const wobble = performance.now() / 60;
  ctx.save();
  ctx.strokeStyle = C.slate;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([6, 5]);
  for (const k of [1, 1.6, 2.2]) {
    ctx.beginPath();
    ctx.ellipse(x, y, 40 * k + Math.sin(wobble + k) * 3, 12 * k, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

const YETI_LOOK: BossLook = { up: YETI, hidden: YETI_DRIFT, under: drawStomp };

export const SNOW_PAGE: PageDef = {
  paper: "#eef2f6",
  rule: "rgba(110, 130, 160, 0.24)",
  margin: "rgba(214, 84, 84, 0.3)",
  props: [
    { recipe: SNOWFLAKE_PROP, weight: 3, fps: 1 },
    { recipe: PINE, weight: 2.5 },
    { recipe: SNOWY_ROCK, weight: 2 },
    { recipe: SKI_TRACKS, weight: 1.5 },
    { recipe: PEAK, weight: 1 },
    { recipe: DRIFT, weight: 2, fps: 3 },
  ],
  propGap: 46,
  drifts: [
    { recipe: FLAKE_DOT, count: 10, vx: -4, vy: 22, swayPx: 10, swayHz: 0.2 },
    { recipe: FLAKE_STAR, count: 5, vx: -6, vy: 16, swayPx: 14, swayHz: 0.15, spinPerS: 0.6 },
  ],
  creatures: { penguin: PENGUIN, snowball: SNOWBALL, "ice block": ICE_BLOCK, snowflake: SNOWFLAKE },
  bosses: { boss_yeti: YETI_LOOK },
};
