import { DOODLE, ENEMY } from "../config/constants";
import type { DoodleRecipe, Pencil, Point } from "./pencil";

/**
 * The doodles, one short recipe each (the 2D cousins of art/blender/recipes).
 * Screen directions: +y is down, aliens face down (toward the player) and
 * the ship's nose points up. Body sizes follow each monster's readability
 * box (MONSTERS in config/tuning/monsters.ts), so the balls still sit right.
 */

const TAU = Math.PI * 2;
const INK = DOODLE.INK;

/** Mirror a list of points across the vertical axis (x → -x). */
const mirror = (points: Point[]): Point[] => points.map(([x, y]) => [-x, y]);

/** Two eyes looking down at the player. */
function eyes(p: Pencil, dx: number, y: number, size: number): void {
  for (const side of [-1, 1]) {
    p.paper(side * dx, y, size);
    p.dot(side * dx, y + size * 0.18, size * 0.2);
  }
}

export const SHIP: DoodleRecipe = {
  w: 48,
  h: 52,
  draw(p, t) {
    // Flames first, so the hull covers their roots; they flicker every frame.
    for (const side of [-1, 1]) {
      const len = 7 + 4 * Math.abs(Math.sin(TAU * t * 2 + side));
      p.curve(
        [
          [side * 5, 11],
          [side * 5 + 2, 13 + len / 2],
          [side * 5, 13 + len],
        ],
        { stroke: INK.darter, strokeWidth: 1.6 },
      );
    }
    for (const side of [-1, 1]) {
      const wing: Point[] = [
        [6, -2],
        [19, 9],
        [18, 14],
        [6, 9],
      ];
      p.shape(side > 0 ? wing : mirror(wing), INK.ship);
    }
    p.shape(
      [
        [0, -20],
        [6, -7],
        [7, 9],
        [0, 13],
        [-7, 9],
        [-6, -7],
      ],
      INK.ship,
      { hachureAngle: 50 },
    );
    p.ellipse(0, -5, 6, 10, undefined, { stroke: INK.swooper, strokeWidth: 1.4 });
  },
};

/** Darter: a small fast kite with a wagging tail. */
export const DARTER: DoodleRecipe = {
  w: 40,
  h: 56,
  draw(p, t) {
    const wag = Math.sin(TAU * t);
    p.curve(
      [
        [0, -9],
        [wag * 4, -17],
        [wag * 8, -24],
      ],
      { strokeWidth: 1.5 },
    );
    for (const side of [-1, 1]) {
      const fin: Point[] = [
        [9, -4],
        [17, -10],
        [13, 2],
      ];
      p.shape(side > 0 ? fin : mirror(fin), INK.darter);
    }
    p.shape(
      [
        [0, 19],
        [13, -1],
        [6, -12],
        [0, -9],
        [-6, -12],
        [-13, -1],
      ],
      INK.darter,
    );
    eyes(p, 5, 3, 7);
    p.line(-3, 11, 0, 14, { strokeWidth: 1 });
    p.line(0, 14, 3, 11, { strokeWidth: 1 });
  },
};

/** Lumberer: a big round stomper on stubby legs, plated back. */
export const LUMBERER: DoodleRecipe = {
  w: 66,
  h: 66,
  draw(p, t) {
    const swing = Math.sin(TAU * t) * 2.5;
    for (const side of [-1, 1]) {
      p.ellipse(side * 19, 19 + swing * side, 11, 13, INK.lumberer);
      p.ellipse(side * 9, 24 - swing * side, 10, 12, INK.lumberer);
    }
    p.circle(0, -1, 48, INK.lumberer);
    for (const y of [-20, -13]) {
      p.curve(
        [
          [-15, y + 4],
          [0, y - 3],
          [15, y + 4],
        ],
        { strokeWidth: 1.1 },
      );
    }
    eyes(p, 9, 2, 10);
    p.curve(
      [
        [-11, 12],
        [0, 17],
        [11, 12],
      ],
      { strokeWidth: 1.3 },
    );
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 4, 14.5],
          [side * 7, 15.5],
          [side * 5.5, 19],
        ],
        DOODLE.PAPER,
        { fillStyle: "solid", strokeWidth: 0.9 },
      );
    }
  },
};

/** Strafer: a wasp with wide flapping wings. */
export const STRAFER: DoodleRecipe = {
  w: 60,
  h: 52,
  draw(p, t) {
    const flap = 0.7 + 0.3 * Math.abs(Math.cos(TAU * t * 2));
    for (const side of [-1, 1]) {
      const hind: Point[] = [
        [4, 2],
        [4 + 15 * flap, 8],
        [4 + 12 * flap, 13],
        [4, 7],
      ];
      p.shape(side > 0 ? hind : mirror(hind), INK.drifter, { hachureGap: 3 });
      const fore: Point[] = [
        [4, -5],
        [4 + 19 * flap, -15],
        [4 + 22 * flap, -6],
        [4 + 10 * flap, 1],
      ];
      p.shape(side > 0 ? fore : mirror(fore), DOODLE.GRAPHITE_LIGHT, { hachureGap: 3.5, fillWeight: 0.6 });
    }
    p.ellipse(0, -4, 14, 28, INK.strafer);
    p.line(-6, -9, 6, -9, { strokeWidth: 1.8 });
    p.line(-6, -3, 6, -3, { strokeWidth: 1.8 });
    p.line(0, -18, 0, -23, { strokeWidth: 1.3 }); // stinger
    p.circle(0, 12, 13, INK.strafer);
    p.dot(-3, 14, 1.8, INK.swooper);
    p.dot(3, 14, 1.8, INK.swooper);
  },
};

/** Swooper: a manta ray whose wingtips beat up and down. */
export const SWOOPER: DoodleRecipe = {
  w: 48,
  h: 50,
  draw(p, t) {
    const tip = -2 + 4 * Math.sin(TAU * t);
    const wag = Math.sin(TAU * t + 1);
    p.curve(
      [
        [0, -9],
        [wag * 3, -16],
        [wag * 5, -22],
      ],
      { strokeWidth: 1.2 },
    );
    p.shape(
      [
        [0, 14],
        [8, 6],
        [19, tip],
        [8, -8],
        [0, -10],
        [-8, -8],
        [-19, tip],
        [-8, 6],
      ],
      INK.swooper,
    );
    for (const side of [-1, 1]) {
      p.curve(
        [
          [side * 3, 13],
          [side * 6, 18],
          [side * 3, 20],
        ],
        { stroke: INK.darter, strokeWidth: 1.8 },
      );
    }
    eyes(p, 5, 4, 6);
  },
};

/** Drifter (bonus): a jellyfish trailing wavy tentacles. */
export const DRIFTER: DoodleRecipe = {
  w: 60,
  h: 62,
  draw(p, t) {
    for (let i = 0; i < 5; i++) {
      const x = -16 + i * 8;
      const wave = Math.sin(TAU * t + i) * 3;
      p.curve(
        [
          [x, 2],
          [x + wave, 11],
          [x - wave, 19],
          [x + wave, 26],
        ],
        { stroke: INK.drifter, strokeWidth: 1.4 },
      );
    }
    const dome: Point[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      dome.push([Math.cos(a) * 23, Math.sin(a) * 19 + 3]);
    }
    p.shape(dome, INK.drifter);
    eyes(p, 7, -6, 8);
  },
};

/** Any monster without its own doodle yet: a round blob with antennae. */
export function blob(halfW: number, ink: string): DoodleRecipe {
  const r = Math.max(8, halfW - 6);
  return {
    w: r * 2 + 16,
    h: r * 2 + 20,
    draw(p, t) {
      const bob = Math.sin(TAU * t) * 1.5;
      for (const side of [-1, 1]) {
        p.line(side * r * 0.4, -r * 0.8, side * r * 0.7, -r - 5 + bob, { strokeWidth: 1.1 });
        p.dot(side * r * 0.7, -r - 5 + bob, 1.6);
      }
      p.circle(0, 0, r * 2, ink);
      p.paper(0, r * 0.15, r * 0.9);
      p.dot(0, r * 0.3, r * 0.22);
    },
  };
}

/** The circle around a number ball, in the operation's color. Filled with
 * paper, so the digit reads even over a monster. */
export function ballRing(color: string): DoodleRecipe {
  const d = ENEMY.BALL_RADIUS * 2 + 2;
  return {
    w: d + 8,
    h: d + 8,
    draw(p) {
      p.circle(0, 0, d, DOODLE.PAPER, { fillStyle: "solid", stroke: color, strokeWidth: 1.8, roughness: 0.9 });
    },
  };
}

/** A loose pencil loop around something (shield, sent-by ring, target). */
export function loop(w: number, h: number, color: string, strokeWidth: number): DoodleRecipe {
  return {
    w: w + 12,
    h: h + 12,
    draw(p) {
      p.ellipse(0, 0, w, h, undefined, { stroke: color, strokeWidth, roughness: 1.6 });
    },
  };
}

/** A shot: a short pencil dash with a sharpened tip. */
export const BULLET: DoodleRecipe = {
  w: 10,
  h: 22,
  draw(p) {
    p.line(0, 7, 0, -5, { strokeWidth: 2.2 });
    p.shape(
      [
        [-2, -5],
        [2, -5],
        [0, -10],
      ],
      DOODLE.GRAPHITE,
      { fillStyle: "solid", strokeWidth: 1 },
    );
  },
};
