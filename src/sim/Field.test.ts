import { describe, expect, it } from "vitest";
import { FEEDBACK, POWER_KINDS, SIM } from "../config/constants";
import { ABILITY_KINDS } from "../objects/abilities";
import { Bot } from "./Bot";
import { Field, replayField, type FieldEvent } from "./Field";

const STEP = SIM.STEP_MS;

/**
 * A scripted player that only sends inputs, like a (very simple) bot: it picks
 * the lowest visible alien, "thinks" for a while, then enters the whole answer
 * at once. It presses FREEZE when an unanswered alien gets close.
 */
function play(field: Field, minutes: number): FieldEvent[] {
  const events: FieldEvent[] = [];
  let thinking: { result: number; leftMs: number } | null = null;
  const steps = Math.round((minutes * 60_000) / STEP);
  for (let i = 0; i < steps && !field.knockedOut; i++) {
    if (!thinking && field.typed === "" && !field.lockedTarget) {
      const a = field.aliens
        .filter((x) => x.active && x.y > 0)
        .sort((x, y) => y.y - x.y)[0];
      if (a) thinking = { result: a.result, leftMs: 600 + 250 * a.ballCount };
    }
    if (thinking && (thinking.leftMs -= STEP) <= 0) {
      if (field.alienFor(thinking.result)) {
        field.apply({ type: "digits", digits: String(thinking.result) });
      }
      thinking = null;
    }
    const danger = field.aliens.some((a) => a.active && a.lethal && a.y > 420 && a !== field.target);
    if (danger && !field.power.running && field.energy.value >= 40) {
      field.apply({ type: "power" });
    } else if (!danger && field.power.running) {
      field.apply({ type: "power" }); // pressing it again turns it off
    }
    field.step(STEP);
    events.push(...field.takeEvents());
  }
  return events;
}

/** The whole field state that matters, to compare two runs exactly. */
function fingerprint(f: Field): string {
  return JSON.stringify({
    steps: f.steps,
    aliens: f.aliens.map((a) => [a.kind, a.digits, a.x, a.y, a.mode, a.ability?.kind ?? null]),
    bullets: f.bullets.map((b) => [b.x, b.y]),
    ship: f.shipX,
    typed: f.typed,
    score: f.score,
    lives: f.lives,
    combo: f.combo,
    kills: f.kills,
    energy: f.energy.value,
    power: [f.power.running, f.power.shieldArmed],
  });
}

describe("Field", () => {
  it("plays a run from inputs alone: fires, solves, scores, charges energy", () => {
    const field = new Field({ seed: 1 });
    const events = play(field, 4);
    const count = (t: FieldEvent["type"]) => events.filter((e) => e.type === t).length;
    expect(count("fired")).toBeGreaterThan(50);
    expect(count("solved")).toBeGreaterThan(50);
    expect(field.score).toBeGreaterThan(5_000);
    expect(field.energy.earned).toBeGreaterThan(200);
    expect(field.energy.spent.freeze).toBeGreaterThan(0);
  });

  it("replays exactly from its seed and input log", () => {
    for (const options of [{ seed: 7 }, { seed: 8, forcedAbilities: [...ABILITY_KINDS] }]) {
      const original = new Field(options);
      play(original, 3);
      expect(original.inputLog.length).toBeGreaterThan(20);
      const replay = replayField(options, original.inputLog, original.steps, STEP);
      expect(fingerprint(replay)).toBe(fingerprint(original));
    }
  });

  it("depends on when each input arrived: one answer a step later changes the run", () => {
    const original = new Field({ seed: 7 });
    play(original, 3);
    const i = original.inputLog.findIndex((e) => e.input.type === "digits");
    const shifted = original.inputLog.map((e, j) => (j === i ? { ...e, step: e.step + 1 } : e));
    const replay = replayField({ seed: 7 }, shifted, original.steps, STEP);
    expect(fingerprint(replay)).not.toBe(fingerprint(original));
  });

  it("types at most two digits; back and clear edit the answer", () => {
    const f = new Field({ seed: 2 });
    expect(f.apply({ type: "digits", digits: "1" })).toBe(true);
    expect(f.apply({ type: "digits", digits: "2" })).toBe(true);
    expect(f.apply({ type: "digits", digits: "3" })).toBe(false);
    expect(f.typed).toBe("12");
    f.apply({ type: "back" });
    expect(f.typed).toBe("1");
    f.apply({ type: "clear" });
    expect(f.typed).toBe("");
    expect(f.apply({ type: "digits", digits: "4x" })).toBe(false);
    expect(f.apply({ type: "digits", digits: "123" })).toBe(false);
  });

  it("clears a wrong answer by itself", () => {
    const f = new Field({ seed: 3 });
    f.step(STEP);
    f.apply({ type: "digits", digits: "97" }); // no early sum is that big
    expect(f.answerView()?.state).toBe("wrong");
    const steps = Math.ceil(FEEDBACK.WRONG_CLEAR_MS / STEP);
    for (let i = 0; i < steps - 1; i++) f.step(STEP);
    expect(f.typed).toBe("97");
    f.step(STEP);
    expect(f.typed).toBe("");
  });

  it("can't use any power without energy", () => {
    for (const power of POWER_KINDS) {
      const f = new Field({ seed: 4, power });
      expect(f.apply({ type: "power" })).toBe(false);
      expect(f.power.running || f.power.shieldArmed).toBe(false);
    }
  });

  it("replays exactly with each power, played by a bot", () => {
    for (const power of POWER_KINDS) {
      const original = new Field({ seed: 11, power });
      const bot = Bot.forSeat("pilot", 11);
      while (!original.knockedOut && original.steps < 60 * 60 * 3) {
        bot.update(original, STEP);
        original.step(STEP);
      }
      expect(original.energy.spent[power]).toBeGreaterThan(0);
      const replay = replayField({ seed: 11, power }, original.inputLog, original.steps, STEP);
      expect(fingerprint(replay)).toBe(fingerprint(original));
    }
  });

  it("kills made while a time power runs charge no energy", () => {
    for (const power of ["freeze", "slow"] as const) {
      const f = new Field({ seed: 6, power });
      const bot = Bot.forSeat("ace", 6);
      let whileOn = 0;
      let charged = 0;
      while (!f.knockedOut && f.steps < 60 * 60 * 3) {
        bot.update(f, STEP);
        const on = f.power.running;
        f.step(STEP);
        for (const e of f.takeEvents()) {
          if (e.type !== "solved" || !on) continue;
          whileOn++;
          charged += e.energy;
        }
      }
      expect(whileOn).toBeGreaterThan(0);
      expect(charged).toBe(0);
    }
  });

  it("BLAST needs a full bar and destroys every alien for no score or energy", () => {
    const f = new Field({ seed: 9, power: "blast" });
    while (f.aliens.filter((a) => a.active).length < 2) f.step(STEP);
    f.energy.charge(f.power.cost - 1);
    expect(f.apply({ type: "power" })).toBe(false);
    f.energy.charge(1);
    const aliens = f.aliens.filter((a) => a.active);
    const before = { score: f.score, combo: f.combo };
    expect(f.apply({ type: "power" })).toBe(true);
    expect(aliens.every((a) => !a.active)).toBe(true);
    expect(f.energy.value).toBe(0);
    expect({ score: f.score, combo: f.combo }).toEqual(before);
    const blasted = f.takeEvents().find((e) => e.type === "blasted");
    expect(blasted?.type === "blasted" && blasted.aliens).toEqual(aliens);
  });

  it("SHIELD blocks one hit, can't be bought twice, and then lives are lost again", () => {
    const f = new Field({ seed: 5, power: "shield" });
    f.energy.charge(100);
    expect(f.apply({ type: "power" })).toBe(true);
    expect(f.power.shieldArmed).toBe(true);
    expect(f.apply({ type: "power" })).toBe(false); // one at a time
    const events: FieldEvent[] = [];
    while (!events.some((e) => e.type === "hit")) {
      f.step(STEP);
      events.push(...f.takeEvents());
    }
    const types = events.map((e) => e.type).filter((t) => t === "shielded" || t === "hit");
    expect(types.slice(0, 2)).toEqual(["shielded", "hit"]);
    expect(f.lives).toBe(2);
    expect(f.power.shieldArmed).toBe(false);
  });

  it("loses lives to unsolved aliens, freezes after a hit, then stops when knocked out", () => {
    const f = new Field({ seed: 5 });
    const events: FieldEvent[] = [];
    while (!f.knockedOut && f.steps < 60 * 60 * 5) {
      f.step(STEP);
      const e = f.takeEvents();
      events.push(...e);
      if (e.some((x) => x.type === "hit") && !f.knockedOut) expect(f.freezeLeftMs).toBeGreaterThan(0);
    }
    expect(events.filter((e) => e.type === "hit").map((e) => e.type === "hit" && e.livesLeft)).toEqual([2, 1, 0]);
    expect(events[events.length - 1]).toEqual({ type: "knockedOut" });

    const steps = f.steps;
    f.step(STEP);
    expect(f.steps).toBe(steps);
    expect(f.apply({ type: "digits", digits: "5" })).toBe(false);
  });

  it("knocks out on the first hit with one life (battle rule)", () => {
    const f = new Field({ seed: 5, lives: 1 });
    while (!f.knockedOut) f.step(STEP);
    expect(f.takeEvents().filter((e) => e.type === "hit" || e.type === "knockedOut").length).toBe(2);
    expect(f.lives).toBe(0);
  });

  it("ends the run once when two aliens reach the player in the same step", () => {
    const f = new Field({ seed: 5, lives: 1 });
    while (f.aliens.filter((a) => a.active).length < 1) f.step(STEP);
    const [a] = f.aliens;
    // Two hits in one step (e.g. a splitling pair): only the first counts.
    const loseLife = (f as unknown as { loseLife(x: unknown): void }).loseLife.bind(f);
    loseLife(a);
    loseLife(a);
    const events = f.takeEvents().filter((e) => e.type === "hit" || e.type === "knockedOut");
    expect(events.map((e) => e.type)).toEqual(["hit", "knockedOut"]);
    expect(f.lives).toBe(0);
  });
});
