import Phaser from "phaser";
import { DOODLE, GAME, LEADERBOARD, LEVELS, MUSIC, RENDER3D, STORY, STORY_MAP } from "../config/constants";
import { selectShip, selectedShip, type ShipChoice } from "../config/ships";
import { drawPaper } from "../renderDoodle/paper";
import { drawFrames, type DoodleRecipe } from "../renderDoodle/pencil";
import { shipIconFrames } from "../renderDoodle/shipIcons";
import { crownTexture, drawTrail, islandFrames, type Box } from "../renderDoodle/storyMap";
import { stageBoard } from "../services/leaderboard";
import { storyComplete } from "../services/shipUnlocks";
import {
  clearSavedRun,
  flightTo,
  islandView,
  loadSavedRun,
  loadStoryProgress,
  runStage,
  type SavedRun,
  type StoryProgress,
} from "../services/storyProgress";
import { onKeyDown } from "../ui/keyboard";
import { textStyle } from "../ui/theme";
import { music } from "./music";

/** Doodles are drawn at 2× and shown at half size, for a sharp picture. */
const SHARP = 2;

/**
 * The story map (the STORY button): one island per stage on a notebook page,
 * joined by a pencil trail. The ship waits on the island of the run in
 * progress; islands this run has reached show their world in color and the
 * best score, islands reached only in an earlier run show it in gray pencil
 * (until this run gets there again), a flag marks a boss ever beaten, and
 * islands never reached are a "?". A game over sends the next run back to
 * island 1 (arcade rules, owner's pick), but a run in progress is saved at
 * the start of each level: CONTINUE picks it up there. After a level is
 * cleared the game comes back here, the ship flies to the next island, and
 * a tap starts it; if the clear unlocked a ship, a NEW SHIP card comes
 * first. Tapping a reached island opens that stage's world board. Once the
 * story is finished, a crown sits over the last island and the title.
 *
 * It reads LEVELS for the stages that are built; the rest of the STAGES
 * planned show as "?" (or "coming soon" once reached), so the map grows as
 * levels are added.
 *
 * Always drawn on paper with ink colors (DOODLE), in either art mode.
 */
export default class StoryMapScene extends Phaser.Scene {
  /** Animated doodles: an image and its boil frames. */
  private boiling: { image: Phaser.GameObjects.Image; keys: string[] }[] = [];
  private frame = 0;
  /** The run in progress (saved at the start of its level), if any. */
  private saved: SavedRun | null = null;
  /** The ship is flying to the next island (or a NEW SHIP card is up before
   * it does): taps wait until it lands. */
  private travelling = false;
  /** The player's ship on the map. */
  private ship!: { image: Phaser.GameObjects.Image; keys: string[] };

  constructor() {
    super("StoryMapScene");
  }

  /** `travelTo`: a level was just cleared; fly the ship to this stage's
   * island. `newShips`: models of the ships that clear unlocked. */
  create(data?: { travelTo?: number; newShips?: string[] }): void {
    this.boiling = [];
    this.frame = 0;
    this.travelling = false;
    // After the last boss the ending plays once, to its end, map or not.
    if (music.playing !== MUSIC.ENDING_FILE) music.play(this, MUSIC.MAP_FILE);
    const progress = loadStoryProgress();
    this.saved = loadSavedRun();

    // The run in progress is on the saved run's level (island 1 if none).
    const atStage = runStage(this.saved);

    this.textures.remove("storyMap:paper");
    this.textures.addCanvas("storyMap:paper", drawPaper(SHARP));
    this.add.image(0, 0, "storyMap:paper").setOrigin(0).setScale(1 / SHARP).setDepth(-2);

    const cx = GAME.WIDTH / 2;
    this.add.text(cx, 24, "STORY MAP", textStyle(28, DOODLE.GRAPHITE)).setOrigin(0.5);
    this.add
      .text(cx, 48, "a game over sends you back to island 1 · tap an island for scores", textStyle(13, DOODLE.GRAPHITE_LIGHT))
      .setOrigin(0.5);

    const labels: Box[] = [];
    for (let stage = 0; stage < STORY.STAGES; stage++) labels.push(...this.makeIsland(stage, progress, atStage));

    // Drawn after the islands so it knows where their labels are, and kept
    // under them by its depth.
    this.textures.remove("storyMap:trail");
    const trail = drawTrail(GAME.WIDTH, GAME.HEIGHT, SHARP, STORY_MAP.SPOTS, atStage, labels);
    this.textures.addCanvas("storyMap:trail", trail);
    this.add.image(0, 0, "storyMap:trail").setOrigin(0).setScale(1 / SHARP).setDepth(-1);

    if (storyComplete(progress)) this.crown();

    const flight = flightTo(this.saved, data?.travelTo);
    const ship = this.makeShip(flight !== null ? flight - 1 : atStage);
    this.makeButtons(progress);
    if (flight !== null && this.saved) {
      const run = this.saved;
      // The unlocks come with the flight's data, so they are trusted only
      // with it (Phaser can hand a scene stale data, see flightTo).
      const unlocked = RENDER3D.SHIPS.filter((s) => data?.newShips?.includes(s.model));
      this.travelling = true;
      this.announce(unlocked, () => this.travel(ship, flight, run));
    }

    this.time.addEvent({
      delay: 1000 / DOODLE.BOIL_FPS,
      loop: true,
      callback: () => {
        this.frame++;
        for (const { image, keys } of this.boiling) image.setTexture(keys[this.frame % keys.length]);
      },
    });
    onKeyDown(this, (e) => {
      if (e.key === "Enter" && !this.travelling) this.play();
      else if (e.key === "Escape") this.scene.start("MenuScene");
    });
  }

  /** One island and its labels; returns the labels' boxes (padded), which
   * the trail must not run through. */
  private makeIsland(stage: number, progress: StoryProgress, atStage: number): Box[] {
    const [x, y] = STORY_MAP.SPOTS[stage];
    const view = islandView(progress, atStage, stage);
    const keys = islandFrames(this.textures, stage, view, SHARP);
    const island = this.add.image(x, y, keys[0]).setScale(1 / SHARP);
    this.boiling.push({ image: island, keys });

    if (view.look === "unreached") {
      const unknown = this.add.text(x, y + 10, "?", textStyle(30, DOODLE.GRAPHITE_LIGHT)).setOrigin(0.5);
      return [labelBox(unknown)];
    }

    const level = LEVELS[stage];
    const best = progress.best[stage] ?? 0;
    const nameInk = view.look === "run" ? DOODLE.GRAPHITE : DOODLE.GRAPHITE_LIGHT;
    const name = this.add
      .text(x, y + 30, `${stage + 1} · ${level?.NAME ?? "coming soon"}`, textStyle(15, nameInk, { align: "center", wordWrap: { width: 170 } }))
      .setOrigin(0.5, 0);
    const scoreInk = view.look === "run" && view.flag ? DOODLE.TARGET : DOODLE.GRAPHITE_LIGHT;
    const score = this.add
      .text(x, name.y + name.height - 2, best > 0 ? `best ${best}` : "not played yet", textStyle(14, scoreInk))
      .setOrigin(0.5, 0);
    const labels = [labelBox(name), labelBox(score)];
    if (!level) return labels; // reached, but this stage isn't built yet

    island.setInteractive({ useHandCursor: true });
    island.on("pointerover", () => island.setScale(1.08 / SHARP));
    island.on("pointerout", () => island.setScale(1 / SHARP));
    island.on("pointerdown", () =>
      this.scene.start("LeaderboardScene", {
        browse: true,
        board: stageBoard(stage),
        title: `${stage + 1} · ${level.NAME}`,
        yourBest: best,
        back: "StoryMapScene",
      }),
    );
    return labels;
  }

  /** The player's ship hovers beside the island of the run in progress. */
  private makeShip(stage: number): Phaser.GameObjects.Image {
    const [x, y] = STORY_MAP.SPOTS[stage];
    const keys = shipIconFrames(this.textures, selectedShip().model, 40 * SHARP);
    const ship = this.add.image(x + STORY_MAP.SHIP_DX, y + STORY_MAP.SHIP_DY, keys[0]).setScale(1 / SHARP);
    this.ship = { image: ship, keys };
    this.boiling.push(this.ship);
    this.hover(ship);
    return ship;
  }

  private hover(ship: Phaser.GameObjects.Image): void {
    this.tweens.add({ targets: ship, y: ship.y - 6, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  /** After a clear: fly the ship to the next island, then wait for a tap. */
  private travel(ship: Phaser.GameObjects.Image, stage: number, run: SavedRun): void {
    this.travelling = true;
    const [x, y] = STORY_MAP.SPOTS[stage];
    this.tweens.killTweensOf(ship);
    ship.setRotation(Math.atan2(y - ship.y, x + STORY_MAP.SHIP_DX - ship.x) + Math.PI / 2);
    this.tweens.add({
      targets: ship,
      x: x + STORY_MAP.SHIP_DX,
      y: y + STORY_MAP.SHIP_DY,
      duration: STORY_MAP.TRAVEL_MS,
      ease: "Sine.easeInOut",
      onComplete: () => {
        ship.setRotation(0);
        this.hover(ship);
        this.travelling = false;
        this.promptStart(run);
      },
    });
  }

  /** "TAP TO START": any tap off the buttons (or Enter) starts the level. */
  private promptStart(run: SavedRun): void {
    const name = LEVELS[run.level]?.NAME ?? "";
    // A paper card in the middle of the map, over the trail, not over a label.
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2 + 20;
    const paper = Phaser.Display.Color.HexStringToColor(DOODLE.PAPER).color;
    const ink = Phaser.Display.Color.HexStringToColor(DOODLE.GRAPHITE).color;
    this.add.rectangle(cx, cy, 300, 86, paper, 0.95).setStrokeStyle(2, ink);
    this.add.text(cx, cy - 16, `LEVEL ${run.level + 1} · ${name}`, textStyle(20, DOODLE.GRAPHITE)).setOrigin(0.5);
    const prompt = this.add.text(cx, cy + 18, "tap to start", textStyle(20, DOODLE.TARGET)).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
    this.input.on("pointerdown", (_p: unknown, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.start(run);
    });
  }

  /** Story complete: a gold crown over the last island and on each side of
   * the title. */
  private crown(): void {
    const key = crownTexture(this.textures, SHARP);
    const [x, y] = STORY_MAP.SPOTS[STORY.STAGES - 1];
    this.add.image(x, y - 42, key).setScale(0.6);
    for (const side of [-1, 1]) this.add.image(GAME.WIDTH / 2 + side * 98, 22, key).setScale(0.4);
  }

  /** A NEW SHIP card for each ship the clear unlocked, one after another,
   * then `done`. FLY IT picks the ship (the map's ship changes at once). */
  private announce(ships: ShipChoice[], done: () => void): void {
    const [ship, ...rest] = ships;
    if (!ship) return done();
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;
    const paper = Phaser.Display.Color.HexStringToColor(DOODLE.PAPER).color;
    const ink = Phaser.Display.Color.HexStringToColor(DOODLE.GRAPHITE).color;
    const card = this.add.container(0, 0).setDepth(10);
    const keys = shipIconFrames(this.textures, ship.model, 80 * SHARP);
    const doodle = this.add.image(cx, cy - 18, keys[0]).setScale(1 / SHARP);
    const boil = { image: doodle, keys };
    this.boiling.push(boil);
    card.add([
      // Interactive so taps on the card don't reach the islands under it.
      this.add.rectangle(cx, cy, 300, 236, paper, 0.97).setStrokeStyle(2, ink).setInteractive(),
      this.add.text(cx, cy - 96, "NEW SHIP!", textStyle(28, DOODLE.TARGET)).setOrigin(0.5),
      doodle,
      this.add.text(cx, cy + 34, ship.name, textStyle(22, DOODLE.GRAPHITE)).setOrigin(0.5),
      this.add.text(cx, cy + 56, "a new look · pick it on the menu", textStyle(13, DOODLE.GRAPHITE_LIGHT)).setOrigin(0.5),
    ]);
    this.tweens.add({ targets: doodle, scale: { from: 0.2 / SHARP, to: 1 / SHARP }, duration: 420, ease: "Back.easeOut" });
    this.sound.play("blip", { volume: 0.5, rate: 1.6 });
    const close = (fly: boolean) => {
      if (fly) {
        selectShip(ship);
        this.ship.keys = shipIconFrames(this.textures, ship.model, 40 * SHARP);
      }
      this.boiling = this.boiling.filter((b) => b !== boil);
      card.destroy();
      this.announce(rest, done);
    };
    card.add(this.makeButton(cx - 70, cy + 92, 120, "FLY IT", () => close(true), DOODLE.TARGET));
    card.add(this.makeButton(cx + 70, cy + 92, 120, "LATER", () => close(false)));
  }

  private makeButtons(progress: StoryProgress): void {
    const y = GAME.HEIGHT - 40;
    this.makeButton(84, y, 120, "BACK", () => this.scene.start("MenuScene"));
    this.makeButton(GAME.WIDTH / 2, y, 150, progress.bestRun > 0 ? `RUNS · ${progress.bestRun}` : "RUN SCORES", () =>
      this.scene.start("LeaderboardScene", {
        browse: true,
        board: LEADERBOARD.STORY_RUN_BOARD,
        title: "STORY RUNS",
        yourBest: progress.bestRun,
        back: "StoryMapScene",
      }),
    );
    this.makeButton(GAME.WIDTH - 84, y, 120, this.saved ? "CONTINUE" : "PLAY", () => this.play(), DOODLE.TARGET);
    if (this.saved) {
      const run = this.saved;
      this.add
        .text(GAME.WIDTH - 84, y - 40, `level ${run.level + 1} · ${run.lives} ♥`, textStyle(13, DOODLE.GRAPHITE_LIGHT))
        .setOrigin(0.5);
      const fresh = this.add
        .text(84, y - 40, "new run", textStyle(15, DOODLE.GRAPHITE_LIGHT))
        .setOrigin(0.5)
        .setPadding(8)
        .setInteractive({ useHandCursor: true });
      fresh.on("pointerdown", () => {
        clearSavedRun();
        this.start(null);
      });
    }
  }

  /** A pencil box with a label; `ink` hatches it (the main button). Returns
   * its parts (box, label). */
  private makeButton(x: number, y: number, w: number, label: string, onClick: () => void, ink?: string): Phaser.GameObjects.GameObject[] {
    const h = 44;
    const key = `storyMap:button:${w}:${ink ?? "plain"}`;
    if (!this.textures.exists(key)) {
      const box: DoodleRecipe = {
        w: w + 8,
        h: h + 8,
        draw: (p) =>
          p.shape(
            [
              [-w / 2, -h / 2],
              [w / 2, -h / 2],
              [w / 2, h / 2],
              [-w / 2, h / 2],
            ],
            ink,
            { hachureGap: 5, fillWeight: 0.6 },
          ),
      };
      this.textures.addCanvas(key, drawFrames(box, SHARP, 1, w)[0]);
    }
    const bg = this.add.image(x, y, key).setScale(1 / SHARP).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, textStyle(20, DOODLE.GRAPHITE)).setOrigin(0.5);
    bg.on("pointerover", () => text.setColor(DOODLE.TARGET));
    bg.on("pointerout", () => text.setColor(DOODLE.GRAPHITE));
    bg.on("pointerdown", onClick);
    return [bg, text];
  }

  /** Continue the saved run, or start a new one from island 1. */
  private play(): void {
    if (!this.travelling) this.start(this.saved);
  }

  /** Play `run` (a saved run), or a new arcade run from island 1 with fresh lives. */
  private start(run: SavedRun | null): void {
    const story = run ?? { level: 0, lives: STORY.LIVES, score: 0, levelScores: [] };
    this.scene.start("GameScene", { story });
  }
}

/** A text's box on the page, padded so the trail stops short of it. */
function labelBox(text: Phaser.GameObjects.Text): Box {
  const pad = STORY_MAP.LABEL_CLEAR_PX;
  const b = text.getBounds();
  return { x: b.x - pad, y: b.y - pad, w: b.width + 2 * pad, h: b.height + 2 * pad };
}
