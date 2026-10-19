import { OWL_BLINK } from "../config/levels/treetops";
import { Boss, blinkCover } from "./abilities";

/**
 * The Great Owl (level 3's boss, MECHANIC "blink"): its two big eyes are its
 * numbers, and they blink on the Blinker's rhythm. It moves like every boss
 * (after an answer it flies to the other side, eyes shut, then perches), and
 * each answer makes it blink faster: the open phase shrinks by SHRINK_MS.
 * After every landing the rhythm starts over with a long first look, so the
 * new sum can always be read once.
 */
export class OwlBoss extends Boss {
  private blinkMs = 0;

  update(delta: number): void {
    super.update(delta);
    if (this.burrowing) {
      this.blinkMs = 0; // flying: eyes shut (cover 1 from Boss)
      return;
    }
    this.blinkMs += delta;
    this.cover = blinkCover(this.blinkMs, { ...OWL_BLINK, OPEN_MS: this.openMs });
  }

  /** How long its eyes stay open now: shorter with every answer. */
  get openMs(): number {
    const answered = this.def.HP - this.hp;
    return Math.max(OWL_BLINK.MIN_OPEN_MS, OWL_BLINK.OPEN_MS - answered * OWL_BLINK.SHRINK_MS);
  }
}
