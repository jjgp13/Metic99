// The 3D view (Three.js) and number-ball colors.
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

import { PALETTE } from "../palette";
import { ENEMY } from "./monsters";

/** Number ball colors map to future math operations (sum/sub/mul/div). */
export const BALL_COLOR = {
  SUM: "blueBalls",
  SUB: "redBalls",
  MUL: "greenBalls",
  DIV: "yellowBalls",
} as const;

/**
 * 3D presentation (Three.js). The playfield keeps its 2D logical coordinates
 * (GAME.WIDTH × GAME.HEIGHT px); a perspective camera is placed so the z = 0
 * plane maps 1:1 onto the Phaser canvas, keeping the 2D HUD aligned with the
 * 3D world. Sprites are extruded into voxel models (1 voxel = 1 source pixel).
 */
export const RENDER3D = {
  FOV: 30, // vertical field of view (deg); narrow = subtle perspective
  MAX_PIXEL_RATIO: 2, // cap for high-DPI phones (fill-rate)

  // Model thickness in voxels.
  ALIEN_DEPTH: 6,
  SHIP_DEPTH: 6,
  BULLET_DEPTH: 2,

  // Number balls: glass spheres with the digit inside (render3d/NumberBall.ts).
  BALL_RADIUS: ENEMY.BALL_RADIUS,
  // Glass tint per ball texture key = math operation (see BALL_COLOR).
  BALL_TINT: {
    blueBalls: 0x3d8bff, // sum
    redBalls: 0xff4d5e, // subtraction
    greenBalls: 0x3ddc84, // multiplication
    yellowBalls: 0xffd23f, // division
  } as Record<string, number>,

  // Blender-built .glb models (public/assets/models/<name>.glb, see
  // docs/ART_SPEC.md). Any that fail to load fall back to sprite voxels.
  MODELS: [
    "ship_player",
    "ship_dart",
    "ship_pod",
    "alien_darter",
    "alien_lumberer",
    "alien_drifter",
    "alien_strafer",
    "alien_swooper",
    "alien_shielded",
    "alien_blinker",
    "alien_splitter",
    "alien_splitling",
  ],

  // Player ships selectable on the menu (model name + label). The first one is
  // the default. Icons: public/assets/icons/<model>.png (built with the models).
  SHIPS: [
    { model: "ship_player", name: "FALCON" },
    { model: "ship_dart", name: "DART" },
    { model: "ship_pod", name: "POD" },
  ],

  // Debris colors each monster model bursts into (model per kind: MONSTERS).
  ALIEN_MODELS: {
    alien_darter: [0xf2913d, 0x5a2d96, 0x7ff6ff],
    alien_lumberer: [0x2bb3a3, 0x1b7468, 0xf5f5f0],
    alien_drifter: [0x8e4fd8, 0xf29bc1, 0xff6be6],
    alien_strafer: [0xd63fa6, 0x5a2d96, 0x9aa0b5],
    alien_swooper: [0x2bb3a3, 0x1b7468, 0xf2913d],
  } as Record<string, readonly number[]>,

  // Models worn by ability aliens (never picked at random), with debris colors.
  ABILITY_MODELS: {
    alien_shielded: [0x7d8196, 0x5a2d96, 0xff6be6],
    alien_blinker: [0xd63fa6, 0x5a2d96, 0xf5f5f0],
    alien_splitter: [0xf29bc1, 0xd63fa6, 0xff6be6],
    alien_splitling: [0xf29bc1, 0xd63fa6],
  } as Record<string, readonly number[]>,

  // Blinker ball lids: color, and how far back they rest when open (rad; a
  // little under π/2 so a thin lid rim shows at rest and marks the ball).
  BALL_LID_COLOR: 0xd63fa6,
  BALL_LID_OPEN_ANGLE: 1.2,
  // Shield bubble (never a ball color): radius clears the ball row above.
  // Battle: a glow ring around aliens another player sent (orange: red is
  // reserved for subtraction balls). Per-attacker colors come with the battle UI.
  ATTACK_RING: { COLOR: PALETTE.ATTACK, RADIUS: 17 },
  SHIELD_COLOR: 0xff6be6,
  SHIELD_RADIUS: 21,
  // The SHIELD power's bubble around the ship while it is armed (gold: the
  // player's UI accent, so it never reads as an alien's magenta shield).
  SHIP_SHIELD_COLOR: 0xffd166,
  SHIP_SHIELD_RADIUS: 27,
  SHIELD_SHARDS: 16,
  // New sum after a shield breaks: the balls pop in from this scale.
  SUM_POP_SCALE: 1.6,
  SUM_POP_MS: 260,

  // Idle motion: aliens sway (yaw) to show off their depth, and bank into
  // sideways moves like the ship.
  ALIEN_SWAY: 0.5, // rad
  ALIEN_SWAY_SPEED: 0.0025, // rad per ms
  ALIEN_BANK_PER_PXS: 0.006, // rad per px/s of sideways speed
  ALIEN_BANK_MAX: 0.5, // rad

  // Sine motion of the models' anim_* parts (docs/ART_SPEC.md §6).
  ANIM: {
    TAIL_WAG: 0.45, // darter tail, rad
    TAIL_SPEED: 0.012, // rad per ms
    LEG_SWING: 0.35, // lumberer legs, rad (synced to its stomp)
    STOMP_LIFT: 3, // px the lumberer's body rises while stepping
    SKIRT_SPIN: 0.0006, // drifter skirt, rad per ms
    SKIRT_PULSE: 0.1, // drifter skirt scale ±
    SKIRT_PULSE_SPEED: 0.004, // rad per ms
    WING_FLAP: 0.45, // strafer wings, rad
    WING_SPEED: 0.018, // rad per ms (doubles in windup/dive)
    WINDUP_SHAKE: 2.5, // px the strafer jitters before diving
  },
  // Ship banks toward where it is sliding.
  SHIP_BANK_PER_PX: 0.012,
  SHIP_BANK_MAX: 0.7, // rad
  SHIP_BANK_RESPONSE: 10, // 1/s, how fast bank follows its target

  STAR_COUNT: 260,
  STAR_NEAR_Z: -80,
  STAR_FAR_Z: -2600,
  STAR_DRIFT: 45, // world px/s; farther stars *look* slower (true parallax)

  // Answer stars (render3d/AnswerStars.ts): a pool of background stars that
  // gather into the typed answer behind the field, then burst when it's solved.
  // Kept dim and deep so the number balls stay the most readable thing.
  ANSWER_STARS: {
    COUNT: 170, // pool size; the ones not in the number drift as normal stars
    Z: -500, // depth of the pool (behind every alien)
    CENTER_Y: 250, // logical y the number is centered on
    DIGIT_H: 120, // logical px: digit glyph height
    DIGIT_ADVANCE: 88, // logical px between two digits' centers
    SAMPLE_PX: 7, // glyph sampling grid (logical px)
    MAX_PER_DIGIT: 48, // stars per digit
    GATHER_RATE: 16, // 1/s: how fast stars fly into the shape (~150 ms)
    // Point sizes as PointsMaterial counts them (like the starfield): at Z, a
    // size of 5 is about 1 logical px.
    SIZE_IDLE: 4,
    SIZE_FORMED: 28,
    BRIGHTNESS: 0.7, // formed star color multiplier (dim = background)
    COLORS: { typing: 0xbfd4ff, match: 0xffd166, wrong: 0xef476f },
    BURST_SPEED: { min: 250, max: 650 }, // world px/s outward when solved
    SCATTER_SPEED: { min: 60, max: 160 }, // wrong answer: a small, sad scatter
    FADE_RATE: 2, // 1/s: released stars fade back to plain stars
  },

  DEBRIS_COUNT: 22,
  DEBRIS_SIZE: 3,
  DEBRIS_SPEED: { min: 90, max: 320 }, // px/s
  DEBRIS_LIFE_MS: 650,
  FLASH_MS: 220,
  FLASH_INTENSITY: 6,
} as const;
