import Phaser from "phaser";
import { GAME } from "./config/constants";
import BootScene from "./scenes/BootScene";
import MenuScene from "./scenes/MenuScene";
import HowToPlayScene from "./scenes/HowToPlayScene";
import GameScene from "./scenes/GameScene";
import NameEntryScene from "./scenes/NameEntryScene";
import LeaderboardScene from "./scenes/LeaderboardScene";
import StoryMapScene from "./scenes/StoryMapScene";
import ThemePickerScene from "./scenes/ThemePickerScene";
import HandwritingLabScene from "./scenes/HandwritingLabScene";
import EndingScene from "./scenes/EndingScene";
import { artMode } from "./config/artMode";
import { DOODLE } from "./config/constants";
import { getWorld3D } from "./render3d/World3D";
import { loadDoodleFont } from "./renderDoodle/font";
import { keepSoundOnIPhone } from "./services/audioSession";

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
    // #game (index.html) already centers the canvas with flexbox, inside the
    // safe-area padding. Phaser's own centering added margins on top of that,
    // which pushed the canvas off center (right on wide screens, down on phones).
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  // Two touches: a thumb can hit SLOW / FREEZE while the other finger draws.
  input: { activePointers: 2 },
  scene: [
    BootScene,
    MenuScene,
    StoryMapScene,
    ThemePickerScene,
    HowToPlayScene,
    GameScene,
    NameEntryScene,
    LeaderboardScene,
    EndingScene,
    HandwritingLabScene,
  ],
};

function startGame(): void {
  const game = new Phaser.Game(config);
  keepSoundOnIPhone(game);
  // Dev-only console handle for inspecting the running game (stripped from builds).
  if (import.meta.env.DEV) Object.assign(window, { __metic: { game, world: getWorld3D } });
}

// The doodle art (the default) needs its handwriting font before any text
// is drawn, and puts the menus on paper too.
if (artMode() === "doodle") {
  document.body.style.background = DOODLE.PAPER;
  void loadDoodleFont().then(startGame);
} else {
  startGame();
}
