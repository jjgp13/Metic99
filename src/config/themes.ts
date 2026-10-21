import { LEVELS, STORAGE } from "./constants";

/**
 * Endless themes (like Tetris 99's): every story world whose boss the
 * player has beaten can dress an Endless run in its notebook page and its
 * path song. A theme is only a look and a sound: Endless keeps one set of
 * rules for everyone (its monsters, its curve, its one leaderboard), so a
 * theme never reaches the sim. GameScene hands it to the field view (the
 * snapshot's `page`) and to the music, nothing else.
 */
export interface Theme {
  /** Saved under STORAGE.THEME. */
  id: string;
  name: string;
  /** The page (renderDoodle PAGES id) drawn under the field; null = plain paper. */
  page: string | null;
  /** The looping song in public/assets/music/. */
  music: string;
  /** The story stage whose boss unlocks it (index into LEVELS); null = always open. */
  stage: number | null;
}

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

/** Endless as it always looked, with its own song (docs/MUSIC_PROMPTS.md). */
export const PLAIN_THEME: Theme = { id: "plain", name: "PLAIN PAGE", page: null, music: "endless.mp3", stage: null };

/** The plain page, then one theme per built story level, in story order. */
export const THEMES: readonly Theme[] = [
  PLAIN_THEME,
  ...LEVELS.map((level, stage) => ({ id: level.PAGE, name: level.NAME, page: level.PAGE, music: levelTracks(stage).path, stage })),
];

/** Open once its stage's boss is beaten, i.e. the story has gone past it
 * (`furthest` = StoryProgress.furthest). */
export function isThemeUnlocked(theme: Theme, furthest: number): boolean {
  return theme.stage === null || theme.stage < furthest;
}

// Kept in memory too, so a pick still applies when storage is blocked.
let picked: string | null = null;

/** The theme the player picked, or the plain page if that one isn't unlocked
 * (e.g. the story progress was cleared). */
export function selectedTheme(furthest: number): Theme {
  if (picked === null) {
    try {
      picked = localStorage.getItem(STORAGE.THEME);
    } catch {
      // Storage blocked (e.g. private mode): use the plain page.
    }
  }
  const theme = THEMES.find((t) => t.id === picked);
  return theme && isThemeUnlocked(theme, furthest) ? theme : PLAIN_THEME;
}

export function selectTheme(theme: Theme): void {
  picked = theme.id;
  try {
    localStorage.setItem(STORAGE.THEME, theme.id);
  } catch {
    // Not persisted across visits; the in-memory pick still applies.
  }
}
