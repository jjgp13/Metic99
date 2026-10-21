import type Phaser from "phaser";
import { LEVEL_CLEAR, PLAYER } from "../config/constants";
import type { ShipLaunchPose } from "../render3d/World3D";

/**
 * The ship blasting off the top of the screen: a level was cleared (and,
 * later, the story's ending). A look only: the rules have already ended, so
 * this runs on the scene's clock, not the field's.
 *
 * It only keeps the time; GameScene puts its `pose` in the field snapshot
 * and each view draws it its own way (the doodle squashes, stretches and
 * leaves speed lines; the 3D view just moves the model).
 *
 *   const launch = new ShipLaunch(scene);
 *   launch.start(() => showResults());  // called once the ship is gone
 *   snapshot.shipLaunch = launch.pose;  // every frame
 */
export class ShipLaunch {
  private startedAt: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Squash, then blast off; `onGone` runs once the ship has left the screen. */
  start(onGone: () => void): void {
    this.startedAt = this.scene.time.now;
    const time = this.scene.time;
    time.delayedCall(LEVEL_CLEAR.SQUASH_MS, () => this.scene.sound.play("launch", { volume: 0.5 }));
    time.delayedCall(LEVEL_CLEAR.SQUASH_MS + LEVEL_CLEAR.FLY_MS, onGone);
  }

  /** How the ship looks this frame, or null before the launch. */
  get pose(): ShipLaunchPose | null {
    return this.startedAt === null ? null : shipLaunchPose(this.scene.time.now - this.startedAt);
  }
}

/**
 * The ship `ms` after its launch began. First it squashes onto the ground
 * and shivers (the anticipation that makes a jump read as powerful), then it
 * climbs faster and faster, stretched, until it is EXIT_MARGIN_PX above the
 * top at SQUASH_MS + FLY_MS. After that it simply keeps going.
 */
export function shipLaunchPose(ms: number): ShipLaunchPose {
  const C = LEVEL_CLEAR;
  if (ms < C.SQUASH_MS) {
    const k = Math.max(0, ms / C.SQUASH_MS);
    const squash = C.SQUASH * (1 - (1 - k) ** 2); // fast at first, then holds
    return {
      liftPx: -C.SQUASH_DIP_PX * k,
      scaleX: 1 + (squash * 2) / 3,
      scaleY: 1 - squash,
      shiverPx: C.SHIVER_PX * k,
      trail: 0,
    };
  }
  const k = (ms - C.SQUASH_MS) / C.FLY_MS;
  // From the dip to above the top edge: PLAYER.Y is the ship's distance to y = 0.
  const climbPx = C.SQUASH_DIP_PX + PLAYER.Y + C.EXIT_MARGIN_PX;
  const stretch = C.STRETCH * Math.min(1, k * 3); // springs into the stretch
  return {
    liftPx: -C.SQUASH_DIP_PX + climbPx * k ** C.FLY_EASE,
    scaleX: 1 - stretch / 2,
    scaleY: 1 + stretch,
    shiverPx: 0,
    trail: Math.min(1, k * 4),
  };
}
