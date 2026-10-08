import Phaser from "phaser";
import { GAME, PLAYER } from "../config/constants";
import { PALETTE } from "../config/palette";
import { textStyle } from "../ui/theme";

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
      .text(cx, 60, "HOW TO PLAY", textStyle(30, PALETTE.GOLD))
      .setOrigin(0.5);

    const sections: { heading: string; body: string }[] = [
      {
        heading: "GOAL",
        body: "Aliens descend carrying numbered balls.\nStop them before they reach your ship.",
      },
      {
        heading: "HOW TO SHOOT",
        body:
          "Each alien's balls form a SUM. Type it on\n" +
          "the keypad or keyboard, or tap ✎ DRAW and\n" +
          "write it. Your ship lines up and fires.",
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
          "Kills charge the EN meter. Spend it on the\n" +
          "POWER you picked on the menu (FREEZE, SLOW,\n" +
          "BLAST or SHIELD). Powers never pay for\n" +
          "themselves: their kills charge nothing.",
      },
      {
        heading: "MONSTERS",
        body:
          "Each kind moves its own way. Solve the\n" +
          "harmless glowing jellyfish for energy.\n" +
          "SHIELDED answer twice · SPLITTER pops in 2\n" +
          "BLINKER read its sum while the eyes are open",
      },
      {
        heading: "CONTROLS",
        body: "0-9 · Esc clear · Space / F power · P pause",
      },
    ];

    let y = 100;
    for (const s of sections) {
      this.add.text(40, y, s.heading, textStyle(17, PALETTE.ACCENT));
      y += 24;
      this.add.text(40, y, s.body, textStyle(14, PALETTE.TEXT, { lineSpacing: 4 }));
      y += s.body.split("\n").length * 20 + 2;
    }

    this.makeBackButton(cx, GAME.HEIGHT - 50);
  }

  private makeBackButton(x: number, y: number): void {
    const back = () => this.scene.start("MenuScene");
    const bg = this.add
      .rectangle(x, y, 200, 46, PALETTE.PANEL)
      .setStrokeStyle(2, PALETTE.ACCENT)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, "BACK", textStyle(20, PALETTE.GOLD))
      .setOrigin(0.5);
    bg.on("pointerdown", back);
    this.input.keyboard?.once("keydown-ESC", back);
    this.input.keyboard?.once("keydown-ENTER", back);
  }
}
