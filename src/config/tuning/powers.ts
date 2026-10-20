// Energy and the player's power.
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

/**
 * Energy: every kill has a value; harder, faster and streakier kills are worth
 * more:
 *
 *   value = BASE * ballBonus * digitBonus * speedBonus * comboBonus
 *
 * - ballBonus: more numbers in the sum pay more.
 * - digitBonus: 1 for an average digit of 1, rising to DIGIT_MAX_MULT at 9.
 * - speedBonus: FAST_MULT when solved within SCORE.FAST_MS, decaying to
 *   SLOW_MULT by SCORE.SLOW_MS (same window as the score's speed bonus).
 * - comboBonus: +COMBO_STEP per consecutive kill, capped at COMBO_MAX.
 *
 * The power meter (MAX) gets POWER_RATE of that value, so the power is scarce
 * and worth saving: an easy early kill charges ~3, a strong player's kill on
 * a streak ~8, so ~12 such kills fill the bar (it was ~5 at rate 1, and the
 * bar sat full most of every level). In a battle the full value goes to
 * cancelling incoming attacks and to the attack gauge (SEND, tuned at rate 1).
 */
export const ENERGY = {
  MAX: 100,
  BASE: 6,
  BALL_BONUS: { 2: 1.0, 3: 1.6, 4: 2.2 } as Record<number, number>,
  DIGIT_MAX_MULT: 1.5,
  FAST_MULT: 1.5,
  SLOW_MULT: 1.0,
  COMBO_STEP: 0.1,
  COMBO_MAX: 2.0,
  POWER_RATE: 0.4,
} as const;

/**
 * Powers: each player picks ONE on the menu (the ship is only a look) and it is
 * fixed for the run / match. The set is data: bots play any power by its
 * EFFECT (sim/Bot.ts), so a new power that reuses an effect is one entry here;
 * a new effect needs code in sim/energy.ts + Field and a bot rule.
 *
 * Rule for every power: it never pays for itself. Kills made while a time
 * power runs, and aliens destroyed by a power, charge no energy (they still
 * score and keep the streak). The first playtests showed why: kills made
 * while frozen paid back 40–50% of FREEZE's cost, so it was on ~27% of the time.
 *
 * - time: a toggle that drains PER_SEC while on and runs the player's own
 *   field (aliens + spawn clock) at FACTOR; the ship, bullets and difficulty
 *   clock keep full speed. Needs MIN_START to switch on.
 * - blast: pay COST (a full bar) to destroy every alien on the field. No score,
 *   no energy, splitters don't split.
 * - shield: pay COST to arm it; the next alien that reaches the ship is
 *   destroyed instead of costing a life. One at a time; buy it in the calm.
 */
export type PowerKind = "freeze" | "slow" | "blast" | "shield";

interface PowerInfo {
  NAME: string;
  /** One line for the menu picker. */
  BLURB: string;
  COLOR: number;
}
export type PowerDef = PowerInfo &
  (
    | { EFFECT: "time"; FACTOR: number; PER_SEC: number; MIN_START: number }
    | { EFFECT: "blast"; COST: number }
    | { EFFECT: "shield"; COST: number }
  );

export const POWERS: Record<PowerKind, PowerDef> = {
  // The panic button: total safety, twice the burn of SLOW per second saved.
  freeze: {
    EFFECT: "time", FACTOR: 0, PER_SEC: 25, MIN_START: 10,
    NAME: "FREEZE", BLURB: "stop the field", COLOR: 0xb8d8ff,
  },
  // The tempo power: aliens still creep, but a bar lasts far longer.
  slow: {
    EFFECT: "time", FACTOR: 0.45, PER_SEC: 6, MIN_START: 10,
    NAME: "SLOW", BLURB: "field at half speed, cheap", COLOR: 0x5ef0ff,
  },
  blast: {
    EFFECT: "blast", COST: 60,
    NAME: "BLAST", BLURB: "full bar: clear the screen", COLOR: 0xff9f5a,
  },
  shield: {
    EFFECT: "shield", COST: 50,
    NAME: "SHIELD", BLURB: "the next hit is blocked", COLOR: 0xffd166,
  },
};

/** Menu order; the first is the default pick. */
export const POWER_KINDS: readonly PowerKind[] = ["freeze", "slow", "blast", "shield"];
