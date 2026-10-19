import type { BossDef } from "../config/constants";
import { Boss } from "./abilities";
import { BigFrog } from "./pondCreatures";
import type { BigFrogDef } from "../config/levels/pond";
import { OwlBoss } from "./owlBoss";
import { MudHalf, MudMonster } from "./swamp";
import { CaveTroll } from "./caveTroll";

/**
 * How each story boss fights (BossDef.MECHANIC). `Boss` is the base: it
 * takes HP answers, burrows away after each one but the last, and retreats
 * after reaching the ship. A boss that fights differently (blinks, splits,
 * hides…) subclasses Boss in its own file and adds one line here.
 */
export const BOSS_MECHANICS: Record<string, (def: BossDef) => Boss> = {
  burrow: (def) => new Boss(def),
  leap: (def) => new BigFrog(def as BigFrogDef), // the pond's BIG_FROG is a BigFrogDef
  blink: (def) => new OwlBoss(def),
  split: (def) => new MudMonster(def),
  mud_half: (def) => new MudHalf(def),
  lamp: (def) => new CaveTroll(def),
};

export function createBoss(def: BossDef): Boss {
  const make = BOSS_MECHANICS[def.MECHANIC];
  if (!make) throw new Error(`unknown boss mechanic "${def.MECHANIC}" (objects/bosses.ts)`);
  return make(def);
}
