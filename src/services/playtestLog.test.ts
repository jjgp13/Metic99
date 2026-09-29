import { describe, expect, it } from "vitest";
import { SIM } from "../config/constants";
import { Bot } from "../sim/Bot";
import { Field, replayField, type FieldInput, type MatchMessage } from "../sim/Field";
import { compact, expand } from "./playtestLog";

describe("playtest log", () => {
  it("compacts every input and expands it back", () => {
    const inputs: (FieldInput | MatchMessage)[] = [
      { type: "digits", digits: "7" },
      { type: "digits", digits: "12" },
      { type: "back" },
      { type: "clear" },
      { type: "power", mode: "slow" },
      { type: "power", mode: "freeze" },
      { type: "standing", alive: 5, total: 8 },
      { type: "send", cost: 50 },
      {
        type: "attack",
        from: 3,
        cost: 100,
        aliens: [
          { kind: "lumberer", ability: "shielded" },
          { kind: "darter", ability: null },
        ],
      },
    ];
    for (const input of inputs) expect(expand(compact(input))).toEqual(input);
  });

  it("replays a logged run exactly from its compact input log", () => {
    const field = new Field({ seed: 21 });
    const bot = Bot.forSeat("pilot", 21);
    while (!field.knockedOut && field.steps < 60 * 90) {
      bot.update(field, SIM.STEP_MS);
      field.step(SIM.STEP_MS);
    }
    const stored = field.inputLog.map(({ step, input }) => [step, compact(input)] as const);
    const log = stored.map(([step, code]) => ({ step, input: expand(code) }));
    const replay = replayField({ seed: 21 }, log, field.steps, SIM.STEP_MS);
    expect(replay.score).toBe(field.score);
    expect(replay.kills).toBe(field.kills);
    expect(replay.lives).toBe(field.lives);
  });
});
