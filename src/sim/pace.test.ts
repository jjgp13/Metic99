import { describe, expect, it } from "vitest";
import { SIM } from "../config/constants";
import { Field } from "./Field";
import { answerTimes } from "./pace";

const STEP = SIM.STEP_MS;

describe("answerTimes", () => {
  it("counts from when the alien became readable to the matching answer", () => {
    const f = new Field({ seed: 3 });
    // Wait for the first alien's balls to come on screen, then answer 1 s later.
    while (!f.aliens.some((a) => a.active && a.y - a.top >= 0)) f.step(STEP);
    const alien = f.aliens.find((a) => a.active && a.y - a.top >= 0)!;
    for (let i = 0; i < 60; i++) f.step(STEP);
    f.apply({ type: "digits", digits: String(alien.result) });
    for (let i = 0; i < 30; i++) f.step(STEP);

    const times = answerTimes({ seed: 3 }, f.inputLog, f.steps);
    const [ms] = times.get(alien.ballCount) ?? [];
    // Readable is seen one step after it happens, so allow a step either way.
    expect(ms).toBeGreaterThan(1000 - 2 * STEP);
    expect(ms).toBeLessThan(1000 + 2 * STEP);
  });

  it("counts a wrong answer's time toward the next right one, not as an answer", () => {
    const f = new Field({ seed: 3 });
    while (!f.aliens.some((a) => a.active && a.y - a.top >= 0)) f.step(STEP);
    f.apply({ type: "digits", digits: "97" }); // matches nothing
    for (let i = 0; i < 60; i++) f.step(STEP);
    const alien = f.aliens.find((a) => a.active)!;
    f.apply({ type: "digits", digits: String(alien.result) });
    const times = answerTimes({ seed: 3 }, f.inputLog, f.steps);
    expect([...times.values()].flat()).toHaveLength(1);
    expect(times.get(alien.ballCount)![0]).toBeGreaterThan(1000 - 2 * STEP);
  });
});
