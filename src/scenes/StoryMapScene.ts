import Phaser from "phaser";
import { DOODLE, GAME, LEADERBOARD, LEVELS, STORY, STORY_MAP } from "../config/constants";
import { selectedShip } from "../config/ships";
import { drawPaper } from "../renderDoodle/paper";
import { shipIconFrames } from "../renderDoodle/shipIcons";
import { drawTrail, islandFrames } from "../renderDoodle/storyMap";
import { stageBoard } from "../services/leaderboard";
import {
  clearSavedRun,
  islandState,
  loadSavedRun,
  loadStoryProgress,
  type SavedRun,
  type StoryProgress,
} from "../services/storyProgress";
import { onKeyDown } from "../ui/keyboard";
import { pencilButton } from "../ui/pencilButton";
import { textStyle } from "../ui/theme";

/** Doodles are drawn at 2× and shown at half size, for a sharp picture. */
const SHARP = 2;

/**
 * The story map (the STORY button): one island per stage on a notebook page,
 * joined by a pencil trail. Islands reached show their world and the best
 * score; a flag marks a beaten boss; the ship waits on the furthest island;
 * islands not reached yet are a "?". A game over sends the next run back to
 * island 1 (arcade rules, owner's pick), but a run in progress is saved at
 * the start of each level: CONTINUE picks it up there. After a level is
 * cleared the game comes back here, the ship flies to the next island, and
 * a tap starts it. Tapping a reached island opens that stage's world board.
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
  /** The ship is flying to the next island: taps wait until it lands. */
  private travelling = false;

  constructor() {
    super("StoryMapScene");
  }

  /** `travelTo`: a level was just cleared; fly the ship to this stage's island. */
  create(data?: { travelTo?: number }): void {
    this.boiling = [];
    this.frame = 0;
    this.travelling = false;
    const progress = loadStoryProgress();
    this.saved = loadSavedRun();

    this.textures.remove("storyMap:paper");
    this.textures.addCanvas("storyMap:paper", drawPaper(SHARP));
    this.add.image(0, 0, "storyMap:paper").setOrigin(0).setScale(1 / SHARP);

    this.textures.remove("storyMap:trail");
    const reached = Math.min(progress.furthest, STORY.STAGES - 1);
    this.textures.addCanvas("storyMap:trail", drawTrail(GAME.WIDTH, GAME.HEIGHT, SHARP, STORY_MAP.SPOTS, reached));
    this.add.image(0, 0, "storyMap:trail").setOrigin(0).setScale(1 / SHARP);

    const cx = GAME.WIDTH / 2;
    this.add.text(cx, 24, "STORY MAP", textStyle(28, DOODLE.GRAPHITE)).setOrigin(0.5);
    this.add
      .text(cx, 48, "a game over sends you back to island 1 · tap an island for scores", textStyle(13, DOODLE.GRAPHITE_LIGHT))
      .setOrigin(0.5);

    for (let stage = 0; stage < STORY.STAGES; stage++) this.makeIsland(stage, progress);
    const travelTo = data?.travelTo;
    const shipAt = travelTo !== undefined ? travelTo - 1 : (this.saved?.level ?? 0);
    const ship = this.makeShip(shipAt);
    this.makeButtons(progress);
    if (travelTo !== undefined && this.saved) this.travel(ship, travelTo, this.saved);

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

  private makeIsland(stage: number, progress: StoryProgress): void {
    const [x, y] = STORY_MAP.SPOTS[stage];
    const state = islandState(progress, stage);
    const keys = islandFrames(this.textures, stage, state, SHARP);
    const island = this.add.image(x, y, keys[0]).setScale(1 / SHARP);
    this.boiling.push({ image: island, keys });

    if (state === "unreached") {
      this.add.text(x, y + 10, "?", textStyle(30, DOODLE.GRAPHITE_LIGHT)).setOrigin(0.5);
      return;
    }

    const level = LEVELS[stage];
    const best = progress.best[stage] ?? 0;
    const name = this.add
      .text(x, y + 30, `${stage + 1} · ${level?.NAME ?? "coming soon"}`, textStyle(15, DOODLE.GRAPHITE, { align: "center", wordWrap: { width: 170 } }))
      .setOrigin(0.5, 0);
    const scoreInk = state === "cleared" ? DOODLE.TARGET : DOODLE.GRAPHITE_LIGHT;
    this.add
      .text(x, name.y + name.height - 2, best > 0 ? `best ${best}` : "not played yet", textStyle(14, scoreInk))
      .setOrigin(0.5, 0);
    if (!level) return; // reached, but this stage isn't built yet

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
  }

  /** The player's ship hovers beside the island of the run in progress. */
  private makeShip(stage: number): Phaser.GameObjects.Image {
    const [x, y] = STORY_MAP.SPOTS[stage];
    const keys = shipIconFrames(this.textures, selectedShip().model, 40 * SHARP);
    const ship = this.add.image(x + STORY_MAP.SHIP_DX, y + STORY_MAP.SHIP_DY, keys[0]).setScale(1 / SHARP);
    this.boiling.push({ image: ship, keys });
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

  private makeButtons(progress: StoryProgress): void {
    const y = GAME.HEIGHT - 40;
    pencilButton(this, 84, y, 120, "BACK", () => this.scene.start("MenuScene"));
    pencilButton(this, GAME.WIDTH / 2, y, 150, progress.bestRun > 0 ? `RUNS · ${progress.bestRun}` : "RUN SCORES", () =>
      this.scene.start("LeaderboardScene", {
        browse: true,
        board: LEADERBOARD.STORY_RUN_BOARD,
        title: "STORY RUNS",
        yourBest: progress.bestRun,
        back: "StoryMapScene",
      }),
    );
    pencilButton(this, GAME.WIDTH - 84, y, 120, this.saved ? "CONTINUE" : "PLAY", () => this.play(), DOODLE.TARGET);
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
