import { ENEMY, GAME, MODEL_BOXES, MONSTERS, type AlienKind } from "../config/constants";
import type { Rng } from "../sim/rng";
import type { Ability } from "./abilities";

/**
 * Where an alien is in its movement pattern. Most kinds only "move"; the
 * strafer flies in, patrols, winds up (a telegraph the renderer shows) and dives.
 */
export type AlienMode = "move" | "enter" | "patrol" | "windup" | "dive";

/**
 * Everything needed to spawn one alien. Passing a single config object (instead
 * of a long positional argument list) keeps call sites readable and makes it
 * trivial to add per-kind fields.
 */
export interface AlienConfig {
  kind: AlienKind;
  x: number;
  y: number;
  /** Sprite drawn by the voxel fallback when the kind's model isn't loaded. */
  bodyKey: string;
  /** The number the player must type to target this alien (sum of the balls). */
  result: number;
  /** The individual numbers the alien carries. */
  digits: number[];
  ballTexture: string;
  fallSpeed: number;
  homeSpeed: number;
  /** Game-clock time (ms) when spawned, used for the score's speed bonus. */
  spawnedAt: number;
  /** Seeded stream for the alien's quirks (start direction, gait phase). */
  rng: Rng;
  /** Strafer: patrol time before the dive. */
  patrolMs?: number;
  /** Strafer / drifter: body y of the band it patrols or crosses. */
  bandY?: number;
  /** Model to wear instead of the kind's (ability aliens); its box comes from
   * MODEL_BOXES while the movement still follows `kind`. */
  model?: string;
  /** Special rule layered on top of the movement (objects/abilities.ts). */
  ability?: Ability;
}

/** A scripted move (knockback, splitting apart) that overrides the pattern. */
interface Glide {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  ms: number;
}

const TAU = Math.PI * 2;

/**
 * An Alien is pure game state: a position in the 2D logical playfield, the
 * numbers it carries, its kind and how that kind moves. It knows nothing about
 * rendering — the 3D view (World3D) reads these fields every frame and draws
 * the kind's model, its animation and the number balls. An optional `ability`
 * adds special rules on top of the movement.
 */
export default class Alien {
  public x: number;
  public y: number;
  /** Position at the start of the last sim step. The sim steps at a fixed rate,
   * so the renderer draws between the last two steps (`viewX`/`viewY`). */
  public prevX: number;
  public prevY: number;
  /** False once killed; the renderer drops its view and the scene prunes it. */
  public active = true;

  public readonly kind: AlienKind;
  /** Lethal aliens cost a life at the player line; the drifter is a bonus. */
  public readonly lethal: boolean;
  /** The number the player must type to target this alien. */
  public result: number;
  public digits: readonly number[];
  /** Bumped whenever the sum changes, so the renderer rebuilds the balls. */
  public sumVersion = 0;
  public readonly bodyKey: string;
  public readonly ballTexture: string;
  /** When the current sum appeared (speed bonus); reset when it changes. */
  public spawnedAt: number;
  /** Model worn instead of the kind's (ability aliens), else null. */
  public readonly model: string | null;
  public readonly ability: Ability | null;

  // Readability box around the ball row and body, relative to (x, y).
  public readonly halfW: number;
  public readonly top: number;
  public readonly bottom: number;
  /** Half-width of the horizontal span this alien sweeps around its lane. */
  public readonly sweepHalf: number;

  public mode: AlienMode;
  /** Radians through the kind's movement cycle (stomp, bob); drives animation. */
  public gait = 0;

  private readonly fallSpeed: number;
  private readonly homeSpeed: number;
  /** Horizontal direction for sideways movers (+1 right, -1 left). */
  private dir: 1 | -1;
  /** Center of the sideways sweep (darter lane, strafer patrol). */
  private laneX: number;
  private readonly bandY: number;
  private modeLeftMs: number;
  private glide: Glide | null = null;
  private holdMs = 0;

  constructor(config: AlienConfig) {
    this.kind = config.kind;
    this.lethal = config.kind !== "drifter";
    this.x = config.x;
    this.y = config.y;
    this.prevX = config.x;
    this.prevY = config.y;
    this.result = config.result;
    this.digits = config.digits;
    this.bodyKey = config.bodyKey;
    this.ballTexture = config.ballTexture;
    this.spawnedAt = config.spawnedAt;
    this.model = config.model ?? null;
    this.ability = config.ability ?? null;
    this.fallSpeed = config.fallSpeed;
    this.homeSpeed = config.homeSpeed;
    this.laneX = config.x;
    this.bandY = config.bandY ?? 0;
    this.modeLeftMs = config.patrolMs ?? 0;

    const box = (this.model && MODEL_BOXES[this.model]) || MONSTERS[config.kind];
    const ballRowHalf = ((this.ballCount - 1) * ENEMY.BALL_SPACING) / 2 + ENEMY.BALL_RADIUS;
    this.halfW = Math.max(box.HALF_W, ballRowHalf);
    this.top = box.BALLS_Y + ENEMY.BALL_RADIUS;
    this.bottom = box.BOTTOM;
    const lateral =
      config.kind === "darter"
        ? MONSTERS.darter.ZIG_AMPLITUDE
        : config.kind === "strafer"
          ? MONSTERS.strafer.PATROL_HALF
          : 0;
    this.sweepHalf = this.halfW + lateral;

    this.mode = config.kind === "strafer" ? "enter" : "move";
    if (config.kind === "drifter") this.dir = config.x < GAME.WIDTH / 2 ? 1 : -1;
    else this.dir = config.rng.chance(0.5) ? 1 : -1;
    this.gait = config.rng.next() * TAU;
  }

  /** Remember where the alien was before this sim step moves it. */
  public savePrev(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }

  /** Where to draw it, `alpha` (0..1) of the way from the last step to this one. */
  public viewX(alpha: number): number {
    return this.prevX + (this.x - this.prevX) * alpha;
  }

  public viewY(alpha: number): number {
    return this.prevY + (this.y - this.prevY) * alpha;
  }

  /** How many numbers this alien carries (2 = easy sum, 3 = harder, …). */
  public get ballCount(): number {
    return this.digits.length;
  }

  /**
   * Horizontal span this alien may occupy soon: its whole zig-zag or patrol
   * while it moves sideways, just its box once it moves straight. The spawner
   * keeps new aliens out of these spans.
   */
  public get sweep(): readonly [number, number] {
    const lateral = this.kind === "darter" || (this.kind === "strafer" && this.mode !== "dive");
    return lateral
      ? [this.laneX - this.sweepHalf, this.laneX + this.sweepHalf]
      : [this.x - this.halfW, this.x + this.halfW];
  }

  /** Whether this alien's box, placed at (x, y), comes within READ_GAP of other's. */
  public overlapsAt(x: number, y: number, other: Alien): boolean {
    const gap = ENEMY.READ_GAP;
    return (
      Math.abs(x - other.x) < this.halfW + other.halfW + gap &&
      y - this.top < other.y + other.bottom + gap &&
      other.y - other.top < y + this.bottom + gap
    );
  }

  public overlaps(other: Alien): boolean {
    return this.overlapsAt(this.x, this.y, other);
  }

  /** Drifter only: crossed out of the far side (it leaves, no penalty). */
  public get escaped(): boolean {
    if (this.lethal) return false;
    return this.dir > 0 ? this.x > GAME.WIDTH + this.halfW : this.x < -this.halfW;
  }

  /** Replace the sum (e.g. a shield broke). The caller keeps results unique;
   * the ball count stays the same, so the readability box does too. */
  public setSum(digits: number[], result: number, now: number): void {
    this.digits = digits;
    this.result = result;
    this.spawnedAt = now;
    this.sumVersion++;
  }

  /**
   * Ease to (x, y) over `ms`, ignoring the movement pattern until it arrives.
   * The glide moves in per-frame steps, so the readability rule can still hold
   * a step back; a sideways glide also recenters the lane it sweeps around.
   */
  public glideTo(x: number, y: number, ms: number): void {
    this.glide = { fromX: this.x, fromY: this.y, toX: x, toY: y, t: 0, ms };
    this.laneX = x;
  }

  /** Stay put for `ms` (after any glide) before the pattern resumes. */
  public hold(ms: number): void {
    this.holdMs = ms;
  }

  /** Move one frame according to the alien's kind (or a scripted glide/hold). */
  public advance(delta: number): void {
    if (this.glide) {
      const g = this.glide;
      const ease = (t: number) => 1 - (1 - t / g.ms) ** 3; // ease-out
      const k0 = ease(g.t);
      g.t = Math.min(g.t + delta, g.ms);
      const dk = ease(g.t) - k0;
      this.x += (g.toX - g.fromX) * dk;
      this.y += (g.toY - g.fromY) * dk;
      if (g.t >= g.ms) this.glide = null;
      return;
    }
    if (this.holdMs > 0) {
      this.holdMs -= delta;
      return;
    }

    const dt = delta / 1000;
    switch (this.kind) {
      case "darter": {
        const m = MONSTERS.darter;
        this.y += this.descentSpeed() * m.SPEED * dt;
        this.x += this.dir * m.ZIG_SPEED * dt;
        this.bounceAt(m.ZIG_AMPLITUDE);
        break;
      }
      case "lumberer": {
        // Steps during the first half of each cycle and stands still for the
        // second; the π gain keeps the average at the difficulty's speed.
        const m = MONSTERS.lumberer;
        this.gait = (this.gait + (TAU * delta) / m.STOMP_MS) % TAU;
        const step = Math.PI * Math.max(0, Math.sin(this.gait));
        this.y += this.descentSpeed() * m.SPEED * step * dt;
        break;
      }
      case "strafer":
        this.advanceStrafer(delta, dt);
        break;
      case "drifter": {
        // Incremental bob, so a move held back by the readability rule never
        // makes it jump when it resumes.
        const m = MONSTERS.drifter;
        this.x += this.dir * m.CROSS_SPEED * dt;
        const g = this.gait + (TAU * delta) / m.BOB_MS;
        this.y += m.BOB_PX * (Math.sin(g) - Math.sin(this.gait));
        this.gait = g % TAU;
        break;
      }
    }
  }

  /**
   * Called when a sideways move was refused by the readability rule: patrols
   * and zig-zags turn around (the drifter just waits for the way to clear).
   */
  public blockedX(): void {
    if (this.kind === "darter" || (this.kind === "strafer" && this.mode === "patrol")) {
      this.dir = this.dir > 0 ? -1 : 1;
    }
  }

  public kill(): void {
    this.active = false;
  }

  private descentSpeed(): number {
    return this.y < ENEMY.HOME_TRIGGER_Y ? this.fallSpeed : this.homeSpeed;
  }

  /** Turn around at `reach` px from the lane center. */
  private bounceAt(reach: number): void {
    if ((this.x - this.laneX) * this.dir >= reach) {
      this.x = this.laneX + this.dir * reach;
      this.dir = this.dir > 0 ? -1 : 1;
    }
  }

  private advanceStrafer(delta: number, dt: number): void {
    const m = MONSTERS.strafer;
    switch (this.mode) {
      case "enter":
        this.y = Math.min(this.bandY, this.y + m.ENTER_SPEED * dt);
        if (this.y >= this.bandY) this.mode = "patrol";
        break;
      case "patrol":
        this.x += this.dir * m.PATROL_SPEED * dt;
        this.bounceAt(m.PATROL_HALF);
        this.modeLeftMs -= delta;
        if (this.modeLeftMs <= 0) {
          this.mode = "windup";
          this.modeLeftMs = m.WINDUP_MS;
        }
        break;
      case "windup":
        this.modeLeftMs -= delta;
        if (this.modeLeftMs <= 0) this.mode = "dive";
        break;
      case "dive":
        this.y += this.homeSpeed * m.DIVE_SPEED * dt;
        break;
    }
  }
}
