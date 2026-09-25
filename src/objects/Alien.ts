import { ENEMY } from "../config/constants";
import type { Ability } from "./abilities";

/** How an alien moves through the field. New personalities slot in here. */
export type AlienBehavior = "descend";

/**
 * Everything needed to spawn one alien. Passing a single config object (instead
 * of a long positional argument list) keeps call sites readable and makes it
 * trivial to add per-personality fields (speed, behavior, ball color, …).
 */
export interface AlienConfig {
  x: number;
  y: number;
  bodyKey: string;
  /** The number the player must type to target this alien (sum of the balls). */
  result: number;
  /** The individual numbers the alien carries; their count drives personality. */
  digits: number[];
  ballTexture: string;
  fallSpeed: number;
  homeSpeed: number;
  /** Scene time (ms) when spawned, used for the score's speed bonus. */
  spawnedAt: number;
  behavior?: AlienBehavior;
  /** Blender model to wear; omitted = the renderer picks a random monster. */
  model?: string;
  /** Special rule layered on top of the behavior (objects/abilities.ts). */
  ability?: Ability;
}

interface Glide {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  ms: number;
}

/**
 * An Alien is pure game state: a position in the 2D logical playfield, the
 * numbers it carries and how it moves. It knows nothing about rendering — the
 * 3D view (World3D) reads these fields every frame and draws the body and its
 * number balls. Movement is driven by `behavior` so different enemy
 * personalities can be added without touching the scene; an optional `ability`
 * adds special rules on top.
 */
export default class Alien {
  public x: number;
  public y: number;
  /** False once killed; the renderer drops its view and the scene prunes it. */
  public active = true;

  /** The number the player must type to target this alien. */
  public result: number;
  public digits: readonly number[];
  /** Bumped whenever the sum changes, so the renderer rebuilds the balls. */
  public sumVersion = 0;
  public readonly bodyKey: string;
  public readonly ballTexture: string;
  public readonly behavior: AlienBehavior;
  public readonly model: string | null;
  public readonly ability: Ability | null;
  /** When the current sum appeared (speed bonus); reset when it changes. */
  public spawnedAt: number;

  private fallSpeed: number;
  private homeSpeed: number;
  /** Scripted moves that override the behavior: a glide, then a hold. */
  private glide: Glide | null = null;
  private holdMs = 0;

  constructor(config: AlienConfig) {
    this.x = config.x;
    this.y = config.y;
    this.result = config.result;
    this.digits = config.digits;
    this.bodyKey = config.bodyKey;
    this.ballTexture = config.ballTexture;
    this.behavior = config.behavior ?? "descend";
    this.model = config.model ?? null;
    this.ability = config.ability ?? null;
    this.spawnedAt = config.spawnedAt;
    this.fallSpeed = config.fallSpeed;
    this.homeSpeed = config.homeSpeed;
  }

  /** How many numbers this alien carries (2 = easy sum, 3 = harder, …). */
  public get ballCount(): number {
    return this.digits.length;
  }

  /** Where the alien is heading (its glide target, else where it is). Spawn
   * and split lane checks use this so a gliding alien reserves its lane. */
  public get laneX(): number {
    return this.glide?.toX ?? this.x;
  }

  public get laneY(): number {
    return this.glide?.toY ?? this.y;
  }

  /** Replace the sum (e.g. a shield broke). The caller keeps results unique. */
  public setSum(digits: number[], result: number, now: number): void {
    this.digits = digits;
    this.result = result;
    this.spawnedAt = now;
    this.sumVersion++;
  }

  /** Ease to (x, y) over `ms`, ignoring the behavior until it arrives. */
  public glideTo(x: number, y: number, ms: number): void {
    this.glide = { fromX: this.x, fromY: this.y, toX: x, toY: y, t: 0, ms };
  }

  /** Stay put for `ms` (after any glide) before the behavior resumes. */
  public hold(ms: number): void {
    this.holdMs = ms;
  }

  /**
   * Move one frame according to the alien's behavior. "descend" falls straight
   * down in a fixed lane (no horizontal movement) so aliens never converge and
   * overlap; speed ramps from fallSpeed to homeSpeed past HOME_TRIGGER_Y, adding
   * urgency as it nears the player. A scripted glide/hold overrides it.
   */
  public advance(delta: number): void {
    if (this.glide) {
      const g = this.glide;
      g.t = Math.min(g.t + delta, g.ms);
      const k = 1 - (1 - g.t / g.ms) ** 3; // ease-out
      this.x = g.fromX + (g.toX - g.fromX) * k;
      this.y = g.fromY + (g.toY - g.fromY) * k;
      if (g.t >= g.ms) this.glide = null;
      return;
    }
    if (this.holdMs > 0) {
      this.holdMs -= delta;
      return;
    }

    const dt = delta / 1000;
    switch (this.behavior) {
      case "descend": {
        const speed = this.y < ENEMY.HOME_TRIGGER_Y ? this.fallSpeed : this.homeSpeed;
        this.y += speed * dt;
        break;
      }
    }
  }

  public kill(): void {
    this.active = false;
  }
}
