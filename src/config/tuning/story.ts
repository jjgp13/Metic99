// Story mode (docs/SOLO_MODES_DESIGN.md): levels, bosses, the arcade run.
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

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
  /** Doodle (and 3D) model; its readability box is in MODEL_BOXES. */
  MODEL: string;
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
  TWO_BALL_KINDS: TwoBallWeights;
  ABILITIES: readonly LevelAbility[];
  /** Bonus drifters cross during the path. */
  DRIFTERS: boolean;
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
} as const;

/** Level 1's boss: a giant mole that digs around the backyard. */
const GIANT_MOLE: BossDef = {
  NAME: "GIANT MOLE",
  MODEL: "boss_mole",
  KIND: "lumberer",
  HP: 5,
  BALLS: 3,
  SPEED: 0.45,
  SCORE_MULT: 5,
  BURROW_UP_PX: 110,
  BURROW_MS: 800,
  REVEAL_MS: 900,
  RETREAT_Y: 140,
  MIN_Y: 140,
};

/** The story, in order. Levels 2–10 are planned in docs/SOLO_MODES_DESIGN.md §3. */
export const LEVELS: readonly LevelDef[] = [
  {
    NAME: "THE BACKYARD",
    PAGE: "backyard",
    SEED: 1001,
    PATH_MS: 180_000,
    // Bots (20 seeds): rookie clears 18/20 losing ~1.5 lives, pilot and ace all.
    D: { FROM: 0, TO: 0.25 },
    // Bugs: beetles (darters) and dragonflies (swoopers); no divers yet.
    TWO_BALL_KINDS: { darter: 0.6, strafer: 0, swooper: 0.4 },
    ABILITIES: [],
    DRIFTERS: true,
    BOSS: GIANT_MOLE,
  },
];
