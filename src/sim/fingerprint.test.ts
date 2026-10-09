import { describe, expect, it } from "vitest";
import { NET, SIM } from "../config/constants";
import { Bot } from "./Bot";
import { Field, replayField, type FieldOptions } from "./Field";
import { fingerprint, fingerprintReplay, stateDump, walkState, type StateLeaf } from "./fingerprint";

const STEP = SIM.STEP_MS;

/** An ace bot plays `seconds` of a field; returns the field (with its input log). */
function botRun(options: FieldOptions, seconds: number): Field {
  const field = new Field(options);
  const bot = Bot.forSeat("ace", options.seed);
  const steps = Math.round((seconds * 1000) / STEP);
  for (let i = 0; i < steps && !field.knockedOut; i++) {
    bot.update(field, STEP);
    field.step(STEP);
  }
  return field;
}

describe("fingerprint", () => {
  const options: FieldOptions = { seed: 42, power: "freeze" };
  const original = botRun(options, 60);

  it("a replay from seed + input log has the same fingerprint as the original", () => {
    const replay = replayField(options, original.inputLog, original.steps, STEP);
    expect(fingerprint(replay)).toBe(fingerprint(original));
  });

  it("one flipped bit in one alien's y changes the fingerprint", () => {
    const replay = replayField(options, original.inputLog, original.steps, STEP);
    const alien = replay.aliens[0];
    const before = alien.y;
    alien.y += alien.y * Number.EPSILON; // the next float up: a last-bit change
    expect(alien.y).not.toBe(before);
    expect(fingerprint(replay)).not.toBe(fingerprint(original));
  });

  it("another seed gives another fingerprint", () => {
    expect(fingerprint(botRun({ ...options, seed: 43 }, 10))).not.toBe(
      fingerprint(botRun(options, 10)),
    );
  });

  it("covers ability state (a Blinker's lids)", () => {
    const field = botRun({ ...options, forcedAbilities: ["blinker"] }, 20);
    expect(stateDump(field).some((line) => line.includes(".ability.cover = "))).toBe(true);
  });

  it("leaves out the input log and the event outbox (not state)", () => {
    const paths = stateDump(original).map((line) => line.split(" = ")[0]);
    expect(paths.some((p) => p.startsWith("inputLog") || p.startsWith("events"))).toBe(false);
  });
});

describe("fingerprintReplay", () => {
  const options: FieldOptions = { seed: 7, power: "blast" };
  const original = botRun(options, 30);
  const checkpoints = fingerprintReplay(options, original.inputLog, original.steps, STEP);

  it(`takes a checkpoint every ${NET.FINGERPRINT_EVERY} steps and one at the end`, () => {
    const steps = checkpoints.map((c) => c.step);
    expect(steps.slice(0, 3)).toEqual([0, NET.FINGERPRINT_EVERY, 2 * NET.FINGERPRINT_EVERY]);
    expect(steps[steps.length - 1]).toBe(original.steps);
  });

  it("ends on the original run's fingerprint, and a second replay gives the same list", () => {
    expect(checkpoints[checkpoints.length - 1].hash).toBe(fingerprint(original));
    expect(fingerprintReplay(options, original.inputLog, original.steps, STEP)).toEqual(checkpoints);
  });
});

describe("walkState", () => {
  it("reports a shared object once, then as a reference (so cycles end)", () => {
    const alien = { y: 1.5 };
    const root: Record<string, unknown> = { aliens: [alien], target: alien };
    root.self = root;
    const seen: [string, StateLeaf][] = [];
    walkState(root, (path, value) => seen.push([path, value]));
    expect(seen).toEqual([
      ["aliens.length", 1],
      ["aliens[0].y", 1.5],
      ["target", "@aliens[0]"],
      ["self", "@"],
    ]);
  });
});
