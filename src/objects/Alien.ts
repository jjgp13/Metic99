import { ENEMY } from "../config/constants";

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
}

/**
 * An Alien is pure game state: a position in the 2D logical playfield, the
 * numbers it carries and how it moves. It knows nothing about rendering — the
 * 3D view (World3D) reads these fields every frame and draws the body and its
 * number balls. Movement is driven by `behavior` so different enemy
 * personalities can be added without touching the scene.
 */
export default class Alien {
  public x: number;
  public y: number;
  /** False once killed; the renderer drops its view and the scene prunes it. */
  public active = true;

  /** The number the player must type to target this alien. */
  public readonly result: number;
  public readonly digits: readonly number[];
  /** How many numbers this alien carries (2 = easy sum, 3 = harder, …). */
  public readonly ballCount: number;
  public readonly bodyKey: string;
  public readonly ballTexture: string;
  public readonly behavior: AlienBehavior;
  public readonly spawnedAt: number;

  private fallSpeed: number;
  private homeSpeed: number;

  constructor(config: AlienConfig) {
    this.x = config.x;
    this.y = config.y;
    this.result = config.result;
    this.digits = config.digits;
    this.ballCount = config.digits.length;
    this.bodyKey = config.bodyKey;
    this.ballTexture = config.ballTexture;
    this.behavior = config.behavior ?? "descend";
    this.spawnedAt = config.spawnedAt;
    this.fallSpeed = config.fallSpeed;
    this.homeSpeed = config.homeSpeed;
  }

  /**
   * Move one frame according to the alien's behavior. "descend" falls straight
   * down in a fixed lane (no horizontal movement) so aliens never converge and
   * overlap; speed ramps from fallSpeed to homeSpeed past HOME_TRIGGER_Y, adding
   * urgency as it nears the player.
   */
  public advance(delta: number): void {
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
