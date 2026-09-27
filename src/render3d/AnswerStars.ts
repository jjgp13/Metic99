import * as THREE from "three";
import { GAME, RENDER3D } from "../config/constants";

export type AnswerState = "typing" | "match" | "wrong";

/** The number to spell in stars and how it reads (see GameScene.answerView). */
export interface AnswerView {
  text: string;
  state: AnswerState;
}

/** A point in logical px (the drawing pad's ink). */
export interface InkPoint {
  x: number;
  y: number;
}

const S = RENDER3D.ANSWER_STARS;

/**
 * A pool of background stars that gather into the typed answer, far behind the
 * field. Idle, they drift like the rest of the starfield; when a number is
 * typed the nearest ones fly into its digit shapes (glyph points are sampled
 * once, up front, so forming a number costs nothing). A solved answer bursts
 * outward, a wrong one scatters, and released stars fade back to plain stars.
 */
export default class AnswerStars {
  public readonly points: THREE.Points;

  private readonly n = S.COUNT;
  private readonly pos: Float32Array;
  private readonly color: Float32Array;
  private readonly size: Float32Array;
  /** Each star's own idle color, and the color it glows while formed/released. */
  private readonly base: Float32Array;
  private readonly tint: Float32Array;
  /** 0 = plain star, 1 = fully part of the number. */
  private readonly heat: Float32Array;
  private readonly vel: Float32Array;
  private readonly target: Float32Array;
  private readonly formed: Uint8Array;
  private readonly material: THREE.ShaderMaterial;

  /** Glyph points per digit, in logical px around the digit's center. */
  private readonly glyphs: Array<Array<[number, number]>>;
  /** World units per logical px at the pool's depth. */
  private readonly scale: number;
  private readonly halfW: number;
  private readonly halfH: number;

  private text: string | null = null;
  private state: AnswerState = "typing";
  /** Brightness kick on a match, decays to 0. */
  private pulse = 0;
  /** Handwritten ink for the next `text` to form: digit k's stars start on
   * inks[k]. Only good for the frame it was given in. */
  private ink: { text: string; inks: ReadonlyArray<readonly InkPoint[] | null> } | null = null;

  constructor(cameraZ: number) {
    this.scale = (cameraZ - S.Z) / cameraZ;
    this.halfW = (GAME.WIDTH / 2) * this.scale;
    this.halfH = (GAME.HEIGHT / 2) * this.scale;
    this.glyphs = Array.from({ length: 10 }, (_, d) => sampleGlyph(String(d)));

    const n = this.n;
    this.pos = new Float32Array(n * 3);
    this.color = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.base = new Float32Array(n * 3);
    this.tint = new Float32Array(n * 3);
    this.heat = new Float32Array(n);
    this.vel = new Float32Array(n * 2);
    this.target = new Float32Array(n * 2);
    this.formed = new Uint8Array(n);

    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      c.setHSL(0.6 + Math.random() * 0.1, 0.5, 0.6 + Math.random() * 0.4);
      this.base.set([c.r, c.g, c.b], i * 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.color, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(this.size, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec3 color;
        uniform float uScale;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(vColor * smoothstep(0.5, 0.15, d), 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.reset();
  }

  /** Scatter every star back to a plain, drifting star (start of a run). */
  public reset(): void {
    for (let i = 0; i < this.n; i++) {
      this.pos[i * 3] = THREE.MathUtils.randFloatSpread(this.halfW * 2);
      this.pos[i * 3 + 1] = THREE.MathUtils.randFloatSpread(this.halfH * 2);
      this.pos[i * 3 + 2] = S.Z;
      this.heat[i] = 0;
      this.formed[i] = 0;
      this.vel[i * 2] = this.vel[i * 2 + 1] = 0;
    }
    this.text = null;
    this.pulse = 0;
  }

  /** The answer `text` was solved: burst its stars outward in gold. */
  public solved(text: string): void {
    if (this.text !== text) return;
    this.release(S.BURST_SPEED, S.COLORS.match);
    this.text = null;
  }

  /**
   * `text` is about to show because it was drawn: the stars of each digit with
   * ink start ON that ink (logical px) and fly up into the clean digit, so the
   * player sees what the recognizer read.
   */
  public fromInk(text: string, inks: ReadonlyArray<readonly InkPoint[] | null>): void {
    this.ink = { text, inks };
  }

  /** `pixelScale` = drawing-buffer height / 2 (like PointsMaterial's size). */
  public update(answer: AnswerView | null, dt: number, pixelScale: number): void {
    this.material.uniforms.uScale.value = pixelScale;
    const text = answer?.text ?? null;
    if (text !== this.text) {
      if (text === null) {
        if (this.state === "wrong") this.release(S.SCATTER_SPEED, S.COLORS.wrong);
        else this.release(null, null);
      } else {
        this.form(text, this.ink?.text === text ? this.ink.inks : []);
      }
      this.text = text;
    }
    this.ink = null;
    if (answer && answer.state !== this.state) {
      if (answer.state === "match") this.pulse = 1;
    }
    if (answer) this.state = answer.state;
    this.step(dt);
  }

  // ---------------------------------------------------------------------------

  /**
   * Send the nearest stars to the digits of `text`; the rest are released.
   * Digits with ink (`inks[k]`) take their stars from the pool and start them
   * on the ink instead, each on the ink point that matches its glyph point.
   */
  private form(text: string, inks: ReadonlyArray<readonly InkPoint[] | null>): void {
    const perDigit: Array<Array<[number, number]>> = [];
    const first = -((text.length - 1) * S.DIGIT_ADVANCE) / 2;
    [...text].forEach((ch, k) => {
      const cx = GAME.WIDTH / 2 + first + k * S.DIGIT_ADVANCE;
      perDigit.push(
        (this.glyphs[Number(ch)] ?? []).map(([x, y]): [number, number] => [
          (cx + x - GAME.WIDTH / 2) * this.scale,
          (GAME.HEIGHT / 2 - S.CENTER_Y - y) * this.scale,
        ]),
      );
    });
    const taken = new Uint8Array(this.n);
    const assign = (i: number, [tx, ty]: [number, number]) => {
      taken[i] = 1;
      this.target[i * 2] = tx;
      this.target[i * 2 + 1] = ty;
      this.vel[i * 2] = this.vel[i * 2 + 1] = 0;
    };

    // Greedy nearest in random order: stars already in a shape mostly stay
    // near it (typing "1" then "12"), and the newcomers come from close by.
    const targets = perDigit.filter((_, k) => !inks[k]?.length).flat();
    shuffle(targets);
    for (const t of targets) {
      const best = this.nearestFree(taken, t[0], t[1]);
      if (best < 0) break;
      assign(best, t);
    }

    perDigit.forEach((glyph, k) => {
      const ink = inks[k];
      if (!ink?.length) return;
      const from = matchShapes(sampleEvenly(ink, glyph.length), glyph);
      glyph.forEach((t, j) => {
        const [lx, ly] = from[j];
        const wx = (lx - GAME.WIDTH / 2) * this.scale;
        const wy = (GAME.HEIGHT / 2 - ly) * this.scale;
        const i = this.nearestFree(taken, wx, wy);
        if (i < 0) return;
        this.pos[i * 3] = wx;
        this.pos[i * 3 + 1] = wy;
        this.heat[i] = 1; // lit from the start: the ink itself turns to stars
        assign(i, t);
      });
    });
    for (let i = 0; i < this.n; i++) this.formed[i] = taken[i];
  }

  private nearestFree(taken: Uint8Array, x: number, y: number): number {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.n; i++) {
      if (taken[i]) continue;
      const dx = this.pos[i * 3] - x;
      const dy = this.pos[i * 3 + 1] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** Let the formed stars go: flung outward at `speed` (tinted `hex`), or just left to fade. */
  private release(speed: { min: number; max: number } | null, hex: number | null): void {
    let cx = 0;
    let cy = 0;
    let count = 0;
    for (let i = 0; i < this.n; i++) {
      if (!this.formed[i]) continue;
      cx += this.pos[i * 3];
      cy += this.pos[i * 3 + 1];
      count++;
    }
    if (!count) return;
    cx /= count;
    cy /= count;
    const c = hex === null ? null : new THREE.Color(hex);
    for (let i = 0; i < this.n; i++) {
      if (!this.formed[i]) continue;
      this.formed[i] = 0;
      if (c) this.tint.set([c.r * S.BRIGHTNESS, c.g * S.BRIGHTNESS, c.b * S.BRIGHTNESS], i * 3);
      if (!speed) continue;
      const a = Math.atan2(this.pos[i * 3 + 1] - cy, this.pos[i * 3] - cx) + THREE.MathUtils.randFloatSpread(0.6);
      const v = THREE.MathUtils.randFloat(speed.min, speed.max);
      this.vel[i * 2] = Math.cos(a) * v;
      this.vel[i * 2 + 1] = Math.sin(a) * v;
    }
  }

  private step(dt: number): void {
    const gather = Math.min(1, S.GATHER_RATE * dt);
    const drag = Math.max(0, 1 - 2.5 * dt);
    const fade = Math.min(1, S.FADE_RATE * dt);
    this.pulse = Math.max(0, this.pulse - dt * 4);
    const glow = new THREE.Color(S.COLORS[this.state]);
    const bright = S.BRIGHTNESS * (1 + 0.8 * this.pulse);
    const formedSize = S.SIZE_FORMED * (1 + 0.4 * this.pulse);

    for (let i = 0; i < this.n; i++) {
      const p = i * 3;
      if (this.formed[i]) {
        this.pos[p] += (this.target[i * 2] - this.pos[p]) * gather;
        this.pos[p + 1] += (this.target[i * 2 + 1] - this.pos[p + 1]) * gather;
        this.heat[i] += (1 - this.heat[i]) * gather;
        this.tint.set([glow.r * bright, glow.g * bright, glow.b * bright], p);
      } else {
        this.vel[i * 2] *= drag;
        this.vel[i * 2 + 1] *= drag;
        let x = this.pos[p] + this.vel[i * 2] * dt;
        let y = this.pos[p + 1] + (this.vel[i * 2 + 1] - RENDER3D.STAR_DRIFT) * dt;
        if (y < -this.halfH) y += this.halfH * 2;
        else if (y > this.halfH) y -= this.halfH * 2;
        if (x < -this.halfW) x += this.halfW * 2;
        else if (x > this.halfW) x -= this.halfW * 2;
        this.pos[p] = x;
        this.pos[p + 1] = y;
        this.heat[i] -= this.heat[i] * fade;
      }
      const h = this.heat[i];
      for (let k = 0; k < 3; k++) this.color[p + k] = this.base[p + k] + (this.tint[p + k] - this.base[p + k]) * h;
      this.size[i] = S.SIZE_IDLE + ((this.formed[i] ? formedSize : S.SIZE_FORMED) - S.SIZE_IDLE) * h;
    }
    const geo = this.points.geometry;
    geo.getAttribute("position").needsUpdate = true;
    geo.getAttribute("color").needsUpdate = true;
    geo.getAttribute("size").needsUpdate = true;
  }
}

/**
 * Points covering one digit, drawn once on a canvas and sampled on a grid, in
 * logical px around the glyph's visual center. Randomly thinned to
 * MAX_PER_DIGIT so every digit costs about the same number of stars.
 */
function sampleGlyph(ch: string): Array<[number, number]> {
  const h = S.DIGIT_H;
  const w = Math.ceil(h * 0.9);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = Math.ceil(h * 1.3);
  const ctx = canvas.getContext("2d")!;
  ctx.font = `bold ${h}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(ch, w / 2, canvas.height / 2);
  const { data } = ctx.getImageData(0, 0, w, canvas.height);

  const pts: Array<[number, number]> = [];
  const step = S.SAMPLE_PX;
  for (let y = step / 2; y < canvas.height; y += step) {
    for (let x = step / 2; x < w; x += step) {
      if (data[(Math.floor(y) * w + Math.floor(x)) * 4 + 3] > 128) pts.push([x, y]);
    }
  }
  if (!pts.length) return pts;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  // Stretch to DIGIT_H tall (the font's glyph is shorter than its size).
  const k = h / Math.max(1, Math.max(...ys) - Math.min(...ys));
  const jitter = step * 0.3;
  const out = pts.map(([x, y]): [number, number] => [
    (x - cx) * k + THREE.MathUtils.randFloatSpread(jitter),
    (y - cy) * k + THREE.MathUtils.randFloatSpread(jitter),
  ]);
  shuffle(out);
  return out.slice(0, S.MAX_PER_DIGIT);
}

/** `count` points spread evenly (by index) over the ink, as [x, y]. */
function sampleEvenly(ink: readonly InkPoint[], count: number): Array<[number, number]> {
  return Array.from({ length: count }, (_, j) => {
    const p = ink[Math.round((j / Math.max(1, count - 1)) * (ink.length - 1))];
    return [p.x, p.y];
  });
}

/**
 * For each glyph point, the ink point in the same place once both shapes are
 * scaled to a unit box (greedy nearest, each ink point used once), so the ink
 * morphs into the digit instead of scrambling. Glyph y is up, ink y is down.
 */
function matchShapes(ink: Array<[number, number]>, glyph: Array<[number, number]>): Array<[number, number]> {
  const unit = (pts: Array<[number, number]>, flipY: boolean) => {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => (flipY ? -p[1] : p[1]));
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const w = Math.max(1e-6, Math.max(...xs) - x0);
    const h = Math.max(1e-6, Math.max(...ys) - y0);
    return pts.map((_, i): [number, number] => [(xs[i] - x0) / w, (ys[i] - y0) / h]);
  };
  const a = unit(ink, false);
  const b = unit(glyph, true);
  const used = new Uint8Array(ink.length);
  return b.map(([gx, gy]) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < a.length; i++) {
      if (used[i]) continue;
      const d = (a[i][0] - gx) ** 2 + (a[i][1] - gy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    used[best] = 1;
    return ink[best];
  });
}

/** In-place Fisher–Yates shuffle. */
function shuffle<T>(a: T[]): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
