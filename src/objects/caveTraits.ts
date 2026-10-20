import { BAT, GLOW } from "../config/levels/cave";
import { sin } from "../math/detmath";
import { Ability, blinkCover } from "./abilities";
import type Alien from "./Alien";

/**
 * The dark cave's creatures (config/levels/cave.ts), as traits: Abilities a
 * level gives its creatures (objects/traits.ts lists them).
 */

const TAU = Math.PI * 2;

/** Where a bat is in its life: flying in, asleep, waking, dropping. */
export type BatPhase = "fly" | "hang" | "wake" | "drop";

/**
 * Roost (the bat): it rides on the strafer, but instead of patrolling it
 * hangs upside down from the ceiling, still, so its numbers are easy to read.
 * Then it wakes with a shake (the strafer's windup, the telegraph) and
 * drops, fluttering side to side. Its timers run on field time (`pace`), so
 * FREEZE and SLOW keep it asleep.
 */
export class Roost extends Ability {
  readonly kind = "roost";
  phase: BatPhase = "fly";
  private leftMs = 0;
  private flap = 0;

  pace(alien: Alien, delta: number): number {
    switch (this.phase) {
      case "fly":
        // The strafer flies down into its band, then would start patrolling.
        if (alien.mode !== "patrol") return delta;
        this.phase = "hang";
        this.leftMs = BAT.HANG_MS;
        return 0;
      case "hang":
        if ((this.leftMs -= delta) <= 0) {
          this.phase = "wake";
          this.leftMs = BAT.WAKE_MS;
          alien.mode = "windup"; // the view shakes it, bots see the dive coming
        }
        return 0;
      case "wake":
        if ((this.leftMs -= delta) <= 0) {
          this.phase = "drop";
          alien.mode = "dive";
        }
        return 0;
      case "drop": {
        // Incremental, so a sideways move refused by the readability rule
        // never makes it jump later.
        const g = this.flap + (TAU * delta) / BAT.FLUTTER_MS;
        alien.x += BAT.FLUTTER_PX * (sin(g) - sin(this.flap));
        this.flap = g % TAU;
        return delta * BAT.DROP_PACE;
      }
    }
  }
}

/**
 * Glow (the glowworm): its numbers glow on and off on a fixed rhythm, with a
 * flicker before each dark spell (the same rhythm code as the Blinker). It
 * hides its numbers, so it moves slower than its kind.
 */
export class Glowworm extends Ability {
  readonly kind = "glowworm";
  private t = 0;

  update(delta: number): void {
    this.t += delta;
    this.cover = blinkCover(this.t, GLOW);
  }

  pace(_alien: Alien, delta: number): number {
    return delta * GLOW.PACE;
  }
}
