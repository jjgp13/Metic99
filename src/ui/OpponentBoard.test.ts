import { describe, expect, it } from "vitest";
import { BATTLE_BOARD as B } from "../config/constants";
import { layoutBoard } from "./OpponentBoard";

/** The canvas as Scale.FIT centers it in a window (480×720 portrait). */
function fit(w: number, h: number) {
  const scale = Math.min(w / 480, h / 720);
  const cw = 480 * scale;
  const ch = 720 * scale;
  const left = (w - cw) / 2;
  const top = (h - ch) / 2;
  return { left, right: left + cw, top, height: ch };
}

describe("layoutBoard", () => {
  for (const [w, h] of [
    [1920, 1080],
    [1280, 720],
  ]) {
    it(`fits beside the canvas at ${w}×${h} without covering it`, () => {
      const canvas = fit(w, h);
      const l = layoutBoard(canvas, w, 4);
      expect(l).not.toBeNull();
      if (!l) return;
      expect(l.leftX + l.tileW).toBeLessThanOrEqual(canvas.left - B.GAP);
      expect(l.leftX).toBeGreaterThanOrEqual(B.EDGE);
      expect(l.rightX).toBeGreaterThanOrEqual(canvas.right + B.GAP);
      expect(l.rightX + l.tileW).toBeLessThanOrEqual(w - B.EDGE);
      const columnH = 4 * l.tileH + 3 * B.GAP;
      expect(l.top).toBeGreaterThanOrEqual(canvas.top);
      expect(l.top + columnH).toBeLessThanOrEqual(canvas.top + canvas.height + 0.5);
    });
  }

  it("stays off on phones, portrait tablets and narrow windows", () => {
    for (const [w, h] of [
      [390, 844], // phone portrait
      [844, 390], // phone landscape: the canvas is too short
      [820, 1180], // tablet portrait
      [900, 720], // a narrow desktop window
    ]) {
      expect(layoutBoard(fit(w, h), w, 4)).toBeNull();
    }
  });
});
