import rough from "roughjs";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { Options } from "roughjs/bin/core";
import { DOODLE } from "../config/constants";

export type Point = [x: number, y: number];

/**
 * A pencil that draws hand-drawn-looking shapes on a canvas, with Rough.js.
 * Coordinates are logical px with (0, 0) at the doodle's center and +y down
 * (screen direction). Outlines are graphite; `ink` fills a shape with
 * colored-pencil hatching.
 *
 * Every shape gets its own seed from `seed`, so the same seed draws exactly
 * the same wobble and a new seed draws a slightly different one: that is all
 * the line "boil" needs.
 */
export class Pencil {
  private shapes = 0;

  constructor(
    private readonly rc: RoughCanvas,
    private readonly seed: number,
    /** "crayon": colored areas are scribbled in with a waxy zigzag (the
     * ending's drawings); outlines and solid dots stay as they are. */
    private readonly look: "pencil" | "crayon" = "pencil",
  ) {}

  /** A closed shape (outline, plus hatching in `ink`). */
  shape(points: Point[], ink?: string, extra: Options = {}): void {
    this.rc.polygon(points, this.style(ink, extra));
  }

  ellipse(cx: number, cy: number, w: number, h: number, ink?: string, extra: Options = {}): void {
    this.rc.ellipse(cx, cy, w, h, this.style(ink, extra));
  }

  circle(cx: number, cy: number, diameter: number, ink?: string, extra: Options = {}): void {
    this.rc.circle(cx, cy, diameter, this.style(ink, extra));
  }

  /** A shape filled with flat paper: hides what's under it (eye whites). */
  paper(cx: number, cy: number, diameter: number, extra: Options = {}): void {
    this.rc.circle(cx, cy, diameter, this.style(DOODLE.PAPER, { fillStyle: "solid", ...extra }));
  }

  line(x1: number, y1: number, x2: number, y2: number, extra: Options = {}): void {
    this.rc.line(x1, y1, x2, y2, this.style(undefined, extra));
  }

  /** A smooth stroke through `points` (tails, tentacles, flames). */
  curve(points: Point[], extra: Options = {}): void {
    this.rc.curve(points, this.style(undefined, extra));
  }

  /** A solid graphite dot (pupils). */
  dot(cx: number, cy: number, r: number, color: string = DOODLE.GRAPHITE): void {
    this.rc.circle(cx, cy, r * 2, this.style(color, { fillStyle: "solid", stroke: color, roughness: 0.4 }));
  }

  private style(ink: string | undefined, extra: Options): Options {
    this.shapes++;
    const style: Options = {
      seed: this.seed * 101 + this.shapes, // Rough.js needs a seed > 0
      roughness: 1.1,
      bowing: 1.2,
      stroke: DOODLE.GRAPHITE,
      strokeWidth: 1.25,
      ...(ink ? { fill: ink, fillStyle: "hachure", hachureGap: 2.4, hachureAngle: -41, fillWeight: 0.9 } : {}),
      ...extra,
    };
    if (this.look === "crayon" && style.fillStyle === "hachure") {
      return { ...style, fillStyle: "zigzag", fillWeight: 1.7, hachureGap: 3.2 };
    }
    return style;
  }
}

/**
 * A doodle recipe: how to draw one thing, like the Blender recipes in art/.
 * `w` × `h` is the logical box the drawing fits in (centered on the body);
 * `draw` draws one frame, where `t` (0..1) is the place in the boil cycle,
 * so wings can flap and legs step as the frames go round.
 */
export interface DoodleRecipe {
  w: number;
  h: number;
  /** Drawn in crayon instead of colored pencil (the kid's own ship). */
  look?: "pencil" | "crayon";
  draw(pencil: Pencil, t: number): void;
}

/**
 * Draw every frame of a recipe once, up front, onto small canvases at
 * `pxPerUnit` device px per logical px. During play a doodle is then just a
 * picture copied to the screen (cheap on phones); only the frame changes.
 */
export function drawFrames(recipe: DoodleRecipe, pxPerUnit: number, frames: number, seed: number): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let i = 0; i < frames; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(recipe.w * pxPerUnit);
    canvas.height = Math.ceil(recipe.h * pxPerUnit);
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(pxPerUnit, 0, 0, pxPerUnit, canvas.width / 2, canvas.height / 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    recipe.draw(new Pencil(rough.canvas(canvas), seed * 31 + i + 1, recipe.look), i / frames);
    out.push(canvas);
  }
  return out;
}
