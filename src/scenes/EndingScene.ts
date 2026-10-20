import Phaser from "phaser";
import { DOODLE, ENDING, GAME, MUSIC } from "../config/constants";
import { selectedShip } from "../config/ships";
import {
  crayonRecipe,
  drawCrayonDoodle,
  drawDesk,
  FLAT_HAND,
  GRIP_HAND,
  HAND_TIP,
  sheetDoodles,
  sheetRecipe,
  STICKY_NOTE,
} from "../renderDoodle/ending";
import { drawFrames, type DoodleRecipe } from "../renderDoodle/pencil";
import { grayPencil } from "../renderDoodle/storyMap";
import { onKeyDown } from "../ui/keyboard";
import { textStyle } from "../ui/theme";

/** Doodles are drawn at 2× and shown at half size, for a sharp picture. */
const SHARP = 2;
/** The right arm reaches in from the bottom right, the left from the left
 * edge (so the score note at the bottom left stays clear). */
const RIGHT_ARM_TURN = -0.6;
const LEFT_ARM_TURN = 0.9;
/** Where the left hand rests on the sheet (sheet px from its center). */
const LEFT_HAND_AT = { x: -186, y: 196 };
/** Where the right hand waits when it isn't coloring (sheet px). */
const RIGHT_HAND_REST = { x: 150, y: 250 };

/** Where the scene goes when the player taps: the scene and its data. */
export interface EndingNext {
  scene: string;
  /** Always given: Phaser restarts a scene with its last data otherwise. */
  data: object;
}

export interface EndingData {
  /** The finished run's score. */
  score: number;
  next: EndingNext;
}

/** One doodle on the sheet: its gray pencil sketch and its crayon version
 * on top, cropped while it is being colored in. */
interface SheetDoodle {
  x: number;
  y: number;
  colored: Phaser.GameObjects.Image;
  widthPx: number;
  heightPx: number;
}

/**
 * The ending, after the last level's boss (owner's design): seen from above,
 * a kid at a desk colors the game's bosses in crayon on a small sheet of
 * paper. The kid imagined it all. The last few doodles are still gray pencil
 * sketches; the kid's hand colors them in one by one. THANK YOU FOR PLAYING
 * is written on the sheet, the run's score is on a sticky note, and a tap
 * goes on to `next` (name entry, or the story map).
 *
 * It plays `ending.mp3` once if that file exists; without it the scene is
 * silent. Dev: `?ending=1` opens it straight from boot.
 */
export default class EndingScene extends Phaser.Scene {
  private next!: EndingNext;
  private leaving = false;
  private music: Phaser.Sound.BaseSound | null = null;

  constructor() {
    super("EndingScene");
  }

  create(data: EndingData): void {
    this.next = data.next;
    this.leaving = false;
    this.music = null;

    this.textures.remove("ending:desk");
    this.textures.addCanvas("ending:desk", drawDesk(SHARP));
    this.add.image(0, 0, "ending:desk").setOrigin(0).setScale(1 / SHARP);

    const sheet = this.makeSheet();
    const doodles = this.makeDoodles(sheet);
    this.makeHand(sheet, FLAT_HAND, LEFT_HAND_AT, LEFT_ARM_TURN);
    const crayon = this.add.image(RIGHT_HAND_REST.x, RIGHT_HAND_REST.y, this.crayonTexture(ENDING.CRAYONS[0]));
    crayon.setOrigin(0.5, 0).setScale(1 / SHARP).setRotation(RIGHT_ARM_TURN);
    sheet.add(crayon);
    const hand = this.makeHand(sheet, GRIP_HAND, RIGHT_HAND_REST, RIGHT_ARM_TURN);
    this.makeScoreNote(data.score);

    this.colorIn(doodles.slice(-ENDING.STILL_GRAY), hand, crayon);
    this.playMusic();
    this.cameras.main.fadeIn(ENDING.FADE_IN_MS, 0xf8, 0xf4, 0xe8);

    this.time.delayedCall(ENDING.TAP_AFTER_MS, () => {
      this.input.on("pointerdown", () => this.leave());
      onKeyDown(this, (e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") this.leave();
      });
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.music?.destroy());
  }

  /** The kid's sheet, tilted a little on the desk, with THANK YOU on it.
   * Everything on the sheet goes in this container (sheet px). */
  private makeSheet(): Phaser.GameObjects.Container {
    const s = ENDING.SHEET;
    const sheet = this.add.container(s.X, s.Y).setRotation(s.TILT);
    sheet.add(this.add.rectangle(5, 7, s.W, s.H, 0x5a3a1a, 0.18)); // its shadow on the desk
    sheet.add(this.add.image(0, 0, this.drawOnce("ending:sheet", sheetRecipe(s.W, s.H))).setScale(1 / SHARP));
    const top = -s.H / 2;
    sheet.add(this.add.text(0, top + 32, "THANK YOU FOR PLAYING!", textStyle(34, "#8e4fd8")).setOrigin(0.5));
    sheet.add(
      this.add.text(0, top + 62, "you beat all 10 worlds of my notebook", textStyle(16, DOODLE.GRAPHITE_LIGHT)).setOrigin(0.5),
    );
    return sheet;
  }

  /** The bosses (and the player's ship) in rows on the sheet; the last
   * ones start as gray sketches. Returns them in sheet order. */
  private makeDoodles(sheet: Phaser.GameObjects.Container): SheetDoodle[] {
    const recipes = sheetDoodles(selectedShip().model);
    const perRow = 3;
    const fit = { maxW: ENDING.CELL_W * 0.86, maxH: ENDING.CELL_H * 0.86 };
    const grayFrom = recipes.length - ENDING.STILL_GRAY;
    return recipes.map((recipe, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, recipes.length - row * perRow);
      const x = (i % perRow - (inRow - 1) / 2) * ENDING.CELL_W;
      const y = ENDING.ROWS_Y[row] ?? 0;
      const canvas = drawCrayonDoodle(recipe, fit, SHARP);
      const key = `ending:doodle:${i}`;
      this.textures.remove(key);
      this.textures.addCanvas(key, canvas);
      if (i >= grayFrom) {
        const sketch = document.createElement("canvas");
        sketch.width = canvas.width;
        sketch.height = canvas.height;
        sketch.getContext("2d")!.drawImage(canvas, 0, 0);
        grayPencil(sketch, ENDING.GRAY_LIGHTEN);
        this.textures.remove(`${key}:gray`);
        this.textures.addCanvas(`${key}:gray`, sketch);
        sheet.add(this.add.image(x, y, `${key}:gray`).setScale(1 / SHARP));
      }
      const colored = this.add.image(x, y, key).setScale(1 / SHARP);
      if (i >= grayFrom) colored.setCrop(0, 0, 0, canvas.height);
      sheet.add(colored);
      return { x, y, colored, widthPx: canvas.width, heightPx: canvas.height };
    });
  }

  /** A hand doodle (it boils like every doodle), placed by its fingertips. */
  private makeHand(
    sheet: Phaser.GameObjects.Container,
    recipe: DoodleRecipe,
    at: { x: number; y: number },
    turn: number,
  ): Phaser.GameObjects.Image {
    const grip = recipe === GRIP_HAND;
    const keys = Array.from({ length: DOODLE.BOIL_FRAMES }, (_, i) => `ending:hand:${grip ? "grip" : "flat"}:${i}`);
    if (!this.textures.exists(keys[0])) {
      drawFrames(recipe, SHARP, DOODLE.BOIL_FRAMES, grip ? 11 : 12).forEach((c, i) => this.textures.addCanvas(keys[i], c));
    }
    const tipY = (HAND_TIP.y + recipe.h / 2) / recipe.h;
    const hand = this.add.image(at.x, at.y, keys[0]).setOrigin(0.5, tipY).setScale(1 / SHARP).setRotation(turn);
    sheet.add(hand);
    let frame = 0;
    this.time.addEvent({
      delay: 1000 / DOODLE.BOIL_FPS,
      loop: true,
      callback: () => hand.setTexture(keys[++frame % keys.length]),
    });
    return hand;
  }

  /** The run's score on a sticky note at the bottom left, under the sheet. */
  private makeScoreNote(score: number): void {
    const x = 112;
    const y = GAME.HEIGHT - 70;
    const note = this.add.container(x, y).setRotation(-0.05);
    note.add(this.add.image(0, 0, this.drawOnce("ending:note", STICKY_NOTE)).setScale(1 / SHARP));
    note.add(this.add.text(0, -30, "your score", textStyle(16, DOODLE.GRAPHITE_LIGHT)).setOrigin(0.5));
    note.add(this.add.text(0, -4, score.toLocaleString("en-US"), textStyle(30, DOODLE.GRAPHITE)).setOrigin(0.5));
    const hint = this.add.text(0, 28, "tap to continue", textStyle(14, DOODLE.GRAPHITE_LIGHT)).setOrigin(0.5);
    note.add(hint);
    hint.setAlpha(0);
    this.tweens.add({ targets: hint, alpha: 1, delay: ENDING.TAP_AFTER_MS, duration: 400 });
  }

  /**
   * The hand colors the gray doodles in, one after another: it moves to a
   * doodle, picks the next crayon, and scribbles across it while the crayon
   * version is uncovered left to right. Then it goes back to rest.
   */
  private colorIn(doodles: SheetDoodle[], hand: Phaser.GameObjects.Image, crayon: Phaser.GameObjects.Image): void {
    const moveTo = (x: number, y: number, delay: number, onComplete?: () => void) =>
      this.tweens.add({ targets: [hand, crayon], x, y, delay, duration: ENDING.MOVE_MS, ease: "Sine.easeInOut", onComplete });

    const colorNext = (i: number) => {
      const doodle = doodles[i];
      if (!doodle) return void moveTo(RIGHT_HAND_REST.x, RIGHT_HAND_REST.y, 300);
      const w = doodle.widthPx / SHARP;
      const h = doodle.heightPx / SHARP;
      const left = doodle.x - w / 2;
      moveTo(left, doodle.y, i === 0 ? ENDING.START_MS : 200, () => {
        crayon.setTexture(this.crayonTexture(ENDING.CRAYONS[i % ENDING.CRAYONS.length]));
        const stroke = { done: 0 };
        this.tweens.add({
          targets: stroke,
          done: 1,
          duration: ENDING.COLOR_MS,
          onUpdate: () => {
            doodle.colored.setCrop(0, 0, doodle.widthPx * stroke.done, doodle.heightPx);
            const scribble = Math.sin(stroke.done * ENDING.COLOR_MS * 0.001 * ENDING.SCRIBBLE_HZ * Math.PI * 2);
            hand.setPosition(left + w * stroke.done, doodle.y + scribble * h * 0.35);
            crayon.setPosition(hand.x, hand.y);
          },
          onComplete: () => colorNext(i + 1),
        });
      });
    };
    colorNext(0);
  }

  /** The ending jingle, once, if the file is there (it may not exist yet:
   * a missing file only means silence). */
  private playMusic(): void {
    const key = `music:${ENDING.MUSIC_FILE}`;
    const play = () => {
      if (!this.scene.isActive() || !this.cache.audio.exists(key)) return;
      this.music = this.sound.add(key, { volume: MUSIC.VOLUME });
      this.music.play();
    };
    if (this.cache.audio.exists(key)) return play();
    this.load.audio(key, `assets/music/${ENDING.MUSIC_FILE}`);
    this.load.once(Phaser.Loader.Events.COMPLETE, play);
    this.load.start();
  }

  /** A recipe drawn once (one frame) into a texture; returns its key. */
  private drawOnce(key: string, recipe: DoodleRecipe): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, drawFrames(recipe, SHARP, 1, 5)[0]);
    return key;
  }

  private crayonTexture(color: string): string {
    return this.drawOnce(`ending:crayon:${color}`, crayonRecipe(color));
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start(this.next.scene, this.next.data);
  }
}
