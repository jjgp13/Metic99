import { DRAGON_BREATH as B } from "../config/levels/volcano";
import { Boss, type AbilityHost } from "./abilities";
import type Alien from "./Alien";

/**
 * The DRAGON (level 6, mechanic "breath"). Like every boss it takes HP
 * answers and flies off after each one but the last (Boss: hidden while it
 * moves, then it lands and holds still). Its own fight is fire breath:
 *
 *   walk WALK_PX closer → stop and inhale (it shakes; the numbers are still
 *   readable: the last chance) → breathe fire for BREATH_MS (its numbers
 *   melt and re-form as a NEW sum, and the breath rears it back RECOIL_PX)
 *
 * So a sum has to be answered before the next breath, and a slow reader is
 * pushed back instead of hit. The inhale borrows the strafer's "windup"
 * mode, the game's telegraph: the view shakes it and bots see the danger.
 */
export class Dragon extends Boss {
  private inhaling = false;
  /** Where the current walk started (null: not walking yet). */
  private walkFromY: number | null = null;
  private breathLeftMs = 0;

  /** Hidden while it flies off and while it breathes fire. */
  get burrowing(): boolean {
    return super.burrowing || this.breathing;
  }

  get breathing(): boolean {
    return this.breathLeftMs > 0;
  }

  update(delta: number, alien?: Alien, host?: AbilityHost): void {
    this.breathLeftMs = Math.max(0, this.breathLeftMs - delta);
    if (alien && host && !super.burrowing) this.fight(alien, host);
    super.update(delta); // sets the cover: hidden while flying or breathing
  }

  /** Walk → inhale → breathe, while it isn't flying off after an answer. */
  private fight(alien: Alien, host: AbilityHost): void {
    if (this.inhaling) {
      // The inhale is a hold, so it lasts in field time (and never ends while
      // the dragon is the held target: the shot comes first).
      if (!alien.scripted) this.breathe(alien, host);
      return;
    }
    if (alien.scripted || this.breathing) return; // landing, revealing, recoiling
    // Its walk counts only once its numbers are well on screen.
    this.walkFromY ??= Math.max(alien.y, this.def.MIN_Y);
    if (alien.y - this.walkFromY >= B.WALK_PX) {
      this.inhaling = true;
      alien.mode = "windup";
      alien.hold(B.INHALE_MS);
    }
  }

  onHit(alien: Alien, host: AbilityHost): boolean {
    this.calmDown(alien);
    return super.onHit(alien, host);
  }

  retreat(alien: Alien): void {
    this.calmDown(alien);
    super.retreat(alien);
  }

  private breathe(alien: Alien, host: AbilityHost): void {
    this.calmDown(alien);
    host.rerollSum(alien); // no free sum: it keeps the old one
    this.breathLeftMs = B.BREATH_MS;
    alien.glideTo(alien.x, Math.max(this.def.MIN_Y, alien.y - B.RECOIL_PX), B.BREATH_MS);
  }

  /** Back to walking: the next breath needs a whole new walk. */
  private calmDown(alien: Alien): void {
    this.inhaling = false;
    this.walkFromY = null;
    alien.mode = "move";
  }
}
