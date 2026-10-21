import Phaser from "phaser";
import { MUSIC } from "../config/constants";

interface Song {
  file: string;
  sound: Phaser.Sound.BaseSound;
}

/**
 * The game's one music player (docs/MUSIC_PROMPTS.md): every scene asks it
 * for a song by file name, and it plays one song at a time, crossfading
 * from the one before. It belongs to the page, not to a scene, because a
 * song outlives the scene that started it: the menu's song goes on through
 * HOW TO PLAY and SCORES, the ending's through name entry.
 *
 * Songs load the first time they are asked for, not at boot (24 tracks
 * would slow the first load on a phone), so a song starts a moment after
 * its screen does. A missing file just doesn't play. Browsers keep audio
 * silent until the first tap or key; a song asked for before that starts
 * then (Phaser resumes the audio on the first input).
 */
export class MusicPlayer {
  private current: Song | null = null;
  /** The song asked for last (maybe still loading), or null for silence. */
  private wanted: string | null = null;
  private paused = false;

  /** The song playing or loading, or null. */
  get playing(): string | null {
    return this.wanted;
  }

  /**
   * Play `file` from public/assets/music/, fading out the song before. The
   * song already playing goes on instead of starting over. `loop: false`
   * plays it once (the ending), then there is silence.
   */
  play(scene: Phaser.Scene, file: string, { loop = true } = {}): void {
    this.pause(false);
    if (this.wanted === file) return;
    this.wanted = file;
    this.fadeOutCurrent(scene, MUSIC.FADE_MS);
    loadSong(scene, file, () => this.start(scene, file, loop));
  }

  /** Load `file` now so it starts on time when it's played later. */
  preload(scene: Phaser.Scene, file: string): void {
    loadSong(scene, file, () => {});
  }

  /** Fade out to silence (`fadeMs` 0 = cut at once). */
  stop(scene: Phaser.Scene, fadeMs: number = MUSIC.FADE_MS): void {
    this.wanted = null;
    this.fadeOutCurrent(scene, fadeMs);
  }

  pause(paused: boolean): void {
    this.paused = paused;
    if (paused) this.current?.sound.pause();
    else this.current?.sound.resume();
  }

  private start(scene: Phaser.Scene, file: string, loop: boolean): void {
    // Another song (or silence) was asked for while this one loaded.
    if (this.wanted !== file || this.current) return;
    const sound = scene.sound.add(songKey(file), { loop, volume: MUSIC.VOLUME });
    sound.play();
    if (this.paused) sound.pause(); // loaded while the game was paused
    this.current = { file, sound };
    if (loop) return;
    sound.once(Phaser.Sound.Events.COMPLETE, () => {
      if (this.current?.sound === sound) {
        this.current = null;
        this.wanted = null;
      }
      sound.destroy();
    });
  }

  private fadeOutCurrent(scene: Phaser.Scene, fadeMs: number): void {
    const song = this.current;
    this.current = null;
    if (!song) return;
    if (fadeMs <= 0 || !canAnimate(scene)) {
      song.sound.destroy();
      return;
    }
    scene.tweens.add({
      targets: song.sound,
      volume: 0,
      duration: fadeMs,
      onComplete: () => song.sound.destroy(),
    });
    // Leaving the scene kills its tweens: a song still fading is destroyed
    // then, or it would play on in the next scene. (Destroying twice is safe.)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => song.sound.destroy());
  }
}

/** The page's music player (a single shared instance, like World3D). */
export const music = new MusicPlayer();

/** Call `then` once `file` is in the audio cache (at once if it already is).
 * If the scene is left before it loads, `then` never runs. */
function loadSong(scene: Phaser.Scene, file: string, then: () => void): void {
  const key = songKey(file);
  if (scene.cache.audio.exists(key)) return then();
  const load = scene.load;
  load.once(`${Phaser.Loader.Events.FILE_KEY_COMPLETE}audio-${key}`, then);
  load.audio(key, `assets/music/${file}`);
  load.start();
}

function songKey(file: string): string {
  return `music:${file}`;
}

/** A scene's tweens run while it is being created or running, not once it
 * is shutting down. */
function canAnimate(scene: Phaser.Scene): boolean {
  const status = scene.sys.settings.status;
  return status === Phaser.Scenes.CREATING || status === Phaser.Scenes.RUNNING;
}
