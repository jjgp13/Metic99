import type Phaser from "phaser";
import { GAME, LEVEL_CLEAR } from "../../config/constants";
import { PALETTE } from "../../config/palette";
import { textStyle } from "../theme";
import { DEPTH } from "./layout";

export interface LevelClearInfo {
  /** 1-based level number and its name. */
  number: number;
  name: string;
  /** Points scored in this level, and the run's total with them. */
  levelScore: number;
  totalScore: number;
  livesLeft: number;
  /** This level's kills, longest streak and length (game clock, ms). */
  kills: number;
  bestCombo: number;
  levelMs: number;
  /** The level score beat this stage's best from an earlier attempt. */
  newBest: boolean;
  /** Whether another level follows (else: to be continued). */
  hasNext: boolean;
}

const CENTER_X = GAME.WIDTH / 2;
const CENTER_Y = GAME.HEIGHT / 2;
/** The stats table: labels left of the center line, values right of it. */
const LABEL_X = CENTER_X - 120;
const VALUE_X = CENTER_X + 120;
const ROW_PX = 30;

/**
 * Story: the results after a level's boss is beaten (the ship has already
 * flown off). The level score counts up from 0 with ticks, the total counts
 * with it, then a NEW BEST stamp (if it is one) and the hint to go on. A tap
 * while it counts jumps to the end (`finishCount`).
 */
export class LevelClearCard {
  private readonly levelScore: Phaser.GameObjects.Text;
  private readonly total: Phaser.GameObjects.Text;
  private readonly stamp: Phaser.GameObjects.Text | null;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly counter: Phaser.Tweens.Tween;
  private counting = true;
  private lastTickAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly info: LevelClearInfo,
  ) {
    scene.add
      .rectangle(CENTER_X, CENTER_Y, GAME.WIDTH, GAME.HEIGHT, PALETTE.BACKGROUND, 0.85)
      .setDepth(DEPTH.GAME_OVER - 1);
    const title = this.text(CENTER_X, 150, `LEVEL ${info.number} CLEAR!`, textStyle(40, PALETTE.GOLD));
    scene.tweens.add({ targets: title, scale: { from: 0.4, to: 1 }, duration: 350, ease: "Back.easeOut" });
    this.text(CENTER_X, 196, info.name, textStyle(22, PALETTE.ACCENT));

    this.text(CENTER_X, 248, "level score", textStyle(16, PALETTE.TEXT_MUTED));
    this.levelScore = this.text(CENTER_X, 286, "0", textStyle(46, PALETTE.GOLD));
    this.stamp = info.newBest
      ? this.text(CENTER_X + 132, 262, "NEW BEST!", textStyle(20, PALETTE.DANGER)).setAngle(-14).setVisible(false)
      : null;

    const rows: [string, string][] = [
      ["total score", ""],
      ["lives left", String(info.livesLeft)],
      ["kills", String(info.kills)],
      ["best combo", `×${info.bestCombo}`],
      ["time", clockTime(info.levelMs)],
    ];
    const valueTexts = rows.map(([label, value], i) => {
      const y = 348 + i * ROW_PX;
      this.text(LABEL_X, y, label, textStyle(20, PALETTE.TEXT_MUTED)).setOrigin(0, 0.5);
      return this.text(VALUE_X, y, value, textStyle(20, PALETTE.TEXT)).setOrigin(1, 0.5);
    });
    this.total = valueTexts[0];

    const hint = info.hasNext ? "tap / Enter: on to the map" : "to be continued…  tap / Enter";
    this.hint = this.text(CENTER_X, 520, hint, textStyle(18, PALETTE.ACCENT)).setVisible(false);

    this.showCount(0);
    this.counter = scene.tweens.addCounter({
      from: 0,
      to: info.levelScore,
      duration: LEVEL_CLEAR.COUNT_MS,
      ease: "Cubic.easeOut", // fast at first, then the last points tick in
      onUpdate: (tween) => this.onCount(Math.round(tween.getValue() ?? 0)),
      onComplete: () => this.finishCount(),
    });
  }

  /** Jump to the end of the count. True if it was still counting (so the
   * tap that did it shouldn't also leave the card). */
  finishCount(): boolean {
    if (!this.counting) return false;
    this.counting = false;
    this.counter.stop();
    this.showCount(this.info.levelScore);
    this.scene.sound.play("blip", { volume: 0.5, rate: 2 });
    this.hint.setVisible(true);
    this.scene.tweens.add({ targets: this.hint, alpha: { from: 0, to: 1 }, duration: 300 });
    if (this.stamp) {
      this.stamp.setVisible(true);
      this.scene.tweens.add({ targets: this.stamp, scale: { from: 2.2, to: 1 }, duration: 250, ease: "Quad.easeIn" });
    }
    return true;
  }

  private onCount(points: number): void {
    this.showCount(points);
    const now = this.scene.time.now;
    if (now - this.lastTickAt < LEVEL_CLEAR.COUNT_TICK_MS) return;
    this.lastTickAt = now;
    // The ticks rise in pitch as the count goes on.
    const share = this.info.levelScore > 0 ? points / this.info.levelScore : 1;
    this.scene.sound.play("blip", { volume: 0.25, rate: 1 + share });
  }

  /** The level score at `points`, and the total with the same points. */
  private showCount(points: number): void {
    const before = this.info.totalScore - this.info.levelScore;
    this.levelScore.setText(String(points));
    this.total.setText(String(before + points));
  }

  private text(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, text, style).setOrigin(0.5).setDepth(DEPTH.GAME_OVER);
  }
}

/** 95_000 ms → "1:35". */
export function clockTime(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
