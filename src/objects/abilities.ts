import { ABILITY, BLINKER, GAME, SHIELD, SPLITTER } from "../config/constants";
import type Alien from "./Alien";

/**
 * Monster abilities: special rules layered on top of an alien's movement
 * (its monster `kind`, see ABILITY.KIND). An ability is pure game state with three hooks, so new abilities
 * (Hider, Orbiter, Worm, …) reuse them instead of adding one-off code to the
 * scene:
 *
 *   update(delta)        per-frame state the renderer reads (e.g. how hidden
 *                        the balls are right now)
 *   onHit(alien, host)   a bullet hit it; return true to absorb the shot
 *   onKilled(alien, host) the player destroyed it
 *
 * Anything that touches the rest of the field (a new unique sum, spawning more
 * aliens) goes through `AbilityHost`, which GameScene implements. That keeps
 * abilities free of Phaser/Three.js so a future server sim can share them.
 */
export type AbilityKind = keyof typeof ABILITY.UNLOCK_AT;

export const ABILITY_KINDS = Object.keys(ABILITY.UNLOCK_AT) as AbilityKind[];

/** What an ability may ask of the game. */
export interface AbilityHost {
  /** Give `alien` a new sum with the same ball count, unique on the field.
   * Returns false if no free sum was found (the alien keeps its old one). */
  rerollSum(alien: Alien): boolean;
  /** Spawn a 2-ball splitling that glides out of `parent` to (x, y). Returns
   * false (and spawns nothing) if its box there would break the readability
   * rule (another alien within READ_GAP). */
  spawnSplitling(parent: Alien, x: number, y: number): boolean;
}

export abstract class Ability {
  abstract readonly kind: AbilityKind;
  /** How hidden the number balls are: 0 = readable, 1 = fully covered. */
  cover = 0;

  update(_delta: number): void {}

  /** A bullet hit the alien. Return true to absorb it (the alien survives). */
  onHit(_alien: Alien, _host: AbilityHost): boolean {
    return false;
  }

  /** The player destroyed the alien (not called when it reaches the player). */
  onKilled(_alien: Alien, _host: AbilityHost): void {}
}

/**
 * Blinker: the balls close like eyelids on a fixed rhythm. Before each close
 * the lids flutter half-shut (the telegraph), so the timing can be learned. The
 * answer never changes, so it can still be typed from memory while closed.
 *
 *   | open | flutter | closing | closed | opening | open | …
 */
export class Blinker extends Ability {
  readonly kind = "blinker";
  private t = 0;

  update(delta: number): void {
    const B = BLINKER;
    this.t += delta;
    // Shift time so the first open phase lasts FIRST_OPEN_MS.
    let t = this.t - (B.FIRST_OPEN_MS - B.OPEN_MS);
    if (t < 0) {
      this.cover = 0;
      return;
    }
    t %= B.OPEN_MS + B.WARN_MS + B.LID_MS * 2 + B.CLOSED_MS;
    if (t < B.OPEN_MS) {
      this.cover = 0;
    } else if ((t -= B.OPEN_MS) < B.WARN_MS) {
      this.cover = B.WARN_COVER * Math.abs(Math.sin((Math.PI * B.WARN_FLUTTERS * t) / B.WARN_MS));
    } else if ((t -= B.WARN_MS) < B.LID_MS) {
      this.cover = t / B.LID_MS;
    } else if ((t -= B.LID_MS) < B.CLOSED_MS) {
      this.cover = 1;
    } else {
      this.cover = 1 - (t - B.CLOSED_MS) / B.LID_MS;
    }
  }
}

/**
 * Shielded: needs two correct answers. The first hit breaks the shield and
 * rolls a new sum (the alien is knocked back and holds still while it pops in);
 * the second hit kills it.
 */
export class Shielded extends Ability {
  readonly kind = "shielded";
  shieldUp = true;

  onHit(alien: Alien, host: AbilityHost): boolean {
    if (!this.shieldUp || !host.rerollSum(alien)) return false;
    this.shieldUp = false;
    alien.glideTo(alien.x, alien.y - SHIELD.KNOCKBACK_PX, SHIELD.KNOCKBACK_MS);
    alien.hold(SHIELD.REVEAL_MS);
    return true;
  }
}

/**
 * Splitter: when destroyed it pops into two 2-ball splitlings that glide out to
 * lanes on either side. A splitling whose landing spot isn't clear is simply
 * not spawned, so splitting never causes overlap.
 */
export class Splitter extends Ability {
  readonly kind = "splitter";

  onKilled(alien: Alien, host: AbilityHost): void {
    // Keep the pair inside the field as a unit so they stay a full lane apart.
    const min = SPLITTER.EDGE_PX + SPLITTER.SPREAD_PX;
    const center = Math.min(Math.max(alien.x, min), GAME.WIDTH - min);
    const y = Math.min(alien.y, SPLITTER.MAX_CHILD_Y);
    host.spawnSplitling(alien, center - SPLITTER.SPREAD_PX, y);
    host.spawnSplitling(alien, center + SPLITTER.SPREAD_PX, y - SPLITTER.STAGGER_PX);
  }
}

export function createAbility(kind: AbilityKind): Ability {
  switch (kind) {
    case "blinker":
      return new Blinker();
    case "shielded":
      return new Shielded();
    case "splitter":
      return new Splitter();
  }
}

/** Abilities that can appear at difficulty d, in unlock order. */
export function unlockedAbilities(d: number): AbilityKind[] {
  return ABILITY_KINDS.filter((k) => d >= ABILITY.UNLOCK_AT[k]);
}
