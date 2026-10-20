import { PLAYER } from "../config/constants";
import { ICE_SLIDE, PENGUIN_SLIDE, SNOWBALL_GROW, SNOWFLAKE_GUST } from "../config/levels/snow";
import { Ability, type AbilityHost } from "./abilities";
import type Alien from "./Alien";

/**
 * The snowy mountain's creature traits (config/levels/snow.ts), listed in
 * objects/traits.ts. Names start with "snow_" so no other level picks them.
 */

/** Where a penguin is in its rhythm (the view draws each). */
export type PenguinPhase = "waddle" | "warn" | "slide" | "getup";

/**
 * Penguin: waddles (its kind's own pattern), and after WADDLE_MS of
 * waddling stops and leans forward (a hold: the telegraph), then
 * belly-slides SLIDE_PX closer (a glide) and gets back up (another hold).
 * `pace` only runs while no glide or hold does, so the waddle clock is field
 * time: freezes and SLOW hold it, and a marching line stays in step.
 */
export class PenguinSlide extends Ability {
  readonly kind = "snow_slide";
  phase: PenguinPhase = "waddle";
  private waddledMs = 0;
  /** The lean is done: slide as soon as the hold ends. */
  private slideDue = false;

  pace(alien: Alien, delta: number): number {
    const S = PENGUIN_SLIDE;
    if (this.slideDue) {
      this.slideDue = false;
      alien.glideTo(alien.x, alien.y + S.SLIDE_PX, S.SLIDE_MS);
      alien.hold(S.GETUP_MS);
      return 0;
    }
    this.waddledMs += delta;
    if (this.waddledMs < S.WADDLE_MS) return delta;
    this.waddledMs = 0;
    this.slideDue = true;
    alien.hold(S.WARN_MS);
    return 0;
  }

  update(_delta: number, alien?: Alien): void {
    if (!alien) return;
    this.phase = this.slideDue ? "warn" : alien.gliding ? "slide" : alien.scripted ? "getup" : "waddle";
  }
}

/**
 * Snowball: once its body rolls past GROW_Y it picks up one more number
 * (AbilityHost.addBall: its numbers stay, so the sum so far still counts),
 * and then rolls slower. Triggered by position, so a freeze holds it too.
 */
export class SnowballGrow extends Ability {
  readonly kind = "snow_grow";
  grown = false;

  update(_delta: number, alien?: Alien, host?: AbilityHost): void {
    if (this.grown || !alien || !host || alien.mode !== "move" || alien.y < SNOWBALL_GROW.GROW_Y) return;
    this.grown = true; // once, even if no free sum was found
    host.addBall?.(alien);
  }

  pace(_alien: Alien, delta: number): number {
    return this.grown ? delta * SNOWBALL_GROW.GROWN_PACE : delta;
  }
}

/** How far down the field `alien` is: 0 at the top, 1 at the ship's line. */
export function slopeProgress(alien: Alien): number {
  return Math.min(1, Math.max(0, alien.y / PLAYER.Y));
}

/** Ice block: no brakes, it slides faster the further down it gets. */
export class IceSlide extends Ability {
  readonly kind = "snow_ice";

  pace(alien: Alien, delta: number): number {
    const k = ICE_SLIDE.FROM_PACE + (ICE_SLIDE.TO_PACE - ICE_SLIDE.FROM_PACE) * slopeProgress(alien);
    return delta * k;
  }
}

/** Snowflake: drifts across calm, then a gust blows it along, on a field-time rhythm. */
export class SnowflakeGust extends Ability {
  readonly kind = "snow_gust";
  private t = 0;

  get gusting(): boolean {
    return this.t % (SNOWFLAKE_GUST.CALM_MS + SNOWFLAKE_GUST.GUST_MS) >= SNOWFLAKE_GUST.CALM_MS;
  }

  pace(_alien: Alien, delta: number): number {
    const k = this.gusting ? SNOWFLAKE_GUST.GUST_PACE : SNOWFLAKE_GUST.CALM_PACE;
    this.t += delta;
    return delta * k;
  }
}

export const SNOW_TRAITS: Record<string, () => Ability> = {
  snow_slide: () => new PenguinSlide(),
  snow_grow: () => new SnowballGrow(),
  snow_ice: () => new IceSlide(),
  snow_gust: () => new SnowflakeGust(),
};
