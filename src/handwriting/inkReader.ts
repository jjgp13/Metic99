import { HANDWRITING } from "../config/constants";
import { DIGIT_TEMPLATES } from "./digitTemplates";
import { bounds, isScratch, recognize, type Point, type Stroke, type Template } from "./recognizer";

/** What the pad reports once the player stops drawing (or scratches). */
export type InkEvent =
  /** Digits read left to right, with each digit's ink (for the answer stars). */
  | { type: "digits"; digits: string; inks: Stroke[][] }
  /** At least one digit was unlike every template: nothing is entered. */
  | { type: "unknown"; inks: Stroke[][] }
  /** A scratch-out stroke: clear the answer. */
  | { type: "scratch" };

/**
 * Turns pen strokes into digits, free of Phaser and rendering (logical px in,
 * events out) so it can be unit-tested.
 *
 * Each finished stroke is grouped by its sideways extent: it joins the current
 * digit if it overlaps it, and opens the next digit if it lies to its right
 * (overlapping by less than NEW_DIGIT_OVERLAP). So "12" can be written in one
 * go, even close together, while a 4's stem or a 5's or 7's bar (which overlap
 * their digit) never split it. After PAUSE_MS without the pen down, every
 * group is read and reported together, so a 2-digit answer never passes
 * through its 1-digit prefix.
 */
export default class InkReader {
  private groups: Stroke[][] = [];
  private stroke: Stroke | null = null;
  private quietMs = 0;

  constructor(
    private readonly templates: readonly Template[] = DIGIT_TEMPLATES,
    private readonly cfg = HANDWRITING,
  ) {}

  /** Groups of strokes (one per digit), plus the stroke being drawn. */
  public get ink(): readonly Stroke[][] {
    return this.stroke ? [...this.groups, [this.stroke]] : this.groups;
  }

  public get drawing(): boolean {
    return this.stroke !== null;
  }

  public begin(p: Point): void {
    this.stroke = [p];
  }

  public move(p: Point): void {
    const s = this.stroke;
    if (!s) return;
    const q = s[s.length - 1];
    if (q.x !== p.x || q.y !== p.y) s.push(p);
  }

  /** Pen up. A scratch-out is reported at once; otherwise the pause starts. */
  public end(): InkEvent | null {
    const s = this.stroke;
    if (!s) return null;
    this.stroke = null;
    this.quietMs = this.cfg.PAUSE_MS;
    if (isScratch(s)) {
      this.clear();
      return { type: "scratch" };
    }
    const last = this.groups[this.groups.length - 1];
    if (!last || (this.groups.length < this.cfg.MAX_DIGITS && this.startsNewDigit(last, s))) {
      this.groups.push([s]);
    } else {
      last.push(s);
    }
    return null;
  }

  /** Advance the pause; reads the ink when it runs out. */
  public update(deltaMs: number): InkEvent | null {
    if (this.stroke || !this.groups.length) return null;
    this.quietMs -= deltaMs;
    return this.quietMs <= 0 ? this.read() : null;
  }

  public clear(): void {
    this.groups = [];
    this.stroke = null;
  }

  /** Read every group now. Ink too small to be a digit (a tap) is dropped. */
  public read(): InkEvent | null {
    const inks = this.groups.filter((g) => {
      const b = bounds(g);
      return Math.max(b.maxX - b.minX, b.maxY - b.minY) >= this.cfg.MIN_INK_PX;
    });
    this.clear();
    if (!inks.length) return null;
    const digits = inks.map((g) => recognize(g, this.templates, this.cfg.MAX_DISTANCE).digit);
    if (digits.some((d) => d === null)) return { type: "unknown", inks };
    return { type: "digits", digits: digits.join(""), inks };
  }

  private startsNewDigit(group: Stroke[], stroke: Stroke): boolean {
    const a = this.span(group);
    const b = this.span([stroke]);
    if (b.lo + b.hi <= a.lo + a.hi) return false; // not to the right
    const overlap = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
    return overlap < this.cfg.NEW_DIGIT_OVERLAP * Math.min(a.hi - a.lo, b.hi - b.lo);
  }

  /** Sideways extent, widened to MIN_STROKE_W around its center. */
  private span(strokes: Stroke[]): { lo: number; hi: number } {
    const { minX, maxX } = bounds(strokes);
    const pad = Math.max(0, this.cfg.MIN_STROKE_W - (maxX - minX)) / 2;
    return { lo: minX - pad, hi: maxX + pad };
  }
}
