import { ENEMY } from "../config/constants";
import { MOON_PHASES as P } from "../config/levels/night";
import { Boss } from "./abilities";
import type Alien from "./Alien";

/**
 * THE MOON (level 9, mechanic "night_phases"). Like every boss it takes HP
 * answers and slips away after each one but the last (Boss: hidden behind a
 * cloud while it moves, then it holds still). Its own fight is its phases:
 * a shadow sweeps across its face, left to right, on a rhythm
 *
 *   full → waning (the shadow comes in from the left) → new (all dark)
 *   → waxing (the shadow leaves to the right) → full …
 *
 * and its numbers show only where the face is lit, so they go dark one by
 * one. The sum never changes in the dark: a number read in time still
 * counts. Each answer shortens the full moon and lengthens the dark. The
 * rhythm runs on real time like every blink, and starts again (full) each
 * time the moon comes out from behind its cloud.
 */
export class Moon extends Boss {
  /** ms into the current cycle (from full). */
  private t = 0;
  /** The shadow on the face, as [from, to] across it (0 = left edge, 1 = right). */
  private band: readonly [number, number] = [0, 0];

  get shadow(): readonly [number, number] {
    return this.band;
  }

  update(delta: number, alien?: Alien): void {
    super.update(delta); // hidden while it slips behind its cloud
    const offPage = alien !== undefined && alien.y - alien.top < 0;
    if (this.burrowing || offPage) {
      this.t = 0; // it comes out full
      this.band = [0, 0];
      return;
    }
    this.t += delta;
    this.band = this.bandAt(this.t);
    let sum = 0;
    for (let i = 0; i < this.def.BALLS; i++) sum += this.ballCover(i, this.def.BALLS);
    this.cover = sum / this.def.BALLS;
  }

  /** How much of ball `i`'s width is in the shadow. */
  ballCover(i: number, n: number): number {
    if (this.burrowing) return 1;
    const [a, b] = this.band;
    if (b <= a) return 0;
    // The shadow's edges at the balls' row: the terminator is a half
    // ellipse, so it is narrower there than at the face's middle.
    const reach = P.FACE_R * Math.sqrt(1 - (this.def.BOX.BALLS_Y / P.FACE_R) ** 2);
    const from = (2 * a - 1) * reach;
    const to = (2 * b - 1) * reach;
    const r = ENEMY.BALL_RADIUS;
    const x = (i - (n - 1) / 2) * ENEMY.BALL_SPACING;
    const overlap = Math.min(to, x + r) - Math.max(from, x - r);
    return Math.min(1, Math.max(0, overlap / (2 * r)));
  }

  /** The shadow band `t` ms into the cycle, for the answers taken so far. */
  private bandAt(time: number): readonly [number, number] {
    const taken = this.def.HP - this.hp;
    const full = Math.max(P.MIN_FULL_MS, P.FULL_MS - P.FULL_LOSS_MS * taken);
    const dark = P.NEW_MS + P.NEW_GAIN_MS * taken;
    let t = time % (full + P.WANE_MS + dark + P.WAX_MS);
    if (t < full) return [0, 0];
    if ((t -= full) < P.WANE_MS) return [0, t / P.WANE_MS];
    if ((t -= P.WANE_MS) < dark) return [0, 1];
    return [(t - dark) / P.WAX_MS, 1];
  }
}
