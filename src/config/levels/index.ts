import type { LevelDef } from "../tuning/story";
import { BACKYARD } from "./backyard";
import { POND } from "./pond";
import { TREETOPS } from "./treetops";
import { SWAMP } from "./swamp";
import { CAVE } from "./cave";
import { VOLCANO } from "./volcano";
import { SNOW } from "./snow";

/**
 * The story, in order (docs/SOLO_MODES_DESIGN.md §3). Each level is its own
 * file in this folder; a new level adds its file and one line here.
 */
export const LEVELS: readonly LevelDef[] = [BACKYARD, POND, TREETOPS, SWAMP, CAVE, VOLCANO, SNOW]; // SKY (level 7) goes before SNOW
