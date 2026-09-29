import { describe, expect, it } from "vitest";
import { PLAYER, SIM } from "../config/constants";
import { isDangerous, openThreats } from "./danger";
import { Field } from "./Field";

const RULE = { minOpen: 2, nearPx: 170, panicPx: 90 };

/** A field with at least two lethal aliens on screen, placed by the test. */
function boardWithTwo(): Field {
  const f = new Field({ seed: 4, lives: 99 });
  // Late-match pressure opens the unsolved cap to 2+.
  f.receive({ type: "standing", alive: 2, total: 8 });
  while (f.aliens.filter((a) => a.active && a.lethal).length < 2 && !f.knockedOut && f.steps < 60 * 120) {
    f.step(SIM.STEP_MS);
  }
  return f;
}

describe("isDangerous", () => {
  it("is calm on an empty board", () => {
    expect(isDangerous(new Field({ seed: 1 }), RULE)).toBe(false);
  });

  it("flags two open aliens near the ship, or one very close", () => {
    const f = boardWithTwo();
    const [a, b] = f.aliens.filter((x) => x.active && x.lethal);
    a.x = 100;
    b.x = 380;
    a.y = b.y = 150; // far up: calm
    expect(openThreats(f)).toHaveLength(2);
    expect(isDangerous(f, RULE)).toBe(false);
    a.y = PLAYER.Y - RULE.nearPx + 10; // two open, the nearest in reach
    expect(isDangerous(f, RULE)).toBe(true);
    b.y = -200; // only one on screen now, still outside panic range
    expect(isDangerous(f, RULE)).toBe(false);
    a.y = PLAYER.Y - RULE.panicPx + 10; // about to land
    expect(isDangerous(f, RULE)).toBe(true);
  });

  it("ignores the alien already answered", () => {
    const f = boardWithTwo();
    const [a, b] = f.aliens.filter((x) => x.active && x.lethal);
    a.x = 100;
    b.x = 380;
    a.y = b.y = PLAYER.Y - RULE.nearPx + 10;
    expect(isDangerous(f, RULE)).toBe(true);
    f.apply({ type: "digits", digits: String(a.result) });
    expect(isDangerous(f, RULE)).toBe(false); // one left open, not in panic range
  });
});
