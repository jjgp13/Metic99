import type { PageDef } from "../pages";
import { BACKYARD_PAGE } from "./backyard";
import { SWAMP_PAGE } from "./swamp";

/**
 * Every story page by id (LevelDef.PAGE). A new level adds its own file in
 * this folder and one line here.
 */
export const PAGES: Record<string, PageDef> = {
  backyard: BACKYARD_PAGE,
  swamp: SWAMP_PAGE,
};
