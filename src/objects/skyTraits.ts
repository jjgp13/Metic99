import { GAME } from "../config/constants";
import { BALLOON, KITE, LOOP, SKY_WIND, SWOOP } from "../config/levels/sky";
import { Ability } from "./abilities";
import type Alien from "./Alien";

/**
 * The windy sky's creatures (config/levels/sky.ts), listed in
 * objects/traits.ts. They all live in one wind (`Wind`), and each meets a
 * gust its own way. Pushes are glides (Alien.glideTo), so they run on field
 * time under the readability guard: a frozen field isn't blown about.
 */

const TAU = Math.PI * 2;

/** Where the wind is in its rhythm (the view draws swirls on "warn" and "gust"). */
export type WindPhase = "calm" | "warn" | "gust";

/** The level's wind at game-clock time `clockMs`: which gust (n), its
 * direction (+1 = blowing right) and the phase. */
export function windAt(clockMs: number): { gust: number; dir: 1 | -1; phase: WindPhase } {
  const W = SKY_WIND;
  const cycle = W.CALM_MS + W.WARN_MS + W.GUST_MS;
  const gust = Math.floor(clockMs / cycle);
  const t = clockMs - gust * cycle;
  const phase = t < W.CALM_MS ? "calm" : t < W.CALM_MS + W.WARN_MS ? "warn" : "gust";
  return { gust, dir: gust % 2 === 0 ? 1 : -1, phase };
}

/**
 * One creature's view of the wind. The clock is the game clock, picked up
 * from the alien's spawn time on its first tick and then advanced like the
 * volcano's fireflies, so every creature on the page feels the same gust at
 * the same moment.
 */
export class Wind {
  phase: WindPhase = "calm";
  dir: 1 | -1 = 1;
  private gust = 0;
  private clock: number | null = null;
  /** The last gust that pushed this creature. */
  private blown = -1;

  tick(delta: number, alien?: Alien): void {
    this.clock = (this.clock ?? alien?.spawnedAt ?? 0) + delta;
    const w = windAt(this.clock);
    this.phase = w.phase;
    this.dir = w.dir;
    this.gust = w.gust;
  }

  /**
   * True once per gust, on the first field step it can push `alien`: the
   * field is moving (a freeze skips the gust) and no glide or hold of the
   * alien's own is running (a gust that blows past one is missed).
   */
  takeGust(alien: Alien, fieldDelta: number): boolean {
    if (this.phase !== "gust" || this.blown === this.gust || fieldDelta <= 0 || alien.scripted) return false;
    this.blown = this.gust;
    return true;
  }
}

/** An x that keeps the alien's box inside the field. */
export function inField(alien: Alien, x: number): number {
  const lo = alien.halfW + SKY_WIND.EDGE_PX;
  return Math.min(Math.max(x, lo), GAME.WIDTH - lo);
}

/** A trait that lives in the wind: ticks it on real time (the game clock). */
export abstract class Windy extends Ability {
  readonly wind = new Wind();

  update(delta: number, alien?: Alien): void {
    this.wind.tick(delta, alien);
  }
}

/**
 * Kite: rides on the strafer (2 bows) or the lumberer (3 bows). While it is
 * on its string, each gust swings it across and lifts it (it climbs in the
 * wind). Once its string snaps (the strafer's windup, then its dive) it
 * tumbles down slower than a dive, swinging side to side and carried along
 * by any gust.
 */
export class Kite extends Windy {
  readonly kind = "sky_kite";
  private swing = 0;

  steer(alien: Alien, delta: number): void {
    if (alien.mode === "windup" || alien.mode === "dive") return;
    if (!this.wind.takeGust(alien, delta)) return;
    const y = Math.min(alien.y, Math.max(alien.y - KITE.LIFT_PX, KITE.MIN_Y)); // never pushed down
    alien.glideTo(inField(alien, alien.x + this.wind.dir * KITE.GUST_DX), y, KITE.GUST_MS);
  }

  pace(alien: Alien, delta: number): number {
    if (alien.mode !== "dive") return delta;
    // Incremental swing, so a sideways step refused by the readability rule
    // never makes it jump later (like the cave's bats).
    const g = this.swing + (TAU * delta) / KITE.SWING_MS;
    let x = alien.x + KITE.SWING_PX * (Math.sin(g) - Math.sin(this.swing));
    if (this.wind.phase === "gust") x += (this.wind.dir * KITE.DRIFT_PX_S * delta) / 1000;
    alien.x = inField(alien, x);
    this.swing = g % TAU;
    return delta * KITE.TUMBLE_PACE;
  }

  /** Its string has snapped: it is tumbling down. */
  tumbling(alien: Alien): boolean {
    return alien.mode === "dive";
  }
}

/**
 * Swallow: rides on the darter, zig-zagging down; when a gust blows it rides
 * it, swooping down and across with the wind. The gust is its burst of speed.
 */
export class Swoop extends Windy {
  readonly kind = "sky_swoop";

  steer(alien: Alien, delta: number): void {
    if (!this.wind.takeGust(alien, delta)) return;
    alien.glideTo(inField(alien, alien.x + this.wind.dir * SWOOP.DX), alien.y + SWOOP.DOWN_PX, SWOOP.MS);
  }

  /** It is swooping on a gust (the doodle spreads its wings flat). */
  swooping(alien: Alien): boolean {
    return alien.gliding;
  }
}

/** Where a paper plane is in its flight: gliding, nosing up, looping. */
export type PlanePose = "glide" | "nose" | "up" | "over";

/**
 * Paper plane: rides on the swooper. Once it has turned down, every EVERY_PX
 * of descent it noses up (a hold: the telegraph), then loops the loop in two
 * glides, up and forward, then over and down to where it started, further
 * along. Near an edge it loops the other way. A gust sweeps it sideways
 * (never while it flies in from the edge or loops).
 */
export class Loop extends Windy {
  readonly kind = "sky_loop";
  pose: PlanePose = "glide";
  private nextLoopY: number | null = null;
  private dir: 1 | -1 = 1;

  steer(alien: Alien, delta: number): void {
    if (alien.mode !== "move") return; // still flying in from the edge
    if (alien.scripted) return; // a step of its loop (or a gust) is running
    switch (this.pose) {
      case "nose":
        this.pose = "up";
        alien.glideTo(alien.x + this.dir * LOOP.DX, alien.y - LOOP.UP_PX, LOOP.LOOP_MS / 2);
        return;
      case "up":
        this.pose = "over";
        alien.glideTo(alien.x + this.dir * LOOP.DX, alien.y + LOOP.UP_PX, LOOP.LOOP_MS / 2);
        return;
      case "over":
        this.pose = "glide";
        this.nextLoopY = alien.y + LOOP.EVERY_PX;
        return;
      case "glide":
        break;
    }
    this.nextLoopY ??= alien.y + LOOP.FIRST_PX;
    if (alien.y >= this.nextLoopY) {
      // Loop the way it is heading, unless that would take it off the page.
      this.dir = alien.heading;
      const reach = 2 * LOOP.DX;
      if (inField(alien, alien.x + this.dir * reach) !== alien.x + this.dir * reach) this.dir = this.dir > 0 ? -1 : 1;
      this.pose = "nose";
      alien.hold(LOOP.NOSE_MS);
      return;
    }
    if (this.wind.takeGust(alien, delta)) {
      alien.glideTo(inField(alien, alien.x + this.wind.dir * LOOP.GUST_DX), alien.y, LOOP.GUST_MS);
    }
  }
}

/**
 * Hot-air balloon (the bonus): drifts across, and a gust carries it far
 * along. With its drift it may be carried off the page; against it, it is
 * pushed back but stays on the page.
 */
export class Balloon extends Windy {
  readonly kind = "sky_balloon";

  steer(alien: Alien, delta: number): void {
    if (!this.wind.takeGust(alien, delta)) return;
    const x = alien.x + this.wind.dir * BALLOON.GUST_DX;
    alien.glideTo(this.wind.dir === alien.heading ? x : inField(alien, x), alien.y, BALLOON.GUST_MS);
  }
}

export const SKY_TRAITS: Record<string, () => Ability> = {
  sky_kite: () => new Kite(),
  sky_swoop: () => new Swoop(),
  sky_loop: () => new Loop(),
  sky_balloon: () => new Balloon(),
};
