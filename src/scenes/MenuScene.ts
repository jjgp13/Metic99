import Phaser from "phaser";
import { DOODLE, GAME, MUSIC, POWERS, POWER_KINDS, RENDER3D } from "../config/constants";
import { artMode } from "../config/artMode";
import { selectPower, selectedPower } from "../config/powers";
import { selectShip, selectedShip } from "../config/ships";
import { storedHighScore } from "../services/masteryStats";
import { isUnlocked, storyComplete, unlockHint } from "../services/shipUnlocks";
import { loadStoryProgress, type StoryProgress } from "../services/storyProgress";
import { onKeyDown } from "../ui/keyboard";
import { PALETTE, css } from "../config/palette";
import { textStyle } from "../ui/theme";
import { lockedIconFrames, shipIconFrames } from "../renderDoodle/shipIcons";
import { crownTexture } from "../renderDoodle/storyMap";
import { music } from "./music";
import { isIPhoneOrIPad } from "../services/audioSession";

/**
 * Title / main menu. The first scene the player sees: a ship picker (a look
 * only), a power picker (the one power used in play), then STORY (the story
 * map), ENDLESS or
 * BATTLE (you + 7 bots), HOW TO PLAY and SCORES. Buttons are large pointer
 * targets (mobile-friendly); ←/→ change ship, ↑/↓ change power and Enter
 * opens ENDLESS (its theme picker). Some ships are unlocked by the story
 * (services/shipUnlocks), and finishing it puts a crown over the title.
 */
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create(): void {
    const cx = GAME.WIDTH / 2;
    music.play(this, MUSIC.MENU_FILE);

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

    const progress = loadStoryProgress();
    if (storyComplete(progress)) {
      this.add.image(cx, 54, crownTexture(this.textures, 2)).setScale(0.75);
      this.add.text(cx, 80, "STORY COMPLETE", textStyle(13, PALETTE.GOLD)).setOrigin(0.5);
    }

    const best = storedHighScore();
    if (best > 0) {
      this.add
        .text(cx, 222, `Best: ${best}`, textStyle(16, PALETTE.TEXT_MUTED))
        .setOrigin(0.5);
    }

    this.makeShipPicker(cx, 296, progress);
    this.makePowerPicker(cx, 432);

    // Story: 10 levels with bosses, lives carried over (docs/SOLO_MODES_DESIGN.md);
    // the map shows how far you got and starts a run.
    this.makeButton(cx - 154, 522, "STORY", () => this.scene.start("StoryMapScene", {}), 144);
    // Endless: play until your lives run out (the world leaderboard), after
    // picking a theme (a world beaten in story: its page and song only).
    this.makeButton(cx, 522, "ENDLESS", () => this.startEndless(), 144);
    // Battle royale vs bots (docs/MULTIPLAYER_DESIGN.md): you + 7 bots, one life.
    this.makeButton(cx + 154, 522, "BATTLE", () => this.scene.start("GameScene", { battle: true }), 144);
    this.makeButton(cx, 582, "HOW TO PLAY", () => this.scene.start("HowToPlayScene"));
    this.makeButton(cx, 642, "SCORES", () =>
      this.scene.start("LeaderboardScene", { browse: true }),
    );

    this.add
      .text(cx, GAME.HEIGHT - 26, "runs are saved anonymously (no names) to tune the game", textStyle(12, PALETTE.TEXT_MUTED))
      .setOrigin(0.5);
    // The silent switch can still mute the game on older iPhones (services/audioSession.ts).
    if (isIPhoneOrIPad()) {
      this.add
        .text(cx, GAME.HEIGHT - 10, "the game has music! no sound? turn off silent mode", textStyle(12, PALETTE.TEXT_MUTED))
        .setOrigin(0.5);
    }

    onKeyDown(this, (e) => {
      if (e.key === "Enter") this.startEndless();
    });
  }

  /** Endless: its theme picker first (scenes/ThemePickerScene.ts), which
   * then starts the run. */
  private startEndless(): void {
    this.scene.start("ThemePickerScene");
  }

  /** ◀ ship ▶ carousel; the pick is saved and used by the next run. A ship
   * the story hasn't unlocked yet shows as a dashed "?" with its name and
   * how to get it, and isn't picked. */
  private makeShipPicker(x: number, y: number, progress: StoryProgress): void {
    const ships = RENDER3D.SHIPS;
    // Progress can only grow, so this happens only if storage was cleared.
    if (!isUnlocked(selectedShip(), progress)) selectShip(ships[0]);
    let index = ships.indexOf(selectedShip());
    const icon = this.add.image(x, y, "star");
    const unknown = this.add.text(x, y, "?", textStyle(40, PALETTE.TEXT_MUTED)).setOrigin(0.5);
    const name = this.add.text(x, y + 58, "", textStyle(18, PALETTE.GOLD)).setOrigin(0.5);
    const hint = this.add.text(x, y + 79, "", textStyle(13, PALETTE.TEXT_MUTED)).setOrigin(0.5);

    // Doodle art: the ship's own doodle, drawn at 2× for a sharp picture and
    // flipping through its boil frames like in play. 3D art: the model's icon
    // (ships without a 3D model show their doodle there too).
    const doodle = artMode() === "doodle";
    let frame = 0;
    const show = () => {
      const ship = ships[index];
      const locked = !isUnlocked(ship, progress);
      unknown.setVisible(locked);
      name.setText(ship.name).setColor(css(locked ? PALETTE.TEXT_MUTED : PALETTE.GOLD));
      hint.setText(locked ? unlockHint(ship) : "");
      if (!locked && !doodle && this.textures.exists(`icon:${ship.model}`)) {
        icon.setTexture(`icon:${ship.model}`).setDisplaySize(96, 96);
        return;
      }
      const keys = locked
        ? lockedIconFrames(this.textures, 192, css(PALETTE.TEXT_MUTED))
        : shipIconFrames(this.textures, ship.model, 192);
      icon.setTexture(keys[frame % keys.length]).setScale(0.5);
    };
    show();
    this.time.addEvent({
      delay: 1000 / DOODLE.BOIL_FPS,
      loop: true,
      callback: () => {
        frame++;
        show();
      },
    });

    const step = (dir: number) => {
      index = (index + dir + ships.length) % ships.length;
      const locked = !isUnlocked(ships[index], progress);
      if (!locked) selectShip(ships[index]);
      show();
      this.sound.play("blip", { volume: 0.4, rate: locked ? 0.7 : 1 });
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
