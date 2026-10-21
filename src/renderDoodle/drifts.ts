import { GAME } from "../config/constants";
import type { DoodleRecipe } from "./pencil";

/**
 * Little things that drift across a story page (dandelion seeds, snow,
 * leaves): the page's weather. They are looks only: they live in screen
 * space, never touch the rules, and are drawn over the props but under
 * every alien, faint, so the numbers still win.
 */
export interface DriftDef {
  recipe: DoodleRecipe;
  /** How many are on the page at once. */
  count: number;
  /** Speed in px/s (+x = right, +y = down); each one gets its own ±SPREAD. */
  vx: number;
  vy: number;
  /** Side-to-side sway: px either way, and sways per second. */
  swayPx?: number;
  swayHz?: number;
  /** Fastest turn, rad/s (a falling leaf tumbles); each one turns its own way. */
  spinPerS?: number;
  /** Frames per second its pre-drawn frames turn (default: one still frame). */
  fps?: number;
}

/** One drifting thing on screen. */
export interface Drift {
  def: DriftDef;
  /** Which entry of the page's `drifts` (its cached frames). */
  index: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageS: number;
  /** Offsets its sway and frames, so they don't move in step. */
  phase: number;
  angle: number;
  spinPerS: number;
}

/** Each drift's speed is its def's speed × (1 ± SPREAD). */
const SPREAD = 0.35;

/**
 * Moves a page's drifts. Whatever leaves the screen comes back in on the
 * side it came from, somewhere new, so the count on screen stays the same.
 * `random` is Math.random in the game (looks only) and a fixed one in tests.
 */
export class DriftLayer {
  public readonly drifts: Drift[] = [];

  constructor(
    defs: readonly DriftDef[],
    private readonly random: () => number = Math.random,
  ) {
    defs.forEach((def, index) => {
      for (let i = 0; i < def.count; i++) {
        const spread = () => 1 + (this.random() * 2 - 1) * SPREAD;
        this.drifts.push({
          def,
          index,
          x: this.random() * GAME.WIDTH,
          y: this.random() * GAME.HEIGHT,
          vx: def.vx * spread(),
          vy: def.vy * spread(),
          ageS: 0,
          phase: this.random(),
          angle: this.random() * Math.PI * 2,
          spinPerS: (this.random() * 2 - 1) * (def.spinPerS ?? 0),
        });
      }
    });
  }

  public step(dtS: number): void {
    for (const d of this.drifts) {
      d.ageS += dtS;
      d.x += d.vx * dtS;
      d.y += d.vy * dtS;
      d.angle += d.spinPerS * dtS;
      this.reenter(d);
    }
  }

  /** Sideways sway at this moment (px), added when drawn. */
  public static swayX(d: Drift): number {
    const { swayPx = 0, swayHz = 0 } = d.def;
    return Math.sin((d.ageS * swayHz + d.phase) * Math.PI * 2) * swayPx;
  }

  private reenter(d: Drift): void {
    // Off-screen by a whole doodle (plus its sway) before it comes back.
    const marginX = d.def.recipe.w + (d.def.swayPx ?? 0);
    const marginY = d.def.recipe.h;
    if (d.x > GAME.WIDTH + marginX) {
      d.x = -marginX;
      d.y = this.random() * GAME.HEIGHT;
    } else if (d.x < -marginX) {
      d.x = GAME.WIDTH + marginX;
      d.y = this.random() * GAME.HEIGHT;
    } else if (d.y > GAME.HEIGHT + marginY) {
      d.y = -marginY;
      d.x = this.random() * GAME.WIDTH;
    } else if (d.y < -marginY) {
      d.y = GAME.HEIGHT + marginY;
      d.x = this.random() * GAME.WIDTH;
    }
  }
}
