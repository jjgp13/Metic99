import type Phaser from "phaser";
import { DOODLE } from "../config/constants";
import { drawFrames } from "./pencil";
import { FALCON, SHIPS } from "./recipes";

/**
 * A ship's doodle as Phaser textures, for 2D menus (the ship picker): one
 * texture per boil frame, `sizePx` across its longer side. Drawn once per
 * page and size; later calls reuse the textures. Returns the frames' texture keys.
 */
export function shipIconFrames(textures: Phaser.Textures.TextureManager, model: string, sizePx: number): string[] {
  const keys = Array.from({ length: DOODLE.BOIL_FRAMES }, (_, i) => `doodleShip:${model}:${sizePx}:${i}`);
  if (textures.exists(keys[0])) return keys;
  const recipe = SHIPS[model] ?? FALCON;
  const frames = drawFrames(recipe, sizePx / Math.max(recipe.w, recipe.h), DOODLE.BOIL_FRAMES, 1);
  frames.forEach((canvas, i) => textures.addCanvas(keys[i], canvas));
  return keys;
}
