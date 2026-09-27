import Phaser from "phaser";
import { GAME } from "./config/constants";
import BootScene from "./scenes/BootScene";
import MenuScene from "./scenes/MenuScene";
import HowToPlayScene from "./scenes/HowToPlayScene";
import GameScene from "./scenes/GameScene";
import NameEntryScene from "./scenes/NameEntryScene";
import LeaderboardScene from "./scenes/LeaderboardScene";
import { getWorld3D } from "./render3d/World3D";

/**
 * Phaser entry point.
 *
 * A Phaser.Game is the root object: it owns the renderer (WebGL, falling back
 * to Canvas), the main loop, the input/audio managers, and a stack of Scenes.
 * Phaser runs the scenes; the first one listed starts automatically.
 *
 * The canvas is transparent so the Three.js playfield (render3d/World3D), drawn
 * on its own canvas underneath, shows through during gameplay. Menus fall back
 * to the page background (#05060f in index.html).
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL if available, else Canvas
  parent: "game",
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  transparent: true,
  pixelArt: true, // crisp scaling for our 16px pixel-art sprites
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT, // letterbox to fit the screen, keep aspect ratio
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Two touches: a thumb can hit SLOW / FREEZE while the other finger draws.
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, HowToPlayScene, GameScene, NameEntryScene, LeaderboardScene],
};

const game = new Phaser.Game(config);

// Dev-only console handle for inspecting the running game (stripped from builds).
if (import.meta.env.DEV) Object.assign(window, { __metic: { game, world: getWorld3D } });
