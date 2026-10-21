/**
 * Every tuning number and its types, re-exported from one place, so code
 * imports them as `import { PLAYER, MONSTERS } from "../config/constants"`.
 *
 * The numbers themselves live in one file per domain under config/tuning/:
 * open the domain you want to tune.
 *
 * The world is a fixed virtual resolution (GAME.WIDTH × GAME.HEIGHT) that
 * Phaser scales to fit any screen; positions and sizes are in those px.
 */
export * from "./tuning/game";
export * from "./tuning/monsters";
export * from "./tuning/difficulty";
export * from "./tuning/scoring";
export * from "./tuning/powers";
export * from "./tuning/answer";
export * from "./tuning/battle";
export * from "./tuning/bots";
export * from "./tuning/storage";
export * from "./tuning/render3d";
export * from "./tuning/doodle";
export * from "./tuning/story";
export * from "./tuning/waves";
// The story, in order: one file per level in config/levels/. Exported here,
// after tuning/story and tuning/waves, and not from tuning/story itself: the
// level files read those values (OWNER_WAVE) as they load, so they must be
// done loading first; an import cycle between them would read them early.
export { LEVELS } from "./levels";
