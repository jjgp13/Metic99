import { DRIP, FLASH, SPARK, type HopTiming } from "../config/levels/volcano";
import { Ability, Shielded, blinkCover } from "./abilities";
import type Alien from "./Alien";

/**
 * The volcano's creature traits (config/levels/volcano.ts), listed in
 * objects/traits.ts. Flash and Hops are general: another level can use them
 * with its own timing.
 */

/**
 * Flash (fireflies): the lantern that holds the numbers goes dark on a
 * rhythm read from the game clock, not from the firefly's own spawn, so
 * the whole swarm flashes in step: when one goes dark, they all do.
 */
export class Flash extends Ability {
  readonly kind = "flash";
  /** The game clock, picked up from the alien's spawn time on the first
   * update (it spawned "now"), then advanced by real time like the Blinker. */
  private clock: number | null = null;

  update(delta: number, alien?: Alien): void {
    this.clock = (this.clock ?? alien?.spawnedAt ?? 0) + delta;
    this.cover = blinkCover(this.clock, FLASH);
  }
}

/** Where a hopping creature is in its rhythm (the view draws each). */
export type HopPhase = "hop" | "warn" | "rest";

/**
 * Hops: the creature moves only in jumps. Each hop is a glide plus a hold
 * (Alien.glideTo / hold), and the next hop starts once both are done, so the
 * rhythm runs in field time: a freeze or SLOW holds it too. The creature's
 * own movement pattern never runs; the readability rule still checks every
 * step of a glide.
 */
export class Hops extends Ability {
  readonly kind: string;
  phase: HopPhase = "hop";
  private hops = 0;

  constructor(
    kind: string,
    private readonly timing: HopTiming,
  ) {
    super();
    this.kind = kind;
  }

  update(_delta: number, alien?: Alien): void {
    if (!alien) return;
    if (!alien.scripted) {
      const T = this.timing;
      const arc = this.hops++ % 2 === 0 ? -T.ARC_PX : T.ARC_PX;
      alien.glideTo(alien.x + alien.heading * T.DX, alien.y + T.DY + arc, T.HOP_MS);
      alien.hold(T.STICK_MS);
    }
    this.phase = alien.gliding ? "hop" : alien.holdLeftMs <= this.timing.WARN_MS ? "warn" : "rest";
  }
}

export const VOLCANO_TRAITS: Record<string, () => Ability> = {
  flash: () => new Flash(),
  drip: () => new Hops("drip", DRIP),
  spark: () => new Hops("spark", SPARK),
  // The lava tortoise's shell is a Shielded rule: answer, crack, answer again.
  shell: () => new Shielded(),
};
