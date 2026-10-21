import type Phaser from "phaser";
import { DOODLE } from "../config/constants";
import { drawFrames, type DoodleRecipe } from "../renderDoodle/pencil";
import { textStyle } from "./theme";

/** Doodles are drawn at 2× and shown at half size, for a sharp picture. */
const SHARP = 2;

/**
 * A pencil box with a label, for the paper screens (story map, theme
 * picker); `ink` hatches it (the main button). The box is drawn once per
 * size and ink, then reused.
 */
export function pencilButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  label: string,
  onClick: () => void,
  ink?: string,
): void {
  const h = 44;
  const key = `pencilButton:${w}:${ink ?? "plain"}`;
  if (!scene.textures.exists(key)) {
    const box: DoodleRecipe = {
      w: w + 8,
      h: h + 8,
      draw: (p) =>
        p.shape(
          [
            [-w / 2, -h / 2],
            [w / 2, -h / 2],
            [w / 2, h / 2],
            [-w / 2, h / 2],
          ],
          ink,
          { hachureGap: 5, fillWeight: 0.6 },
        ),
    };
    scene.textures.addCanvas(key, drawFrames(box, SHARP, 1, w)[0]);
  }
  const bg = scene.add.image(x, y, key).setScale(1 / SHARP).setInteractive({ useHandCursor: true });
  const text = scene.add.text(x, y, label, textStyle(20, DOODLE.GRAPHITE)).setOrigin(0.5);
  bg.on("pointerover", () => text.setColor(DOODLE.TARGET));
  bg.on("pointerout", () => text.setColor(DOODLE.GRAPHITE));
  bg.on("pointerdown", onClick);
}
