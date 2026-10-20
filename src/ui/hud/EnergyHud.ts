import type Phaser from "phaser";
import { GAME, PLAYER, POWER_CUE } from "../../config/constants";
import { PALETTE } from "../../config/palette";
import type { Field } from "../../sim/Field";
import { textStyle } from "../theme";
import type { Ducker } from "./Ducker";
import { DEPTH, GUTTER, KEY_HINT_Y, METER } from "./layout";
import { dangerClose, justBecameReady, powerCue, type PowerCue } from "./powerCue";

interface GutterButton {
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

export interface EnergyHudOptions {
  /** Battle: SEND takes the left gutter, so POWER is only on the right, and
   * the battle dock takes the key hint's place. */
  battle: boolean;
  onPower: () => void;
  /** The ready moment (energy just crossed the power's cost): the scene plays the chime. */
  onReady?: () => void;
}

/**
 * The player's power and its fuel: the POWER button in the gutters beside
 * the keypad (one per thumb), a small vertical energy meter in the top-right
 * corner with a mark at the power's cost, and a tint over the field while a time power runs.
 * The buttons sit beside the keypad, so they never cover the field or keys;
 * the meter is over the field, so it ducks under aliens like the rest of the
 * top HUD (the numbers win).
 *
 * It also shows when the power is ready (POWER_CUE): the ready moment
 * flashes, then the bar's glow and the buttons breathe, a tag says READY or
 * FULL, and they pulse harder when an alien is close to the ship. It works
 * this out from the field each frame (powerCue.ts); the rules never know.
 */
export class EnergyHud {
  private readonly buttons: GutterButton[] = [];
  private readonly meterFill: Phaser.GameObjects.Rectangle;
  private readonly meterValue: Phaser.GameObjects.Text;
  /** Gold halo behind the bar while the power is ready. */
  private readonly glow: Phaser.GameObjects.Rectangle;
  /** A light band running up a full bar. */
  private readonly shimmer: Phaser.GameObjects.Rectangle;
  /** READY / FULL, under the power's name. */
  private readonly tag: Phaser.GameObjects.Text;
  /** Drawn on the transparent Phaser canvas, so it tints the 3D field below. */
  private readonly fieldTint: Phaser.GameObjects.Rectangle;
  private readonly onReady?: () => void;

  /** Last frame's cue, to spot the frame it changes. */
  private cue: PowerCue;
  /** Drives the breathing and the shimmer; stops while paused (no updates). */
  private clockMs = 0;
  /** Time left of the ready moment's flash, and of the tag's pop. */
  private flashMs = 0;
  private tagPopMs = 0;

  constructor(scene: Phaser.Scene, ducker: Ducker, field: Field, options: EnergyHudOptions) {
    const power = field.power.def;
    this.onReady = options.onReady;

    this.fieldTint = scene.add
      .rectangle(GAME.WIDTH / 2, 0, GAME.WIDTH, PLAYER.Y + 20, power.COLOR, 1)
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.FIELD_OVERLAY)
      .setVisible(false);

    if (!options.battle) this.buttons.push(this.powerButton(scene, GUTTER.LEFT_X, field, options.onPower));
    this.buttons.push(this.powerButton(scene, GUTTER.RIGHT_X, field, options.onPower));

    // The meter: a vertical bar that fills from the bottom, a gold mark at
    // the power's cost, and the value over the power's name to its left.
    // Added first, so the glow draws behind the bar.
    const bottom = METER.TOP + METER.H;
    this.glow = ducker.add(
      scene.add.rectangle(METER.X, METER.TOP + METER.H / 2, METER.W + 10, METER.H + 10, PALETTE.GOLD).setAlpha(0),
    );
    ducker.add(
      scene.add
        .rectangle(METER.X, METER.TOP, METER.W, METER.H, PALETTE.PANEL)
        .setOrigin(0.5, 0)
        .setStrokeStyle(1, PALETTE.PANEL_LIGHT),
    );
    this.meterFill = ducker.add(
      scene.add.rectangle(METER.X, bottom - 2, METER.W - 4, 0, PALETTE.ENERGY).setOrigin(0.5, 1),
    );
    this.shimmer = ducker.add(
      scene.add.rectangle(METER.X, bottom - 2, METER.W - 4, 8, 0xffffff).setOrigin(0.5, 1).setVisible(false),
    );
    const costY = bottom - METER.H * (field.power.cost / field.energy.max);
    ducker.add(scene.add.rectangle(METER.X, costY, METER.W + 6, 2, PALETTE.GOLD));
    this.meterValue = ducker.add(
      scene.add.text(METER.TEXT_X, METER.TOP + 10, "0", textStyle(14)).setOrigin(1, 0.5),
    );
    ducker.add(
      scene.add.text(METER.TEXT_X, METER.TOP + 28, power.NAME, textStyle(10, PALETTE.TEXT_MUTED)).setOrigin(1, 0.5),
    );
    this.tag = ducker.add(
      scene.add.text(METER.TEXT_X, METER.TOP + 47, "", textStyle(14, PALETTE.GOLD, { fontStyle: "bold" })).setOrigin(1, 0.5),
    );

    if (!options.battle) {
      scene.add
        .text(GAME.WIDTH / 2, KEY_HINT_Y, `SPACE or F: ${power.NAME}`, textStyle(11, PALETTE.TEXT_MUTED))
        .setOrigin(0.5)
        .setDepth(DEPTH.HUD);
    }

    // A run that starts ready (story energy carries over) shows it, but
    // without the ready moment: nothing just happened.
    this.cue = powerCue(field.power, field.energy);
    this.update(field);
  }

  /** Once per frame (and right after a press, with no time passed). */
  update(field: Field, deltaMs = 0): void {
    const { energy, power } = field;
    this.meterFill.setSize(METER.W - 4, (METER.H - 4) * energy.fraction);
    this.meterValue.setText(String(Math.floor(energy.value)));

    const cue = powerCue(power, energy);
    if (justBecameReady(this.cue, cue)) {
      this.flashMs = POWER_CUE.FLASH_MS;
      this.tagPopMs = POWER_CUE.FLASH_MS;
      this.onReady?.();
    } else if (this.cue === "ready" && cue === "full") {
      this.tagPopMs = POWER_CUE.FLASH_MS;
    }
    this.cue = cue;
    this.clockMs += deltaMs;
    this.flashMs = Math.max(0, this.flashMs - deltaMs);
    this.tagPopMs = Math.max(0, this.tagPopMs - deltaMs);

    const ready = cue === "ready" || cue === "full";
    const nudge = ready && dangerClose(field.aliens, [field.target, field.lockedTarget]);
    this.showReady(ready, nudge, cue === "full");

    // Lit while running (time) or armed (shield); a gold frame and a
    // breathing gold fill while ready (the name stays in ink, readable at
    // the flash); dim when it can't be used.
    const on = cue === "on";
    const usable = on || power.canTrigger(energy);
    const fill = this.between(nudge ? POWER_CUE.BUTTON.NUDGE : POWER_CUE.BUTTON.BREATHE, nudge);
    for (const { bg, text } of this.buttons) {
      if (on) bg.setFillStyle(power.def.COLOR, 0.45).setStrokeStyle(2, power.def.COLOR);
      else if (ready) bg.setFillStyle(PALETTE.GOLD, Math.max(fill, this.flash() * 0.8)).setStrokeStyle(3, PALETTE.GOLD);
      else bg.setFillStyle(PALETTE.PANEL, 1).setStrokeStyle(2, power.def.COLOR);
      bg.setAlpha(usable ? 1 : 0.35);
      text.setAlpha(usable ? 1 : 0.35);
    }

    const def = power.def;
    const timeRunning = power.running && def.EFFECT === "time";
    this.fieldTint.setVisible(timeRunning);
    if (timeRunning) this.fieldTint.setFillStyle(def.COLOR, def.FACTOR === 0 ? 0.22 : 0.1);
  }

  /** The meter's glow, tag and shimmer. */
  private showReady(ready: boolean, nudge: boolean, full: boolean): void {
    const flash = this.flash();
    const glow = this.between(nudge ? POWER_CUE.GLOW.NUDGE : POWER_CUE.GLOW.BREATHE, nudge);
    this.glow.setAlpha(ready ? Math.max(glow, 0.8 * flash) : 0).setScale(1 + 0.5 * flash);

    this.tag.setVisible(ready).setText(full ? "FULL" : "READY");
    this.tag.setScale(1 + (POWER_CUE.POP_SCALE - 1) * (this.tagPopMs / POWER_CUE.FLASH_MS));

    this.shimmer.setVisible(full);
    if (full) {
      const t = (this.clockMs % POWER_CUE.SHIMMER_MS) / POWER_CUE.SHIMMER_MS;
      const bottom = METER.TOP + METER.H - 2;
      this.shimmer.setY(bottom - t * (METER.H - 12)).setAlpha(0.7 * Math.sin(Math.PI * t));
    }
  }

  /** 1 at the ready moment, fading to 0 over FLASH_MS. */
  private flash(): number {
    return this.flashMs / POWER_CUE.FLASH_MS;
  }

  /** A value breathing between `range`'s ends (faster while nudging). */
  private between(range: readonly [number, number], nudge: boolean): number {
    const period = nudge ? POWER_CUE.NUDGE_MS : POWER_CUE.BREATHE_MS;
    const wave = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.clockMs) / period);
    return range[0] + (range[1] - range[0]) * wave;
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
