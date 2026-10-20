import { GAME } from "../config/constants";
import { DRAGONFLY, DUCK, FROG, type BigFrogDef } from "../config/levels/pond";
import { Ability, Boss, type AbilityHost } from "./abilities";
import type Alien from "./Alien";

/**
 * The pond's special rules (config/levels/pond.ts): two creature traits and
 * the Big Frog's mechanic. All three script their own moves in `steer`,
 * which runs on field time, so freezes and SLOW hold them too.
 */

/** x moved `dx` sideways, kept `edge` px (plus its box) inside the field. */
function within(alien: Alien, dx: number, edge: number): number {
  const lo = alien.halfW + edge;
  return Math.min(Math.max(alien.x + dx, lo), GAME.WIDTH - lo);
}

/**
 * Hop (frog): it hops on the lumberer's stop-and-go, but after each hop it
 * sits on its lily pad a while longer, the longer the more spots (balls) it
 * carries: a 4-ball sum takes longer to add, so it comes slower.
 */
export class Hop extends Ability {
  readonly kind = "hop";
  private inAir = false;

  steer(alien: Alien): void {
    const inAir = Math.sin(alien.gait) > 0; // the lumberer moves while sin(gait) > 0
    if (this.inAir && !inAir) alien.hold(FROG.SIT_PER_BALL_MS * alien.ballCount);
    this.inAir = inAir;
  }
}

/**
 * Dart (dragonfly): it patrols and buzzes like any strafer, but its dive is
 * a string of quick zips down, to alternate sides, hanging still in the air
 * between them (a hover is a moment to read it).
 */
export class Dart extends Ability {
  readonly kind = "dart";
  private leftMs = 0; // field ms until the next dart
  private side: 1 | -1 = 1;

  steer(alien: Alien, delta: number): void {
    if (alien.mode !== "dive") return;
    this.leftMs -= delta;
    if (this.leftMs > 0) return;
    const D = DRAGONFLY;
    this.leftMs += D.DART_MS + D.HOVER_MS;
    this.side = this.side > 0 ? -1 : 1;
    alien.glideTo(within(alien, this.side * D.DART_SIDE_PX, D.EDGE_PX), alien.y + D.DART_PX, D.DART_MS);
    alien.hold(D.HOVER_MS);
  }
}

/**
 * Dive (duck): it paddles across with its numbers up; now and then it tips
 * its head down (the telegraph), dives (numbers hidden), swims ahead under
 * the water and pops up further along. Its answer never changes.
 */
export class Dive extends Ability {
  readonly kind = "dive";
  private t = 0; // field ms
  private under = false;

  steer(alien: Alien, delta: number): void {
    const D = DUCK;
    this.t += delta;
    // Shifted so the first paddle lasts FIRST_PADDLE_MS.
    const shifted = this.t - (D.FIRST_PADDLE_MS - D.PADDLE_MS);
    const p = shifted < 0 ? 0 : shifted % (D.PADDLE_MS + D.DIVE_MS);
    const diving = p >= D.PADDLE_MS;
    if (diving && !this.under) alien.glideTo(alien.x + alien.heading * D.DIVE_PX, alien.y, D.DIVE_MS);
    this.under = diving;
    this.cover = diving ? 1 : p >= D.PADDLE_MS - D.WARN_MS ? D.WARN_COVER : 0;
  }
}

/**
 * The Big Frog (BigFrogDef): it leaps onto the page, then moves only in
 * croaking leaps: it sits, croaks (its throat puffs; `alien.mode` is
 * "windup" so the view shakes it and bots see the danger), then leaps down
 * and across to the next lily pad. Answers work like the mole's: each but
 * the last sends it jumping back up and across, numbers hidden in the air.
 *
 * It is hungry: when a croak starts, its tongue aims at the nearest
 * creature in reach (`prey`, drawn as a dotted line), and when the croak
 * ends it eats it (AbilityHost.swallow: no points) and its sum gets one more
 * number (addBall), up to MAX_BALLS. A creature answered in time is saved,
 * and one the player has typed or fired at is never eaten. The croak is a
 * field-time rhythm (`steer`); the tongue watches it from `update`, which
 * has the host.
 */
export class BigFrog extends Boss {
  /** The creature its tongue is aiming at while it croaks, or null. */
  prey: Alien | null = null;
  /** Ms left of the tongue's strike after a gulp (for the view), and where. */
  gulpLeftMs = 0;
  gulpAt: readonly [number, number] | null = null;
  private t = 0; // field ms into the current sit + croak
  private side: 1 | -1 = 1;
  private entered = false;
  private croaking = false;

  constructor(readonly frog: BigFrogDef) {
    super(frog);
  }

  update(delta: number, alien?: Alien, host?: AbilityHost): void {
    super.update(delta);
    this.gulpLeftMs = Math.max(0, this.gulpLeftMs - delta);
    if (!alien || !host) return;
    const croaking = alien.mode === "windup" && !this.burrowing;
    if (croaking && !this.croaking) this.prey = host.preyNear?.(alien, this.frog.TONGUE_REACH_PX) ?? null;
    if (!croaking && this.croaking) this.gulp(alien, host);
    this.croaking = croaking;
    if (this.prey && !this.prey.active) this.prey = null; // answered in time: saved
  }

  onHit(alien: Alien, host: AbilityHost): boolean {
    this.prey = null; // an answer interrupts the croak: no gulp
    return super.onHit(alien, host);
  }

  retreat(alien: Alien): void {
    this.prey = null;
    super.retreat(alien);
  }

  /** The croak ended: eat the creature the tongue aimed at, if it is still there. */
  private gulp(alien: Alien, host: AbilityHost): void {
    const prey = this.prey;
    this.prey = null;
    if (!prey?.active || !host.swallow?.(prey)) return;
    this.gulpAt = [prey.x, prey.y];
    this.gulpLeftMs = this.frog.GULP_MS;
    if (alien.ballCount < this.frog.MAX_BALLS) host.addBall?.(alien);
  }

  /** How long it sits between leaps: longer the more numbers it carries. */
  private sitMs(alien: Alien): number {
    return this.frog.SIT_MS + this.frog.SIT_PER_BALL_MS * Math.max(0, alien.ballCount - this.frog.BALLS);
  }

  steer(alien: Alien, delta: number): void {
    const F = this.frog;
    if (!this.entered) {
      this.entered = true;
      alien.glideTo(alien.x, F.MIN_Y, F.ENTER_MS);
      alien.hold(F.REVEAL_MS);
      this.t = -F.REVEAL_MS - F.ENTER_MS;
      return;
    }
    if (this.burrowing) {
      // In the air after an answer (or after reaching the ship): sit once landed.
      this.t = -F.REVEAL_MS;
      alien.mode = "move";
      return;
    }
    this.t += delta;
    const sitMs = this.sitMs(alien);
    if (this.t < sitMs) return;
    alien.mode = "windup";
    if (this.t < sitMs + F.CROAK_MS) return;
    alien.mode = "move";
    this.t = -F.LEAP_MS; // the next sit starts once it lands
    if (within(alien, this.side * F.LEAP_SIDE_PX, 0) !== alien.x + this.side * F.LEAP_SIDE_PX) {
      this.side = this.side > 0 ? -1 : 1; // an edge: zig-zag back
    }
    alien.glideTo(within(alien, this.side * F.LEAP_SIDE_PX, 0), alien.y + F.LEAP_PX, F.LEAP_MS);
    this.side = this.side > 0 ? -1 : 1;
  }
}
