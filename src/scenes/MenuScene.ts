import Phaser from "phaser";
import { GAME, POWERS, POWER_KINDS, RENDER3D, STORAGE } from "../config/constants";
import { selectPower, selectedPower } from "../config/powers";
import { selectShip, selectedShip } from "../config/ships";
import { onKeyDown } from "../ui/keyboard";
import { PALETTE, css } from "../config/palette";
import { textStyle } from "../ui/theme";

/**
 * Title / main menu. The first scene the player sees: a ship picker (a look
 * only), a power picker (the one power used in play), then PLAY or BATTLE
 * (you + 7 bots), HOW TO PLAY and SCORES. Buttons are large pointer targets
 * (mobile-friendly); ←/→ change ship, ↑/↓ change power and Enter plays.
 */
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create(): void {
    const cx = GAME.WIDTH / 2;

    // A few drifting stars to match the in-game backdrop.
    for (let i = 0; i < 40; i++) {
      const s = this.add.image(
        Phaser.Math.Between(0, GAME.WIDTH),
        Phaser.Math.Between(0, GAME.HEIGHT),
        "star",
      );
      s.setScale(Phaser.Math.FloatBetween(0.3, 1)).setAlpha(0.6);
    }

    this.add
      .text(cx, 130, "METIC", textStyle(72, PALETTE.GOLD))
      .setOrigin(0.5);
    this.add
      .text(cx, 188, "math invaders", textStyle(18, PALETTE.ACCENT))
      .setOrigin(0.5);

    const best = Number(localStorage.getItem(STORAGE.HIGHSCORE) ?? 0);
    if (best > 0) {
      this.add
        .text(cx, 222, `Best: ${best}`, textStyle(16, PALETTE.TEXT_MUTED))
        .setOrigin(0.5);
    }

    this.makeShipPicker(cx, 296);
    this.makePowerPicker(cx, 432);

    this.makeButton(cx - 68, 522, "PLAY", () => this.scene.start("GameScene"), 124);
    // Battle royale vs bots (docs/MULTIPLAYER_DESIGN.md): you + 7 bots, one life.
    this.makeButton(cx + 68, 522, "BATTLE", () => this.scene.start("GameScene", { battle: true }), 124);
    this.makeButton(cx, 582, "HOW TO PLAY", () => this.scene.start("HowToPlayScene"));
    this.makeButton(cx, 642, "SCORES", () =>
      this.scene.start("LeaderboardScene", { browse: true }),
    );

    this.add
      .text(cx, GAME.HEIGHT - 26, "a Phaser math-shooter", textStyle(12, PALETTE.TEXT_MUTED))
      .setOrigin(0.5);

    onKeyDown(this, (e) => {
      if (e.key === "Enter") this.scene.start("GameScene");
    });
  }

  /** ◀ ship ▶ carousel; the pick is saved and used by the next run. */
  private makeShipPicker(x: number, y: number): void {
    const ships = RENDER3D.SHIPS;
    let index = ships.indexOf(selectedShip());
    const icon = this.add.image(x, y, `icon:${ships[index].model}`).setDisplaySize(96, 96);
    const name = this.add
      .text(x, y + 58, ships[index].name, textStyle(18, PALETTE.GOLD))
      .setOrigin(0.5);

    const step = (dir: number) => {
      index = (index + dir + ships.length) % ships.length;
      selectShip(ships[index]);
      icon.setTexture(`icon:${ships[index].model}`).setDisplaySize(96, 96);
      name.setText(ships[index].name);
      this.sound.play("blip", { volume: 0.4 });
    };
    for (const dir of [-1, 1]) {
      const arrow = this.add
        .text(x + dir * 110, y, dir < 0 ? "◀" : "▶", textStyle(36, PALETTE.ACCENT))
        .setOrigin(0.5)
        .setPadding(16)
        .setInteractive({ useHandCursor: true });
      arrow.on("pointerover", () => arrow.setColor(css(PALETTE.GOLD)));
      arrow.on("pointerout", () => arrow.setColor(css(PALETTE.ACCENT)));
      arrow.on("pointerdown", () => step(dir));
    }
    onKeyDown(this, (e) => {
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });
  }

  /** ◀ POWER ▶ picker with a one-line description; saved for the next run. */
  private makePowerPicker(x: number, y: number): void {
    let index = POWER_KINDS.indexOf(selectedPower());
    this.add
      .text(x, y - 30, "POWER", textStyle(13, PALETTE.TEXT_MUTED))
      .setOrigin(0.5);
    const name = this.add
      .text(x, y, "", textStyle(22))
      .setOrigin(0.5);
    const blurb = this.add
      .text(x, y + 24, "", textStyle(13, PALETTE.TEXT_MUTED))
      .setOrigin(0.5);
    const show = () => {
      const def = POWERS[POWER_KINDS[index]];
      name.setText(def.NAME).setColor(css(def.COLOR));
      blurb.setText(def.BLURB);
    };
    show();

    const step = (dir: number) => {
      index = (index + dir + POWER_KINDS.length) % POWER_KINDS.length;
      selectPower(POWER_KINDS[index]);
      show();
      this.sound.play("blip", { volume: 0.4, rate: 1.2 });
    };
    for (const dir of [-1, 1]) {
      const arrow = this.add
        .text(x + dir * 110, y, dir < 0 ? "◀" : "▶", textStyle(28, PALETTE.ACCENT))
        .setOrigin(0.5)
        .setPadding(14)
        .setInteractive({ useHandCursor: true });
      arrow.on("pointerover", () => arrow.setColor(css(PALETTE.GOLD)));
      arrow.on("pointerout", () => arrow.setColor(css(PALETTE.ACCENT)));
      arrow.on("pointerdown", () => step(dir));
    }
    onKeyDown(this, (e) => {
      if (e.key === "ArrowUp") step(-1);
      else if (e.key === "ArrowDown") step(1);
    });
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void, w = 260): void {
    const h = 52;
    const bg = this.add
      .rectangle(x, y, w, h, PALETTE.PANEL)
      .setStrokeStyle(2, PALETTE.ACCENT)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(x, y, label, textStyle(24))
      .setOrigin(0.5);

    bg.on("pointerover", () => {
      bg.setFillStyle(0x24305a);
      txt.setColor(css(PALETTE.GOLD));
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(PALETTE.PANEL);
      txt.setColor(css(PALETTE.TEXT));
    });
    bg.on("pointerdown", onClick);
  }
}
