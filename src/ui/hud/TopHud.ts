import type Phaser from "phaser";
import { GAME, SCORE } from "../../config/constants";
import { PALETTE } from "../../config/palette";
import { textStyle } from "../theme";
import type { Ducker } from "./Ducker";

const MARGIN = 12;
const DIFFICULTY_BAR_Y = 44;
const DIFFICULTY_BAR_W = GAME.WIDTH - 2 * MARGIN;

export interface TopHudOptions {
  lives: number;
  /** Dev autopilot (`?bot=ace`): its level is shown, else null. */
  autopilotLevel: string | null;
  onPause: () => void;
}

/**
 * The strip at the top of the field: score, difficulty bar, combo, lives and
 * the pause button. Every piece ducks under aliens (see Ducker).
 */
export class TopHud {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly difficultyBar: Phaser.GameObjects.Rectangle;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly lifeIcons: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, ducker: Ducker, options: TopHudOptions) {
    this.scoreText = ducker.add(scene.add.text(MARGIN, MARGIN, "0000000", textStyle(20)));

    // A thin bar that fills as the game gets harder.
    ducker.add(
      scene.add.rectangle(MARGIN, DIFFICULTY_BAR_Y, DIFFICULTY_BAR_W, 4, PALETTE.PANEL).setOrigin(0, 0.5),
    );
    this.difficultyBar = ducker.add(
      scene.add.rectangle(MARGIN, DIFFICULTY_BAR_Y, 0, 4, PALETTE.ACCENT).setOrigin(0, 0.5),
    );

    for (let i = 0; i < options.lives; i++) {
      const icon = scene.add.image(GAME.WIDTH - 18 - i * 26, 22, "life").setScale(1.4);
      this.lifeIcons.push(ducker.add(icon));
    }

    this.comboText = ducker.add(scene.add.text(MARGIN, 56, "", textStyle(14, PALETTE.GOLD)));

    if (options.autopilotLevel) {
      const label = `AUTOPILOT: ${options.autopilotLevel.toUpperCase()}`;
      ducker.add(scene.add.text(GAME.WIDTH - MARGIN, 62, label, textStyle(12, PALETTE.ENERGY)).setOrigin(1, 0.5));
    }

    const pauseButton = ducker.add(scene.add.text(GAME.WIDTH / 2, 22, "II", textStyle(20, PALETTE.ACCENT)).setOrigin(0.5));
    pauseButton.setInteractive({ useHandCursor: true }).on("pointerdown", options.onPause);
  }

  /** `d` = normalized difficulty, 0..1. */
  setDifficulty(d: number): void {
    this.difficultyBar.setSize(d * DIFFICULTY_BAR_W, 4);
  }

  setScore(score: number): void {
    this.scoreText.setText(score.toString().padStart(7, "0"));
  }

  /** The kill streak and the score multiplier it gives (hidden below 2). */
  setCombo(combo: number): void {
    if (combo < 2) {
      this.comboText.setText("");
      return;
    }
    const multiplier = Math.min(SCORE.COMBO_MAX, 1 + (combo - 1) * SCORE.COMBO_STEP);
    this.comboText.setText(`x${multiplier.toFixed(2)}  (${combo} streak)`);
  }

  /** Dim the icon of the life just lost. */
  loseLife(livesLeft: number): void {
    this.lifeIcons[livesLeft]?.setAlpha(0.15);
  }
}
