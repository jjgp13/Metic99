import Phaser from "phaser";
import { MUSIC } from "../config/constants";

type Track = "path" | "boss";

/**
 * A story level's music (docs/MUSIC_PROMPTS.md): a looping path track, then
 * the level's boss track once the boss comes in. The tracks are loaded when
 * the level starts, not at boot (20 tracks would slow the first load on a
 * phone), so the music starts a moment after the level does. Pause, the
 * level card and game over fade it out; leaving the scene stops it.
 */
export class LevelMusic {
  private current: Phaser.Sound.BaseSound | null = null;
  private wanted: Track = "path";
  private stopped = false;
  private paused = false;

  constructor(
    private readonly scene: Phaser.Scene,
    /** Index into LEVELS (0 = level 1). */
    private readonly level: number,
  ) {
    const load = scene.load;
    for (const track of ["path", "boss"] as const) {
      const key = this.key(track);
      if (!scene.cache.audio.exists(key)) load.audio(key, `assets/music/${this.file(track)}`);
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
    if (!sound) return;
    if (fadeMs <= 0 || !this.scene.sys.isActive()) return void sound.destroy();
    this.scene.tweens.add({ targets: sound, volume: 0, duration: fadeMs, onComplete: () => sound.destroy() });
  }

  private play(track: Track): void {
    const key = this.key(track);
    if (this.stopped || !this.scene.cache.audio.exists(key)) return;
    const old = this.current;
    if (old && old.key === key) return;
    if (old) this.scene.tweens.add({ targets: old, volume: 0, duration: MUSIC.FADE_MS, onComplete: () => old.destroy() });
    const sound = this.scene.sound.add(key, { loop: true, volume: MUSIC.VOLUME });
    sound.play();
    if (this.paused) sound.pause(); // loaded while the game was paused
    this.current = sound;
  }

  private key(track: Track): string {
    return `music:${this.file(track)}`;
  }

  /** level01-path.mp3 … level10-boss.mp3 (public/assets/music/). */
  private file(track: Track): string {
    return `level${String(this.level + 1).padStart(2, "0")}-${track}.mp3`;
  }
}
