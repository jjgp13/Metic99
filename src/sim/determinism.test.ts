import { describe, expect, it } from "vitest";
import recordingJson from "../lab/determinism-recording.json";
import {
  checkMath,
  checkRun,
  fromBits,
  oneBitOff,
  toBits,
  withBrokenSin,
  withEngineMath,
  type Recording,
} from "./determinism";

const recording = recordingJson as unknown as Recording;

describe("the determinism recording", () => {
  it.each(recording.runs.map((r) => [r.name, r] as const))(
    "%s replays to Node's fingerprints (if not: the rules changed, run `npm run determinism:record`)",
    (_name, run) => {
      expect(checkRun(run).firstMismatch).toBeNull();
    },
  );

  it("the game's own sin/exp give exactly Node's recorded answers", () => {
    const { checked, mismatches } = checkMath(recording.math, "game");
    expect(checked).toBeGreaterThan(1000);
    expect(mismatches).toEqual([]);
  });

  it("so does Node's Math (the recording was made with it)", () => {
    expect(checkMath(recording.math, "engine").mismatches).toEqual([]);
  });
});

describe("break it: Math.sin off by one bit", () => {
  const run = recording.runs.find((r) => r.name === "lumberers")!;

  it("no longer reaches the game: the rules use their own sin", () => {
    expect(withBrokenSin(() => checkRun(run)).ok).toBe(true);
  });

  it("with the engine's Math (the rules before S0 step 4) the run drifts", () => {
    const result = withEngineMath(() => withBrokenSin(() => checkRun(run)));
    expect(result.ok).toBe(false);
    expect(result.firstMismatch!.step).toBeGreaterThan(0);
  });

  it("restores the real Math.sin afterwards", () => {
    withBrokenSin(() => 0);
    expect(Math.sin(1)).toBe(0.8414709848078965);
  });
});

describe("float bits", () => {
  it("round-trips exactly, -0 included", () => {
    for (const x of [0, -0, 1, 85.5, 0.1 + 0.2, Math.PI, -1e-300]) {
      expect(Object.is(fromBits(toBits(x)), x)).toBe(true);
    }
  });

  it("oneBitOff changes only the last bit's step", () => {
    const x = 0.3;
    expect(oneBitOff(x)).not.toBe(x);
    expect(BigInt(`0x${toBits(oneBitOff(x))}`) - BigInt(`0x${toBits(x)}`)).toBe(1n);
  });
});
