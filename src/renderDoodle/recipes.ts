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

/** Engine flames under a ship; they flicker as the boil frames go round. */
function flames(p: Pencil, t: number, xs: number[], y: number): void {
  xs.forEach((x, i) => {
    const len = 7 + 4 * Math.abs(Math.sin(TAU * t * 2 + i));
    p.curve(
      [
        [x, y],
        [x + 2, y + 2 + len / 2],
        [x, y + 2 + len],
      ],
      { stroke: INK.flame, strokeWidth: 1.6 },
    );
  });
}

/** FALCON: a fat hull with swept wings and a round canopy. */
export const FALCON: DoodleRecipe = {
  w: 48,
  h: 52,
  draw(p, t) {
    // Flames first, so the hull covers their roots.
    flames(p, t, [-5, 5], 11);
    for (const side of [-1, 1]) {
      const wing: Point[] = [
        [6, -2],
        [19, 9],
        [18, 14],
        [6, 9],
      ];
      p.shape(side > 0 ? wing : mirror(wing), INK.falcon);
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
      INK.falcon,
      { hachureAngle: 50 },
    );
    p.ellipse(0, -5, 6, 10, undefined, { stroke: INK.canopy, strokeWidth: 1.4 });
  },
};

/** DART: a long thin needle on a wide delta wing, one engine. */
export const DART: DoodleRecipe = {
  w: 50,
  h: 62,
  draw(p, t) {
    flames(p, t, [0], 15);
    const delta: Point[] = [
      [0, -10],
      [21, 13],
      [14, 15],
      [0, 10],
    ];
    for (const side of [-1, 1]) p.shape(side > 0 ? delta : mirror(delta), INK.dart, { hachureAngle: 20 });
    p.shape(
      [
        [0, -27],
        [4, -12],
        [4, 15],
        [-4, 15],
        [-4, -12],
      ],
      INK.dart,
      { hachureAngle: 70 },
    );
    for (const side of [-1, 1]) p.line(side * 16, 13, side * 18, 3, { strokeWidth: 1.2 }); // wingtip fins
    p.ellipse(0, -12, 4, 9, undefined, { stroke: INK.canopy, strokeWidth: 1.3 });
  },
};

/** POD: a round chunky saucer with two side pods and a bubble canopy. */
export const POD: DoodleRecipe = {
  w: 58,
  h: 52,
  draw(p, t) {
    flames(p, t, [-18, 18], 13);
    for (const side of [-1, 1]) p.ellipse(side * 18, 3, 12, 20, INK.pod, { hachureAngle: 30 });
    p.circle(0, 0, 32, INK.pod, { hachureAngle: -60 });
    p.circle(0, -2, 15, DOODLE.PAPER, { fillStyle: "solid", stroke: INK.canopy, strokeWidth: 1.4 });
    p.curve(
      [
        [-4, -5],
        [-2, -7],
        [1, -7.5],
      ],
      { strokeWidth: 0.9 },
    ); // a glint on the canopy
  },
};

/** A leaf's outline from its stem (`root`) to its tip, `len` long and
 * `width` wide at the middle, turned `angle` radians from pointing right. */
function leaf(root: Point, len: number, width: number, angle: number): Point[] {
  const n = 6;
  const half: Point[] = Array.from({ length: n + 1 }, (_, k) => [(len * k) / n, (-width / 2) * Math.sin((Math.PI * k) / n)]);
  const outline = [...half, ...half.slice(1, -1).reverse().map(([x, y]): Point => [x, -y])];
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return outline.map(([x, y]) => [root[0] + x * cos - y * sin, root[1] + x * sin + y * cos]);
}

/** LEAF GLIDER (beat the Great Owl): an acorn riding on two leaf wings. */
export const LEAF_GLIDER: DoodleRecipe = {
  w: 60,
  h: 50,
  draw(p, t) {
    flames(p, t, [0], 11);
    for (const side of [-1, 1]) {
      // The wings tip up and down a little as the frames go round, like gliding.
      const angle = -0.3 + 0.06 * Math.sin(TAU * t + side);
      const wing = leaf([4, 0], 24, 12, angle);
      p.shape(side > 0 ? wing : mirror(wing), INK.leaf, { hachureAngle: side * 30 });
      const tip: Point = [4 + 24 * Math.cos(angle), 24 * Math.sin(angle)];
      p.line(side * 4, 0, side * tip[0], tip[1], { strokeWidth: 0.9 }); // the vein
    }
    p.ellipse(0, 3, 12, 18, INK.acorn, { hachureAngle: 60 });
    p.shape(
      [
        [-7, -4],
        [-6, -9],
        [0, -12],
        [6, -9],
        [7, -4],
      ],
      INK.leaf,
      { hachureAngle: -20 },
    ); // the acorn's cap is the cockpit
    p.line(0, -12, 1, -17, { strokeWidth: 1.4 }); // its stem, the nose
  },
};

/** LAVA ROCKET (beat the Dragon): a dark rock rocket with glowing cracks. */
export const LAVA_ROCKET: DoodleRecipe = {
  w: 46,
  h: 66,
  draw(p, t) {
    flames(p, t, [-4, 4], 18);
    const fin: Point[] = [
      [6, 5],
      [15, 15],
      [15, 22],
      [6, 16],
    ];
    for (const side of [-1, 1]) p.shape(side > 0 ? fin : mirror(fin), INK.ember, { hachureAngle: 40 });
    p.shape(
      [
        [0, -28],
        [6, -16],
        [8, 0],
        [7, 18],
        [-7, 18],
        [-8, 0],
        [-6, -16],
      ],
      INK.lava,
      { hachureAngle: 70, hachureGap: 1.8 },
    );
    p.shape(
      [
        [0, -28],
        [5, -18],
        [-5, -18],
      ],
      INK.ember,
    ); // a glowing nose
    // Lava shows through the cracks; they glow brighter and dimmer.
    const crack = { stroke: INK.ember, strokeWidth: 1.3 + 0.5 * Math.abs(Math.sin(TAU * t)) };
    p.curve(
      [
        [-4, -3],
        [-1, 1],
        [-3, 6],
        [0, 11],
      ],
      crack,
    );
    p.curve(
      [
        [5, 4],
        [3, 8],
        [5, 13],
      ],
      crack,
    );
    p.paper(0, -10, 8, { stroke: INK.canopy, strokeWidth: 1.4 }); // porthole
  },
};

/** A five-pointed star's outline around (cx, cy). */
function star(cx: number, cy: number, outer: number, inner: number): Point[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 10) * TAU;
    const r = i % 2 === 0 ? outer : inner;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

/** STAR CRUISER (beat the Moon): wide night-blue wings, a gold star cockpit. */
export const STAR_CRUISER: DoodleRecipe = {
  w: 62,
  h: 54,
  draw(p, t) {
    flames(p, t, [-7, 7], 12);
    const wing: Point[] = [
      [4, -6],
      [27, 7],
      [26, 13],
      [5, 9],
    ];
    for (const side of [-1, 1]) p.shape(side > 0 ? wing : mirror(wing), INK.star, { hachureAngle: 25 });
    p.shape(
      [
        [0, -24],
        [7, -6],
        [6, 13],
        [-6, 13],
        [-7, -6],
      ],
      INK.star,
      { hachureAngle: 65 },
    );
    p.shape(star(0, -3, 7, 3), INK.gold, { fillStyle: "solid", strokeWidth: 1 });
    // A twinkle at each wingtip.
    for (const side of [-1, 1]) {
      const r = 1.5 + 1.5 * Math.abs(Math.sin(TAU * t + side));
      const [x, y] = [side * 28, 2];
      p.line(x - r, y, x + r, y, { stroke: INK.gold, strokeWidth: 1.1 });
      p.line(x, y - r, x, y + r, { stroke: INK.gold, strokeWidth: 1.1 });
    }
  },
};

/** CRAYON (finish the story): the kid's own drawing of a rocket, lopsided,
 * in waxy crayon, with a smiling pilot in the window. */
export const CRAYON_SHIP: DoodleRecipe = {
  w: 56,
  h: 60,
  look: "crayon",
  draw(p, t) {
    for (const [i, x] of [-5, 4].entries()) {
      const len = 8 + 5 * Math.abs(Math.sin(TAU * t * 2 + i));
      p.curve(
        [
          [x, 15],
          [x - 3, 15 + len / 3],
          [x + 2, 15 + (2 * len) / 3],
          [x - 1, 15 + len],
        ],
        { stroke: INK.crayonFlame, strokeWidth: 2.4, roughness: 1.6 },
      );
    }
    const wing: Point[] = [
      [8, 1],
      [21, 17],
      [9, 14],
    ];
    p.shape(wing, INK.crayonWindow, { roughness: 1.8 });
    p.shape(
      mirror([
        [9, 3],
        [19, 15],
        [9, 15],
      ]),
      INK.crayonWindow,
      { roughness: 1.8 },
    ); // the kid drew this wing a bit smaller
    p.shape(
      [
        [1, -26],
        [9, -9],
        [10, 15],
        [-9, 16],
        [-10, -7],
      ],
      INK.crayonBody,
      { roughness: 1.8 },
    );
    p.paper(0, -5, 12, { stroke: INK.crayonWindow, strokeWidth: 2 });
    p.dot(-2.2, -6.5, 0.9);
    p.dot(2.2, -6.5, 0.9);
    p.curve(
      [
        [-2.8, -4],
        [0, -2.2],
        [2.8, -4],
      ],
      { strokeWidth: 1 },
    );
  },
};

/** The player's ships by model name (RENDER3D.SHIPS). */
export const SHIPS: Record<string, DoodleRecipe> = {
  ship_player: FALCON,
  ship_dart: DART,
  ship_pod: POD,
  ship_leaf: LEAF_GLIDER,
  ship_lava: LAVA_ROCKET,
  ship_star: STAR_CRUISER,
  ship_crayon: CRAYON_SHIP,
};

/** A cartoon star circling a dazed ship after a hit. */
export const DIZZY_STAR: DoodleRecipe = {
  w: 16,
  h: 16,
  draw(p) {
    const star: Point[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const r = i % 2 ? 2.6 : 6;
      star.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    p.shape(star, DOODLE.TARGET, { fillStyle: "solid", strokeWidth: 1, roughness: 0.6 });
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

