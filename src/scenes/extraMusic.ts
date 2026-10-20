import Phaser from "phaser";
import { MUSIC } from "../config/constants";

/**
 * Music outside a level's own tracks (docs/MUSIC_PROMPTS.md): the main
 * theme on the menu and the story map, and the jingle after a boss. These
 * files are made one by one, so each is *optional*: it plays when it is in
 * public/assets/music/, and a missing (or broken) file is never an error,
 * just silence or a stand-in made of the sound effects.
 */

/** Files that failed to load this visit: not asked for again. */
const missing = new Set<string>();

const keyFor = (file: string) => `music:${file}`;

/**
 * Load `file` (if it isn't loaded yet) and call `then` with its audio key,
 * or with null when the file isn't there. `then` doesn't run if the scene
 * was left meanwhile. Call it without `then` to load ahead of time.
 */
export function loadOptionalMusic(scene: Phaser.Scene, file: string, then?: (key: string | null) => void): void {
  const key = keyFor(file);
  if (scene.cache.audio.exists(key)) return then?.(key);
  if (missing.has(file)) return then?.(null);
  const load = scene.load;
  load.audio(key, `assets/music/${file}`);
  load.once(Phaser.Loader.Events.COMPLETE, () => {
    const loaded = scene.cache.audio.exists(key);
    if (!loaded) missing.add(file);
    if (scene.sys.isActive()) then?.(loaded ? key : null);
  });
  load.start();
}

/**
 * The main theme (a loop), for the menu and the story map. The sound manager
 * belongs to the whole game, not to a scene, so the theme keeps playing from
 * the menu to the map and back instead of starting over.
 */
export function playMenuTheme(scene: Phaser.Scene): void {
  loadOptionalMusic(scene, MUSIC.MENU_FILE, (key) => {
    if (!key || scene.sound.getAll(key).some((s) => s.isPlaying)) return;
    scene.sound.add(key, { loop: true, volume: MUSIC.VOLUME }).play();
  });
}

/** A run starts: fade the main theme out. */
export function stopMenuTheme(scene: Phaser.Scene): void {
  for (const sound of scene.sound.getAll(keyFor(MUSIC.MENU_FILE))) {
    scene.tweens.add({ targets: sound, volume: 0, duration: MUSIC.FADE_MS, onComplete: () => sound.destroy() });
  }
}

/** The victory jingle after a boss; until level-clear.mp3 exists, a short
 * fanfare made of the blip sound played at rising pitches. */
export function playLevelClearJingle(scene: Phaser.Scene): void {
  loadOptionalMusic(scene, MUSIC.LEVEL_CLEAR_FILE, (key) => {
    if (key) scene.sound.play(key, { volume: MUSIC.JINGLE_VOLUME });
    else playFallbackFanfare(scene);
  });
}

function playFallbackFanfare(scene: Phaser.Scene): void {
  const notes = MUSIC.FALLBACK_FANFARE;
  notes.forEach((rate, i) => {
    // The last note is the long one: twice as far from the others, louder.
    const last = i === notes.length - 1;
    const atMs = (last ? i + 1 : i) * MUSIC.FALLBACK_STEP_MS;
    scene.time.delayedCall(atMs, () => scene.sound.play("blip", { volume: last ? 0.6 : 0.45, rate }));
  });
}
