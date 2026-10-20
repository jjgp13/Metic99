// Story mode (docs/SOLO_MODES_DESIGN.md): levels, bosses, the arcade run.
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.
import type { AlienKind, BallLayout } from "./monsters";
import type { WavesDef } from "./waves";

/** Monster kinds a level's 2-ball spawns pick from (see ENEMY.TWO_BALL_KINDS). */
type TwoBallWeights = Readonly<Record<"darter" | "strafer" | "swooper", number>>;
/** Abilities a level may spawn (keys of ABILITY.UNLOCK_AT). */
type LevelAbility = "shielded" | "blinker" | "splitter";

/**
 * A boss: a big alien at the end of a level's path that takes several
 * answers. Each answer but the last knocks a piece off: it rolls a new sum
 * and burrows to another spot (hidden while it moves), then pops up.
 */
export interface BossDef {
  NAME: string;
  /** Its doodle (the level's page draws it by this name). */
  MODEL: string;
  /** How it fights (objects/bosses.ts); "burrow" = the mole's dig. */
  MECHANIC: string;
  /** Readability box, like MONSTERS (its balls ride in a row above it). */
  BOX: { HALF_W: number; BALLS_Y: number; BOTTOM: number };
  /** Movement pattern it rides on (MONSTERS). */
  KIND: "lumberer";
  /** Answers it takes. */
  HP: number;
  /** Balls per sum. */
  BALLS: number;
  /** × the level's fall / home speed: the more answers, the slower (owner's rule). */
  SPEED: number;
  /** Kill score multiplier for the last answer. */
  SCORE_MULT: number;
  /** After an answer: how far up it burrows and how long it stays hidden. */
  BURROW_UP_PX: number;
  BURROW_MS: number;
  /** Then it holds still this long so the new sum can be read. */
  REVEAL_MS: number;
  /** Reaching the ship costs a life and sends it back up to this y. */
  RETREAT_Y: number;
  /** It never pops up higher than this y (its balls stay below the top HUD). */
  MIN_Y: number;
  /** A boss that splits (the Mud Monster): what each of its parts is. The
   * level is cleared once every part is beaten. */
  PART?: BossDef;
}

/**
 * A creature on a level's page: what a monster kind becomes there, with its
 * own personality. It keeps the kind's movement; these are the extras.
 */
export interface SpeciesDef {
  /** Its name (the doodle the view draws for it). */
  NAME: string;
  /** Where it carries its number balls (BALL_LAYOUTS). */
  LAYOUT?: BallLayout;
  /** A special rule it carries (objects/traits.ts), e.g. "wings". */
  TRAIT?: string;
  /** × its kind's speed (default 1): a creature whose trait makes it harder
   * to beat moves slower (owner's rule, like ABILITY.SPEED). */
  SPEED?: number;
  /** Readability box instead of its kind's, with its balls in a row (like
   * BossDef.BOX): a creature whose sum grows (AbilityHost.addBall) gets a
   * box that already fits its last ball, so growing never breaks the rule. */
  BOX?: { HALF_W: number; BALLS_Y: number; BOTTOM: number };
  /** Sometimes comes in a marching line, in step: up to SIZE of them, with
   * chance CHANCE per spawn (a line skips the unsolved cap but not the
   * threat budget). One behind the other, or side by side with ROW. */
  MARCH?: { SIZE: number; CHANCE: number; ROW?: boolean };
  /** One line shown the first time it appears in a run. */
  INTRO: string;
}

export interface LevelDef {
  /** Shown in the level banner and on the level-complete card. */
  NAME: string;
  /** The notebook page it's drawn on (renderDoodle/pages.ts). */
  PAGE: string;
  /** Same seed every attempt: the same aliens come, so a level can be learned. */
  SEED: number;
  /** Path time (ms) from its start to the boss: field time, but never less
   * than STORY.PATH_MIN_PACE of real time (sim/director.ts). */
  PATH_MS: number;
  /** Difficulty d at the start and at the end of the path (paramsAt): how
   * fast and how big the sums are. How many come at once is the wave's. */
  D: { FROM: number; TO: number };
  WAVES: WavesDef;
  /** Most balls a sum may carry, instead of what the d range gives (3+ ball
   * sums ride on lumberers, one on screen at a time). */
  MAX_BALLS?: number;
  TWO_BALL_KINDS: TwoBallWeights;
  ABILITIES: readonly LevelAbility[];
  /** Bonus drifters cross during the path. */
  DRIFTERS: boolean;
  /** What each monster kind is on this page (kinds not listed stay as they are). */
  SPECIES: Partial<Record<AlienKind, SpeciesDef>>;
  BOSS: BossDef;
}

/** Story music (scenes/levelMusic.ts): a path and a boss track per level. */
export const MUSIC = {
  VOLUME: 0.35, // under the sound effects
  FADE_MS: 700, // crossfade to the boss track; fade out at the end
} as const;

export const STORY = {
  /** Lives for the whole run (arcade: they carry over between levels). */
  LIVES: 3,
  /** While the boss is up: the boss plus this many minions at a time. */
  BOSS_PHASE_UNSOLVED: 2,
  /** Level banner at the start. */
  BANNER_MS: 2600,
  /** The level-complete card stays at least this long. */
  CLEAR_MIN_MS: 1500,
  /** Room between two beetles of a marching line (on top of READ_GAP). */
  MARCH_GAP: 6,
  /** The path follows field time (SLOW and FREEZE hold it back), but never
   * falls further behind the game clock than this pace, so a level that is
   * played with a time power on stays about as long (owner's pick). */
  PATH_MIN_PACE: 0.8,
  /** Stages planned (docs/SOLO_MODES_DESIGN.md §3); LEVELS holds the built ones. */
  STAGES: 10,
} as const;

/**
 * The ending (scenes/EndingScene.ts), after the last level's boss: seen from
 * above, a kid's hands color the game's bosses on a small sheet of paper.
 */
export const ENDING = {
  /** The sheet on the desk: center, size, a slight tilt (radians). */
  SHEET: { X: 240, Y: 318, W: 404, H: 488, TILT: -0.03 },
  /** The doodles on the sheet: rows of cells (sheet px from its center). */
  CELL_W: 126,
  CELL_H: 96,
  ROWS_Y: [-118, -22, 74, 170],
  /** How many doodles at the end are still gray pencil, colored in one by
   * one while the scene plays. */
  STILL_GRAY: 2,
  /** A gray doodle is this much lighter than graphite. */
  GRAY_LIGHTEN: 0.45,
  /** Before the first stroke, per doodle, and moving between doodles. */
  START_MS: 1400,
  COLOR_MS: 3200,
  MOVE_MS: 800,
  /** The crayon's scribble up and down while coloring. */
  SCRIBBLE_HZ: 4,
  /** A tap leaves only after this long (it may still be the clear card's tap). */
  TAP_AFTER_MS: 2000,
  FADE_IN_MS: 900,
  /** Crayons the hand picks up, one per doodle colored in. */
  CRAYONS: ["#f08a2c", "#8e4fd8", "#e0679f", "#1f9e8f"],
  /** Music: a jingle, played once if the file exists (docs/MUSIC_PROMPTS.md). */
  MUSIC_FILE: "ending.mp3",
} as const;

/**
 * The story map (scenes/StoryMapScene.ts): one island per stage on a
 * notebook page, joined by a dotted trail from the bottom (stage 1) up.
 */
export const STORY_MAP = {
  /** Island centers, by stage index (a snake up the page). */
  SPOTS: [
    [128, 560],
    [332, 548],
    [356, 444],
    [146, 432],
    [118, 326],
    [328, 334],
    [354, 226],
    [150, 216],
    [132, 112],
    [338, 118],
  ] as const,
  /** After a level is cleared the ship flies to the next island this long,
   * then waits for a tap to start it. */
  TRAVEL_MS: 1600,
  /** Where the ship hovers next to its island. */
  SHIP_DX: 52,
  SHIP_DY: -24,
  /** An island reached only in an earlier run is redrawn in gray pencil:
   * its colors turn gray, this much lighter (0 = as dark, 1 = white). */
  BEFORE_LIGHTEN: 0.35,
  /** The trail stops this far (px) around each island's name and score, so
   * it never runs through them. */
  LABEL_CLEAR_PX: 5,
  /** An island's doodle box (logical px), drawn at 2× for a sharp picture. */
  ISLAND_W: 112,
  ISLAND_H: 66,
  /** Colored pencil per stage's island (its world, §3). No ball colors. */
  INK: [
    "#8a6a3f", // backyard dirt
    "#2a8f9e", // pond
    "#6f8f2f", // treetops
    "#6b7344", // swamp mud
    "#6e6a7a", // cave rock
    "#c4572a", // volcano
    "#8fb3d9", // windy sky
    "#a9b8c9", // snowy mountain
    "#4b3f8a", // night sky
    "#c07a9e", // bedroom
  ] as const,
} as const;

/** The story, in order: one file per level in config/levels/. */
export { LEVELS } from "../levels";
