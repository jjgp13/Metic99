import Phaser from "phaser";
import { MUSIC } from "../config/constants";

type Track = "path" | "boss";

/** A run's music files in public/assets/music/: a looping path track and,
 * for a story level, the boss track it switches to. */
export interface MusicTracks {
  path: string;
  boss?: string;
}

/** A story level's tracks: level01-path.mp3 … level10-boss.mp3. */
export function levelTracks(level: number): MusicTracks {
  const n = String(level + 1).padStart(2, "0");
  return { path: `level${n}-path.mp3`, boss: `level${n}-boss.mp3` };
}

/**
 * A run's music (docs/MUSIC_PROMPTS.md): a looping path track, then the
 * level's boss track once the boss comes in. The tracks are loaded when
 * the run starts, not at boot (20 tracks would slow the first load on a
 * phone), so the music starts a moment after the run does. A track that
 * is missing or fails to load just doesn't play. Pause, the level card and
 * game over fade it out; leaving the scene stops it.
 */
export class LevelMusic {
  private current: Phaser.Sound.BaseSound | null = null;
  /** Tracks still fading out. Leaving the scene kills their fade tweens, so
   * they are destroyed here too, or they would loop on in the next scene. */
  private readonly fading = new Set<Phaser.Sound.BaseSound>();
  private wanted: Track = "path";
  private stopped = false;
  private paused = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tracks: MusicTracks,
  ) {
    const load = scene.load;
    for (const file of [tracks.path, tracks.boss]) {
      if (!file) continue;
      const key = musicKey(file);
      if (!scene.cache.audio.exists(key)) load.audio(key, `assets/music/${file}`);
    }
    load.once(Phaser.Loader.Events.COMPLETE, () => this.play(this.wanted));
    load.start();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stop(0));
  }

  /** The boss came in: switch to its track. */
  boss(): void {
    this.wanted = "boss";
    this.play("boss");
  }

  pause(paused: boolean): void {
    this.paused = paused;
    if (paused) this.current?.pause();
    else this.current?.resume();
  }

  /** Fade out and stop for good (level clear, game over). */
  stop(fadeMs: number = MUSIC.FADE_MS): void {
    this.stopped = true;
    const sound = this.current;
    this.current = null;
    if (fadeMs <= 0 || !this.scene.sys.isActive()) {
      sound?.destroy();
      for (const old of this.fading) old.destroy();
      this.fading.clear();
      return;
    }
    if (sound) this.fadeOut(sound, fadeMs);
  }

  private fadeOut(sound: Phaser.Sound.BaseSound, fadeMs: number): void {
    this.fading.add(sound);
    this.scene.tweens.add({
      targets: sound,
      volume: 0,
      duration: fadeMs,
      onComplete: () => {
        this.fading.delete(sound);
        sound.destroy();
      },
    });
  }

  private play(track: Track): void {
    const file = this.tracks[track];
    if (!file) return;
    const key = musicKey(file);
    if (this.stopped || !this.scene.cache.audio.exists(key)) return;
    const old = this.current;
    if (old && old.key === key) return;
    if (old) this.fadeOut(old, MUSIC.FADE_MS);
    const sound = this.scene.sound.add(key, { loop: true, volume: MUSIC.VOLUME });
    sound.play();
    if (this.paused) sound.pause(); // loaded while the game was paused
    this.current = sound;
  }
}

function musicKey(file: string): string {
  return `music:${file}`;
}
