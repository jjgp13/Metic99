import { DOODLE, GAME } from "../config/constants";

/**
 * Draw a sheet of notebook paper (blue rules, red margin, faint grain) at
 * `scale` device px per logical px. Drawn once per canvas size and then
 * copied under every frame.
 */
export function drawPaper(scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(GAME.WIDTH * scale);
  canvas.height = Math.round(GAME.HEIGHT * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  ctx.fillStyle = DOODLE.PAPER;
  ctx.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);

  // Grain: tiny specks, darker or lighter than the paper.
  for (let i = 0; i < DOODLE.GRAIN_DOTS; i++) {
    const dark = Math.random() < 0.7;
    ctx.fillStyle = dark ? `rgba(90, 70, 40, ${0.04 + Math.random() * 0.06})` : "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(Math.random() * GAME.WIDTH, Math.random() * GAME.HEIGHT, 1 + Math.random(), 1 + Math.random());
  }

  ctx.lineWidth = 1;
  ctx.strokeStyle = DOODLE.RULE;
  for (let y = DOODLE.RULE_TOP; y < GAME.HEIGHT; y += DOODLE.RULE_GAP) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(GAME.WIDTH, y + 0.5);
    ctx.stroke();
  }

  ctx.strokeStyle = DOODLE.MARGIN;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(DOODLE.MARGIN_X, 0);
  ctx.lineTo(DOODLE.MARGIN_X, GAME.HEIGHT);
  ctx.stroke();

  // A soft shadow at the edges, so it reads as a sheet, not a flat color.
  const edge = ctx.createRadialGradient(
    GAME.WIDTH / 2,
    GAME.HEIGHT / 2,
    GAME.HEIGHT * 0.35,
    GAME.WIDTH / 2,
    GAME.HEIGHT / 2,
    GAME.HEIGHT * 0.75,
  );
  edge.addColorStop(0, "rgba(120, 100, 60, 0)");
  edge.addColorStop(1, "rgba(120, 100, 60, 0.14)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);
  return canvas;
}
