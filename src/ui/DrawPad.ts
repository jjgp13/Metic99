import Phaser from "phaser";
import { HANDWRITING } from "../config/constants";
import InkReader, { type InkEvent } from "../handwriting/inkReader";
import { bounds, type Stroke } from "../handwriting/recognizer";
import { PALETTE } from "../config/palette";
import { textStyle, outline } from "./theme";

const INK = HANDWRITING.INK;
const DEPTH = 5;

/**
 * The handwriting pad: a see-through box in the keypad area where the player
 * draws digits with a finger (or mouse). It draws the glowing ink and feeds
 * the strokes to an InkReader; what the reader decides is passed on through
 * `onInk` (digits, unknown or scratch). An unknown drawing flashes red with a
 * "?" here and enters nothing.
 */
export default class DrawPad {
  private readonly reader = new InkReader();
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly bounds: Phaser.Geom.Rectangle;
  /** The pointer drawing the current stroke (other fingers are ignored). */
  private pointerId: number | null = null;
  private enabled = true;
  private shown = false;
  /** Read ink still fading out (the hint waits for it). */
  private fading = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    cx: number,
    cy: number,
    w: number,
    h: number,
    private readonly onInk: (event: InkEvent) => void,
  ) {
    this.bounds = new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h);
    this.bg = scene.add
      .rectangle(cx, cy, w, h, HANDWRITING.PAD_FILL, HANDWRITING.PAD_ALPHA)
      .setStrokeStyle(2, PALETTE.ACCENT, 0.7)
      .setDepth(DEPTH)
      .setInteractive();
    this.hint = scene.add
      .text(cx, cy, "draw the answer\nscribble to clear", textStyle(14, PALETTE.TEXT_MUTED, { align: "center", lineSpacing: 6 }))
      .setOrigin(0.5)
      .setAlpha(0.6)
      .setDepth(DEPTH);
    this.ink = scene.add.graphics().setDepth(DEPTH).setBlendMode(Phaser.BlendModes.ADD);

    this.bg.on("pointerdown", (p: Phaser.Input.Pointer) => this.down(p));
    const input = scene.input;
    const move = (p: Phaser.Input.Pointer) => this.move(p);
    const up = (p: Phaser.Input.Pointer) => this.up(p);
    input.on(Phaser.Input.Events.POINTER_MOVE, move);
    input.on(Phaser.Input.Events.POINTER_UP, up);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.off(Phaser.Input.Events.POINTER_MOVE, move);
      input.off(Phaser.Input.Events.POINTER_UP, up);
      input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);
    });
    this.setVisible(false);
  }

  public setVisible(on: boolean): void {
    this.shown = on;
    this.bg.setVisible(on);
    this.ink.setVisible(on);
    this.redraw();
    if (on) this.bg.setInteractive();
    else this.bg.disableInteractive();
    if (!on) this.cancel();
  }

  /** Disabled (pause, game over): drops any ink and ignores the pen. */
  public setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.cancel();
  }

  public cancel(): void {
    this.reader.clear();
    this.pointerId = null;
    this.redraw();
  }

  /** Runs the pause that ends a drawing (call every frame while playing). */
  public update(delta: number): void {
    if (!this.shown || !this.enabled) return;
    const event = this.reader.update(delta);
    if (!event) return;
    if (event.type === "digits") this.fadeInk(event.inks, INK.COLOR);
    if (event.type === "unknown") {
      this.fadeInk(event.inks, INK.UNKNOWN_COLOR);
      this.showUnknown(event.inks);
    }
    this.redraw();
    this.onInk(event);
  }

  // ---------------------------------------------------------------------------

  private down(p: Phaser.Input.Pointer): void {
    if (!this.enabled || !this.shown || this.pointerId !== null) return;
    this.pointerId = p.id;
    this.reader.begin(this.clamp(p));
    this.redraw();
  }

  private move(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    this.reader.move(this.clamp(p));
    this.redraw();
  }

  private up(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    this.reader.move(this.clamp(p));
    this.pointerId = null;
    const inks = this.reader.ink.slice(); // a scratch clears the reader
    const event = this.reader.end();
    if (event) this.fadeInk(inks, INK.UNKNOWN_COLOR);
    this.redraw();
    if (event) this.onInk(event);
  }

  /** Ink stays inside the pad: what is drawn is what is read. */
  private clamp(p: Phaser.Input.Pointer): { x: number; y: number } {
    const b = this.bounds;
    return {
      x: Phaser.Math.Clamp(p.x, b.left + 2, b.right - 2),
      y: Phaser.Math.Clamp(p.y, b.top + 2, b.bottom - 2),
    };
  }

  private redraw(): void {
    this.ink.clear();
    drawInk(this.ink, this.reader.ink, INK.COLOR);
    this.hint.setVisible(this.shown && !this.reader.ink.length && !this.fading);
  }

  /** Read ink fades out while its stars fly off (or while the "?" shows). */
  private fadeInk(inks: Stroke[][], color: number): void {
    const g = this.scene.add.graphics().setDepth(DEPTH).setBlendMode(Phaser.BlendModes.ADD);
    drawInk(g, inks, color);
    this.fading++;
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: INK.FADE_MS * (color === INK.COLOR ? 1 : 2.5),
      onComplete: () => {
        g.destroy();
        this.fading--;
        this.redraw();
      },
    });
  }

  private showUnknown(inks: Stroke[][]): void {
    const b = bounds(inks.flat());
    const q = this.scene.add
      .text((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, "?", textStyle(48, PALETTE.DANGER, { fontStyle: "bold", ...outline(4) }))
      .setOrigin(0.5)
      .setDepth(DEPTH)
      .setScale(1.5);
    this.scene.tweens.add({ targets: q, scale: 1, duration: 150, ease: "Back.easeOut" });
    this.scene.tweens.add({ targets: q, alpha: 0, delay: 350, duration: 300, onComplete: () => q.destroy() });
  }
}

/** A wide, faint glow under a bright core line. */
function drawInk(g: Phaser.GameObjects.Graphics, groups: readonly Stroke[][], color: number): void {
  for (const group of groups) {
    for (const s of group) {
      if (s.length === 1) {
        g.fillStyle(color, INK.GLOW_ALPHA).fillCircle(s[0].x, s[0].y, INK.GLOW_PX / 2);
        continue;
      }
      g.lineStyle(INK.GLOW_PX, color, INK.GLOW_ALPHA).strokePoints(s);
      g.lineStyle(INK.CORE_PX, color, 1).strokePoints(s);
      g.fillStyle(color, 1);
      g.fillCircle(s[0].x, s[0].y, INK.CORE_PX / 2);
      g.fillCircle(s[s.length - 1].x, s[s.length - 1].y, INK.CORE_PX / 2);
    }
  }
}
