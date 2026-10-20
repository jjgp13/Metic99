import { GAME } from "../config/constants";
import { HEAD_TURN, HOVER, LEAP } from "../config/levels/treetops";
import { Ability, blinkCover } from "./abilities";
import type Alien from "./Alien";

/**
 * The treetops creatures' special rules (config/levels/treetops.ts), listed
 * in objects/traits.ts. The leap and the hover steer their alien (`steer`,
 * on field time) only with glideTo/hold, which Alien.advance runs under the
 * readability guard, and they trigger on position, not on a clock: a frozen
 * field doesn't move, so nothing leaps or darts either.
 */

/**
 * Squirrel: once it has turned down, every EVERY_PX of descent it leaps to
 * the next branch, sideways by PX and a little down, then freezes a moment.
 * It leaps the other way each time (away from an edge if it must), so the
 * path can be read ahead.
 */
export class Leap extends Ability {
  readonly kind = "leap";
  /** y of the next branch it leaps from; null until it turns down. */
  nextBranchY: number | null = null;
  private dir: 1 | -1 = 1;

  steer(alien: Alien): void {
    if (alien.mode !== "move") return; // still flying in from the trunk
    if (this.nextBranchY === null) {
      this.nextBranchY = alien.y + LEAP.FIRST_PX;
      this.dir = alien.heading; // keep going the way it came in
      return;
    }
    if (alien.y < this.nextBranchY) return;
    this.nextBranchY = alien.y + LEAP.EVERY_PX;
    const lo = alien.halfW + LEAP.EDGE_PX;
    const hi = GAME.WIDTH - lo;
    if (alien.x + this.dir * LEAP.PX > hi || alien.x + this.dir * LEAP.PX < lo) this.dir = this.dir > 0 ? -1 : 1;
    const x = Math.min(Math.max(alien.x + this.dir * LEAP.PX, lo), hi);
    alien.glideTo(x, alien.y + LEAP.DROP_PX, LEAP.MS);
    alien.hold(LEAP.LAND_MS);
    this.dir = this.dir > 0 ? -1 : 1;
  }

  /** It is about to leap (the doodle crouches: the telegraph). */
  crouching(alien: Alien): boolean {
    if (this.nextBranchY === null || alien.mode !== "move") return false;
    const left = this.nextBranchY - alien.y;
    return left > 0 && left < LEAP.CROUCH_PX;
  }
}

/**
 * Owl: turns its head away on a fixed rhythm (the Blinker's, glancing aside
 * first), hiding the numbers that are its eyes. It always looks at you while
 * it winds up and swoops down, so a diving owl can always be read.
 */
export class HeadTurn extends Ability {
  readonly kind = "headTurn";
  private t = 0;
  private swooping = false;

  // The rhythm runs on real time, like the Blinker's; steer only looks.
  update(delta: number): void {
    this.t += delta;
    this.cover = this.swooping ? 0 : blinkCover(this.t, HEAD_TURN);
  }

  steer(alien: Alien): void {
    this.swooping = alien.mode === "windup" || alien.mode === "dive";
    if (this.swooping) this.cover = 0;
  }
}

/**
 * Hummingbird (bonus): once on screen it darts DART_PX ahead and hovers
 * HOVER_MS, every EVERY_PX of crossing. Hovering is the moment to catch it.
 */
export class Hover extends Ability {
  readonly kind = "hover";
  /** How far across it has come (px from the edge it entered). */
  private nextDartAt: number | null = null;

  steer(alien: Alien): void {
    const across = alien.heading > 0 ? alien.x : GAME.WIDTH - alien.x;
    this.nextDartAt ??= alien.halfW + HOVER.FIRST_PX;
    if (across < this.nextDartAt) return;
    this.nextDartAt = across + HOVER.EVERY_PX;
    alien.glideTo(alien.x + alien.heading * HOVER.DART_PX, alien.y, HOVER.DART_MS);
    alien.hold(HOVER.HOVER_MS);
  }
}
