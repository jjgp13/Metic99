import type { BossDef } from "../config/constants";
import { Boss } from "./abilities";
import { GiantMole } from "./mole";
import { BigFrog } from "./pondCreatures";
import type { BigFrogDef } from "../config/levels/pond";
import { WiseOwl } from "./owlBoss";
import { MudHalf, MudMonster } from "./swamp";
import { CaveTroll } from "./caveTroll";
import { Dragon } from "./dragon";
import { RainDrop, StormCloud } from "./stormCloud";
import { Yeti } from "./yeti";
import { Moon } from "./moon";
import { UnderTheBed } from "./bedroom";

/**
 * How each story boss fights (BossDef.MECHANIC). `Boss` is the base: it
 * takes HP answers, burrows away after each one but the last, and retreats
 * after reaching the ship. A boss that fights differently (blinks, splits,
 * hides…) subclasses Boss in its own file and adds one line here.
 */
export const BOSS_MECHANICS: Record<string, (def: BossDef) => Boss> = {
  burrow: (def) => new Boss(def),
  molehills: (def) => new GiantMole(def),
  leap: (def) => new BigFrog(def as BigFrogDef), // the pond's BIG_FROG is a BigFrogDef
  riddle: (def) => new WiseOwl(def),
  split: (def) => new MudMonster(def),
  mud_half: (def) => new MudHalf(def),
  lamp: (def) => new CaveTroll(def),
  breath: (def) => new Dragon(def),
  sky_storm: (def) => new StormCloud(def),
  sky_raindrop: (def) => new RainDrop(def),
  snow_stomp: (def) => new Yeti(def),
  night_phases: (def) => new Moon(def),
  bedroom_underbed: (def) => new UnderTheBed(def),
};

export function createBoss(def: BossDef): Boss {
  const make = BOSS_MECHANICS[def.MECHANIC];
  if (!make) throw new Error(`unknown boss mechanic "${def.MECHANIC}" (objects/bosses.ts)`);
  return make(def);
}
