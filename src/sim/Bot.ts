import { BOT, PLAYER, type BotLevel } from "../config/constants";
import type Alien from "../objects/Alien";
import type { Field } from "./Field";
import { isDangerous, openThreats, readableAliens } from "./danger";
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
 * Powers: it uses whatever power its field has, by the power's EFFECT (not
 * its name), so a new power that reuses an effect needs no bot code. A time
 * power (FREEZE, SLOW) goes on when two or more unanswered aliens are on
 * screen and the nearest is getting close (or one is about to land), and off
 * once the board is clear — the owner's own FREEZE pattern.
 * In a battle it also SENDs when its energy is high and the board is calm,
 * aiming by its level's strategy (TARGETING).
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
  /** Times it switched a time power on, and attacks it sent (battle). */
  freezes = 0;
  sends = 0;
  /** False: never press POWER (the "no powers" baseline in `npm run bots`). */
  usesPower = true;
  /** "owner": uses its power the way the owner does (fitted to playtests);
   * "sharp": never misses a dangerous moment and saves BLAST for the last
   * moment (a power's ceiling, for balancing). */
  powerStyle: "owner" | "sharp" = "owner";
  /** Attack gauge at which it SENDs (its level's SEND_AT; Infinity = never). */
  sendAt: number;
  /** Since when the power decision it is about to make has held (REACTION). */
  private powerSince: number | null = null;
  /** This dangerous moment went unnoticed (MISS_DANGER): no power until it passes. */
  private missed = false;
  /** Since when it has been ready to SEND (REACTION). */
  private sendSince: number | null = null;
  /** Set its targeting strategy (battle). */
  private aimed = false;

  constructor(
    readonly level: BotLevel,
    private readonly rng: Rng,
  ) {
    this.skill = BOT.LEVELS[level];
    this.sendAt = this.skill.SEND_AT;
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
    if (this.usesPower) this.usePower(field);
    // Battle: pick its targeting strategy once, like a player before the start.
    if (field.standing && !this.aimed) {
      field.apply({ type: "target", aim: this.skill.TARGETING });
      this.aimed = true;
    }
    this.decideSend(field);

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
   * Energy policy (docs/MULTIPLAYER_DESIGN.md §7), one rule per effect:
   * - time: on in a dangerous moment (`dangerous`), off once the board is
   *   clear (fitted to the owner's FREEZE);
   * - blast: in a dangerous moment too, which is when the owner blasts (2+
   *   unanswered aliens up, one getting close); "sharp" bots instead wait
   *   until several are about to land, which gets the most out of each blast;
   * - shield: arm it as soon as it's affordable (buy it in the calm).
   * Owner-style bots act on a dangerous moment only after REACTION and miss
   * one with MISS_DANGER, whatever the power, so powers compare fairly.
   */
  private usePower(field: Field): void {
    const power = field.power;
    if (power.def.EFFECT === "shield") {
      if (power.canTrigger(field.energy)) field.apply({ type: "power" });
      return;
    }
    if (power.def.EFFECT === "blast" && this.powerStyle === "sharp") {
      const p = BOT.POWER;
      const open = field.aliens.filter(
        (a) => a.active && a.lethal && a !== field.lockedTarget && a !== field.target,
      );
      const danger = open.reduce((y, a) => Math.max(y, a.y), -Infinity);
      const press = open.filter((a) => a.y > p.BLAST_Y).length >= 2 || danger > p.BLAST_LAST_Y;
      if (press && power.canTrigger(field.energy)) field.apply({ type: "power" });
      return;
    }
    this.useMomentPower(field);
  }

  /** The owner's "this is getting dangerous" moment: 2+ unanswered aliens up
   * and the nearest within FREEZE_AT_PX of the ship, or any within PANIC_PX. */
  private dangerous(field: Field): { open: number; moment: boolean } {
    const moment = isDangerous(field, {
      minOpen: BOT.FREEZE_MIN_OPEN,
      nearPx: this.skill.FREEZE_AT_PX,
      panicPx: this.skill.PANIC_PX,
    });
    return { open: openThreats(field).length, moment };
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
   * A time power (FREEZE, SLOW) on in a dangerous moment, off once every
   * alien on screen is answered; BLAST fired in a dangerous moment. A
   * decision is made only after it has held for REACTION, like a person
   * noticing, and owner-style bots miss some moments (MISS_DANGER).
   */
  private useMomentPower(field: Field): void {
    const { open, moment } = this.dangerous(field);
    const frozen = field.power.running;
    const want = frozen ? open > 0 : moment; // stay on until the board is clear
    // Nothing to change (or the hit-recovery freeze already holds the field).
    if (want === frozen || field.freezeLeftMs > 0 || (!frozen && !field.power.canTrigger(field.energy))) {
      this.powerSince = null;
      this.missed = false; // the moment passed
      return;
    }
    if (this.powerSince === null && !frozen && this.powerStyle === "owner") {
      // A new dangerous moment: people sometimes don't notice one in time.
      this.missed = this.rng.chance(this.skill.MISS_DANGER);
    }
    this.powerSince ??= this.clock;
    if (this.missed) return;
    if (this.clock - this.powerSince < this.skill.REACTION) return;
    field.apply({ type: "power" }); // toggles a time power, or fires a blast
    if (!frozen) this.freezes++;
    this.powerSince = null;
  }

  /**
   * Battle: SEND (the strongest tier the attack gauge buys) once the gauge
   * reaches SEND_AT and the board is calm (no time power on, nothing close
   * enough to want one): pressing a button takes attention, like for people.
   */
  private decideSend(field: Field): void {
    const tier = field.sendTier();
    const nearest = this.readable(field)
      .filter((a) => a.lethal)
      .reduce((d, a) => Math.min(d, PLAYER.Y - a.y), Infinity);
    const ready =
      tier !== null &&
      field.attack.value >= this.sendAt &&
      !field.power.running &&
      nearest > this.skill.FREEZE_AT_PX;
    if (!ready) {
      this.sendSince = null;
      return;
    }
    this.sendSince ??= this.clock;
    if (this.clock - this.sendSince < this.skill.REACTION) return;
    if (field.apply({ type: "send", cost: tier })) this.sends++;
    this.sendSince = null;
  }

  /** Aliens whose balls a person could read right now (sim/danger.ts). */
  private readable(field: Field): Alien[] {
    return readableAliens(field);
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
