import { DOODLE, GAME } from "../config/constants";
import type Alien from "../objects/Alien";
import type { DoodleRecipe } from "./pencil";

/**
 * Story pages (docs/SOLO_MODES_DESIGN.md §2): each level is drawn on its
 * own notebook page that scrolls down as the level's path goes by, with
 * faint props (pebbles, grass…) doodled on it. The numbers must still win,
 * so props are light pencil drawn at PAGE_PROP_ALPHA.
 *
 * Each level's page lives in its own file under renderDoodle/levels/ (with
 * its creatures and its boss) and is listed in renderDoodle/levels/index.ts.
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
  /** How the level's creatures look, by species name (SpeciesDef.NAME). */
  creatures: Record<string, CreatureLook>;
  /** How the level's boss looks, by its model (BossDef.MODEL). */
  bosses: Record<string, BossLook>;
}

/**
 * How a creature looks. Its number balls are drawn by the view at
 * `alien.ballOffset(i)` (its layout, a rule); the doodle is drawn around
 * them, so a beetle's eyes or a worm's segments ARE the balls.
 */
export interface CreatureLook {
  /** Which cached doodle this alien needs now ("2", "2:folded"…): one per
   * ball count or state, since the doodle is pre-drawn. */
  variant(alien: Alien): string;
  recipe(alien: Alien): DoodleRecipe;
  /** Ball `i` drawn this far off its place at boil-cycle point `t` (0..1),
   * e.g. a worm's wriggle; must stay within the layout's box. */
  ballNudge?(i: number, t: number): readonly [number, number];
  /** Color laid over the numbers while they're hidden (default graphite). */
  coverInk?: string;
  /** Fully hidden numbers aren't drawn at all (a folded butterfly). */
  hidesBalls?: boolean;
}

/** A boss's doodle, and the one while it hides (burrowing, diving…). */
export interface BossLook {
  up: DoodleRecipe;
  hidden?: DoodleRecipe;
  /** Drawn on the page under every alien while the boss is up (a lamp's
   * beam, a shadow); `ctx` is in logical px. */
  under?(ctx: CanvasRenderingContext2D, boss: Alien, alpha: number): void;
}

/** A prop placed on the page: `pathY` px along the path from the start. */
export interface PlacedProp {
  key: string;
  recipe: DoodleRecipe;
  x: number;
  pathY: number;
  angle: number;
}

export { PAGES } from "./levels";

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
