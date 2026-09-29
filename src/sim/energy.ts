import { ENERGY, POWERS, SCORE, type PowerDef, type PowerKind } from "../config/constants";

/**
 * Energy rules, kept free of Phaser and rendering so the same code can run in a
 * future shared sim / match server (docs/MULTIPLAYER_DESIGN.md §5, phase 2).
 *
 * The meter only knows how to charge and spend. Each way of spending is its own
 * small controller (Power below for the player's picked power; "send" later)
 * that asks the meter for energy, so adding a spender doesn't touch the others.
 */

/** Everything about a kill that energy cares about. */
export interface KillInfo {
  digits: readonly number[];
  solveMs: number;
  /** Streak length INCLUDING this kill (1 = first kill after a hit/start). */
  combo: number;
}

/** gain = BASE * ballBonus * digitBonus * speedBonus * comboBonus (see ENERGY). */
export function energyForKill(k: KillInfo): number {
  const ballBonus = ENERGY.BALL_BONUS[k.digits.length] ?? 1;

  const meanDigit = k.digits.reduce((s, d) => s + d, 0) / Math.max(1, k.digits.length);
  const digitT = clamp((meanDigit - 1) / 8, 0, 1);
  const digitBonus = 1 + (ENERGY.DIGIT_MAX_MULT - 1) * digitT;

  const speedT = clamp((k.solveMs - SCORE.FAST_MS) / (SCORE.SLOW_MS - SCORE.FAST_MS), 0, 1);
  const speedBonus = ENERGY.FAST_MULT + (ENERGY.SLOW_MULT - ENERGY.FAST_MULT) * speedT;

  const comboBonus = Math.min(ENERGY.COMBO_MAX, 1 + (k.combo - 1) * ENERGY.COMBO_STEP);

  return ENERGY.BASE * ballBonus * digitBonus * speedBonus * comboBonus;
}

/** Where energy can go: the power, or "send" (the battle's attack gauge). */
export type EnergySpender = PowerKind | "send";

export class EnergyMeter {
  public value = 0;
  /** Per-run totals, shown on game over to compare playtest settings. */
  public earned = 0;
  public readonly spent: Record<EnergySpender, number> = {
    freeze: 0,
    slow: 0,
    blast: 0,
    shield: 0,
    send: 0,
  };

  constructor(public readonly max: number = ENERGY.MAX) {}

  get fraction(): number {
    return this.value / this.max;
  }

  /**
   * Add energy from a kill; overflow past `max` is lost. Returns what was
   * stored. Battle royale: the kill will cancel incoming aliens first and only
   * the remainder reaches this call.
   */
  charge(amount: number): number {
    const stored = Math.min(amount, this.max - this.value);
    this.value += stored;
    this.earned += amount;
    return stored;
  }

  canSpend(amount: number): boolean {
    return this.value >= amount;
  }

  /** All-or-nothing spend (one-shot effects such as a full stop or a send). */
  spend(amount: number, by: EnergySpender): boolean {
    if (!this.canSpend(amount)) return false;
    this.value -= amount;
    this.spent[by] += amount;
    return true;
  }

  /** Spend up to `amount` (continuous effects). Returns what was actually taken. */
  drain(amount: number, by: EnergySpender): number {
    const taken = Math.min(amount, this.value);
    this.value -= taken;
    this.spent[by] += taken;
    return taken;
  }
}

/** What pressing the power did. */
export type PowerUse = "on" | "off" | "blast" | "armed";

/**
 * The player's one power (POWERS in constants), picked before the run and fixed
 * for it. What it does depends on its EFFECT:
 * - time: a toggle that drains energy while on and slows the field; it turns
 *   off by itself when the meter runs dry.
 * - blast: a one-shot that pays its cost; the Field destroys every alien.
 * - shield: pays its cost to arm; the Field asks `absorbHit()` when an alien
 *   reaches the ship. Only one shield can be armed.
 */
export class Power {
  readonly def: PowerDef;
  private on = false;
  private armed = false;

  constructor(readonly kind: PowerKind) {
    this.def = POWERS[kind];
  }

  /** A time power is running: the field is slowed and kills charge nothing. */
  get running(): boolean {
    return this.on;
  }

  get shieldArmed(): boolean {
    return this.armed;
  }

  /** Energy needed to press it (the meter's mark). */
  get cost(): number {
    return this.def.EFFECT === "time" ? this.def.MIN_START : this.def.COST;
  }

  /** Whether pressing it now would do something. A running time power can
   * always be switched off; an armed shield can't be bought twice. */
  canTrigger(meter: EnergyMeter): boolean {
    if (this.on) return true;
    if (this.armed) return false;
    return meter.canSpend(this.cost);
  }

  /** The player pressed POWER. Returns what happened, or null if nothing. */
  trigger(meter: EnergyMeter): PowerUse | null {
    if (!this.canTrigger(meter)) return null;
    switch (this.def.EFFECT) {
      case "time":
        this.on = !this.on;
        return this.on ? "on" : "off";
      case "blast":
        meter.spend(this.def.COST, this.kind);
        return "blast";
      case "shield":
        meter.spend(this.def.COST, this.kind);
        this.armed = true;
        return "armed";
    }
  }

  /**
   * Advance by real (unslowed) ms and return the field speed factor
   * (1 = normal). While `held` (e.g. the hit-recovery freeze already stops the
   * field) nothing drains, so energy isn't wasted.
   */
  update(deltaMs: number, meter: EnergyMeter, held: boolean): number {
    if (!this.on || this.def.EFFECT !== "time") return 1;
    if (!held) meter.drain((this.def.PER_SEC * deltaMs) / 1000, this.kind);
    if (meter.value <= 0) this.on = false;
    return this.on ? this.def.FACTOR : 1;
  }

  /** An alien reached the ship: true if an armed shield took it (and is spent). */
  absorbHit(): boolean {
    if (!this.armed) return false;
    this.armed = false;
    return true;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
