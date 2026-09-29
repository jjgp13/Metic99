import { describe, expect, it } from "vitest";
import { BATTLE_BOARD as B } from "../config/constants";
import { layoutBoard, reserveWidth } from "./OpponentBoard";

/** The canvas as Scale.FIT centers it in a box `w` wide (480×720 portrait). */
function fit(w: number, h: number, box = w) {
  const scale = Math.min(box / 480, h / 720);
  const cw = 480 * scale;
  const ch = 720 * scale;
  const left = (w - cw) / 2;
  const top = (h - ch) / 2;
  return { left, right: left + cw, top, height: ch };
}

function expectBeside(canvas: ReturnType<typeof fit>, w: number, compact: boolean) {
  const l = layoutBoard(canvas, w, 4);
  expect(l).not.toBeNull();
  if (!l) return;
  expect(l.compact).toBe(compact);
  expect(l.leftX + l.tileW).toBeLessThanOrEqual(canvas.left - B.GAP);
  expect(l.leftX).toBeGreaterThanOrEqual(B.EDGE - 1);
  expect(l.rightX).toBeGreaterThanOrEqual(canvas.right + B.GAP);
  expect(l.rightX + l.tileW).toBeLessThanOrEqual(w - B.EDGE + 1);
  expect(l.fieldW).toBeLessThanOrEqual(l.tileW);
  const columnH = 4 * l.tileH + 3 * B.GAP;
  expect(l.top).toBeGreaterThanOrEqual(canvas.top - 0.5);
  expect(l.top + columnH).toBeLessThanOrEqual(canvas.top + canvas.height + 0.5);
}

describe("layoutBoard", () => {
  it("shows full tiles beside the canvas on desktop screens", () => {
    for (const [w, h] of [
      [1920, 1080],
      [1280, 720],
      [1150, 850],
    ]) {
      expect(reserveWidth(w, h)).toBeNull();
      expectBeside(fit(w, h), w, false);
    }
  });

  it("shows compact tiles in narrower windows (e.g. an Artifact panel)", () => {
    for (const [w, h] of [
      [1000, 800],
      [900, 760],
      [860, 700],
    ]) {
      expect(reserveWidth(w, h)).toBeNull();
      expectBeside(fit(w, h), w, true);
    }
  });

  it("shrinks the game a little to make room in a nearly square window", () => {
    const [w, h] = [760, 740];
    expect(layoutBoard(fit(w, h), w, 4)).toBeNull();
    const box = reserveWidth(w, h);
    expect(box).not.toBeNull();
    expectBeside(fit(w, h, box!), w, true);
  });

  it("stays off on phones and portrait tablets", () => {
    for (const [w, h] of [
      [390, 844], // phone portrait
      [844, 390], // phone landscape: the canvas is too short
      [820, 1180], // tablet portrait
    ]) {
      expect(layoutBoard(fit(w, h), w, 4)).toBeNull();
      expect(reserveWidth(w, h)).toBeNull();
    }
  });
});
