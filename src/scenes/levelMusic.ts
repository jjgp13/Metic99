import Phaser from "phaser";
import { MUSIC } from "../config/constants";
import { loadOptionalMusic } from "./extraMusic";
import { music } from "./music";

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

/** Endless plays one song (docs/MUSIC_PROMPTS.md, "Endless"). */
export const ENDLESS_TRACKS: MusicTracks = { path: MUSIC.ENDLESS_FILE };

/**
 * A run's music (docs/MUSIC_PROMPTS.md): a looping path track, then the
 * level's boss track once the boss comes in, played by the game's one
 * music player (scenes/music.ts), which fades out the song before (the
 * map's or the menu's). Pause, the level card and game over fade it out;
 * leaving the scene cuts it, unless a song that came after it is playing
 * (the ending).
 */
export class LevelMusic {
  private stopped = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tracks: MusicTracks,
  ) {
    music.play(scene, tracks.path);
    if (tracks.boss) music.preload(scene, tracks.boss);
    // A story level: loaded now so the victory jingle starts on time when the boss falls.
    if (tracks.boss) loadOptionalMusic(scene, MUSIC.LEVEL_CLEAR_FILE);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stop(0));
  }

  /** The boss came in: switch to its track. */
  boss(): void {
    if (this.stopped || !this.tracks.boss) return;
    music.play(this.scene, this.tracks.boss);
  }

  pause(paused: boolean): void {
    if (this.ownsSong()) music.pause(paused);
  }

  /** Fade out and stop for good (level clear, game over). */
  stop(fadeMs: number = MUSIC.FADE_MS): void {
    this.stopped = true;
    if (this.ownsSong()) music.stop(this.scene, fadeMs);
  }

  /** Whether the song playing is one of this run's tracks. */
  private ownsSong(): boolean {
    const song = music.playing;
    return song !== null && (song === this.tracks.path || song === this.tracks.boss);
  }
}
