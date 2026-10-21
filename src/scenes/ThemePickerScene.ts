import Phaser from "phaser";
import { DOODLE, GAME } from "../config/constants";
import { THEMES, isThemeUnlocked, selectTheme, selectedTheme, type Theme } from "../config/themes";
import { PAGES } from "../renderDoodle/pages";
import { drawPaper } from "../renderDoodle/paper";
import { islandFrames } from "../renderDoodle/storyMap";
import { loadStoryProgress } from "../services/storyProgress";
import { onKeyDown } from "../ui/keyboard";
import { pencilButton } from "../ui/pencilButton";
import { textStyle } from "../ui/theme";

/** Doodles are drawn at 2× and shown at half size, for a sharp picture. */
const SHARP = 2;
const CARD = { W: 216, H: 84, COLS: [120, 360], TOP: 118, STEP: 90 };

/**
 * The ENDLESS button: pick the run's theme, then PLAY. A theme is a story
 * world's page and path song (config/themes.ts); worlds whose boss isn't
 * beaten yet show a dashed "?" island and how to open them. The pick is
 * saved; GameScene reads it for the look and the music only.
 *
 * Always drawn on paper with ink colors (DOODLE), like the story map.
 * ←/→/↑/↓ step through the open themes, Enter plays, Esc goes back.
 */
export default class ThemePickerScene extends Phaser.Scene {
  private boiling: { image: Phaser.GameObjects.Image; keys: string[] }[] = [];
  private frame = 0;
  /** The gold frame around each open theme's card, by theme id. */
  private frames = new Map<string, Phaser.GameObjects.Rectangle>();
  private picked!: Theme;

  constructor() {
    super("ThemePickerScene");
  }

  create(): void {
    this.boiling = [];
    this.frame = 0;
    this.frames.clear();
    const furthest = loadStoryProgress().furthest;
    this.picked = selectedTheme(furthest);

    this.textures.remove("themePicker:paper");
    this.textures.addCanvas("themePicker:paper", drawPaper(SHARP));
    this.add.image(0, 0, "themePicker:paper").setOrigin(0).setScale(1 / SHARP);

    const cx = GAME.WIDTH / 2;
    this.add.text(cx, 34, "ENDLESS", textStyle(30, DOODLE.GRAPHITE)).setOrigin(0.5);
    this.add
      .text(cx, 62, "pick a theme: it changes the page and the music, never the game", textStyle(13, DOODLE.GRAPHITE_LIGHT))
      .setOrigin(0.5);

    THEMES.forEach((theme, i) => this.makeCard(theme, i, isThemeUnlocked(theme, furthest)));
    this.showPicked();

    const y = GAME.HEIGHT - 40;
    pencilButton(this, 84, y, 120, "BACK", () => this.scene.start("MenuScene"));
    pencilButton(this, GAME.WIDTH - 84, y, 120, "PLAY", () => this.play(), DOODLE.TARGET);

    this.time.addEvent({
      delay: 1000 / DOODLE.BOIL_FPS,
      loop: true,
      callback: () => {
        this.frame++;
        for (const { image, keys } of this.boiling) image.setTexture(keys[this.frame % keys.length]);
      },
    });
    const open = THEMES.filter((t) => isThemeUnlocked(t, furthest));
    onKeyDown(this, (e) => {
      const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
      if (step) this.pick(open[(open.indexOf(this.picked) + step + open.length) % open.length]);
      else if (e.key === "Enter") this.play();
      else if (e.key === "Escape") this.scene.start("MenuScene");
    });
  }

  /** One theme's card: its page's paper and island sketch, or "?" while locked. */
  private makeCard(theme: Theme, index: number, open: boolean): void {
    const x = CARD.COLS[index % 2];
    const y = CARD.TOP + Math.floor(index / 2) * CARD.STEP;
    const page = theme.page ? PAGES[theme.page] : null;
    const paper = open && page ? page.paper : DOODLE.PAPER;
    const card = this.add
      .rectangle(x, y, CARD.W, CARD.H, color(paper))
      .setStrokeStyle(1.5, color(open ? DOODLE.GRAPHITE : DOODLE.GRAPHITE_LIGHT));
    const frame = this.add.rectangle(x, y, CARD.W + 8, CARD.H + 8).setStrokeStyle(3, color(DOODLE.TARGET)).setVisible(false);

    const textX = theme.stage === null ? x : x - CARD.W / 2 + 118;
    const textW = theme.stage === null ? CARD.W - 16 : CARD.W - 124;
    const origin = theme.stage === null ? 0.5 : 0;
    if (theme.stage !== null) {
      const keys = islandFrames(this.textures, theme.stage, open ? "reached" : "unreached", SHARP);
      this.boiling.push({ image: this.add.image(x - CARD.W / 2 + 58, y, keys[0]).setScale(1 / SHARP), keys });
    }
    if (!open) {
      const stage = theme.stage! + 1;
      this.add.text(x - CARD.W / 2 + 58, y + 6, "?", textStyle(28, DOODLE.GRAPHITE_LIGHT)).setOrigin(0.5);
      this.add
        .text(textX, y, `LEVEL ${stage}\nbeat its boss in STORY to unlock`, textStyle(13, DOODLE.GRAPHITE_LIGHT, { wordWrap: { width: textW } }))
        .setOrigin(origin, 0.5);
      return;
    }

    const name = theme.stage === null ? theme.name : `${theme.stage + 1} · ${theme.name}`;
    this.add
      .text(textX, y, name, textStyle(16, DOODLE.GRAPHITE, { align: theme.stage === null ? "center" : "left", wordWrap: { width: textW } }))
      .setOrigin(origin, 0.5);
    this.frames.set(theme.id, frame);
    card.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.pick(theme));
  }

  private pick(theme: Theme): void {
    if (theme === this.picked) return;
    this.picked = theme;
    selectTheme(theme);
    this.showPicked();
    this.sound.play("blip", { volume: 0.4 });
  }

  private showPicked(): void {
    for (const [id, frame] of this.frames) frame.setVisible(id === this.picked.id);
  }

  private play(): void {
    selectTheme(this.picked);
    this.scene.start("GameScene");
  }
}

function color(css: string): number {
  return Phaser.Display.Color.HexStringToColor(css).color;
}
