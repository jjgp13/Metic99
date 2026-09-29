import { describe, expect, it } from "vitest";
import { FEEDBACK, SIM } from "../config/constants";
import { ABILITY_KINDS } from "../objects/abilities";
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
    if (danger && field.slowTime.mode === null && field.energy.value >= 40) {
      field.apply({ type: "power", mode: "freeze" });
    } else if (!danger && field.slowTime.mode !== null) {
      field.apply({ type: "power", mode: "freeze" }); // pressing it again turns it off
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
    power: f.slowTime.mode,
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

  it("can't start a power without energy", () => {
    const f = new Field({ seed: 4 });
    expect(f.apply({ type: "power", mode: "slow" })).toBe(false);
    expect(f.slowTime.mode).toBeNull();
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
