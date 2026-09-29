import { describe, expect, it } from "vitest";
import { BOT, SIM, type BotLevel } from "../config/constants";
import { Bot, carries } from "./Bot";
import { Field, replayField } from "./Field";

const STEP = SIM.STEP_MS;

/** Let `bot` play `field` until knocked out or `minutes` of game time pass. */
function run(field: Field, bot: Bot, minutes: number, onStep?: () => void): void {
  const maxSteps = Math.round((minutes * 60_000) / STEP);
  while (!field.knockedOut && field.steps < maxSteps) {
    bot.update(field, STEP);
    field.step(STEP);
    field.takeEvents();
    onStep?.();
  }
}

describe("carries", () => {
  it("counts how often a running sum crosses a ten", () => {
    expect(carries([2, 3])).toBe(0);
    expect(carries([7, 5])).toBe(1);
    expect(carries([5, 5])).toBe(1);
    expect(carries([9, 9, 9])).toBe(2);
    expect(carries([1, 2, 3])).toBe(0);
  });
});

describe("Bot", () => {
  it("plays only through inputs: its run replays exactly from the input log", () => {
    const field = new Field({ seed: 11 });
    run(field, Bot.forSeat("ace", 11), 2);
    expect(field.kills).toBeGreaterThan(20);
    const replay = replayField({ seed: 11 }, field.inputLog, field.steps, STEP);
    expect(replay.score).toBe(field.score);
    expect(replay.kills).toBe(field.kills);
    expect(replay.aliens.map((a) => [a.x, a.y, a.digits])).toEqual(
      field.aliens.map((a) => [a.x, a.y, a.digits]),
    );
  });

  it("is deterministic per seat: same seed and seat → same run; other seat → different", () => {
    const play = (seat: number) => {
      const field = new Field({ seed: 12 });
      run(field, Bot.forSeat("pilot", 12, seat), 1.5);
      return JSON.stringify(field.inputLog);
    };
    expect(play(0)).toBe(play(0));
    expect(play(1)).not.toBe(play(0));
  });

  it("ranks by skill: aces outscore pilots outscore rookies", () => {
    const median = (level: BotLevel) => {
      const scores = [1, 2, 3, 4, 5].map((seed) => {
        const field = new Field({ seed });
        run(field, Bot.forSeat(level, seed), 4);
        return field.score;
      });
      return scores.sort((a, b) => a - b)[2];
    };
    const rookie = median("rookie");
    const pilot = median("pilot");
    const ace = median("ace");
    expect(pilot).toBeGreaterThan(rookie * 1.5);
    expect(ace).toBeGreaterThan(pilot * 1.3);
  });

  it("makes slips at about its error rate, and clears the ones that don't fire", () => {
    let answers = 0;
    let slips = 0;
    let longestWrongMs = 0;
    for (const seed of [1, 2, 3]) {
      const field = new Field({ seed });
      const bot = Bot.forSeat("rookie", seed);
      let wrongMs = 0;
      run(field, bot, 3, () => {
        const state = field.answerView()?.state;
        wrongMs = field.typed !== "" && state !== "match" ? wrongMs + STEP : 0;
        longestWrongMs = Math.max(longestWrongMs, wrongMs);
      });
      answers += bot.answers;
      slips += bot.slips;
    }
    expect(slips / answers).toBeGreaterThan(BOT.LEVELS.rookie.ERROR_RATE / 2);
    expect(slips / answers).toBeLessThan(BOT.LEVELS.rookie.ERROR_RATE * 2);
    // A slip never sits in the answer display much longer than it takes to notice.
    expect(longestWrongMs).toBeLessThanOrEqual(BOT.LEVELS.rookie.NOTICE_WRONG + 2 * STEP);
  });

  it("never reads balls hidden by a Blinker's lids", () => {
    // Play without a bot until the only alien on screen is a blinker with
    // its lids shut (nothing is answered, so it stays alone for a while).
    const field = new Field({ seed: 13, forcedAbilities: ["blinker"] });
    const onScreen = () => field.aliens.filter((a) => a.active && a.y - a.top >= 0);
    const shut = () => {
      const [a, ...rest] = onScreen();
      return a && !rest.length && (a.ability?.cover ?? 0) > BOT.MAX_READ_COVER;
    };
    while (!shut() && field.steps < 60 * 60) field.step(STEP);
    expect(shut()).toBe(true);

    // A bot arriving now can't start on it (starting = counting an answer)...
    const bot = Bot.forSeat("ace", 13);
    const limit = field.steps + 60 * 10;
    while (shut() && field.steps < limit) {
      bot.update(field, STEP);
      expect(bot.answers).toBe(0);
      field.step(STEP);
    }
    // ...but reads it as soon as the lids open.
    bot.update(field, STEP);
    expect(bot.answers).toBe(1);
  });
});

describe("Bot powers (FREEZE)", () => {
  const play = (seed: number, powers: boolean, onStep?: (f: Field) => void) => {
    const field = new Field({ seed });
    const bot = Bot.forSeat("ace", seed);
    bot.usePowers = powers;
    run(field, bot, 10, () => onStep?.(field));
    return { field, bot };
  };

  it("survives longer with FREEZE than without (A/B)", () => {
    const seeds = [1, 2, 3, 4, 5];
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[2];
    const without = median(seeds.map((s) => play(s, false).field.elapsedMs));
    const withPowers = median(seeds.map((s) => play(s, true).field.elapsedMs));
    expect(withPowers).toBeGreaterThan(without * 1.5);
  });

  it("freezes only when the board is dangerous, and unfreezes once it's clear", () => {
    let freezeSteps = 0;
    let frozenWithNothingOpen = 0;
    const { bot } = play(2, true, (f) => {
      if (f.slowTime.mode !== "freeze") return;
      freezeSteps++;
      const open = f.aliens.filter((a) => a.active && a.lethal && a !== f.lockedTarget && a.y - a.top >= 0);
      if (open.length === 0) frozenWithNothingOpen++;
    });
    expect(bot.freezes).toBeGreaterThan(5);
    // A clear board is noticed within REACTION (plus the step the last kill lands).
    expect(frozenWithNothingOpen / bot.freezes).toBeLessThan((BOT.LEVELS.ace.REACTION + 100) / STEP);
    expect(freezeSteps).toBeGreaterThan(0);
  });

  it("never uses SLOW", () => {
    const { field } = play(3, true);
    expect(field.energy.spent.slow).toBe(0);
    expect(field.energy.spent.freeze).toBeGreaterThan(0);
  });
});
