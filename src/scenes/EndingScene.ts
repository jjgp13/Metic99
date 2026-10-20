import Phaser from "phaser";
import { DOODLE, ENDING, GAME, LEVELS, MUSIC } from "../config/constants";
import { selectedShip } from "../config/ships";
import {
  crayonRecipe,
  drawCrayonDoodle,
  drawDesk,
  FLAT_HAND,
  GRIP_HAND,
  HAND_TIP,
  HEART,
  sheetDoodles,
  sheetRecipe,
  STICKY_NOTE,
} from "../renderDoodle/ending";
import { drawPaper } from "../renderDoodle/paper";
import { drawFrames, type DoodleRecipe } from "../renderDoodle/pencil";
import { grayPencil } from "../renderDoodle/storyMap";
import { onKeyDown } from "../ui/keyboard";
import { textStyle } from "../ui/theme";
import { creditLines, type CreditStyle } from "./endingCredits";
import { loadOptionalMusic } from "./extraMusic";

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

/** How each kind of credits line is written: size, color. */
const CREDIT_LOOK: Record<CreditStyle, { size: number; color: string }> = {
  title: { size: 50, color: "#8e4fd8" },
  author: { size: 32, color: DOODLE.GRAPHITE },
  body: { size: 23, color: DOODLE.GRAPHITE },
  reward: { size: 24, color: "#d4691c" },
  sign: { size: 30, color: DOODLE.GRAPHITE },
};
/** The credits are centered between the page's red margin and its right edge. */
const CREDITS_X = (DOODLE.MARGIN_X + GAME.WIDTH) / 2;
/** The rule "tap to continue" sits on, under the credits. */
const HINT_RULE = 23;

/** Where the scene goes when the player taps: the scene and its data. */
export interface EndingNext {
  scene: string;
  /** Always given: Phaser restarts a scene with its last data otherwise. */
  data: object;
}

export interface EndingData {
  /** The finished run's score. */
  score: number;
  /** Game-clock time of the whole run, every level and boss. */
  playedMs: number;
  /** What beating the story unlocked ("the crayon ship"), for a line in
   * the credits; left out when nothing was unlocked. */
  unlocked?: string;
  next: EndingNext;
}

/** Where the ending is: the kid coloring, the credits being written, or
 * the credits written (a tap may leave once READ_MIN_MS has passed). */
type Phase = "drawing" | "writing" | "written";

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
 * The ending, after the last level's boss (owner's design), in two beats:
 *
 * 1. The drawing: seen from above, a kid at a desk colors the game's bosses
 *    in crayon on a small sheet of paper. The kid imagined it all. The last
 *    few doodles are still gray pencil sketches; the kid's hand colors them
 *    in one by one. THANK YOU FOR PLAYING is on the sheet, the score on a
 *    sticky note.
 * 2. The credits: a fresh notebook page slides over the desk and the
 *    credits are written on its rules, line by line: who made the game, a
 *    thank-you, and the run told back (time played, worlds, score).
 *
 * A tap on the drawing turns to the credits; a tap while they are written
 * finishes them; only once they have been up READ_MIN_MS does a tap fade out
 * and go on to `next` (name entry, or the story map). So the thank-you is
 * never skipped by accident.
 *
 * Music fades in with the drawing: `ending.mp3` once if the file exists,
 * else the bedroom's path track, slowed and soft. Dev: `?ending=1`.
 */
export default class EndingScene extends Phaser.Scene {
  private next!: EndingNext;
  private run!: EndingData;
  private phase: Phase = "drawing";
  private leaving = false;
  /** Game time from which a tap may leave (after the credits are up). */
  private leaveAt = Infinity;
  private music: Phaser.Sound.BaseSound | null = null;
  /** The credits' write-on tweens, and how to show each line at once. */
  private writing: { tween: Phaser.Tweens.Tween; show: () => void }[] = [];
  private hint: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("EndingScene");
  }

  create(data: EndingData): void {
    this.next = data.next;
    this.run = data;
    this.phase = "drawing";
    this.leaving = false;
    this.leaveAt = Infinity;
    this.music = null;
    this.writing = [];
    this.hint = null;

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

    this.colorIn(doodles.slice(-ENDING.STILL_GRAY), hand, crayon, () =>
      this.time.delayedCall(ENDING.DRAWING_HOLD_MS, () => this.showCredits()),
    );
    this.playMusic();
    this.cameras.main.fadeIn(ENDING.FADE_IN_MS, 0xf8, 0xf4, 0xe8);

    this.time.delayedCall(ENDING.TAP_AFTER_MS, () => {
      this.input.on("pointerdown", () => this.tap());
      onKeyDown(this, (e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") this.tap();
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
    note.add(this.add.text(0, -24, "your score", textStyle(16, DOODLE.GRAPHITE_LIGHT)).setOrigin(0.5));
    note.add(this.add.text(0, 4, score.toLocaleString("en-US"), textStyle(30, DOODLE.GRAPHITE)).setOrigin(0.5));
  }

  /**
   * The hand colors the gray doodles in, one after another: it moves to a
   * doodle, picks the next crayon, and scribbles across it while the crayon
   * version is uncovered left to right. Then it goes back to rest and
   * calls `done`.
   */
  private colorIn(
    doodles: SheetDoodle[],
    hand: Phaser.GameObjects.Image,
    crayon: Phaser.GameObjects.Image,
    done: () => void,
  ): void {
    const moveTo = (x: number, y: number, delay: number, onComplete?: () => void) =>
      this.tweens.add({ targets: [hand, crayon], x, y, delay, duration: ENDING.MOVE_MS, ease: "Sine.easeInOut", onComplete });

    const colorNext = (i: number) => {
      const doodle = doodles[i];
      if (!doodle) return void moveTo(RIGHT_HAND_REST.x, RIGHT_HAND_REST.y, 300, done);
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

  /** Every tap or key goes here; what it does depends on the phase. */
  private tap(): void {
    if (this.phase === "drawing") this.showCredits();
    else if (this.phase === "writing") this.finishWriting();
    else if (this.time.now >= this.leaveAt) this.leave();
  }

  /**
   * Turn to the credits: a fresh notebook page slides in over the desk,
   * then its lines are written one after another, left to right, like a
   * pencil writing them. The drawing goes on under the page, unseen.
   */
  private showCredits(): void {
    if (this.phase !== "drawing") return;
    this.phase = "writing";
    this.textures.remove("ending:page");
    this.textures.addCanvas("ending:page", drawPaper(SHARP));
    const page = this.add.container(GAME.WIDTH + 30, 0).setRotation(0.06);
    page.add(this.add.rectangle(-6, 0, 12, GAME.HEIGHT, 0x5a3a1a, 0.18).setOrigin(0.5, 0)); // its shadow
    page.add(this.add.image(0, 0, "ending:page").setOrigin(0).setScale(1 / SHARP));
    this.tweens.add({ targets: page, x: 0, rotation: 0, duration: ENDING.PAGE_FLIP_MS, ease: "Cubic.easeOut" });

    const lines = creditLines({
      score: this.run.score,
      playedMs: this.run.playedMs,
      worlds: LEVELS.length,
      unlocked: this.run.unlocked,
    });
    let startsAt = ENDING.PAGE_FLIP_MS;
    for (const line of lines) {
      const look = CREDIT_LOOK[line.style];
      // Origin low in the text, so its letters sit on the rule.
      const text = this.add.text(CREDITS_X, ruleY(line.rule), line.text, textStyle(look.size, look.color)).setOrigin(0.5, 0.86);
      page.add(text);
      const heart = line.style === "sign" ? this.heartAfter(page, text) : null;
      const show = () => {
        text.setCrop();
        heart?.setAlpha(1);
      };
      text.setCrop(0, 0, 0, text.height);
      const pen = { done: 0 };
      const ms = line.text.length * ENDING.WRITE_MS_PER_CHAR;
      const tween = this.tweens.add({
        targets: pen,
        done: 1,
        delay: startsAt,
        duration: ms,
        onUpdate: () => text.setCrop(0, 0, text.width * pen.done, text.height),
        onComplete: show,
      });
      this.writing.push({ tween, show });
      startsAt += ms + ENDING.LINE_GAP_MS;
    }
    this.hint = this.add.text(CREDITS_X, ruleY(HINT_RULE), "tap to continue", textStyle(16, DOODLE.GRAPHITE_LIGHT));
    this.hint.setOrigin(0.5, 0.86).setAlpha(0);
    page.add(this.hint);
    this.time.delayedCall(startsAt, () => this.allWritten());
  }

  /** A tap while the credits are written: show every line now. */
  private finishWriting(): void {
    for (const { tween, show } of this.writing) {
      tween.remove();
      show();
    }
    this.allWritten();
  }

  /** Every line is up: from READ_MIN_MS on, a tap leaves (the hint shows then). */
  private allWritten(): void {
    if (this.phase !== "writing") return;
    this.phase = "written";
    this.leaveAt = this.time.now + ENDING.READ_MIN_MS;
    this.tweens.add({ targets: this.hint, alpha: 1, delay: ENDING.READ_MIN_MS, duration: 500 });
  }

  /** The heart after the signature, hidden until the signature is written. */
  private heartAfter(page: Phaser.GameObjects.Container, sign: Phaser.GameObjects.Text): Phaser.GameObjects.Image {
    const x = sign.x + sign.width / 2 + 24;
    const y = sign.y - sign.height * 0.38;
    const heart = this.add.image(x, y, this.drawOnce("ending:heart", HEART)).setScale(1 / SHARP).setRotation(0.15).setAlpha(0);
    page.add(heart);
    return heart;
  }

  /**
   * The ending's music, faded in: `ending.mp3` once if the file is there
   * (it may not exist yet), else the bedroom's path track looping slower
   * and softer, so the ending is never silent.
   */
  private playMusic(): void {
    loadOptionalMusic(this, ENDING.MUSIC_FILE, (key) => {
      if (key) return this.startMusic(key, { loop: false, rate: 1, volume: MUSIC.VOLUME });
      loadOptionalMusic(this, ENDING.FALLBACK_MUSIC_FILE, (fallback) => {
        if (fallback) this.startMusic(fallback, { loop: true, rate: ENDING.FALLBACK_RATE, volume: ENDING.FALLBACK_VOLUME });
      });
    });
  }

  private startMusic(key: string, how: { loop: boolean; rate: number; volume: number }): void {
    if (this.leaving) return;
    this.music = this.sound.add(key, { loop: how.loop, rate: how.rate, volume: 0 });
    this.music.play();
    this.tweens.add({ targets: this.music, volume: how.volume, duration: ENDING.MUSIC_FADE_IN_MS });
  }

  /** A recipe drawn once (one frame) into a texture; returns its key. */
  private drawOnce(key: string, recipe: DoodleRecipe): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, drawFrames(recipe, SHARP, 1, 5)[0]);
    return key;
  }

  private crayonTexture(color: string): string {
    return this.drawOnce(`ending:crayon:${color}`, crayonRecipe(color));
  }

  /** Fade the music and the picture out together, then go on to `next`. */
  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    if (this.music) this.tweens.add({ targets: this.music, volume: 0, duration: ENDING.FADE_OUT_MS });
    this.cameras.main.fadeOut(ENDING.FADE_OUT_MS, 0xf8, 0xf4, 0xe8);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start(this.next.scene, this.next.data),
    );
  }
}

/** The y of notebook rule `n` (0 = the first rule under the header strip). */
function ruleY(n: number): number {
  return DOODLE.RULE_TOP + n * DOODLE.RULE_GAP;
}
