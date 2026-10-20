import { ENEMY, STORY, WAVES, type AlienKind, type BossDef, type LevelDef, type SpeciesDef } from "../config/constants";
import { difficultyAt, paramsAt, type DifficultyParams } from "../config/difficulty";
import { unlockedAbilities, type AbilityKind } from "../objects/abilities";
import { waveAt, type WavePoint } from "./waves";

/** The kinds a 2-ball spawn picks from, by weight. */
export type TwoBallKind = keyof typeof ENEMY.TWO_BALL_KINDS;

/** The two clocks a story level's path is measured on. */
export interface PathClock {
  /** The game clock: ms of play (it keeps running through freezes). */
  elapsedMs: number;
  /** Field time: ms the field actually moved (stopped while frozen, slower
   * under SLOW). A story level's path advances with it. */
  fieldMs: number;
}

/** Where a field is when its director is asked (all read from the sim). */
export interface DirectorState extends PathClock {
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
  drifters(clock: PathClock): boolean;
  /** How far along a story level's path (0..1), or null without a path. */
  progress(clock: PathClock): number | null;
  /** Where a story level's path is in its wave, or null without a path. */
  wave(clock: PathClock): WavePoint | null;
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

  wave(): null {
    return null;
  }

  species(): null {
    return null;
  }

  readonly boss = null;
}

/**
 * A story level (config/tuning/story.ts): difficulty follows the path from
 * D.FROM to D.TO instead of the score, the level's wave decides how many
 * sums come at once and how fast, the roster is the level's own, and at the
 * end of the path the boss comes in. The path runs on field time, so
 * freezes and SLOW hold it back, but never below STORY.PATH_MIN_PACE of
 * the game clock, so a level stays about as long however it is played.
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
    const p = this.progress(s);
    const { FROM, TO } = this.level.D;
    const d = FROM + (TO - FROM) * p;
    const base = paramsAt(d, d);
    const params = { ...base, maxBalls: this.level.MAX_BALLS ?? base.maxBalls };
    // Boss phase: the boss and a minion or two, no more.
    if (p >= 1) return { ...params, maxUnsolved: STORY.BOSS_PHASE_UNSOLVED };
    // The wave: from one sum at a time and slow spawns (rest) to the
    // level's peak and fast spawns (burst).
    const w = this.wave(s).intensity;
    const lerp = (from: number, to: number) => from + (to - from) * w;
    return {
      ...params,
      maxUnsolved: Math.round(lerp(WAVES.REST_UNSOLVED, this.level.WAVES.PEAK)),
      spawnInterval: params.spawnInterval * lerp(WAVES.INTERVAL_X.REST, WAVES.INTERVAL_X.BURST),
    };
  }

  /** Where the path is in the level's wave right now. */
  wave(clock: PathClock): WavePoint {
    return waveAt(this.level.WAVES.PROFILE, this.progress(clock));
  }

  abilities(): readonly AbilityKind[] {
    return this.level.ABILITIES;
  }

  drifters(clock: PathClock): boolean {
    return this.level.DRIFTERS && this.progress(clock) < 1;
  }

  progress({ fieldMs, elapsedMs }: PathClock): number {
    const pathMs = Math.max(fieldMs, elapsedMs * STORY.PATH_MIN_PACE);
    return Math.min(1, pathMs / this.level.PATH_MS);
  }

  species(kind: AlienKind): SpeciesDef | null {
    return this.level.SPECIES[kind] ?? null;
  }
}
