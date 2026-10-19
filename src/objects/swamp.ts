import { GAME } from "../config/constants";
import { GLOW, MUD_SPLIT, PEEK, SLIME } from "../config/levels/swamp";
import type Alien from "./Alien";
import { Ability, Boss, Splitter, blinkCover, type AbilityHost } from "./abilities";

/**
 * Level 4, THE MUD SWAMP's own rules (config/levels/swamp.ts): two creature
 * traits (listed in objects/traits.ts) and the Mud Monster's mechanics
 * (listed in objects/bosses.ts). The slime's split and the snail's shell are
 * the Splitter and Shielded abilities, given as traits.
 */

/** Slime blob (trait "split"): the Splitter, with its two little blobs kept
 * higher up the field. */
export class SlimeSplit extends Splitter {
  constructor() {
    super(SLIME.MAX_CHILD_Y);
  }
}

/** Peeper: its eyes are its numbers, and it ducks them under the mud on a
 * fixed rhythm, bubbling first (like the Blinker). */
export class Peek extends Ability {
  readonly kind = "peek";
  private t = 0;

  update(delta: number): void {
    this.t += delta;
    this.cover = blinkCover(this.t, PEEK);
  }
}

/** Firefly (the bonus): its light flickers out now and then, and its
 * numbers go dark with it. */
export class Glow extends Ability {
  readonly kind = "glow";
  private t = 0;

  update(delta: number): void {
    this.t += delta;
    this.cover = blinkCover(this.t, GLOW);
  }
}

/**
 * The MUD MONSTER (mechanic "split"): its first answer sinks it into the mud
 * like the mole; its last answer splits it into two halves (def.PART), each
 * with its own sum. The level is cleared only when both halves are beaten
 * (Field checks that no boss is left).
 */
export class MudMonster extends Boss {
  onKilled(alien: Alien, host: AbilityHost): void {
    const part = this.def.PART;
    if (!part) return;
    for (const side of [-1, 1]) {
      // Start inside the whole's box (it's gone now, so that spot is clear),
      // then glide out; the halves hold still a moment so both sums can be read.
      const half = host.spawnBossPart(part, alien.x + side * MUD_SPLIT.START_PX, alien.y);
      if (!half) continue;
      const x = clamp(alien.x + side * MUD_SPLIT.SPREAD_PX, half.halfW, GAME.WIDTH - half.halfW);
      half.glideTo(x, alien.y, MUD_SPLIT.GLIDE_MS);
      half.hold(part.REVEAL_MS);
    }
  }
}

/** Half of the Mud Monster (mechanic "mud_half"): after an answer it sinks
 * and glops back up higher on its own side, so the two halves never swap. */
export class MudHalf extends Boss {
  protected surfaceAt(alien: Alien): readonly [number, number] {
    return [alien.x, Math.max(this.def.MIN_Y, alien.y - this.def.BURROW_UP_PX)];
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
