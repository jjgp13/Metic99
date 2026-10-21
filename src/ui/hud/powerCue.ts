import { PLAYER, POWER_CUE } from "../../config/constants";
import type { EnergyMeter, Power } from "../../sim/energy";

/**
 * What the power's HUD should say, worked out from the field each frame.
 * Phaser-free so it can be tested; the rules never read it (a look only).
 *
 * - "charging": below the power's cost.
 * - "ready": it can be pressed now.
 * - "full": ready and the meter is at max, so new energy is wasted.
 * - "on": a time power is running or a shield is armed.
 */
export type PowerCue = "charging" | "ready" | "full" | "on";

export function powerCue(power: Power, energy: EnergyMeter): PowerCue {
  if (power.running || power.shieldArmed) return "on";
  if (!power.canTrigger(energy)) return "charging";
  return energy.value >= energy.max ? "full" : "ready";
}

/**
 * The ready moment: energy just crossed the cost. Coming from "on" (the
 * player switched a time power off with energy left, or a shield was used up)
 * is not one: the player knows the power is there, and a chime on every
 * switch-off would teach them to ignore it.
 */
export function justBecameReady(before: PowerCue, now: PowerCue): boolean {
  return before === "charging" && (now === "ready" || now === "full");
}

/** Just what dangerClose reads of an alien (so tests can pass plain objects). */
export interface AlienNearShip {
  active: boolean;
  lethal: boolean;
  y: number;
}

/**
 * A lethal alien not yet answered is within NUDGE_PX of the ship: the
 * moment the power matters most. `answered` = the typed or locked target
 * (it holds still and can't cost a life).
 */
export function dangerClose(aliens: readonly AlienNearShip[], answered: readonly (AlienNearShip | null)[]): boolean {
  return aliens.some(
    (a) => a.active && a.lethal && !answered.includes(a) && PLAYER.Y - a.y <= POWER_CUE.NUDGE_PX,
  );
}
