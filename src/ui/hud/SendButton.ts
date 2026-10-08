import type Phaser from "phaser";
import { SEND } from "../../config/constants";
import { PALETTE } from "../../config/palette";
import type { Field } from "../../sim/Field";
import { outline, textStyle } from "../theme";
import { DEPTH, GUTTER } from "./layout";

/** The button's fill while held (a dark attack orange). */
const HELD_FILL = 0x5a3418;
const COLUMN_X = GUTTER.LEFT_X - 22;
const COLUMN_W = 44;

/**
 * Battle: the SEND button in the left gutter, which is also the attack
 * gauge. The gauge fills from the bottom in orange (a mark at each tier);
 * incoming attacks hang from the top in pink, one block per sent alien,
 * soonest at the top, blinking in their last second.
 *
 * Tap = send the strongest tier the gauge buys. Holding steps down one tier
 * per SEND.HOLD_STEP_MS after SEND.HOLD_MS; sliding off cancels.
 */
export class SendButton {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly gauge: Phaser.GameObjects.Graphics;
  /** Scene time when the press started, or null when not held. */
  private heldSince: number | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly field: Field,
    private readonly onSend: (cost: number) => void,
  ) {
    this.bg = scene.add
      .rectangle(GUTTER.LEFT_X, GUTTER.CENTER_Y, GUTTER.W, GUTTER.H, PALETTE.PANEL)
      .setStrokeStyle(2, PALETTE.ATTACK)
      .setDepth(DEPTH.HUD)
      .setInteractive({ useHandCursor: true });
    // The gauge draws over the button's background and under its label.
    this.gauge = scene.add.graphics().setDepth(DEPTH.HUD + 0.1);
    this.label = scene.add
      .text(GUTTER.LEFT_X, GUTTER.CENTER_Y, "", textStyle(18, PALETTE.TEXT, { align: "center", ...outline(3) }))
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD + 0.2);

    this.bg.on("pointerdown", () => {
      if (this.choice() !== null) this.heldSince = scene.time.now;
    });
    this.bg.on("pointerup", () => {
      if (this.heldSince !== null) this.send();
    });
    this.bg.on("pointerout", () => (this.heldSince = null));
  }

  /** Send the tier chosen now (a tap, a release, or the keyboard). */
  send(): void {
    const cost = this.choice();
    this.heldSince = null;
    if (cost !== null) this.onSend(cost);
  }

  update(): void {
    const tier = this.choice();
    this.label.setText(`S\nE\nN\nD\n\n${tier ?? "--"}`).setAlpha(tier === null ? 0.5 : 1);
    this.bg.setFillStyle(this.heldSince !== null ? HELD_FILL : PALETTE.PANEL);
    this.drawGauge();
  }

  /**
   * The tier a release would send now: the strongest affordable one, stepped
   * down by how long the button has been held. Null when nothing is affordable.
   */
  private choice(): number | null {
    const affordable = SEND.TIERS.filter((t) => this.field.attack.canSpend(t.COST))
      .map((t) => t.COST)
      .reverse();
    if (!affordable.length) return null;
    if (this.heldSince === null) return affordable[0];
    const heldMs = this.scene.time.now - this.heldSince;
    const steps = heldMs < SEND.HOLD_MS ? 0 : 1 + Math.floor((heldMs - SEND.HOLD_MS) / SEND.HOLD_STEP_MS);
    return affordable[Math.min(steps, affordable.length - 1)];
  }

  private drawGauge(): void {
    const { attack, incoming, elapsedMs } = this.field;
    const g = this.gauge.clear();
    const pxPerEnergy = GUTTER.H / attack.max;

    const fill = GUTTER.H * attack.fraction;
    g.fillStyle(PALETTE.ATTACK, 0.4).fillRect(COLUMN_X, GUTTER.BOTTOM - fill, COLUMN_W, fill);
    for (const tier of SEND.TIERS) {
      if (tier.COST >= attack.max) continue;
      g.fillStyle(PALETTE.ATTACK, 0.8).fillRect(COLUMN_X, GUTTER.BOTTOM - tier.COST * pxPerEnergy, COLUMN_W, 1);
    }

    let top: number = GUTTER.TOP;
    for (const attackIn of incoming) {
      const h = Math.min(GUTTER.BOTTOM - top, Math.max(4, attackIn.left * pxPerEnergy));
      const landsSoon = attackIn.landsAtMs - elapsedMs < 1000;
      const alpha = landsSoon ? 0.55 + 0.45 * Math.sin(this.scene.time.now / 60) : 0.9;
      g.fillStyle(PALETTE.INCOMING, alpha).fillRect(COLUMN_X, top, COLUMN_W, h - 1);
      top += h;
      if (top >= GUTTER.BOTTOM) break;
    }
  }
}
