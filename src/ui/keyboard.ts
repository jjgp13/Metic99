import type Phaser from "phaser";

/**
 * Listen for key presses, delivering each one exactly once.
 *
 * Phaser 3.90 re-runs its whole key queue on every DOM key event until the
 * frame ends, and its duplicate check only compares with the previous event.
 * When presses and releases interleave within one frame (fast typing, a frame
 * stall) earlier keys fire again: "12" became "112", F toggled FREEZE twice.
 * The queue hands back the same KeyboardEvent object, so remember it.
 */
export function onKeyDown(scene: Phaser.Scene, handler: (e: KeyboardEvent) => void): void {
  const seen = new WeakSet<KeyboardEvent>();
  scene.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
    if (seen.has(e)) return;
    seen.add(e);
    handler(e);
  });
}
