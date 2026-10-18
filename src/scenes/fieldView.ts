import type Phaser from "phaser";
import { artMode } from "../config/artMode";
import { selectedShip } from "../config/ships";
import type Alien from "../objects/Alien";
import type { InkPoint } from "../render3d/AnswerStars";
import { getWorld3D, type WorldSnapshot } from "../render3d/World3D";
import { getDoodleWorld } from "../renderDoodle/DoodleWorld";

/**
 * What GameScene needs from whatever draws the playfield. Two views fill it:
 * DoodleWorld (pencil on paper, the default) and World3D (Three.js models,
 * `?art=3d`). Both only read the snapshot, so the rules never know which
 * one is on screen.
 */
export interface FieldView {
  /** Draw the field as of this frame (called every frame). */
  render(snapshot: WorldSnapshot, time: number, delta: number): void;
  /** An alien died (or hit the ship) at logical (x, y). */
  explode(x: number, y: number, alien?: Alien): void;
  /** The answer `text` was solved. */
  answerSolved(text: string): void;
  /** `text` was drawn on the pad (one ink per digit, or null). */
  answerInk(text: string, inks: ReadonlyArray<readonly InkPoint[] | null>): void;
  /** Same semantics as Phaser's camera.shake. */
  shake(durationMs: number, intensity: number): void;
  /** Stop drawing (leaving the game scene). */
  end(): void;
  /** True when the view draws its own lock-on mark, so the HUD's
   * gold brackets (ui/hud/Reticle) stay off. */
  readonly drawsTarget: boolean;
}

/** Start drawing a run in the art the URL picked (config/artMode.ts). */
export function createFieldView(scene: Phaser.Scene): FieldView {
  if (artMode() === "doodle") {
    const doodle = getDoodleWorld();
    doodle.begin(scene.game.canvas);
    return doodle;
  }
  const world = getWorld3D();
  world.begin(scene.textures, scene.game.canvas, selectedShip().model);
  return world;
}
