import { BALL_LAYOUTS, GAME } from "../../config/constants";
import { TROLL_LAMP } from "../../config/levels/cave";
import type Alien from "../../objects/Alien";
import { Roost } from "../../objects/caveTraits";
import { CaveTroll, LAMP_X, LAMP_Y } from "../../objects/caveTroll";
import type { BossLook, CreatureLook, PageDef } from "../pages";
import type { DoodleRecipe, Pencil, Point } from "../pencil";

/**
 * Level 5, THE DARK CAVE (config/levels/cave.ts): a grey stone page with
 * stalactites, rocks, crystals and drips; bats that hang upside down and
 * drop, glowworms on silk threads whose numbers glow on and off, a mine cart
 * whose wheels are its numbers, and the CAVE TROLL, read only in the beam of
 * a swinging lamp. "Dark" is a mood: the paper is mid-grey, so graphite still
 * reads, and the number balls stay filled with white paper.
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const C = {
  stone: "#6f6a62",
  crystal: "#8e5fc8",
  crystalTeal: "#3fa69a",
  drip: "#5d7f96",
  bat: "#5e4a74",
  batWing: "#7a6390",
  glow: "#4fc4b2",
  glowDark: "#3b3f4a",
  worm: "#a99d8a",
  cart: "#b06d38",
  rail: "#5a524a",
  troll: "#8a7f70",
  moss: "#3fa69a",
  tusk: "#efe6cf",
  star: "#e8873a",
  beam: "rgba(255, 246, 214, 0.5)",
  beamEdge: "rgba(51, 49, 46, 0.35)",
};

// --- Props --------------------------------------------------------------------

const STALACTITES: DoodleRecipe = {
  w: 50,
  h: 40,
  draw(p) {
    p.line(-22, -14, 22, -14, { stroke: C.stone, strokeWidth: 1.4 }); // the roof
    for (const [x, w, len] of [
      [-14, 10, 22],
      [0, 14, 30],
      [13, 9, 16],
    ]) {
      p.shape(
        [
          [x - w / 2, -14],
          [x + w / 2, -14],
          [x, -14 + len],
        ],
        C.stone,
        { hachureGap: 2.6 },
      );
    }
  },
};

const ROCKS: DoodleRecipe = {
  w: 40,
  h: 26,
  draw(p) {
    const big: Point[] = [
      [-16, 8],
      [-13, -4],
      [-3, -9],
      [6, -5],
      [8, 8],
    ];
    p.shape(big, C.stone, { hachureGap: 3, hachureAngle: 30 });
    p.shape(
      [
        [8, 8],
        [11, 0],
        [17, 1],
        [18, 8],
      ],
      undefined,
    );
  },
};

const CRYSTALS: DoodleRecipe = {
  w: 34,
  h: 36,
  draw(p) {
    for (const [x, lean, h, ink] of [
      [-7, -0.35, 22, C.crystal],
      [1, 0, 28, C.crystalTeal],
      [8, 0.4, 18, C.crystal],
    ] as const) {
      const tipX = x + Math.sin(lean) * h;
      const tipY = 14 - Math.cos(lean) * h;
      p.shape(
        [
          [x - 3, 14],
          [x + 3, 14],
          [tipX + 3, tipY + 4],
          [tipX, tipY],
          [tipX - 3, tipY + 4],
        ],
        ink,
        { hachureGap: 2.2 },
      );
    }
  },
};

const DRIP: DoodleRecipe = {
  w: 26,
  h: 34,
  draw(p) {
    p.curve(
      [
        [0, -12],
        [-4, -2],
        [0, 2],
        [4, -2],
        [0, -12],
      ],
      { stroke: C.drip, strokeWidth: 1.2 },
    );
    p.ellipse(0, 12, 18, 5, undefined, { stroke: C.drip, strokeWidth: 1 }); // the splash ring
  },
};

const MUSHROOMS: DoodleRecipe = {
  w: 30,
  h: 24,
  draw(p) {
    for (const [x, s] of [
      [-6, 1],
      [6, 0.7],
    ]) {
      p.line(x, 9, x, 9 - 9 * s, { strokeWidth: 1.1 });
      p.ellipse(x, 9 - 10 * s, 14 * s, 7 * s, C.crystalTeal, { hachureGap: 2 });
    }
  },
};

const WEB: DoodleRecipe = {
  w: 34,
  h: 34,
  draw(p) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      p.line(0, 0, Math.cos(a) * 14, Math.sin(a) * 14, { strokeWidth: 0.8 });
    }
    for (const r of [5, 10]) p.circle(0, 0, r * 2, undefined, { strokeWidth: 0.7, roughness: 1.8 });
  },
};

// --- Creatures ------------------------------------------------------------------

const W = BALL_LAYOUTS.wings;

/** Bat asleep (or waking), upside down: feet on the roof, each wing wrapped
 * round one of its numbers, its head at the bottom. */
function batHanging(awake: boolean): DoodleRecipe {
  return {
    w: 66,
    h: 56,
    draw(p) {
      p.line(-10, -25, 10, -25, { stroke: C.stone, strokeWidth: 1.6 }); // the roof it grips
      for (const side of [-1, 1]) {
        p.curve(
          [
            [side * 3, -24],
            [side * 4, -19],
            [side * 3, -15],
          ],
          { strokeWidth: 1.1 },
        ); // toes
        // A wrapped wing: a cocoon round its number ball.
        p.ellipse(side * W.WING_DX, W.WING_Y, 26, 32, C.batWing, { hachureGap: 2.4 });
      }
      p.ellipse(0, -2, 12, 28, C.bat, { hachureGap: 2 }); // body
      p.circle(0, 15, 15, C.bat, { hachureGap: 2 }); // head, upside down
      for (const side of [-1, 1]) {
        p.shape(
          [
            [side * 2, 20],
            [side * 6, 20],
            [side * 6, 26],
          ],
          C.bat,
        ); // ears, pointing down
        if (awake) p.dot(side * 3, 13, 1.6);
        else p.line(side * 1.5, 13, side * 5, 13, { strokeWidth: 1 }); // asleep
      }
    },
  };
}

/** A bat's wing: scalloped edge from its body out past its number ball. */
function batWing(p: Pencil, side: number, lift: number): void {
  const wing: Point[] = [
    [side * 5, -8],
    [side * 22, -18 - lift],
    [side * 32, -10 - lift],
    [side * 28, 2],
    [side * 22, -1],
    [side * 17, 6],
    [side * 11, 2],
    [side * 5, 6],
  ];
  p.shape(wing, C.batWing, { hachureGap: 2.6 });
}

/** Bat flying (in, or dropping): wings spread, a number ball on each. */
const BAT_FLYING: DoodleRecipe = {
  w: 70,
  h: 56,
  draw(p, t) {
    const lift = 4 * Math.sin(TAU * t);
    for (const side of [-1, 1]) batWing(p, side, lift);
    p.ellipse(0, -2, 12, 22, C.bat, { hachureGap: 2 }); // body
    p.circle(0, 11, 14, C.bat, { hachureGap: 2 }); // head, facing the player
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 2, 6],
          [side * 6, 6],
          [side * 6, 0],
        ],
        C.bat,
      ); // ears
      p.dot(side * 3, 12, 1.6);
    }
    p.line(-2, 16, -1, 18, { strokeWidth: 0.9 }); // fangs
    p.line(2, 16, 1, 18, { strokeWidth: 0.9 });
  },
};

const batPhase = (a: Alien) => (a.ability instanceof Roost ? a.ability.phase : "fly");

const BAT: CreatureLook = {
  variant: (a) => batPhase(a),
  recipe: (a) => {
    const phase = batPhase(a);
    return phase === "hang" || phase === "wake" ? batHanging(phase === "wake") : BAT_FLYING;
  },
};

const L = BALL_LAYOUTS.chain;
const THREAD_PX = 110;
const lit = (a: Alien) => (a.ability?.cover ?? 0) < 0.5;

/** Glowworm: a soft grub whose glowing segments are its numbers, hanging on
 * a silk thread. Lit: rays round each segment; dark: plain grey segments. */
function glowwormDoodle(balls: number, glowing: boolean): DoodleRecipe {
  const topBall = L.FIRST_Y - (balls - 1) * L.GAP;
  const top = -topBall + 12 + THREAD_PX;
  return {
    w: 44,
    h: 2 * Math.max(top, L.BOTTOM + 4),
    draw(p, t) {
      p.line(0, topBall - 10, 0, topBall - 10 - THREAD_PX, { strokeWidth: 0.7, roughness: 0.6 }); // silk
      for (const k of [0.3, 0.6]) p.dot(0, topBall - 10 - THREAD_PX * k, 1); // sticky drops
      for (let i = balls - 1; i >= 0; i--) {
        const y = L.FIRST_Y - i * L.GAP;
        if (glowing) {
          for (let r = 0; r < 6; r++) {
            const a = (r / 6) * TAU + t * 1.2 + i;
            p.line(Math.cos(a) * 14, y + Math.sin(a) * 14, Math.cos(a) * 18, y + Math.sin(a) * 18, {
              stroke: C.glow,
              strokeWidth: 1.4,
            });
          }
        }
        p.circle(0, y, 25, glowing ? C.glow : C.worm, { hachureGap: 2.2, hachureAngle: 60 });
      }
      p.circle(0, 6, 16, C.worm, { hachureGap: 2.4 }); // head
      for (const side of [-1, 1]) p.dot(side * 3, 7, 1.3);
    },
  };
}

const GLOWWORM: CreatureLook = {
  variant: (a) => `${a.ballCount}:${lit(a) ? "lit" : "dark"}`,
  recipe: (a) => glowwormDoodle(a.ballCount, lit(a)),
  coverInk: C.glowDark,
};

const E = BALL_LAYOUTS.eyes;

/** Mine cart on its rails: its two wheels are its numbers. */
const MINECART: DoodleRecipe = {
  w: 72,
  h: 50,
  draw(p, t) {
    const railY = E.EYE_Y + 10;
    p.line(-34, railY, 34, railY, { stroke: C.rail, strokeWidth: 1.6 });
    for (let x = -30; x <= 30; x += 12) {
      const shift = ((t * 12) % 12) - 6; // the ties roll by
      p.line(x + shift - 2, railY + 4, x + shift + 2, railY - 1, { stroke: C.rail, strokeWidth: 1.1 });
    }
    p.shape(
      [
        [-22, -14],
        [22, -14],
        [17, 4],
        [-17, 4],
      ],
      C.cart,
      { hachureGap: 2.4 },
    );
    p.line(-20, -8, 20, -8, { strokeWidth: 1 }); // a plank
    // A load of rocks and a crystal.
    p.ellipse(-8, -16, 14, 8, C.stone, { hachureGap: 2.4 });
    p.ellipse(5, -17, 12, 7, C.stone, { hachureGap: 2.4 });
    p.shape(
      [
        [12, -14],
        [14, -24],
        [17, -14],
      ],
      C.crystal,
    );
    p.line(-E.EYE_DX, E.EYE_Y, E.EYE_DX, E.EYE_Y, { strokeWidth: 1.4 }); // the axle
  },
};

const MINECART_LOOK: CreatureLook = {
  variant: () => "cart",
  recipe: () => MINECART,
};

// --- Boss: the CAVE TROLL --------------------------------------------------------

/** A hulking stone troll facing the player: mossy shoulders, a big nose,
 * tusks, knuckles on the ground. Its numbers ride above its head. */
const TROLL: DoodleRecipe = {
  w: 112,
  h: 100,
  draw(p, t) {
    const sway = Math.sin(TAU * t) * 2;
    for (const side of [-1, 1]) {
      p.ellipse(side * 38, 18 + sway * side, 22, 34, C.troll, { hachureGap: 2.4 }); // arm
      p.circle(side * 40, 36 + sway * side, 16, C.troll, { hachureGap: 2 }); // fist
      for (const k of [-1, 0, 1]) p.line(side * 40 + k * 4, 32 + sway * side, side * 40 + k * 4, 36 + sway * side);
    }
    p.ellipse(0, 6, 76, 70, C.troll, { hachureGap: 2.2 }); // body
    for (const [x, y] of [
      [-22, -14],
      [20, -18],
      [-10, -24],
    ])
      p.ellipse(x, y, 12, 7, C.moss, { hachureGap: 1.8 }); // moss
    p.circle(0, -6, 40, C.troll, { hachureGap: 2.6, hachureAngle: 30 }); // head
    p.line(-13, -15, -4, -12, { strokeWidth: 1.8 }); // heavy brows
    p.line(13, -15, 4, -12, { strokeWidth: 1.8 });
    for (const side of [-1, 1]) p.dot(side * 8, -9, 2);
    p.ellipse(0, -2, 12, 14, C.troll, { hachureGap: 1.8 }); // nose
    p.curve(
      [
        [-10, 8],
        [0, 12],
        [10, 8],
      ],
      { strokeWidth: 1.4 },
    ); // grumpy mouth
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 6, 9],
          [side * 10, 8],
          [side * 9, 2],
        ],
        C.tusk,
        { fillStyle: "solid", strokeWidth: 1 },
      ); // tusks
    }
  },
};

/** The troll staggering off after an answer: hunched, seeing stars. */
const TROLL_STAGGER: DoodleRecipe = {
  w: 112,
  h: 100,
  draw(p, t) {
    p.ellipse(0, 10, 76, 60, C.troll, { hachureGap: 3, hachureAngle: 20 });
    p.circle(0, 2, 36, C.troll, { hachureGap: 2.8 });
    for (const side of [-1, 1]) {
      p.line(side * 10, -2, side * 4, 4, { strokeWidth: 1.6 }); // X eyes
      p.line(side * 4, -2, side * 10, 4, { strokeWidth: 1.6 });
    }
    for (let i = 0; i < 3; i++) {
      const a = TAU * (t + i / 3);
      const x = Math.cos(a) * 22;
      const y = -26 + Math.sin(a) * 6;
      p.shape(
        [
          [x, y - 4],
          [x + 1.5, y - 1],
          [x + 4, y],
          [x + 1.5, y + 1],
          [x, y + 4],
          [x - 1.5, y + 1],
          [x - 4, y],
          [x - 1.5, y - 1],
        ],
        C.star,
        { fillStyle: "solid", strokeWidth: 0.8 },
      );
    }
  },
};

/** The lamp's beam: a cone of light from above the page, swinging. */
function drawBeam(ctx: CanvasRenderingContext2D, boss: Alien): void {
  if (!(boss.ability instanceof CaveTroll)) return;
  const reach = GAME.HEIGHT * 1.6;
  const cone = TROLL_LAMP.CONE_DEG * DEG;
  const a = boss.ability.beamAngle;
  const at = (k: number): [number, number] => [LAMP_X + Math.sin(a + k) * reach, LAMP_Y + Math.cos(a + k) * reach];
  const [lx, ly] = at(-cone);
  const [rx, ry] = at(cone);
  ctx.save();
  ctx.fillStyle = C.beam;
  ctx.beginPath();
  ctx.moveTo(LAMP_X, LAMP_Y);
  ctx.lineTo(lx, ly);
  ctx.lineTo(rx, ry);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.beamEdge;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([7, 6]);
  for (const [x, y] of [
    [lx, ly],
    [rx, ry],
  ]) {
    ctx.beginPath();
    ctx.moveTo(LAMP_X, LAMP_Y);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();
}

const TROLL_LOOK: BossLook = { up: TROLL, hidden: TROLL_STAGGER, under: drawBeam };

export const CAVE_PAGE: PageDef = {
  paper: "#c9c4b9",
  rule: "rgba(70, 80, 100, 0.22)",
  margin: "rgba(150, 70, 70, 0.3)",
  props: [
    { recipe: STALACTITES, weight: 3 },
    { recipe: ROCKS, weight: 3 },
    { recipe: CRYSTALS, weight: 2 },
    { recipe: DRIP, weight: 2 },
    { recipe: MUSHROOMS, weight: 1.2 },
    { recipe: WEB, weight: 1 },
  ],
  propGap: 50,
  creatures: { bat: BAT, glowworm: GLOWWORM, minecart: MINECART_LOOK },
  bosses: { boss_troll: TROLL_LOOK },
};
