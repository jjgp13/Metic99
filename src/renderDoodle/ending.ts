import rough from "roughjs";
import { DOODLE, GAME, LEVELS } from "../config/constants";
import { PAGES } from "./pages";
import { Pencil, type DoodleRecipe, type Point } from "./pencil";
import { FALCON, SHIPS } from "./recipes";

/**
 * The ending's doodles (scenes/EndingScene.ts): seen from above, a kid's desk
 * with a small sheet of paper on it, the game's bosses drawn on the sheet in
 * crayon, two small hands and loose crayons. It reveals who imagined every
 * world: the doodles on the sheet are the game's own boss recipes.
 */

const C = {
  wood: "#c99a66",
  grain: "rgba(120, 78, 40, 0.35)",
  sheet: "#fdfcf6",
  skin: "#eebf94",
  sleeve: "#2a8f9e",
  stripe: "#f3ead6",
  wrapper: "#f3ead6",
  note: "#f4e48a",
};

/** The doodles on the sheet: every level's boss in order, then the
 * player's own ship (the kid drew that too). */
export function sheetDoodles(shipModel: string): DoodleRecipe[] {
  const bosses = LEVELS.flatMap((level) => {
    const look = PAGES[level.PAGE]?.bosses[level.BOSS.MODEL];
    return look ? [look.up] : [];
  });
  return [...bosses, SHIPS[shipModel] ?? FALCON];
}

/** Small doodles (the ship) grow at most this much to fill their cell. */
const MAX_GROW = 1.6;

/**
 * Draw `recipe` once in crayon, scaled to fit `maxW` × `maxH` logical px,
 * at `pxPerUnit` device px per logical px.
 */
export function drawCrayonDoodle(
  recipe: DoodleRecipe,
  box: { maxW: number; maxH: number },
  pxPerUnit: number,
): HTMLCanvasElement {
  const fit = Math.min(box.maxW / recipe.w, box.maxH / recipe.h, MAX_GROW);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(recipe.w * fit * pxPerUnit);
  canvas.height = Math.ceil(recipe.h * fit * pxPerUnit);
  const ctx = canvas.getContext("2d")!;
  const scale = fit * pxPerUnit;
  ctx.setTransform(scale, 0, 0, scale, canvas.width / 2, canvas.height / 2);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  recipe.draw(new Pencil(rough.canvas(canvas), 7, "crayon"), 0);
  return canvas;
}

/** A crayon, tip up: a paper wrapper with bands, a waxy cone at the top. */
export function crayonRecipe(color: string): DoodleRecipe {
  return {
    w: 14,
    h: 54,
    draw(p) {
      p.shape(
        [
          [0, -26],
          [4, -17],
          [-4, -17],
        ],
        color,
        { fillStyle: "solid", stroke: color },
      );
      p.shape(
        [
          [-5, -17],
          [5, -17],
          [5, 25],
          [-5, 25],
        ],
        color,
        { fillStyle: "solid" },
      );
      p.shape(
        [
          [-5, -9],
          [5, -9],
          [5, 17],
          [-5, 17],
        ],
        C.wrapper,
        { fillStyle: "solid", roughness: 0.6 },
      );
      for (const y of [-5, 13]) p.line(-5, y, 5, y, { stroke: color, strokeWidth: 1.6 });
    },
  };
}

/** Where the fingertips (or the crayon's tip) are in a hand doodle: hand
 * images are placed and turned around this point. */
export const HAND_TIP = { x: 0, y: -166 } as const;

/** A sleeve from the wrist (`top`) down past the bottom of the doodle. */
function sleeve(p: Pencil, top: number, bottom: number): void {
  p.shape(
    [
      [-21, top],
      [21, top],
      [24, bottom],
      [-24, bottom],
    ],
    C.sleeve,
    { hachureGap: 2.8 },
  );
  for (let y = top + 18; y < bottom - 6; y += 22) p.line(-22, y, 22, y + 2, { stroke: C.stripe, strokeWidth: 3 });
  p.ellipse(0, top + 2, 44, 12, C.sleeve, { fillStyle: "solid" }); // the cuff
}

/**
 * The kid's right hand, fingers up, gripping a crayon (drawn separately,
 * under this doodle, so it can change color): index finger along the
 * crayon, thumb beside it, the other fingers curled under the palm.
 */
export const GRIP_HAND: DoodleRecipe = {
  w: 60,
  h: 340,
  draw(p) {
    const tip = HAND_TIP.y;
    sleeve(p, tip + 78, 170);
    p.ellipse(4, tip + 56, 42, 46, C.skin, { fillStyle: "solid" }); // palm
    for (const [x, y] of [
      [17, tip + 44],
      [19, tip + 56],
    ]) {
      p.ellipse(x, y, 13, 11, C.skin, { fillStyle: "solid" }); // curled fingers
    }
    p.ellipse(-10, tip + 36, 11, 22, C.skin, { fillStyle: "solid" }); // thumb
    p.ellipse(3, tip + 30, 11, 30, C.skin, { fillStyle: "solid" }); // index finger
    p.curve(
      [
        [-1, tip + 22],
        [3, tip + 20],
        [7, tip + 22],
      ],
      { strokeWidth: 0.9 },
    ); // a fingernail
  },
};

/** The kid's left hand, flat on the sheet to hold it still, fingers up. */
export const FLAT_HAND: DoodleRecipe = {
  w: 60,
  h: 340,
  draw(p) {
    const tip = HAND_TIP.y;
    sleeve(p, tip + 78, 170);
    for (const [x, len] of [
      [-15, 30],
      [-5, 36],
      [5, 36],
      [14, 30],
    ]) {
      p.ellipse(x, tip + len / 2 + (36 - len), 10, len, C.skin, { fillStyle: "solid" });
    }
    p.ellipse(19, tip + 50, 12, 26, C.skin, { fillStyle: "solid", roughness: 0.8 }); // thumb
    p.ellipse(0, tip + 54, 42, 40, C.skin, { fillStyle: "solid" }); // palm
  },
};

/** The kid's sheet: a small white page, no lines. */
export function sheetRecipe(w: number, h: number): DoodleRecipe {
  return {
    w: w + 8,
    h: h + 8,
    draw(p) {
      const corners: Point[] = [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
      ];
      p.shape(corners, C.sheet, { fillStyle: "solid", stroke: DOODLE.GRAPHITE_LIGHT, roughness: 0.5 });
    },
  };
}

/** A sticky note with a curled corner, for the score. */
export const STICKY_NOTE: DoodleRecipe = {
  w: 168,
  h: 104,
  draw(p) {
    p.shape(
      [
        [-80, -48],
        [80, -48],
        [80, 34],
        [66, 48],
        [-80, 48],
      ],
      C.note,
      { fillStyle: "solid", stroke: DOODLE.GRAPHITE_LIGHT, roughness: 0.6 },
    );
    p.shape(
      [
        [80, 34],
        [66, 48],
        [68, 36],
      ],
      "#e0cf6c",
      { fillStyle: "solid", stroke: DOODLE.GRAPHITE_LIGHT, roughness: 0.4 },
    );
  },
};

/** Loose crayons lying on the desk: color, x, y, turn (radians). */
const LOOSE_CRAYONS: [string, number, number, number][] = [
  ["#c93d9a", 456, 604, 0.3],
  ["#7a9a3a", 292, 702, 1.4],
  ["#f08a2c", 446, 70, 2.1],
  ["#6a4c93", 30, 36, 1.2],
];

/**
 * The desk, drawn once at `scale` device px per logical px: wood with grain
 * and a few loose crayons.
 */
export function drawDesk(scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(GAME.WIDTH * scale);
  canvas.height = Math.round(GAME.HEIGHT * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = C.wood;
  ctx.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);

  const rc = rough.canvas(canvas);
  const pencil = new Pencil(rc, 3);
  // Grain: long wavy lines across the boards, and a board seam every 180 px.
  for (let y = 12; y < GAME.HEIGHT; y += 26) {
    const wave = 4 + ((y * 7) % 5);
    pencil.curve(
      [
        [-10, y],
        [120, y + wave],
        [250, y - wave],
        [380, y + wave / 2],
        [GAME.WIDTH + 10, y],
      ],
      { stroke: C.grain, strokeWidth: 1, roughness: 0.6 },
    );
  }
  for (let y = 180; y < GAME.HEIGHT; y += 180) pencil.line(0, y, GAME.WIDTH, y, { stroke: C.grain, strokeWidth: 2, roughness: 0.3 });

  for (const [color, x, y, turn] of LOOSE_CRAYONS) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(turn);
    crayonRecipe(color).draw(pencil, 0);
    ctx.restore();
  }
  return canvas;
}
