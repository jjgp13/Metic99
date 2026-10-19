import type Phaser from "phaser";
import { DOODLE, STORY_MAP } from "../config/constants";
import type { IslandState } from "../services/storyProgress";
import { drawFrames, type DoodleRecipe, type Pencil, type Point } from "./pencil";

/**
 * The story map's doodles (scenes/StoryMapScene.ts): one small island per
 * stage, with a sketch of its world on top (a flower for the backyard, a
 * lily pad for the pond…). Islands not reached yet are a faint dashed
 * outline with nothing on them: the scene writes a "?" over them.
 */

const TAU = Math.PI * 2;
const GRAPHITE = DOODLE.GRAPHITE;
const LIGHT = DOODLE.GRAPHITE_LIGHT;
const WATER = DOODLE.RULE;

/** A seeded number in [0, 1) that is the same every time for (stage, i). */
function noise(stage: number, i: number): number {
  const x = Math.sin(stage * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The island's outline: a wobbly oval whose bumps differ per stage. */
function coast(stage: number, w: number, h: number): Point[] {
  const n = 14;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const r = 0.82 + 0.18 * noise(stage, i);
    return [Math.cos(a) * (w / 2) * r, Math.sin(a) * (h / 2) * r];
  });
}

/** A sketch of each stage's world, drawn on the island around (0, -6). */
const WORLDS: ((p: Pencil) => void)[] = [
  // 1 backyard: a flower and a tuft of grass.
  (p) => {
    p.line(-6, 4, -6, -12);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      p.circle(-6 + Math.cos(a) * 4, -15 + Math.sin(a) * 4, 5, "#e0679f");
    }
    p.dot(-6, -15, 1.6, "#e09b00");
    for (const dx of [8, 12, 16]) p.line(12, 4, dx, -4);
  },
  // 2 pond: a lily pad and a cattail.
  (p) => {
    p.shape(
      [
        [-14, 0],
        [-4, -6],
        [4, -5],
        [6, 1],
        [-2, 3],
      ],
      "#4f8a3a",
    );
    p.line(10, 4, 11, -16);
    p.ellipse(11, -14, 4, 9, "#8a6a3f");
  },
  // 3 treetops: a round tree.
  (p) => {
    p.shape(
      [
        [-2, 4],
        [2, 4],
        [2, -8],
        [-2, -8],
      ],
      "#8a6a3f",
    );
    p.circle(0, -16, 20, "#4f8a3a");
  },
  // 4 swamp: reeds and a mud bubble.
  (p) => {
    for (const x of [-10, -6, -2]) p.curve([[x, 4], [x - 1, -6], [x + 2, -16]]);
    p.circle(10, -2, 8);
    p.circle(15, -7, 4);
  },
  // 5 cave: a dark cave mouth in a rock.
  (p) => {
    p.shape(
      [
        [-16, 4],
        [-12, -12],
        [0, -18],
        [12, -12],
        [16, 4],
      ],
      "#6e6a7a",
    );
    p.ellipse(0, -2, 12, 12, GRAPHITE, { fillStyle: "solid" });
  },
  // 6 volcano: a cone with lava and a puff of smoke.
  (p) => {
    p.shape(
      [
        [-16, 4],
        [-4, -14],
        [4, -14],
        [16, 4],
      ],
      "#8a6a3f",
    );
    p.curve([[-3, -14], [-2, -8], [-5, -2]], { stroke: "#f08a2c", strokeWidth: 2 });
    p.curve([[0, -16], [-4, -22], [2, -26], [-2, -32]], { stroke: LIGHT });
  },
  // 7 windy sky: a cloud and a kite.
  (p) => {
    for (const [x, y, d] of [[-10, -6, 12], [-2, -10, 14], [6, -6, 12]] as const) p.circle(x, y, d, "#ffffff");
    p.shape(
      [
        [14, -22],
        [19, -16],
        [14, -8],
        [9, -16],
      ],
      "#e0679f",
    );
    p.curve([[14, -8], [11, -2], [15, 3]]);
  },
  // 8 snowy mountain: a peak with a snow cap.
  (p) => {
    p.shape(
      [
        [-16, 4],
        [0, -20],
        [16, 4],
      ],
      "#7d8196",
    );
    p.shape(
      [
        [-6, -11],
        [0, -20],
        [6, -11],
        [2, -9],
        [-2, -12],
      ],
      DOODLE.PAPER,
      { fillStyle: "solid" },
    );
  },
  // 9 night sky: a crescent moon and a star.
  (p) => {
    p.circle(-4, -10, 18, "#e09b00");
    p.circle(2, -13, 15, DOODLE.PAPER, { fillStyle: "solid", stroke: "none" });
    const star: Point[] = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * TAU - Math.PI / 2;
      const r = i % 2 ? 2.5 : 6;
      return [12 + Math.cos(a) * r, -16 + Math.sin(a) * r];
    });
    p.shape(star, "#e09b00");
  },
  // 10 bedroom: a little bed with a pillow.
  (p) => {
    p.shape(
      [
        [-15, 2],
        [-15, -12],
        [15, -6],
        [15, 2],
      ],
      "#c07a9e",
    );
    p.ellipse(-9, -10, 9, 5, DOODLE.PAPER, { fillStyle: "solid" });
    p.line(-15, 2, -15, 6);
    p.line(15, 2, 15, 6);
  },
];

/** A small flag on a cleared island (its boss is beaten). */
function flag(p: Pencil): void {
  p.line(26, 2, 26, -18);
  p.shape(
    [
      [26, -18],
      [38, -14],
      [26, -10],
    ],
    "#e09b00",
  );
}

export function islandRecipe(stage: number, state: IslandState): DoodleRecipe {
  const w = STORY_MAP.ISLAND_W;
  const h = STORY_MAP.ISLAND_H;
  const ink = STORY_MAP.INK[stage % STORY_MAP.INK.length];
  return {
    w,
    h,
    draw(p) {
      const ground = coast(stage, w - 12, h * 0.55);
      const lift = (pts: Point[], dy: number): Point[] => pts.map(([x, y]) => [x, y + dy]);
      if (state === "unreached") {
        p.shape(lift(ground, 12), undefined, { stroke: LIGHT, strokeLineDash: [5, 5] });
        return;
      }
      // Ripples under the island, then the island (shaded), then its world.
      for (const dx of [-30, 18]) p.curve([[dx, h / 2 - 6], [dx + 6, h / 2 - 8], [dx + 12, h / 2 - 6]], { stroke: WATER });
      p.shape(lift(ground, 12), ink, { hachureGap: 2.6 });
      WORLDS[stage]?.(p);
      if (state === "cleared") flag(p);
    },
  };
}

/**
 * An island's doodle as Phaser textures (one per boil frame), `pxPerUnit`
 * device px per logical px, like shipIconFrames. Drawn once per page.
 */
export function islandFrames(
  textures: Phaser.Textures.TextureManager,
  stage: number,
  state: IslandState,
  pxPerUnit: number,
): string[] {
  const keys = Array.from({ length: DOODLE.BOIL_FRAMES }, (_, i) => `island:${stage}:${state}:${i}`);
  if (textures.exists(keys[0])) return keys;
  const frames = drawFrames(islandRecipe(stage, state), pxPerUnit, DOODLE.BOIL_FRAMES, 40 + stage);
  frames.forEach((canvas, i) => textures.addCanvas(keys[i], canvas));
  return keys;
}

/**
 * The trail between the islands: pencil dots from stage to stage, solid up
 * to the furthest island reached and faint after it. Returns a canvas the
 * size of the page (GAME px × `scale`).
 */
export function drawTrail(width: number, height: number, scale: number, spots: readonly (readonly [number, number])[], reached: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  for (let i = 1; i < spots.length; i++) {
    const [x1, y1] = spots[i - 1];
    const [x2, y2] = spots[i];
    // A little bend, so the trail looks walked, not ruled.
    const mx = (x1 + x2) / 2 + (i % 2 ? 18 : -18);
    const my = (y1 + y2) / 2;
    ctx.strokeStyle = i <= reached ? GRAPHITE : LIGHT;
    ctx.globalAlpha = i <= reached ? 0.7 : 0.35;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx, my, x2, y2);
    ctx.stroke();
  }
  return canvas;
}
