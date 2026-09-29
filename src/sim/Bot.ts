import { BOT, PLAYER, type BotLevel } from "../config/constants";
import type Alien from "../objects/Alien";
import type { Field } from "./Field";
import { Rng } from "./rng";

/** Key of the bots' random streams: seat N of a match seeded S draws from
 * `Rng.derive(S, BOT_STREAM, N)`, apart from the field's own streams. */
export const BOT_STREAM = 99;

/** An answer the bot is working out: typed once `readyAt` comes. */
interface Plan {
  alien: Alien;
  /** The sum it read; if the alien's sum changes (a shield broke), re-read. */
  sumVersion: number;
  /** What it will type (the right answer, or a slip). */
  answer: number;
  readyAt: number;
}

/**
 * A bot player (docs/MULTIPLAYER_DESIGN.md §7). It plays a Field exactly like
 * a person: it only looks at what is on screen (digits it can see, positions)
 * and only acts through `field.apply()`, the same inputs as the keypad. So it
 * can't cheat, a new monster mostly just works, and later the same bot can
 * fill empty seats on a server.
 *
 * Solving model per answer: notice (REACTION) → think (base + per addition +
 * per carry, spread log-normally) → type the whole answer at once (PER_KEY per
 * digit; like the drawing pad, so "23" never passes through "2") → sometimes a
 * slip (off by 1 or 10) that it notices and clears. Like a person it reads the
 * next alien while the ship lines up its shot, and it drops a sum it is
 * still thinking about when a clearly worse threat appears.
 *
 * Powers: FREEZE when two or more unanswered aliens are on screen and the
 * nearest is getting close (or one is about to land), keep answering while
 * frozen, and unfreeze once the board is clear — the owner's own pattern.
 *
 * Call `update()` once per sim step, before `field.step()`. Its randomness
 * comes from its own seeded stream, so a match with bots replays exactly.
 */
export class Bot {
  readonly skill: (typeof BOT.LEVELS)[BotLevel];
  /** The bot's own clock (ms), advanced by update(). */
  private clock = 0;
  private plan: Plan | null = null;
  /** When it entered an answer that hasn't fired yet (to notice a slip). */
  private enteredAt: number | null = null;
  /** Aliens already weighed as a reason to switch (each gets one chance). */
  private weighed = new WeakSet<Alien>();
  /** Answers entered, and how many were slips; times it switched targets. */
  answers = 0;
  slips = 0;
  switches = 0;
  /** Times it switched FREEZE on. */
  freezes = 0;
  /** Off for A/B tests (`npm run bots -- --no-powers`). */
  usePowers = true;
  /** Since when the power decision it is about to make has held (REACTION). */
  private powerSince: number | null = null;
  /** This dangerous moment went unnoticed (MISS_DANGER): no FREEZE until it passes. */
  private missed = false;

  constructor(
    readonly level: BotLevel,
    private readonly rng: Rng,
  ) {
    this.skill = BOT.LEVELS[level];
  }

  /** The bot in `seat` of a match (or run) with this seed. */
  static forSeat(level: BotLevel, seed: number, seat = 0): Bot {
    return new Bot(level, Rng.derive(seed, BOT_STREAM, seat));
  }

  static isLevel(name: string): name is BotLevel {
    return Object.prototype.hasOwnProperty.call(BOT.LEVELS, name);
  }

  update(field: Field, dt: number): void {
    this.clock += dt;
    if (field.knockedOut) return;
    if (this.usePowers) this.decidePower(field);

    // Waiting on an entered answer: a right one fires (and clears the typed
    // answer); a slip stays wrong, or dangles as the start of another answer.
    // While a right one waits for the ship, the bot reads ahead like a person.
    const waiting = this.enteredAt !== null && field.typed !== "";
    if (this.enteredAt !== null) {
      if (field.typed === "") {
        this.enteredAt = null;
      } else if (field.answerView()?.state !== "match") {
        if (this.clock - this.enteredAt < this.skill.NOTICE_WRONG) return;
        field.apply({ type: "clear" });
        this.enteredAt = null;
        return;
      }
    }

    const plan = this.plan;
    if (plan) {
      if (!plan.alien.active || plan.alien.sumVersion !== plan.sumVersion) {
        this.plan = null; // gone, or its sum changed under us: look again
      } else if (this.clock >= plan.readyAt && !waiting) {
        // Typing now can't cancel a shot: the answer box is empty or holds a
        // leftover that doesn't match anything.
        if (field.typed !== "") field.apply({ type: "clear" });
        field.apply({ type: "digits", digits: String(plan.answer) });
        this.enteredAt = this.clock;
        this.plan = null;
      } else {
        this.maybeSwitch(field, plan);
      }
      return;
    }

    const alien = this.pickTarget(field);
    if (alien) this.plan = this.read(alien);
  }

  /**
   * Mid-thought, a clearly worse threat appeared (e.g. splitlings popping out
   * low on the field): with chance FOCUS drop the current sum and go for it.
   * Each newcomer is weighed once, so the bot doesn't flip back and forth.
   */
  private maybeSwitch(field: Field, plan: Plan): void {
    const worst = this.readable(field).reduce<Alien | null>(
      (best, a) => (best === null || danger(a) > danger(best) ? a : best),
      null,
    );
    if (!worst || worst === plan.alien || this.weighed.has(worst)) return;
    this.weighed.add(worst);
    if (danger(worst) - danger(plan.alien) < BOT.SWITCH_MARGIN_PX) return;
    if (!this.rng.chance(this.skill.FOCUS)) return;
    this.switches++;
    this.answers--; // the dropped answer was never entered
    if (plan.answer !== sumOf(plan.alien)) this.slips--;
    this.plan = this.read(worst);
  }

  /**
   * FREEZE when the board gets dangerous; unfreeze once every alien on
   * screen is answered. A decision is made only after it has held for
   * REACTION, like a person noticing.
   */
  private decidePower(field: Field): void {
    const open = this.readable(field).filter((a) => a.lethal);
    const nearest = open.reduce((d, a) => Math.min(d, PLAYER.Y - a.y), Infinity);
    const frozen = field.slowTime.mode === "freeze";
    const want = frozen
      ? open.length > 0 // stay frozen until the board is clear
      : (open.length >= BOT.FREEZE_MIN_OPEN && nearest <= this.skill.FREEZE_AT_PX) ||
        nearest <= this.skill.PANIC_PX;
    // Nothing to change (or the hit-recovery freeze already holds the field).
    if (want === frozen || field.freezeLeftMs > 0 || (!frozen && !field.slowTime.canTrigger(field.energy))) {
      this.powerSince = null;
      this.missed = false; // the moment passed
      return;
    }
    if (this.powerSince === null && !frozen) {
      // A new dangerous moment: people sometimes don't notice one in time.
      this.missed = this.rng.chance(this.skill.MISS_DANGER);
    }
    this.powerSince ??= this.clock;
    if (this.missed) return;
    if (this.clock - this.powerSince < this.skill.REACTION) return;
    field.apply({ type: "power", mode: "freeze" }); // toggles it on or off
    if (!frozen) this.freezes++;
    this.powerSince = null;
  }

  /** Aliens whose balls a person could read right now. */
  private readable(field: Field): Alien[] {
    // The alien whose answer is typed and waiting for the ship is done.
    const answered = field.typed === "" ? undefined : field.alienFor(parseInt(field.typed, 10));
    return field.aliens.filter(
      (a) =>
        a.active &&
        a !== field.lockedTarget &&
        a !== answered &&
        a.y - a.top >= 0 && // its balls are on screen
        (a.ability?.cover ?? 0) <= BOT.MAX_READ_COVER,
    );
  }

  /** Usually the most dangerous readable alien; sometimes (1 - FOCUS) any. */
  private pickTarget(field: Field): Alien | null {
    const readable = this.readable(field);
    if (!readable.length) return null;
    if (!this.rng.chance(this.skill.FOCUS)) return this.rng.pick(readable);
    return readable.reduce((best, a) => (danger(a) > danger(best) ? a : best));
  }

  private read(alien: Alien): Plan {
    const s = this.skill;
    const sum = sumOf(alien);
    this.weighed.add(alien);
    const think =
      (s.THINK_BASE + s.PER_ADD * (alien.ballCount - 1) + s.PER_CARRY * carries(alien.digits)) *
      Math.exp(s.NOISE * this.gaussian());
    const answer = this.rng.chance(s.ERROR_RATE) ? this.slip(sum) : sum;
    this.answers++;
    if (answer !== sum) this.slips++;
    return {
      alien,
      sumVersion: alien.sumVersion,
      answer,
      readyAt: this.clock + s.REACTION + think + s.PER_KEY * String(answer).length,
    };
  }

  /** A believable wrong answer: off by 1, or by 10 (a carry slip). */
  private slip(sum: number): number {
    const step = this.rng.chance(BOT.TENS_SLIP) ? 10 : 1;
    const up = sum + step <= 99;
    const down = sum - step >= 1;
    return up && (!down || this.rng.chance(0.5)) ? sum + step : sum - step;
  }

  /** Standard normal draw (Box–Muller) from the bot's stream. */
  private gaussian(): number {
    const u = 1 - this.rng.next(); // (0, 1]: log(0) would be -Infinity
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.rng.next());
  }
}

/** Bigger = more urgent: lower on screen, or a strafer about to dive. Drifters
 * are optional, so they come last. */
function danger(a: Alien): number {
  if (!a.lethal) return -Infinity;
  return a.y + (a.mode === "windup" || a.mode === "dive" ? BOT.DIVE_DANGER_PX : 0);
}

function sumOf(a: Alien): number {
  return a.digits.reduce((t, d) => t + d, 0);
}

/** How many times a running sum crosses a ten (7 + 5: once). */
export function carries(digits: readonly number[]): number {
  let n = 0;
  let sum = 0;
  for (const d of digits) {
    if (Math.floor((sum + d) / 10) > Math.floor(sum / 10)) n++;
    sum += d;
  }
  return n;
}
