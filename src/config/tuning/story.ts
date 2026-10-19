// Story mode (docs/SOLO_MODES_DESIGN.md): levels, bosses, the arcade run.
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.
import type { AlienKind, BallLayout } from "./monsters";

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
  /** Sometimes comes in a marching line, in step: up to SIZE of them, with
   * chance CHANCE per spawn (a line skips the unsolved cap but not the
   * threat budget). */
  MARCH?: { SIZE: number; CHANCE: number };
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
  /** Field time (ms) from the start of the path to the boss. */
  PATH_MS: number;
  /** Difficulty d at the start and at the end of the path (paramsAt). */
  D: { FROM: number; TO: number };
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
} as const;

/** The story, in order: one file per level in config/levels/. */
export { LEVELS } from "../levels";
