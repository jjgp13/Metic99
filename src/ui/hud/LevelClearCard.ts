import type Phaser from "phaser";
import { GAME } from "../../config/constants";
import { PALETTE } from "../../config/palette";
import { textStyle } from "../theme";
import { DEPTH } from "./layout";

export interface LevelClearInfo {
  /** 1-based level number and its name. */
  number: number;
  name: string;
  /** Points scored in this level, and the run's total so far. */
  levelScore: number;
  totalScore: number;
  livesLeft: number;
  /** Whether another level follows (else: to be continued). */
  hasNext: boolean;
}

const CENTER_X = GAME.WIDTH / 2;
const CENTER_Y = GAME.HEIGHT / 2;

/** Story: the card over the field when a level's boss is beaten. */
export class LevelClearCard {
  constructor(
    private readonly scene: Phaser.Scene,
    info: LevelClearInfo,
  ) {
    scene.add
      .rectangle(CENTER_X, CENTER_Y, GAME.WIDTH, GAME.HEIGHT, PALETTE.BACKGROUND, 0.8)
      .setDepth(DEPTH.GAME_OVER - 1);
    this.line(-110, `LEVEL ${info.number} CLEAR!`, textStyle(40, PALETTE.GOLD));
    this.line(-62, info.name, textStyle(22, PALETTE.ACCENT));
    const stats = [
      `level score   ${info.levelScore}`,
      `total score   ${info.totalScore}`,
      `lives left    ${info.livesLeft}`,
    ].join("\n");
    this.line(10, stats, textStyle(18, PALETTE.TEXT, { align: "left", lineSpacing: 8 }));
    const hint = info.hasNext
      ? `tap / Enter: level ${info.number + 1}`
      : "to be continued…  tap / Enter for the menu";
    this.line(100, hint, textStyle(16, PALETTE.ACCENT));
  }

  /** A centered line `dy` px below the screen's center. */
  private line(dy: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle): void {
    this.scene.add.text(CENTER_X, CENTER_Y + dy, text, style).setOrigin(0.5).setDepth(DEPTH.GAME_OVER);
  }
}
