import { DOODLE, GAME } from "../config/constants";
import type { DoodleRecipe, Point } from "./pencil";

/**
 * Story pages (docs/SOLO_MODES_DESIGN.md §2): each level is drawn on its
 * own notebook page that scrolls down as the level's path goes by, with
 * faint props (pebbles, grass…) doodled on it. The numbers must still win,
 * so props are light pencil drawn at PAGE_PROP_ALPHA.
 */
export interface PageDef {
  /** Paper tint, rule and margin colors. */
  paper: string;
  rule: string;
  margin: string;
  /** Props scattered along the path, picked by weight. */
  props: { recipe: DoodleRecipe; weight: number }[];
  /** Average px of path between two props. */
  propGap: number;
}

/** A prop placed on the page: `pathY` px along the path from the start. */
export interface PlacedProp {
  key: string;
  recipe: DoodleRecipe;
  x: number;
  pathY: number;
  angle: number;
}

const TAU = Math.PI * 2;
const DIRT = "#8a6a4a";
const GRASS = "#7a9a3a";

const PEBBLES: DoodleRecipe = {
  w: 34,
  h: 22,
  draw(p) {
    p.ellipse(-6, 2, 14, 10, DIRT, { hachureGap: 3 });
    p.ellipse(7, -2, 10, 8, undefined);
    p.ellipse(4, 7, 7, 5, DIRT, { hachureGap: 3 });
  },
};

const GRASS_TUFT: DoodleRecipe = {
  w: 30,
  h: 26,
  draw(p) {
    for (const [x, lean] of [
      [-6, -5],
      [-2, -2],
      [2, 1],
      [6, 5],
    ]) {
      p.curve(
        [
          [x, 10],
          [x + lean * 0.4, 0],
          [x + lean, -10],
        ],
        { stroke: GRASS, strokeWidth: 1.3 },
      );
    }
  },
};

const DAISY: DoodleRecipe = {
  w: 26,
  h: 26,
  draw(p) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      p.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 6, 6, undefined, { strokeWidth: 1 });
    }
    p.circle(0, 0, 5, "#d9b44a", { fillStyle: "solid", strokeWidth: 0.8 });
  },
};

const CLOD: DoodleRecipe = {
  w: 30,
  h: 20,
  draw(p) {
    const lump: Point[] = [
      [-11, 4],
      [-7, -4],
      [1, -6],
      [9, -2],
      [11, 4],
    ];
    p.shape(lump, DIRT, { hachureGap: 2.6, hachureAngle: 20 });
  },
};

const ANT_TRAIL: DoodleRecipe = {
  w: 60,
  h: 20,
  draw(p) {
    for (let i = 0; i < 5; i++) {
      const x = -24 + i * 12;
      const y = Math.sin(i * 1.3) * 4;
      p.dot(x, y, 1.6);
      p.dot(x + 3, y, 1.2);
    }
  },
};

const TWIG: DoodleRecipe = {
  w: 46,
  h: 20,
  draw(p) {
    p.curve(
      [
        [-20, 4],
        [-4, 0],
        [18, -4],
      ],
      { stroke: DIRT, strokeWidth: 1.8 },
    );
    p.line(2, -1, 9, -8, { stroke: DIRT, strokeWidth: 1.2 });
  },
};

export const PAGES: Record<string, PageDef> = {
  backyard: {
    paper: "#f3ead6",
    rule: "rgba(120, 140, 170, 0.28)",
    margin: "rgba(214, 84, 84, 0.35)",
    props: [
      { recipe: PEBBLES, weight: 3 },
      { recipe: GRASS_TUFT, weight: 4 },
      { recipe: DAISY, weight: 1.5 },
      { recipe: CLOD, weight: 2 },
      { recipe: ANT_TRAIL, weight: 1 },
      { recipe: TWIG, weight: 1.5 },
    ],
    propGap: 46,
  },
};

/**
 * One screen-height of the page's ruled paper that tiles vertically (the
 * height is a whole number of rule gaps), so scrolling just draws it twice.
 */
export function drawPageTile(page: PageDef, scale: number): HTMLCanvasElement {
  const h = Math.ceil(GAME.HEIGHT / DOODLE.RULE_GAP) * DOODLE.RULE_GAP;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(GAME.WIDTH * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = page.paper;
  ctx.fillRect(0, 0, GAME.WIDTH, h);
  for (let i = 0; i < DOODLE.GRAIN_DOTS; i++) {
    ctx.fillStyle = `rgba(90, 70, 40, ${0.04 + Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * GAME.WIDTH, Math.random() * h, 1 + Math.random(), 1 + Math.random());
  }
  ctx.strokeStyle = page.rule;
  ctx.lineWidth = 1;
  for (let y = DOODLE.RULE_GAP / 2; y < h; y += DOODLE.RULE_GAP) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(GAME.WIDTH, y + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = page.margin;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(DOODLE.MARGIN_X, 0);
  ctx.lineTo(DOODLE.MARGIN_X, h);
  ctx.stroke();
  return canvas;
}

/**
 * Scatter the page's props along `lengthPx` of path (plus a screen's worth
 * already in view at the start). Visual only, so Math.random is fine; it is
 * done once per level and kept, so the props don't jump.
 */
export function layOutProps(pageId: string, page: PageDef, lengthPx: number): PlacedProp[] {
  const total = page.props.reduce((t, p) => t + p.weight, 0);
  const out: PlacedProp[] = [];
  for (let y = -GAME.HEIGHT; y < lengthPx + GAME.HEIGHT; y += page.propGap * (0.5 + Math.random())) {
    let r = Math.random() * total;
    const i = Math.max(
      0,
      page.props.findIndex((p) => (r -= p.weight) < 0),
    );
    out.push({
      key: `prop:${pageId}:${i}`,
      recipe: page.props[i].recipe,
      x: 12 + Math.random() * (GAME.WIDTH - 24),
      pathY: y,
      angle: (Math.random() - 0.5) * 0.8,
    });
  }
  return out;
}
