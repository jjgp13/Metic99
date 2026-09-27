import { describe, expect, it } from "vitest";
import { DIGIT_SHAPES, DIGIT_TEMPLATES, arc, line } from "./digitTemplates";
import InkReader from "./inkReader";
import { isScratch, recognize, type Point, type Stroke } from "./recognizer";
import { TEST_SHAPES, distort, rng } from "./testShapes";

/** Move strokes (template box coords) to pad px: 0.9 scale, offset (ox, oy). */
const place = (strokes: Stroke[], ox: number, oy = 500): Stroke[] =>
  strokes.map((s) => s.map((p) => ({ x: ox + p.x * 0.9, y: oy + p.y * 0.9 })));

function drawAll(reader: InkReader, strokes: Stroke[]): void {
  for (const s of strokes) {
    reader.begin(s[0]);
    for (const p of s.slice(1)) reader.move(p);
    expect(reader.end()).toBeNull();
  }
}

describe("recognizer", () => {
  it("reads every template as its own digit", () => {
    for (const s of DIGIT_SHAPES) {
      expect(recognize(s.strokes, DIGIT_TEMPLATES).digit, s.name).toBe(s.digit);
    }
  });

  it("reads other styles through a shaky hand (≥ 93%)", () => {
    const rand = rng(1);
    let ok = 0;
    let total = 0;
    for (let rep = 0; rep < 30; rep++) {
      for (const s of TEST_SHAPES) {
        total++;
        if (recognize(distort(s.strokes, rand), DIGIT_TEMPLATES).digit === s.digit) ok++;
      }
    }
    expect(ok / total).toBeGreaterThanOrEqual(0.93);
  });

  it("ignores stroke direction and order", () => {
    const four: Stroke[] = [line(42, 0, 42, 100), [...line(40, 0, 4, 66), ...line(4, 66, 58, 66)].reverse()];
    expect(recognize(four, DIGIT_TEMPLATES).digit).toBe("4");
    expect(recognize([arc(30, 50, 24, 50, 270, -90)], DIGIT_TEMPLATES).digit).toBe("0");
  });

  it("answers null (\"?\") for ink unlike any digit", () => {
    const dash: Stroke[] = [line(0, 50, 60, 52)];
    expect(recognize(dash, DIGIT_TEMPLATES).digit).toBeNull();
  });
});

describe("scratch-out", () => {
  const zigzag = (legs: number, w = 120, h = 30): Stroke =>
    Array.from({ length: legs + 1 }, (_, i) => ({ x: i % 2 ? w : 0, y: (i / legs) * h }));

  it("detects a wide back-and-forth stroke", () => {
    expect(isScratch(zigzag(3))).toBe(true);
    expect(isScratch(zigzag(6))).toBe(true);
  });

  it("does not mistake digits for it", () => {
    for (const s of DIGIT_SHAPES) for (const st of s.strokes) expect(isScratch(st), s.name).toBe(false);
    expect(isScratch(zigzag(1))).toBe(false); // one there-and-back is not enough
    expect(isScratch(zigzag(4, 60, 60))).toBe(false); // not wide enough
  });
});

describe("InkReader", () => {
  const byName = (name: string) => DIGIT_SHAPES.find((s) => s.name === name)!.strokes;

  it("reads nothing until the pause runs out", () => {
    const reader = new InkReader();
    drawAll(reader, place(byName("7-plain"), 100));
    expect(reader.update(200)).toBeNull();
    expect(reader.update(150)).toEqual(expect.objectContaining({ type: "digits", digits: "7" }));
    expect(reader.ink).toHaveLength(0);
  });

  it("keeps a multi-stroke digit together (bar/stem drawn second)", () => {
    for (const name of ["4-closed", "4-open", "5-bar", "7-bar", "1-base"]) {
      const reader = new InkReader();
      drawAll(reader, place(byName(name), 100));
      expect(reader.ink, name).toHaveLength(1);
      expect(reader.read(), name).toEqual(expect.objectContaining({ digits: name[0] }));
    }
  });

  it("splits two digits written in one go, left to right", () => {
    const reader = new InkReader();
    drawAll(reader, [...place(byName("1-flag"), 80), ...place(byName("4-closed"), 140)]);
    expect(reader.ink).toHaveLength(2);
    const ev = reader.update(1000);
    expect(ev).toEqual(expect.objectContaining({ type: "digits", digits: "14" }));
  });

  it("splits digits written close together", () => {
    const rand = rng(5);
    let ok = 0;
    for (let rep = 0; rep < 40; rep++) {
      const reader = new InkReader();
      // Two ~55 px wide digits, centers 68 px apart: a ~13 px gap.
      const [a, b] = [TEST_SHAPES[5 + (rep % 6)], TEST_SHAPES[15 + (rep % 6)]];
      drawAll(reader, [...distort(a.strokes, rand, 100, 150, 560), ...distort(b.strokes, rand, 100, 218, 560)]);
      if (reader.ink.length === 2) ok++;
    }
    expect(ok).toBeGreaterThanOrEqual(38);
    const ones = new InkReader();
    drawAll(ones, [line(100, 520, 100, 610), line(122, 520, 120, 610)]);
    expect(ones.read()).toEqual(expect.objectContaining({ digits: "11" }));
  });

  it("reports unknown ink instead of guessing, and drops taps", () => {
    const reader = new InkReader();
    drawAll(reader, place([line(0, 50, 60, 52)], 100));
    expect(reader.read()).toEqual(expect.objectContaining({ type: "unknown" }));
    const tap: Point = { x: 200, y: 560 };
    reader.begin(tap);
    reader.move({ x: 202, y: 561 });
    reader.end();
    expect(reader.read()).toBeNull();
  });

  it("clears on a scratch-out right away", () => {
    const reader = new InkReader();
    drawAll(reader, place(byName("3-round"), 100));
    const s = [0, 1, 2, 3, 4].map((i) => ({ x: 100 + (i % 2) * 150, y: 520 + i * 8 }));
    reader.begin(s[0]);
    s.slice(1).forEach((p) => reader.move(p));
    expect(reader.end()).toEqual({ type: "scratch" });
    expect(reader.ink).toHaveLength(0);
  });
});
