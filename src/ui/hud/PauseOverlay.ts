import type Phaser from "phaser";
import { GAME } from "../../config/constants";
import { PALETTE } from "../../config/palette";
import { textStyle } from "../theme";
import { DEPTH } from "./layout";

/**
 * The pause screen: an almost opaque cover over everything, so the player
 * can't keep solving sums during a break (the 3D view also hides the aliens).
 * Tapping it resumes.
 */
export class PauseOverlay {
  private parts: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onResume: () => void,
    /** Story: leave for the map (the run is saved at the level's start). */
    private readonly onQuit: (() => void) | null = null,
  ) {}

  show(): void {
    const center = { x: GAME.WIDTH / 2, y: GAME.HEIGHT / 2 };
    const cover = this.scene.add
      .rectangle(center.x, center.y, GAME.WIDTH, GAME.HEIGHT, PALETTE.BACKGROUND, 0.92)
      .setDepth(DEPTH.PAUSE)
      .setInteractive();
    cover.on("pointerdown", this.onResume);
    const label = this.scene.add
      .text(center.x, center.y, "PAUSED\n\ntap / P to resume", textStyle(28, PALETTE.ACCENT, { align: "center" }))
      .setOrigin(0.5)
      .setDepth(DEPTH.PAUSE + 1);
    this.parts = [cover, label];
    if (this.onQuit) {
      const quit = this.scene.add
        .text(center.x, center.y + 120, "SAVE & QUIT TO MAP", textStyle(20, PALETTE.GOLD))
        .setOrigin(0.5)
        .setPadding(12)
        .setDepth(DEPTH.PAUSE + 1)
        .setInteractive({ useHandCursor: true });
      const onQuit = this.onQuit;
      quit.on("pointerdown", (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation(); // don't also resume
        onQuit();
      });
      this.parts.push(quit);
    }
  }

  hide(): void {
    for (const part of this.parts) part.destroy();
    this.parts = [];
  }
}
