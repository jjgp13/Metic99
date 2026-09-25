import Phaser from "phaser";
import { GAME, PLAYER } from "../config/constants";

/**
 * Static rules screen reached from the menu. Explains the core loop, controls
 * and scoring, then returns to the menu.
 */
export default class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super("HowToPlayScene");
  }

  create(): void {
    const cx = GAME.WIDTH / 2;
    const lives: number = PLAYER.LIVES;

    this.add
      .text(cx, 60, "HOW TO PLAY", {
        fontFamily: "monospace",
        fontSize: "30px",
        color: "#ffd166",
      })
      .setOrigin(0.5);

    const sections: { heading: string; body: string }[] = [
      {
        heading: "GOAL",
        body: "Aliens descend carrying numbered balls.\nStop them before they reach your ship.",
      },
      {
        heading: "HOW TO SHOOT",
        body:
          "Each alien's balls form a SUM. Type that\n" +
          "sum on the keypad or keyboard. Your ship\n" +
          "slides under the matching alien and fires.",
      },
      {
        heading: "STAY ALIVE",
        body:
          `You have ${lives} ${lives === 1 ? "life" : "lives"}. An alien reaching your line\n` +
          "costs one. Lose them all: game over.",
      },
      {
        heading: "SCORE BIG",
        body:
          "Fast solves, streaks and harder sums pay\n" +
          "more. The board toughens as you score.",
      },
      {
        heading: "ENERGY",
        body:
          "Kills charge the EN meter (harder, faster\n" +
          "and streak kills charge more). Press SLOW\n" +
          "to slow your field. M switches slow mode.",
      },
      {
        heading: "CONTROLS",
        body: "0-9 type · Bksp · Esc clear · Space slow · P pause",
      },
    ];

    let y = 120;
    for (const s of sections) {
      this.add.text(40, y, s.heading, {
        fontFamily: "monospace",
        fontSize: "17px",
        color: "#4ea1ff",
      });
      y += 26;
      this.add.text(40, y, s.body, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
        lineSpacing: 4,
      });
      y += s.body.split("\n").length * 20 + 16;
    }

    this.makeBackButton(cx, GAME.HEIGHT - 50);
  }

  private makeBackButton(x: number, y: number): void {
    const back = () => this.scene.start("MenuScene");
    const bg = this.add
      .rectangle(x, y, 200, 46, 0x1b2340)
      .setStrokeStyle(2, 0x4ea1ff)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, "BACK", { fontFamily: "monospace", fontSize: "20px", color: "#ffd166" })
      .setOrigin(0.5);
    bg.on("pointerdown", back);
    this.input.keyboard?.once("keydown-ESC", back);
    this.input.keyboard?.once("keydown-ENTER", back);
  }
}
