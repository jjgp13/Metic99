import type { LevelDef } from "../tuning/story";
import { BACKYARD } from "./backyard";
import { VOLCANO } from "./volcano";

/**
 * The story, in order (docs/SOLO_MODES_DESIGN.md §3). Each level is its own
 * file in this folder; a new level adds its file and one line here.
 */
export const LEVELS: readonly LevelDef[] = [BACKYARD, VOLCANO];
