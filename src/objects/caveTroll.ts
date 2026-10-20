import { ENEMY, GAME } from "../config/constants";
import { TROLL_LAMP } from "../config/levels/cave";
import { Boss } from "./abilities";
import type Alien from "./Alien";

const DEG = Math.PI / 180;

/** Where the lamp hangs (logical px). */
export const LAMP_X = GAME.WIDTH / 2;
export const LAMP_Y = TROLL_LAMP.PIVOT_Y;

/**
 * The beam's direction `t` ms into the swing, in radians from straight down
 * (+ = toward the right). A triangle wave, so the beam moves at a steady
 * speed and every spot on the field is lit for the same time per pass.
 */
export function beamAngleAt(t: number): number {
  const u = (t % TROLL_LAMP.PERIOD_MS) / TROLL_LAMP.PERIOD_MS;
  const tri = u < 0.5 ? 4 * u - 1 : 3 - 4 * u; // -1 → 1 → -1
  return tri * TROLL_LAMP.SWEEP_DEG * DEG;
}

/**
 * The CAVE TROLL (mechanic "lamp", config/levels/cave.ts): a Boss whose
 * numbers can only be read inside the lamp's beam. The light stuns it, so it
 * stands still while lit and stomps on in the dark, faster after each answer.
 * Everything else (HP answers, staggering off after each one, retreating
 * after reaching the ship) is the base Boss.
 *
 * The beam runs on real time like the Blinker's eyes: FREEZE stops the troll
 * but the lamp keeps swinging, so a frozen board can still be read.
 */
export class CaveTroll extends Boss {
  /** The beam's direction now (radians from straight down), for the view. */
  beamAngle = beamAngleAt(0);
  private t = 0;

  update(delta: number, alien?: Alien): void {
    super.update(delta); // hidden while it staggers off after an answer
    this.t += delta;
    this.beamAngle = beamAngleAt(this.t);
    if (!this.burrowing && alien) this.cover = this.darkness(alien);
  }

  pace(_alien: Alien, delta: number): number {
    if (this.cover < 0.5) return 0; // caught in the light: it shields its eyes
    const answered = this.def.HP - this.hp;
    return delta * (1 + TROLL_LAMP.RAGE_PER_ANSWER * answered);
  }

  /**
   * 0 while its whole ball row is inside the beam, 1 once it is outside,
   * fading over EDGE_DEG between (the shading slides over the numbers).
   */
  private darkness(alien: Alien): number {
    const x = alien.x;
    const y = alien.y + alien.ballOffset(0)[1];
    const dist = Math.hypot(x - LAMP_X, y - LAMP_Y);
    const off = Math.abs(Math.atan2(x - LAMP_X, y - LAMP_Y) - this.beamAngle);
    const rowHalf = ((alien.ballCount - 1) * ENEMY.BALL_SPACING) / 2 + ENEMY.BALL_RADIUS;
    const litUpTo = TROLL_LAMP.CONE_DEG * DEG - Math.atan(rowHalf / dist);
    return Math.min(1, Math.max(0, (off - litUpTo) / (TROLL_LAMP.EDGE_DEG * DEG)));
  }
}
