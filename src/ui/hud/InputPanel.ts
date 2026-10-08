import type Phaser from "phaser";
import { GAME, KEYPAD_AREA, PLAYER, type InputMode } from "../../config/constants";
import { inputMode, setInputMode } from "../../config/inputMode";
import { PALETTE } from "../../config/palette";
import type { InkEvent } from "../../handwriting/inkReader";
import DrawPad from "../DrawPad";
import { textStyle } from "../theme";
import { ANSWER_Y, DEPTH } from "./layout";

/** A key of the on-screen keypad: a digit, C (clear) or < (backspace). */
export type PadKey = string;

const KEYPAD_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"];
const KEYPAD_COLUMNS = 3;
const KEY_W = 120;
const KEY_H = 42;

export interface InputPanelOptions {
  /** A keypad key was pressed (or the drawing pad's C). */
  onKey: (key: PadKey, source: "keypad" | "pad") => void;
  /** The drawing pad read some ink. */
  onInk: (event: InkEvent) => void;
}

/**
 * The on-screen answer input under the ship: the keypad, or the drawing pad
 * in the same box (never over the field, so a finger doesn't hide the
 * aliens). A switch right of the answer display picks one; the choice is
 * saved. The physical keyboard works in both modes (GameScene handles it).
 */
export class InputPanel {
  private readonly keypadParts: Phaser.GameObjects.GameObject[] = [];
  private readonly pad: DrawPad;
  /** The drawing pad's C button (only shown in draw mode). */
  private readonly padClearParts: Phaser.GameObjects.GameObject[];
  private readonly modeLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, options: InputPanelOptions) {
    this.buildKeypad(scene, options.onKey);

    const { TOP, BOTTOM, PAD_W } = KEYPAD_AREA;
    this.pad = new DrawPad(scene, GAME.WIDTH / 2, (TOP + BOTTOM) / 2, PAD_W, BOTTOM - TOP, options.onInk);

    const mode = smallButton(scene, GAME.WIDTH - 62, 76, "", () =>
      this.setMode(inputMode() === "draw" ? "keys" : "draw"),
    );
    this.modeLabel = mode.text;
    const clear = smallButton(scene, 62, 44, "C", () => options.onKey("C", "pad"));
    this.padClearParts = [clear.bg, clear.text];

    this.setMode(inputMode());
  }

  /** Off during pause and after game over (drops any ink). */
  setEnabled(enabled: boolean): void {
    this.pad.setEnabled(enabled);
  }

  /** Once per frame while playing (the pad's ink and read timer). */
  update(deltaMs: number): void {
    this.pad.update(deltaMs);
  }

  private setMode(mode: InputMode): void {
    setInputMode(mode);
    const draw = mode === "draw";
    showInteractive(this.keypadParts, !draw);
    showInteractive(this.padClearParts, draw);
    this.pad.setVisible(draw);
    this.modeLabel.setText(draw ? "KEYPAD" : "✎ DRAW");
  }

  private buildKeypad(scene: Phaser.Scene, onKey: InputPanelOptions["onKey"]): void {
    const startX = GAME.WIDTH / 2 - KEY_W;
    const startY = PLAYER.Y + 70;
    KEYPAD_LABELS.forEach((label, i) => {
      const x = startX + (i % KEYPAD_COLUMNS) * KEY_W;
      const y = startY + Math.floor(i / KEYPAD_COLUMNS) * KEY_H;
      const key = scene.add
        .rectangle(x, y, KEY_W - 8, KEY_H - 6, PALETTE.PANEL)
        .setStrokeStyle(2, PALETTE.ACCENT)
        .setInteractive({ useHandCursor: true });
      const text = scene.add.text(x, y, label, textStyle(22)).setOrigin(0.5);
      this.keypadParts.push(key, text);

      key.on("pointerdown", () => {
        key.setFillStyle(PALETTE.PANEL_LIGHT);
        onKey(label, "keypad");
      });
      key.on("pointerup", () => key.setFillStyle(PALETTE.PANEL));
      key.on("pointerout", () => key.setFillStyle(PALETTE.PANEL));
    });
  }
}

/** A small button on the answer row. */
function smallButton(scene: Phaser.Scene, x: number, w: number, label: string, onPress: () => void) {
  const bg = scene.add
    .rectangle(x, ANSWER_Y, w, 26, PALETTE.PANEL)
    .setStrokeStyle(1, PALETTE.ACCENT)
    .setDepth(DEPTH.HUD)
    .setInteractive({ useHandCursor: true });
  const text = scene.add.text(x, ANSWER_Y, label, textStyle(13)).setOrigin(0.5).setDepth(DEPTH.HUD);
  bg.on("pointerdown", onPress);
  return { bg, text };
}

/** Show or hide objects, and turn their pointer input on or off with them. */
function showInteractive(objects: readonly Phaser.GameObjects.GameObject[], on: boolean): void {
  for (const obj of objects) {
    (obj as Phaser.GameObjects.Rectangle).setVisible(on);
    if (obj.input) obj.input.enabled = on;
  }
}
