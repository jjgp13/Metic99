import { ENERGY, SCORE, SLOW_TIME, type SlowMode } from "../config/constants";

/**
 * Energy rules, kept free of Phaser and rendering so the same code can run in a
 * future shared sim / match server (docs/MULTIPLAYER_DESIGN.md §5, phase 2).
 *
 * The meter only knows how to charge and spend. Each way of spending is its own
 * small controller (SlowTime below for slow/freeze; "send" later) that asks the
 * meter for energy, so adding a spender doesn't touch the others.
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

/** Where energy can go. "send" (attack an opponent) arrives with multiplayer. */
export type EnergySpender = SlowMode | "send";

export class EnergyMeter {
  public value = 0;
  /** Per-run totals, shown on game over to compare playtest settings. */
  public earned = 0;
  public readonly spent: Record<EnergySpender, number> = { slow: 0, freeze: 0, send: 0 };

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

/**
 * Time powers: SLOW (field at 30%) and FREEZE (field stopped). Each is a toggle
 * that drains energy while on; only one runs at a time. Pressing the running
 * one turns it off, pressing the other switches over, and it turns off by
 * itself when the meter runs dry.
 */
export class SlowTime {
  private running: SlowMode | null = null;

  get mode(): SlowMode | null {
    return this.running;
  }

  /** Energy needed before a power can be switched on. */
  get threshold(): number {
    return SLOW_TIME.MIN_START;
  }

  /** Whether pressing a power would do something: once one runs, switching
   * over or off is always allowed; starting needs `threshold` energy. */
  canTrigger(meter: EnergyMeter): boolean {
    return this.running !== null || meter.canSpend(this.threshold);
  }

  /** The player pressed SLOW or FREEZE. Returns true if something changed. */
  trigger(mode: SlowMode, meter: EnergyMeter): boolean {
    if (!this.canTrigger(meter)) return false;
    this.running = this.running === mode ? null : mode;
    return true;
  }

  /**
   * Advance by real (unslowed) ms and return the field speed factor
   * (1 = normal). While `held` (e.g. the hit-recovery freeze already stops the
   * field) nothing drains, so energy isn't wasted.
   */
  update(deltaMs: number, meter: EnergyMeter, held: boolean): number {
    if (this.running === null) return 1;
    const { FACTOR, PER_SEC } = SLOW_TIME.MODES[this.running];
    if (!held) meter.drain((PER_SEC * deltaMs) / 1000, this.running);
    if (meter.value <= 0) this.running = null;
    return this.running === null ? 1 : FACTOR;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
