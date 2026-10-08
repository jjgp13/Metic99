import { SIM } from "../config/constants";

/**
 * Fixed timestep (docs/ARCHITECTURE.md §2.4): turns the frame's variable real
 * time into whole rule steps of exactly SIM.STEP_MS, so a run plays the same
 * at 60 Hz and 120 Hz. Time left over is kept for the next frame, and
 * `alpha` says how far real time is into the next step, so the renderer can
 * draw between the last two steps.
 *
 *   clock.advance(delta, () => field.step(SIM.STEP_MS));
 *   alien.viewX(clock.alpha);
 */
export class SimClock {
  /** Real time (ms) not simulated yet; always below one step after advance(). */
  private bankedMs = 0;

  constructor(
    readonly stepMs: number = SIM.STEP_MS,
    /** After a stall (tab switch, slow phone) at most this many steps run in
     * one frame; the rest is dropped so the game can't spiral behind. */
    readonly maxStepsPerFrame: number = SIM.MAX_STEPS_PER_FRAME,
  ) {}

  /**
   * Bank `deltaMs` of real time and call `step` once per whole step it pays
   * for. `step` may return false to stop early (e.g. the run just ended).
   */
  advance(deltaMs: number, step: () => boolean | void): void {
    this.bankedMs = Math.min(this.bankedMs + deltaMs, this.stepMs * this.maxStepsPerFrame);
    while (this.bankedMs >= this.stepMs) {
      this.bankedMs -= this.stepMs;
      if (step() === false) return;
    }
  }

  /** How far (0..1) real time is between the last step and the next. */
  get alpha(): number {
    return this.bankedMs / this.stepMs;
  }
}
