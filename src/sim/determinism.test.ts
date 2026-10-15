import { describe, expect, it } from "vitest";
import recordingJson from "../lab/determinism-recording.json";
import {
  checkMath,
  checkRun,
  fromBits,
  oneBitOff,
  toBits,
  withBrokenSin,
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

  it("Node agrees with its own recorded Math.sin / Math.exp answers", () => {
    const { checked, mismatches } = checkMath(recording.math);
    expect(checked).toBeGreaterThan(1000);
    expect(mismatches).toEqual([]);
  });
});

describe("break it: Math.sin off by one bit", () => {
  it("makes a lumberer run drift from Node's fingerprints", () => {
    const run = recording.runs.find((r) => r.name === "lumberers")!;
    const result = withBrokenSin(() => checkRun(run));
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
