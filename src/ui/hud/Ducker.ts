import Phaser from "phaser";
import { FEEDBACK } from "../../config/constants";
import type Alien from "../../objects/Alien";
import { DEPTH } from "./layout";

/**
 * "The numbers win over the HUD": HUD pieces and pops drawn over the field
 * fade while any alien's box (its ball row and body) is under them, so they
 * never hide a sum.
 *
 * Each piece goes into its own container. The container's alpha multiplies
 * the piece's own (a lost life's dimmed icon, a pop fading out), so both
 * still work.
 */
export class Ducker {
  private containers: Phaser.GameObjects.Container[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Let `obj` duck under aliens; returns it for chaining. */
  add<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.containers.push(this.scene.add.container(0, 0, [obj]).setDepth(DEPTH.HUD));
    return obj;
  }

  /** Fade every piece that overlaps an alien; `alpha` = interpolation (SimClock). */
  update(aliens: readonly Alien[], alpha: number, deltaMs: number): void {
    const boxes = aliens
      .filter((a) => a.active)
      .map((a) => {
        const x = a.viewX(alpha);
        const y = a.viewY(alpha);
        return new Phaser.Geom.Rectangle(x - a.halfW, y - a.top, a.halfW * 2, a.top + a.bottom);
      });
    const blend = Math.min(1, deltaMs / FEEDBACK.DUCK.MS);
    this.containers = this.containers.filter((c) => {
      if (c.list.length === 0) {
        c.destroy(); // its pop finished
        return false;
      }
      const bounds = c.getBounds();
      const under = boxes.some((b) => Phaser.Geom.Intersects.RectangleToRectangle(bounds, b));
      const goal = under ? FEEDBACK.DUCK.ALPHA : 1;
      c.setAlpha(c.alpha + (goal - c.alpha) * blend);
      return true;
    });
  }
}
