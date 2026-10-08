import type Phaser from "phaser";
import { GAME, PLAYER } from "../../config/constants";
import { PALETTE } from "../../config/palette";
import type { Field } from "../../sim/Field";
import { textStyle } from "../theme";
import { DEPTH, GUTTER, METER } from "./layout";

interface GutterButton {
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

export interface EnergyHudOptions {
  /** Battle: SEND takes the left gutter, so POWER is only on the right, and
   * the battle dock takes the key hint's place. */
  battle: boolean;
  onPower: () => void;
}

/**
 * The player's power and its fuel: the POWER button in the gutters beside
 * the keypad (one per thumb), the energy meter under the keypad with a mark
 * at the power's cost, and a tint over the field while a time power runs.
 * It sits beside and under the keypad, so it never covers the field or keys.
 */
export class EnergyHud {
  private readonly buttons: GutterButton[] = [];
  private readonly meterFill: Phaser.GameObjects.Rectangle;
  private readonly meterValue: Phaser.GameObjects.Text;
  /** Drawn on the transparent Phaser canvas, so it tints the 3D field below. */
  private readonly fieldTint: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, field: Field, options: EnergyHudOptions) {
    const power = field.power.def;

    this.fieldTint = scene.add
      .rectangle(GAME.WIDTH / 2, 0, GAME.WIDTH, PLAYER.Y + 20, power.COLOR, 1)
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.FIELD_OVERLAY)
      .setVisible(false);

    if (!options.battle) this.buttons.push(this.powerButton(scene, GUTTER.LEFT_X, field, options.onPower));
    this.buttons.push(this.powerButton(scene, GUTTER.RIGHT_X, field, options.onPower));

    scene.add.text(GUTTER.LEFT_X, METER.Y, "EN", textStyle(12, PALETTE.ENERGY)).setOrigin(0.5).setDepth(DEPTH.HUD);
    scene.add
      .rectangle(METER.X, METER.Y, METER.W, 12, PALETTE.PANEL)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, PALETTE.PANEL_LIGHT)
      .setDepth(DEPTH.HUD);
    this.meterFill = scene.add
      .rectangle(METER.X, METER.Y, 0, 8, PALETTE.ENERGY)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.HUD);
    const costX = METER.X + METER.W * (field.power.cost / field.energy.max);
    scene.add.rectangle(costX, METER.Y, 2, 18, PALETTE.GOLD).setDepth(DEPTH.HUD);
    this.meterValue = scene.add
      .text(GUTTER.RIGHT_X, METER.Y, "0", textStyle(12))
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD);

    if (!options.battle) {
      scene.add
        .text(GAME.WIDTH / 2, METER.Y + 22, `SPACE or F: ${power.NAME}`, textStyle(11, PALETTE.TEXT_MUTED))
        .setOrigin(0.5)
        .setDepth(DEPTH.HUD);
    }

    this.update(field);
  }

  update(field: Field): void {
    const { energy, power } = field;
    this.meterFill.setSize(METER.W * energy.fraction, 8);
    this.meterValue.setText(String(Math.floor(energy.value)));

    // Lit while running (time) or armed (shield); dim when it can't be used.
    const on = power.running || power.shieldArmed;
    const usable = on || power.canTrigger(energy);
    for (const { bg, text } of this.buttons) {
      bg.setFillStyle(on ? power.def.COLOR : PALETTE.PANEL, on ? 0.45 : 1).setAlpha(usable ? 1 : 0.35);
      text.setAlpha(usable ? 1 : 0.35);
    }

    const def = power.def;
    const timeRunning = power.running && def.EFFECT === "time";
    this.fieldTint.setVisible(timeRunning);
    if (timeRunning) this.fieldTint.setFillStyle(def.COLOR, def.FACTOR === 0 ? 0.22 : 0.1);
  }

  /** A tall button with the power's name written downwards. */
  private powerButton(scene: Phaser.Scene, x: number, field: Field, onPress: () => void): GutterButton {
    const def = field.power.def;
    const bg = scene.add
      .rectangle(x, GUTTER.CENTER_Y, GUTTER.W, GUTTER.H, PALETTE.PANEL)
      .setStrokeStyle(2, def.COLOR)
      .setDepth(DEPTH.HUD)
      .setInteractive({ useHandCursor: true });
    const vertical = def.NAME.split("").join("\n");
    const text = scene.add
      .text(x, GUTTER.CENTER_Y, vertical, textStyle(18, PALETTE.TEXT, { align: "center", lineSpacing: def.NAME.length > 4 ? 0 : 8 }))
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD);
    bg.on("pointerdown", onPress);
    return { bg, text };
  }
}
