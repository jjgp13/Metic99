import rough from "roughjs";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { Drawable } from "roughjs/bin/core";
import { DOODLE, ENEMY, GAME, MODEL_BOXES, PLAYER, RECOVERY } from "../config/constants";
import type Alien from "../objects/Alien";
import { Shielded } from "../objects/abilities";
import type { AnswerView, InkPoint } from "../render3d/AnswerStars";
import type { WorldSnapshot } from "../render3d/World3D";
import { drawPaper } from "./paper";
import { drawFrames, type DoodleRecipe, type Point } from "./pencil";
import * as R from "./recipes";

/** What the view remembers about one alien between frames (looks only). */
interface AlienLook {
  /** Offsets this alien's boil and sway, so the swarm doesn't move in sync. */
  phase: number;
  lastX: number;
  /** Lean into sideways moves (radians). */
  tilt: number;
  sumVersion: number;
  /** ms left of the "new sum" pop-in. */
  popLeft: number;
}

/** A scribble burst where an alien died (or the ship blew up). */
interface Burst {
  x: number;
  y: number;
  radius: number;
  age: number;
  shapes: Drawable[];
  word: string;
  specks: { x: number; y: number; vx: number; vy: number }[];
}

/** A word written next to the ship when it's hit ("ouch!"), floating up. */
interface ShipWord {
  text: string;
  x: number;
  age: number;
}

/** One half of the destroyed ship, tumbling off the page. */
interface ShipPiece {
  /** -1 = left half, +1 = right half. */
  side: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
}

/** The answer that was just solved, fading out with a tick. */
interface Solved {
  text: string;
  age: number;
}

const KIND_RECIPES: Record<string, DoodleRecipe> = {
  darter: R.DARTER,
  lumberer: R.LUMBERER,
  strafer: R.STRAFER,
  swooper: R.SWOOPER,
  drifter: R.DRIFTER,
};

const isShieldUp = (a: Alien) => a.ability instanceof Shielded && a.ability.shieldUp;
/** Visual-only randomness (allowed: it never touches the rules). */
const randomSeed = () => 1 + Math.floor(Math.random() * 2 ** 30);

/**
 * The doodle view of the playfield (the default art): pencil drawings on a
 * sheet of notebook paper, on a 2D canvas *under* Phaser's transparent one
 * (where World3D's canvas would be). Like World3D it only reads the
 * snapshot, so the rules and the HUD don't change.
 *
 * Every doodle is drawn up front in a few wobble variants (pencil.ts); the
 * frames go round BOIL_FPS times a second, which gives the hand-drawn shimmer
 * ("line boil") while play itself just copies pictures, cheap on phones.
 */
export default class DoodleWorld {
  public readonly drawsTarget = true;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly rc: RoughCanvas;
  private phaserCanvas: HTMLCanvasElement | null = null;
  private lastRect = "";
  /** Device px per logical px of the screen canvas. */
  private scale = 1;
  /** Scale the cached doodles were drawn at (redrawn if the screen changes a lot). */
  private spriteScale = 0;
  private paper: HTMLCanvasElement | null = null;
  private readonly sprites = new Map<string, HTMLCanvasElement[]>();

  private readonly looks = new Map<Alien, AlienLook>();
  private bursts: Burst[] = [];
  private solved: Solved | null = null;
  private target: Alien | null = null;
  private targetAge = 0;
  private shipTilt = 0;
  private shipModel = "ship_player";
  /** Last frame's `shipHurt`, to notice the moment of a hit. */
  private lastHurt = 0;
  private kickLeft = 0;
  private shipWords: ShipWord[] = [];
  /** Set once the ship is destroyed: its halves, and how long ago. */
  private wreck: { pieces: ShipPiece[]; age: number } | null = null;
  private shakeLeft = 0;
  private shakeIntensity = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    const c = this.canvas;
    c.style.position = "fixed";
    c.style.pointerEvents = "none";
    c.style.zIndex = "0";
    c.style.display = "none";
    document.body.appendChild(c);
    this.ctx = c.getContext("2d")!;
    this.rc = rough.canvas(c);
  }

  /** Start drawing a run, aligned under Phaser's canvas. */
  public begin(phaserCanvas: HTMLCanvasElement, shipModel: string): void {
    this.phaserCanvas = phaserCanvas;
    this.shipModel = shipModel;
    this.lastHurt = 0;
    this.kickLeft = 0;
    this.shipWords = [];
    this.wreck = null;
    this.looks.clear();
    this.bursts = [];
    this.solved = null;
    this.target = null;
    this.lastRect = "";
    this.canvas.style.display = "block";
  }

  public end(): void {
    this.looks.clear();
    this.bursts = [];
    this.canvas.style.display = "none";
  }

  public render(s: WorldSnapshot, time: number, delta: number): void {
    this.syncCanvasRect();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.paper) ctx.drawImage(this.paper, 0, 0);

    let dx = 0;
    let dy = 0;
    if (this.shakeLeft > 0) {
      this.shakeLeft -= delta;
      const m = this.shakeIntensity * GAME.WIDTH;
      dx = (Math.random() * 2 - 1) * m;
      dy = (Math.random() * 2 - 1) * m;
    }
    ctx.setTransform(this.scale, 0, 0, this.scale, dx * this.scale, dy * this.scale);
    const boil = Math.floor((time / 1000) * DOODLE.BOIL_FPS);

    // Back to front; the number balls go last, so nothing ever covers a sum.
    this.drawAnswer(s.answer, delta);
    const aliens = s.aliensHidden ? [] : s.aliens.filter((a) => a.active);
    this.drawAliens(aliens, s.alpha, boil, delta);
    this.drawTarget(s, boil, delta);
    this.drawBullets(s, boil);
    this.drawShip(s, time, boil, delta);
    this.drawBursts(delta);
    this.drawShipWords(delta);
    for (const a of aliens) this.drawBalls(a, s.alpha, boil, delta);
  }

  /** Burst into a pencil scribble at logical (x, y). */
  public explode(x: number, y: number, alien?: Alien): void {
    const ink = alien ? this.inkFor(alien) : DOODLE.INK.darter;
    this.addBurst(x, y, ink, DOODLE.BURST_RADIUS, DOODLE.BURST_WORDS);
  }

  private addBurst(x: number, y: number, ink: string, r: number, words: readonly string[]): void {
    const gen = this.rc.generator;
    const star: Point[] = [];
    const spin = Math.random() * Math.PI;
    for (let i = 0; i < 16; i++) {
      const a = spin + (i / 16) * Math.PI * 2;
      const rr = i % 2 ? r * 0.45 : r * (0.8 + Math.random() * 0.3);
      star.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    const shapes = [
      gen.polygon(star, {
        seed: randomSeed(),
        stroke: DOODLE.GRAPHITE,
        strokeWidth: 1.4,
        fill: ink,
        fillStyle: "zigzag",
        hachureGap: 3,
        roughness: 1.6,
      }),
    ];
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = r * 1.05;
      const r1 = r * (1.4 + Math.random() * 0.4);
      shapes.push(
        gen.line(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1, {
          seed: randomSeed(),
          stroke: DOODLE.GRAPHITE,
          strokeWidth: 1.3,
        }),
      );
    }
    const specks = Array.from({ length: DOODLE.BURST_SPECKS }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 120;
      return { x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v };
    });
    this.bursts.push({ x, y, radius: r, age: 0, shapes, word: pick(words), specks });
  }

  public answerSolved(text: string): void {
    this.solved = { text, age: 0 };
  }

  /** The pad's own ink already fades in place; nothing to add on paper. */
  public answerInk(_text: string, _inks: ReadonlyArray<readonly InkPoint[] | null>): void {}

  public shake(durationMs: number, intensity: number): void {
    this.shakeLeft = durationMs;
    this.shakeIntensity = intensity;
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  /** Bodies, then the rings around them (shield, sent by another player). */
  private drawAliens(aliens: readonly Alien[], alpha: number, boil: number, delta: number): void {
    const ctx = this.ctx;
    const dt = delta / 1000;
    for (const a of aliens) {
      const look = this.lookFor(a);
      const x = a.viewX(alpha);
      const y = a.viewY(alpha);
      if (dt > 0) {
        const lean = Math.max(-0.3, Math.min(0.3, ((x - look.lastX) / dt) * 0.004));
        look.tilt += (lean - look.tilt) * Math.min(1, dt * 8);
      }
      look.lastX = x;
      const sway = Math.sin(performance.now() / 500 + look.phase) * 0.05;
      const jitter = a.mode === "windup" ? (Math.random() * 2 - 1) * 1.5 : 0;
      ctx.save();
      ctx.translate(x + jitter, y);
      ctx.rotate(look.tilt + sway);
      this.drawSprite(this.alienKey(a), () => this.alienRecipe(a), boil + look.phase);
      ctx.restore();
    }
    for (const a of aliens) {
      const look = this.lookFor(a);
      const x = a.viewX(alpha);
      const y = a.viewY(alpha);
      const midY = y + (a.bottom - a.top) / 2;
      if (isShieldUp(a)) {
        const d = Math.round(a.halfW * 2);
        this.drawAt(`shield:${d}`, () => R.loop(d, d, DOODLE.SHIELD, 2), boil + look.phase, x, y);
      }
      if (a.sentBy !== null) {
        const w = Math.round(a.halfW * 2 + 10);
        const h = Math.round(a.top + a.bottom + 10);
        this.drawAt(`sent:${w}:${h}`, () => R.loop(w, h, DOODLE.SENT, 1.6), boil + look.phase + 3, x, midY);
      }
    }
    for (const a of this.looks.keys()) if (!aliens.includes(a)) this.looks.delete(a);
  }

  /** The lock-on mark: a gold marker loop around the target, snapping in. */
  private drawTarget(s: WorldSnapshot, boil: number, delta: number): void {
    const a = s.target;
    if (a !== this.target) {
      this.target = a;
      this.targetAge = 0;
    }
    if (!a) return;
    this.targetAge += delta;
    const snapped = Math.min(1, this.targetAge / DOODLE.TARGET_SNAP_MS);
    const grow = 1 + 0.5 * (1 - snapped) ** 2;
    const w = Math.round(a.halfW * 2 + 18);
    const h = Math.round(a.top + a.bottom + 16);
    const y = a.viewY(s.alpha) + (a.bottom - a.top) / 2;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.6 * snapped;
    ctx.translate(a.viewX(s.alpha), y);
    ctx.scale(grow, grow);
    this.drawSprite(`target:${w}:${h}`, () => R.loop(w, h, DOODLE.TARGET, 2.6), boil);
    ctx.restore();
  }

  private drawBalls(a: Alien, alpha: number, boil: number, delta: number): void {
    const ctx = this.ctx;
    const look = this.lookFor(a);
    if (look.sumVersion !== a.sumVersion) {
      look.sumVersion = a.sumVersion;
      look.popLeft = DOODLE.BALL_POP_MS;
    }
    look.popLeft = Math.max(0, look.popLeft - delta);
    const pop = 1 + 0.5 * (look.popLeft / DOODLE.BALL_POP_MS);
    const ring = DOODLE.BALL_RING[a.ballTexture] ?? DOODLE.BALL_RING.blueBalls;
    const cover = a.ability?.cover ?? 0;
    const r = ENEMY.BALL_RADIUS;
    const rowY = a.viewY(alpha) - (a.top - r);
    const n = a.digits.length;

    ctx.font = `${DOODLE.BALL_FONT_PX}px "${DOODLE.FONT}", cursive`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      const bx = a.viewX(alpha) + (i - (n - 1) / 2) * ENEMY.BALL_SPACING;
      ctx.save();
      ctx.translate(bx, rowY);
      ctx.scale(pop, pop);
      this.drawSprite(`ball:${a.ballTexture}`, () => R.ballRing(ring), boil + look.phase + i);
      ctx.fillStyle = DOODLE.BALL_INK;
      ctx.fillText(String(a.digits[i]), 0, 1);
      if (cover > 0) {
        // The Blinker's eyelid: pencil shading pulled down over the digit.
        ctx.beginPath();
        ctx.arc(0, 0, r + 0.5, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = DOODLE.GRAPHITE_LIGHT;
        ctx.fillRect(-r - 1, -r - 1, 2 * r + 2, (2 * r + 2) * cover);
        ctx.strokeStyle = DOODLE.GRAPHITE;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-r, -r - 1 + (2 * r + 2) * cover);
        ctx.lineTo(r, -r - 1 + (2 * r + 2) * cover);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawBullets(s: WorldSnapshot, boil: number): void {
    for (const b of s.bullets) {
      if (!b.active) continue;
      this.drawAt("bullet", () => R.BULLET, boil, b.x, b.prevY + (b.y - b.prevY) * s.alpha);
    }
  }

  /**
   * The ship: leaning toward its target; knocked down, blinking and dazed
   * (stars circling) while the field is frozen after a hit; snapped in two
   * once the last life is gone.
   */
  private drawShip(s: WorldSnapshot, time: number, boil: number, delta: number): void {
    if (s.shipDown) return this.drawWreck(s.shipX, delta);
    if (s.shipHurt > this.lastHurt + 0.01) this.onShipHit(s.shipX);
    this.lastHurt = s.shipHurt;

    const lean =
      s.shipTargetX === null ? 0 : Math.max(-1, Math.min(1, (s.shipTargetX - s.shipX) / 60)) * 0.25;
    this.shipTilt += (lean - this.shipTilt) * Math.min(1, (delta / 1000) * 10);
    this.kickLeft = Math.max(0, this.kickLeft - delta);
    // Knocked down at once, then springs back (ease out).
    const kick = DOODLE.HURT_KICK_PX * (this.kickLeft / DOODLE.HURT_KICK_MS) ** 2;
    const blinkOff = s.shipHurt > 0 && Math.floor((time / 1000) * DOODLE.HURT_BLINK_HZ * 2) % 2 === 1;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = blinkOff ? 0.3 : 1;
    ctx.translate(s.shipX, PLAYER.Y + kick);
    ctx.rotate(this.shipTilt + (kick / DOODLE.HURT_KICK_PX) * 0.3);
    this.drawSprite(this.shipKey(), () => this.shipRecipe(), boil);
    ctx.restore();
    if (s.shipHurt > 0) this.drawDizzy(s.shipX, time, s.shipHurt, boil);
    if (s.shipShield) this.drawAt("shipShield", () => R.loop(52, 52, DOODLE.SHIP_SHIELD, 2.2), boil, s.shipX, PLAYER.Y);
  }

  private onShipHit(x: number): void {
    this.kickLeft = DOODLE.HURT_KICK_MS;
    this.shipWords.push({ text: pick(DOODLE.HURT_WORDS), x: x + 26, age: 0 });
  }

  /** Cartoon stars circling above the dazed ship; they fade out at the end. */
  private drawDizzy(x: number, time: number, hurt: number, boil: number): void {
    const ctx = this.ctx;
    const n = DOODLE.DIZZY_STARS;
    const turn = (time / 1000) * DOODLE.DIZZY_TURNS_PER_S * Math.PI * 2;
    ctx.save();
    ctx.globalAlpha = Math.min(1, hurt * 5);
    for (let i = 0; i < n; i++) {
      const a = turn + (i / n) * Math.PI * 2;
      const sx = x + Math.cos(a) * DOODLE.DIZZY_RADIUS;
      const sy = PLAYER.Y - 30 + Math.sin(a) * DOODLE.DIZZY_RADIUS * 0.3;
      this.drawAt("dizzy", () => R.DIZZY_STAR, boil + i, sx, sy);
    }
    ctx.restore();
  }

  /** The destroyed ship: a big burst, then its two halves tumble down. */
  private drawWreck(x: number, delta: number): void {
    if (!this.wreck) {
      this.addBurst(x, PLAYER.Y, DOODLE.INK.flame, DOODLE.DOWN_BURST_RADIUS, DOODLE.DOWN_WORDS);
      this.shake(400, 0.02);
      const v = DOODLE.DOWN_PIECE_SPEED;
      this.wreck = {
        age: 0,
        pieces: [-1, 1].map((side) => ({
          side,
          x,
          y: PLAYER.Y,
          vx: side * v * (0.8 + Math.random() * 0.4),
          vy: -v * (1 + Math.random() * 0.5),
          angle: this.shipTilt,
          spin: side * DOODLE.DOWN_PIECE_SPIN * (0.7 + Math.random() * 0.6),
        })),
      };
    }
    const w = this.wreck;
    const dt = delta / 1000;
    w.age += delta;
    const recipe = this.shipRecipe();
    const ctx = this.ctx;
    for (const p of w.pieces) {
      p.vy += DOODLE.DOWN_GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - w.age / RECOVERY.GAME_OVER_DELAY_MS);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      // Keep only this piece's half of the doodle.
      ctx.beginPath();
      ctx.rect(p.side < 0 ? -recipe.w / 2 : 0, -recipe.h / 2, recipe.w / 2, recipe.h);
      ctx.clip();
      this.drawSprite(this.shipKey(), () => recipe, 0);
      ctx.restore();
    }
  }

  /** "ouch!" next to the ship, floating up and fading. */
  private drawShipWords(delta: number): void {
    const ctx = this.ctx;
    const life = DOODLE.BURST_MS * 1.5;
    ctx.font = `22px "${DOODLE.FONT}", cursive`;
    ctx.textAlign = "center";
    ctx.fillStyle = DOODLE.ANSWER_COLOR.wrong;
    for (const w of this.shipWords) {
      w.age += delta;
      const k = w.age / life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillText(w.text, w.x, PLAYER.Y - 26 - 24 * k);
      ctx.restore();
    }
    this.shipWords = this.shipWords.filter((w) => w.age < life);
  }

  /** The typed answer, written big and faint on the paper behind the field. */
  private drawAnswer(answer: AnswerView | null, delta: number): void {
    const ctx = this.ctx;
    const x = GAME.WIDTH / 2;
    const y = DOODLE.ANSWER_Y;
    ctx.font = `${DOODLE.ANSWER_FONT_PX}px "${DOODLE.FONT}", cursive`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (this.solved) {
      this.solved.age += delta;
      const k = this.solved.age / DOODLE.SOLVED_MS;
      if (k >= 1) this.solved = null;
      else if (!answer || answer.text !== this.solved.text) {
        ctx.save();
        ctx.globalAlpha = DOODLE.ANSWER_ALPHA.match * (1 - k);
        ctx.fillStyle = DOODLE.ANSWER_COLOR.match;
        ctx.fillText(this.solved.text, x, y);
        // A teacher's tick, drawn in as it fades.
        const w = ctx.measureText(this.solved.text).width / 2;
        ctx.strokeStyle = DOODLE.GRAPHITE;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x + w + 6, y);
        ctx.lineTo(x + w + 18, y + 16);
        ctx.lineTo(x + w + 18 + 26 * Math.min(1, k * 3), y + 16 - 40 * Math.min(1, k * 3));
        ctx.stroke();
        ctx.restore();
      }
    }
    if (!answer) return;
    ctx.save();
    ctx.globalAlpha = DOODLE.ANSWER_ALPHA[answer.state];
    ctx.fillStyle = DOODLE.ANSWER_COLOR[answer.state];
    ctx.fillText(answer.text, x, y);
    if (answer.state === "wrong") {
      // Crossed out.
      const w = ctx.measureText(answer.text).width / 2 + 10;
      ctx.strokeStyle = DOODLE.ANSWER_COLOR.wrong;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x - w, y + 30);
      ctx.lineTo(x + w, y - 34);
      ctx.moveTo(x - w, y - 30);
      ctx.lineTo(x + w, y + 32);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBursts(delta: number): void {
    const ctx = this.ctx;
    const dt = delta / 1000;
    for (const b of this.bursts) {
      b.age += delta;
      const k = Math.min(1, b.age / DOODLE.BURST_MS);
      const grow = 0.55 + 0.6 * (1 - (1 - k) ** 3);
      ctx.save();
      ctx.globalAlpha = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
      ctx.translate(b.x, b.y);
      ctx.save();
      ctx.scale(grow, grow);
      for (const shape of b.shapes) this.rc.draw(shape);
      ctx.restore();
      ctx.fillStyle = DOODLE.GRAPHITE;
      for (const sp of b.specks) {
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        ctx.fillRect(sp.x, sp.y, 1.6, 1.6);
      }
      ctx.font = `18px "${DOODLE.FONT}", cursive`;
      ctx.textAlign = "center";
      ctx.fillText(b.word, 0, -b.radius * grow - 10 - 10 * k);
      ctx.restore();
    }
    this.bursts = this.bursts.filter((b) => b.age < DOODLE.BURST_MS);
  }

  // ---------------------------------------------------------------------------
  // Doodle frames and canvas
  // ---------------------------------------------------------------------------

  /** Draw frame `tick` of a cached doodle centered on the current origin. */
  private drawSprite(key: string, recipe: () => DoodleRecipe, tick: number): void {
    let frames = this.sprites.get(key);
    if (!frames) {
      frames = drawFrames(recipe(), this.spriteScale, DOODLE.BOIL_FRAMES, hash(key));
      this.sprites.set(key, frames);
    }
    const frame = frames[((tick % frames.length) + frames.length) % frames.length];
    const w = frame.width / this.spriteScale;
    const h = frame.height / this.spriteScale;
    this.ctx.drawImage(frame, -w / 2, -h / 2, w, h);
  }

  private drawAt(key: string, recipe: () => DoodleRecipe, tick: number, x: number, y: number): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.drawSprite(key, recipe, tick);
    this.ctx.restore();
  }

  private shipKey(): string {
    return `ship:${this.shipModel}`;
  }

  private shipRecipe(): DoodleRecipe {
    return R.SHIPS[this.shipModel] ?? R.FALCON;
  }

  private alienKey(a: Alien): string {
    return a.model ? `blob:${a.model}` : `alien:${a.kind}`;
  }

  private alienRecipe(a: Alien): DoodleRecipe {
    if (a.model) return R.blob(MODEL_BOXES[a.model]?.HALF_W ?? a.halfW, this.inkFor(a));
    return KIND_RECIPES[a.kind] ?? R.blob(a.halfW, this.inkFor(a));
  }

  private inkFor(a: Alien): string {
    return (a.model && DOODLE.ABILITY_INK[a.model]) || DOODLE.INK[a.kind] || DOODLE.INK.darter;
  }

  private lookFor(a: Alien): AlienLook {
    let look = this.looks.get(a);
    if (!look) {
      look = { phase: Math.floor(Math.random() * 100), lastX: a.x, tilt: 0, sumVersion: a.sumVersion, popLeft: 0 };
      this.looks.set(a, look);
    }
    return look;
  }

  /** Keep the canvas exactly under Phaser's, at the screen's resolution. */
  private syncCanvasRect(): void {
    if (!this.phaserCanvas) return;
    const r = this.phaserCanvas.getBoundingClientRect();
    const key = `${r.left},${r.top},${r.width},${r.height}`;
    if (key === this.lastRect) return;
    this.lastRect = key;
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, DOODLE.MAX_PIXEL_RATIO);
    c.style.left = `${r.left}px`;
    c.style.top = `${r.top}px`;
    c.style.width = `${r.width}px`;
    c.style.height = `${r.height}px`;
    c.width = Math.max(1, Math.round(r.width * dpr));
    c.height = Math.max(1, Math.round(r.height * dpr));
    this.scale = c.width / GAME.WIDTH;
    this.paper = drawPaper(this.scale);
    // Redraw the doodles only when the size changed a lot (they stay sharp).
    if (Math.abs(this.scale - this.spriteScale) > this.spriteScale * 0.2) {
      this.spriteScale = this.scale;
      this.sprites.clear();
    }
  }
}

const pick = (words: readonly string[]) => words[Math.floor(Math.random() * words.length)];

/** A small stable number for a string (seeds a doodle's wobble). */
function hash(text: string): number {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 100003;
  return h;
}

let instance: DoodleWorld | null = null;

/** The page-wide doodle view, created on first use. */
export function getDoodleWorld(): DoodleWorld {
  instance ??= new DoodleWorld();
  return instance;
}
