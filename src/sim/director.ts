import { ENEMY, STORY, type AlienKind, type BossDef, type LevelDef, type SpeciesDef } from "../config/constants";
import { difficultyAt, paramsAt, type DifficultyParams } from "../config/difficulty";
import { unlockedAbilities, type AbilityKind } from "../objects/abilities";

/** The kinds a 2-ball spawn picks from, by weight. */
export type TwoBallKind = keyof typeof ENEMY.TWO_BALL_KINDS;

/** Where a field is when its director is asked (all read from the sim). */
export interface DirectorState {
  /** The game clock: ms of play (it keeps running through freezes). */
  elapsedMs: number;
  /** Field time: ms the field actually moved (stopped while frozen, slower
   * under SLOW). A story level's path advances with it. */
  fieldMs: number;
  score: number;
  /** Battle pressure from the match (0 in solo play). */
  dMatch: number;
}

/**
 * Decides what a field spawns and how hard it is: the part that differs
 * between Endless (the score-led curve) and a story level (a path with its
 * own roster). Swarm asks its director and never decides pacing itself, so
 * each mode is its own small class instead of `if (story)` all over Swarm.
 * This is the strategy pattern (docs/ARCHITECTURE.md), the same shape as
 * FieldView for drawing.
 */
export interface SpawnDirector {
  /** Pacing knobs right now. */
  difficulty(state: DirectorState): DifficultyParams;
  /** Abilities a new spawn may get at difficulty `d`. */
  abilities(d: number): readonly AbilityKind[];
  /** Weights for picking a 2-ball spawn's kind. */
  readonly twoBallKinds: Readonly<Record<TwoBallKind, number>>;
  /** Whether bonus drifters cross the field right now. */
  drifters(fieldMs: number): boolean;
  /** How far along a story level's path (0..1), or null without a path. */
  progress(fieldMs: number): number | null;
  /** The boss met at the end of the path, or null. */
  readonly boss: BossDef | null;
  /** What a monster kind is on this page (its personality), or null. */
  species(kind: AlienKind): SpeciesDef | null;
}

/** Endless and battles: today's score-led curve, every monster unlocked by d. */
export class EndlessDirector implements SpawnDirector {
  readonly twoBallKinds = ENEMY.TWO_BALL_KINDS;

  difficulty(s: DirectorState): DifficultyParams {
    return difficultyAt(s.elapsedMs, s.score, s.dMatch);
  }

  abilities(d: number): readonly AbilityKind[] {
    return unlockedAbilities(d);
  }

  drifters(): boolean {
    return true;
  }

  progress(): null {
    return null;
  }

  species(): null {
    return null;
  }

  readonly boss = null;
}

/**
 * A story level (config/tuning/story.ts): difficulty follows the path from
 * D.FROM to D.TO instead of the score, the roster is the level's own, and
 * at the end of the path the boss comes in. The path runs on field time, so
 * freezes and SLOW hold it back too.
 */
export class LevelDirector implements SpawnDirector {
  readonly boss: BossDef;

  constructor(readonly level: LevelDef) {
    this.boss = level.BOSS;
  }

  get twoBallKinds(): Readonly<Record<TwoBallKind, number>> {
    return this.level.TWO_BALL_KINDS;
  }

  difficulty(s: DirectorState): DifficultyParams {
    const p = this.progress(s.fieldMs);
    const { FROM, TO } = this.level.D;
    const d = FROM + (TO - FROM) * p;
    const base = paramsAt(d, d);
    const params = { ...base, maxBalls: this.level.MAX_BALLS ?? base.maxBalls };
    // Boss phase: the boss and a minion or two, no more.
    return p < 1 ? params : { ...params, maxUnsolved: STORY.BOSS_PHASE_UNSOLVED };
  }

  abilities(): readonly AbilityKind[] {
    return this.level.ABILITIES;
  }

  drifters(fieldMs: number): boolean {
    return this.level.DRIFTERS && this.progress(fieldMs) < 1;
  }

  progress(fieldMs: number): number {
    return Math.min(1, fieldMs / this.level.PATH_MS);
  }

  species(kind: AlienKind): SpeciesDef | null {
    return this.level.SPECIES[kind] ?? null;
  }
}
