import { describe, expect, it } from "vitest";
import { DET, atan, atan2, cos, exp, hypot, sin } from "./detmath";

/** Every rule source file, as text (Vite reads them at test time). */
const sources = import.meta.glob(["../sim/**/*.ts", "../objects/**/*.ts", "../config/**/*.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/**
 * Files allowed to use the engine's Math: bots run only on the server and
 * act through logged inputs; determinism.ts is the experiment that compares
 * engine Math with ours on purpose.
 */
const ALLOWED = ["../sim/Bot.ts", "../sim/determinism.ts"];

/** Engine math that may differ in the last bit between JS engines. */
const FORBIDDEN =
  /Math\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log1p|log2|log10|pow|cbrt|hypot)\b|\*\*/;

/** Code without its comments, so a comment may mention Math.sin. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("guard: game rules use deterministic math", () => {
  const ruleFiles = Object.keys(sources).filter((f) => !f.endsWith(".test.ts") && !ALLOWED.includes(f));

  it("finds the rule files (so the guard really looks)", () => {
    expect(ruleFiles.length).toBeGreaterThan(10);
  });

  it.each(ruleFiles)("%s calls no engine sin/cos/exp/pow/** (use math/detmath)", (file) => {
    const offending = code(sources[file])
      .split("\n")
      .filter((line) => FORBIDDEN.test(line));
    expect(offending).toEqual([]);
  });
});

describe("detmath", () => {
  /** Distance between two floats in last-bit steps (ulps). */
  const ulps = (a: number, b: number) => {
    const view = new DataView(new ArrayBuffer(16));
    view.setFloat64(0, a);
    view.setFloat64(8, b);
    const diff = view.getBigInt64(0) - view.getBigInt64(8);
    return Number(diff < 0n ? -diff : diff);
  };

  it("stays within 1 ulp of this engine's Math over the game's range", () => {
    for (let i = 0; i < 20_000; i++) {
      const x = -20 + i * 0.002_013;
      expect(ulps(sin(x), Math.sin(x))).toBeLessThanOrEqual(1);
      expect(ulps(cos(x), Math.cos(x))).toBeLessThanOrEqual(1);
      expect(ulps(exp(x), Math.exp(x))).toBeLessThanOrEqual(1);
    }
  });

  it("atan, atan2 and hypot stay within 1 ulp of Math too", () => {
    for (let i = 0; i < 20_000; i++) {
      const x = -50 + i * 0.005_017;
      const y = 30 - i * 0.003_001;
      expect(ulps(atan(x), Math.atan(x))).toBeLessThanOrEqual(1);
      expect(ulps(atan2(y, x), Math.atan2(y, x))).toBeLessThanOrEqual(1);
      // Plain sqrt(x² + y²): up to 2 ulps from Math.hypot (which guards
      // against overflow with extra steps). Identical everywhere is what counts.
      expect(ulps(hypot(x, y), Math.hypot(x, y))).toBeLessThanOrEqual(2);
    }
  });

  it("atan2 gets the quadrants and the zeros right", () => {
    for (const [y, x] of [[1, 1], [1, -1], [-1, -1], [-1, 1], [0, -1], [-0, -1], [0, 1], [-0, 1], [1, 0], [-1, 0]]) {
      expect(Object.is(atan2(y, x), Math.atan2(y, x))).toBe(true);
    }
  });

  it("handles the special values like Math does", () => {
    for (const x of [0, -0, NaN, Infinity, -Infinity, 1e-300, 710, -746, 1e6]) {
      expect(Object.is(DET.exp(x), Math.exp(x))).toBe(true);
    }
    expect(Object.is(sin(-0), -0)).toBe(true);
    expect(sin(Infinity)).toBeNaN();
    expect(cos(0)).toBe(1);
  });

  it("is a known function: sin(π/6) ≈ 0.5, exp(1) ≈ e", () => {
    expect(sin(Math.PI / 6)).toBeCloseTo(0.5, 15);
    expect(exp(1)).toBeCloseTo(Math.E, 15);
  });
});
