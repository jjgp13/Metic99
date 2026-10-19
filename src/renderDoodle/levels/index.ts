import type { PageDef } from "../pages";
import { BACKYARD_PAGE } from "./backyard";
import { POND_PAGE } from "./pond";
import { TREETOPS_PAGE } from "./treetops";
import { SWAMP_PAGE } from "./swamp";
import { CAVE_PAGE } from "./cave";
import { VOLCANO_PAGE } from "./volcano";
import { SKY_PAGE } from "./sky";
import { SNOW_PAGE } from "./snow";
import { NIGHT_PAGE } from "./night";
import { BEDROOM_PAGE } from "./bedroom";

/**
 * Every story page by id (LevelDef.PAGE). A new level adds its own file in
 * this folder and one line here.
 */
export const PAGES: Record<string, PageDef> = {
  backyard: BACKYARD_PAGE,
  pond: POND_PAGE,
  treetops: TREETOPS_PAGE,
  swamp: SWAMP_PAGE,
  cave: CAVE_PAGE,
  volcano: VOLCANO_PAGE,
  sky: SKY_PAGE,
  snow: SNOW_PAGE,
  night: NIGHT_PAGE,
  bedroom: BEDROOM_PAGE,
};
