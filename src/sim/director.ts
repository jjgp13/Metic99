import { ENEMY } from "../config/constants";
import { difficultyAt, type DifficultyParams } from "../config/difficulty";
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
}
