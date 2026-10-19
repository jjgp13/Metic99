import { WINGS } from "../config/constants";
import { Ability, blinkCover } from "./abilities";
import { Glow, Roost } from "./caveTraits";

/**
 * Story creatures' special rules (SpeciesDef.TRAIT): an Ability on the same
 * hooks as the spawnable ones, given to a creature by its level. A new trait
 * is an Ability class plus one line in TRAITS.
 */

/**
 * Wings (the backyard butterfly): it folds its wings over the numbers on
 * them on a fixed rhythm, fluttering first. Same idea as the Blinker, so the
 * same rhythm code; its answer never changes while folded.
 */
export class Wings extends Ability {
  readonly kind = "wings";
  private t = 0;

  update(delta: number): void {
    this.t += delta;
    this.cover = blinkCover(this.t, WINGS);
  }
}

export const TRAITS: Record<string, () => Ability> = {
  wings: () => new Wings(),
  roost: () => new Roost(),
  glow: () => new Glow(),
};
