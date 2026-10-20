import { GAME, MONSTERS, PLAYER } from "../config/constants";
import {
  BIG_INVADER_MARCH,
  COMET,
  INVADER_MARCH,
  UFO_WARP,
  WISH,
  type MarchTiming,
} from "../config/levels/night";
import { Ability } from "./abilities";
import type Alien from "./Alien";

/**
 * The night sky's creature traits (config/levels/night.ts), listed in
 * objects/traits.ts. Names start with "night_" so no other level's trait
 * can take them.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * March (invaders): the creature moves only in steps on a beat, like
 * Space Invaders: down, SIDE_STEPS one way, down, SIDE_STEPS back, … Each
 * step is a short glide and the beat a hold (Alien.glideTo / hold), so the
 * rhythm runs in field time: a freeze or SLOW holds it too, and the
 * readability rule checks every step. A row that came in together starts
 * together and steps together. The beat quickens the lower it gets.
 */
export class March extends Ability {
  readonly kind: string;
  /** Flips each step: the view's two-frame walk, like the arcade's. */
  frame = 0;
  private steps = 0;
  /** Its first sideways direction (a row shares its leader's). */
  private dir: 1 | -1 | null = null;

  constructor(
    kind: string,
    private readonly timing: MarchTiming,
  ) {
    super();
    this.kind = kind;
  }

  update(_delta: number, alien?: Alien): void {
    if (!alien || alien.scripted) return;
    const T = this.timing;
    this.dir ??= alien.heading;
    // down, side × N, down, back × N
    const half = T.SIDE_STEPS + 1;
    const k = this.steps++ % (2 * half);
    if (k % half === 0) {
      alien.glideTo(alien.x, alien.y + T.DY, T.STEP_MS);
    } else {
      const dir = k < half ? this.dir : -this.dir;
      const x = Math.min(Math.max(alien.x + dir * T.DX, alien.halfW + 2), GAME.WIDTH - alien.halfW - 2);
      alien.glideTo(x, alien.y, T.STEP_MS);
    }
    const low = clamp01(alien.y / PLAYER.Y);
    alien.hold(T.BEAT_MS * (1 - T.QUICKEN * low) - T.STEP_MS);
    this.frame = 1 - this.frame;
  }
}

/**
 * Bounce (comets): once in from its side edge, a comet keeps flying on a
 * slant as it falls, and bounces off the page's edges, and off any creature
 * the readability rule doesn't let it pass, like a ball on a table.
 */
export class Bounce extends Ability {
  readonly kind = "night_bounce";
  /** Its sideways direction now (0 until it starts falling). */
  dir: -1 | 0 | 1 = 0;
  /** Where its last slant step should have put it. */
  private expectX: number | null = null;

  pace(alien: Alien, delta: number): number {
    if (alien.mode !== "move") return delta; // still streaking in from the side
    if (this.dir === 0) this.dir = alien.heading;
    // A slant step the readability rule refused: it bumped into a creature.
    if (this.expectX !== null && Math.abs(alien.x - this.expectX) > 1e-6) this.dir = this.dir > 0 ? -1 : 1;
    let x = alien.x + (this.dir * COMET.SLANT_PX_S * delta) / 1000;
    const lo = alien.halfW + COMET.EDGE_PX;
    const hi = GAME.WIDTH - lo;
    if (x < lo || x > hi) {
      x = Math.min(Math.max(x, lo), hi);
      this.dir = this.dir > 0 ? -1 : 1;
    }
    alien.x = x;
    this.expectX = x;
    return delta;
  }
}

/** Where a UFO is in its warp (the view spins its lights in "warn"). */
export type WarpPhase = "fly" | "warn" | "warp";

/**
 * Warp (UFOs): while patrolling the top, every EVERY_MS it spins its lights
 * (the telegraph), then vanishes and reappears PX away, toward the side of
 * the page with more room (often across the middle). Its numbers are gone only while it warps, and its sum stays the
 * same. It never warps once it winds up for its dive. Field time.
 */
export class Warp extends Ability {
  readonly kind = "night_warp";
  phase: WarpPhase = "fly";
  private t = 0;

  steer(alien: Alien, delta: number): void {
    this.move(alien, delta);
    this.cover = this.phase === "warp" ? 1 : 0;
  }

  private move(alien: Alien, delta: number): void {
    if (this.phase === "warp") {
      if (!alien.gliding) this.phase = "fly";
      return;
    }
    if (alien.mode !== "patrol") {
      this.phase = "fly";
      this.t = 0;
      return;
    }
    this.t += delta;
    if (this.phase === "fly" && this.t >= UFO_WARP.EVERY_MS) {
      this.phase = "warn";
      this.t = 0;
    } else if (this.phase === "warn" && this.t >= UFO_WARP.WARN_MS) {
      // Toward the roomier side, never so far that its patrol leaves the page.
      const room = alien.halfW + MONSTERS.strafer.PATROL_HALF;
      const side = alien.x < GAME.WIDTH / 2 ? 1 : -1;
      const x = Math.min(Math.max(alien.x + side * UFO_WARP.PX, room), GAME.WIDTH - room);
      alien.glideTo(x, alien.y, UFO_WARP.WARP_MS);
      this.phase = "warp";
      this.t = 0;
    }
  }
}

/**
 * Wish (the bonus shooting star): it crosses fast, falling a little, and
 * burns out as it goes: its numbers fade between BURN_FROM and BURN_TO of
 * the way across, so it must be answered early.
 */
export class Wish extends Ability {
  readonly kind = "night_wish";

  pace(alien: Alien, delta: number): number {
    const across = (MONSTERS.drifter.CROSS_SPEED * WISH.PACE * delta) / 1000;
    alien.y += (WISH.DROP_PX * across) / GAME.WIDTH;
    return delta * WISH.PACE;
  }

  update(_delta: number, alien?: Alien): void {
    if (!alien) return;
    const way = alien.heading > 0 ? alien.x / GAME.WIDTH : 1 - alien.x / GAME.WIDTH;
    this.cover = clamp01((way - WISH.BURN_FROM) / (WISH.BURN_TO - WISH.BURN_FROM));
  }
}

export const NIGHT_TRAITS: Record<string, () => Ability> = {
  night_march: () => new March("night_march", INVADER_MARCH),
  night_bigMarch: () => new March("night_bigMarch", BIG_INVADER_MARCH),
  night_bounce: () => new Bounce(),
  night_warp: () => new Warp(),
  night_wish: () => new Wish(),
};
