import type { PageDef } from "../pages";
import { BACKYARD_PAGE } from "./backyard";
import { POND_PAGE } from "./pond";
import { TREETOPS_PAGE } from "./treetops";
import { SWAMP_PAGE } from "./swamp";

/**
 * Every story page by id (LevelDef.PAGE). A new level adds its own file in
 * this folder and one line here.
 */
export const PAGES: Record<string, PageDef> = {
  backyard: BACKYARD_PAGE,
  pond: POND_PAGE,
  treetops: TREETOPS_PAGE,
  swamp: SWAMP_PAGE,
};
