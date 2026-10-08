import type Phaser from "phaser";
import { FEEDBACK } from "../../config/constants";
import type Alien from "../../objects/Alien";
import { DEPTH } from "./layout";

/**
 * Gold lock-on brackets around the targeted alien's box. They snap in from
 * wider when a new target is acquired.
 */
export class Reticle {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private target: Alien | null = null;
  /** ms since the current target was acquired (drives the snap-in). */
  private ageMs = 0;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.FIELD_OVERLAY);
  }

  setVisible(visible: boolean): void {
    this.gfx.setVisible(visible);
  }

  clear(): void {
    this.gfx.clear();
  }

  /** Draw around `target` (null: nothing); `alpha` = interpolation (SimClock). */
  update(target: Alien | null, alpha: number, deltaMs: number): void {
    if (target !== this.target) {
      this.target = target;
      this.ageMs = 0;
    }
    this.gfx.clear();
    if (!target) return;
    this.ageMs += deltaMs;

    const R = FEEDBACK.RETICLE;
    const x = target.viewX(alpha);
    const y = target.viewY(alpha);
    const snapped = Math.min(1, this.ageMs / R.SNAP_MS); // 0 = just acquired, 1 = in place
    const grow = 1 + (R.SNAP_FROM - 1) * (1 - snapped) ** 2;
    const top = y - target.top - R.PAD;
    const bottom = y + target.bottom + R.PAD;
    const centerY = (top + bottom) / 2;
    const halfW = (target.halfW + R.PAD) * grow;
    const halfH = ((bottom - top) / 2) * grow;

    this.gfx.lineStyle(R.WIDTH, R.COLOR, 0.4 + 0.6 * snapped);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const cornerX = x + sx * halfW;
        const cornerY = centerY + sy * halfH;
        this.gfx.beginPath();
        this.gfx.moveTo(cornerX - sx * R.ARM, cornerY);
        this.gfx.lineTo(cornerX, cornerY);
        this.gfx.lineTo(cornerX, cornerY - sy * R.ARM);
        this.gfx.strokePath();
      }
    }
  }
}
