import Phaser from "phaser";
import { BATTLE_HUD, GAME, PLAYER, TARGET_STRATEGIES, type TargetStrategy } from "../config/constants";
import type { Match, MatchEvent, PlayerTile } from "../sim/Match";
import { OpponentBoard, boardWanted } from "./OpponentBoard";
import { PALETTE, css } from "../config/palette";
import { textStyle, outline } from "./theme";

/**
 * A way of showing the other players in a battle (docs/MULTIPLAYER_DESIGN.md
 * §6, M8): the desktop opponent board, the phone feedback, and so on. A view
 * only reads — the tiles (`Match.tiles()`, what the server will broadcast per
 * player) and the match events — and acts only through `BattleActions`, so it
 * never touches the sim and several views can be built side by side.
 */
export interface BattleView {
  /** Once per frame (also while paused or after game over, so it can animate). */
  update(frame: BattleFrame): void;
  destroy(): void;
}

export interface BattleFrame {
  tiles: readonly PlayerTile[];
  /** Match events since the last frame, oldest first. */
  events: readonly MatchEvent[];
  /** The player's own seat. */
  you: number;
  /** ms since the last frame (real time, for animation only). */
  delta: number;
  /** The field is hidden (pause) or the run is over. */
  paused: boolean;
  gameOver: boolean;
}

/** What a view may do for the player. */
export interface BattleActions {
  /** Aim attacks at this seat (tapping an opponent's tile). */
  aimAt(seat: number): void;
  /** Aim attacks by a strategy (Tetris 99: random, KOs, attackers, badges). */
  aimBy(strategy: TargetStrategy): void;
}

/**
 * The views for this screen. Add a view here (one line), e.g. an opponent
 * board when the window is wide enough and a compact strip on phones.
 */
export function createBattleViews(scene: Phaser.Scene, match: Match, actions: BattleActions): BattleView[] {
  // Every screen: the dock under the energy meter and the edge glow (inside
  // the canvas, so it fits phones and desktops alike).
  const views: BattleView[] = [new PhoneBattleDock(scene, match.tiles().length, actions)];
  // Desktop: the other players' tiles beside the canvas (shown while there is room).
  if (boardWanted(scene.game.canvas)) {
    // Read the box's new size before refitting: refresh() alone uses the
    // cached size (and then caches the new one without refitting).
    const refit = () => {
      scene.scale.getParentBounds();
      scene.scale.refresh();
    };
    views.push(new OpponentBoard(scene.game.canvas, actions, refit));
  }
  return views;
}

const H = BATTLE_HUD;
const STRATEGY_LABEL: Record<TargetStrategy, string> = {
  random: "RANDOM",
  kos: "KOs",
  attackers: "ATTACK",
  badges: "BADGES",
};

function lerpColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const x = (a >> shift) & 0xff;
    return Math.round(x + (((b >> shift) & 0xff) - x) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}

/** Calm up to CALM_TO (an alien anywhere in the top part is normal), then
 * warm to WARN_AT and hot at CRITICAL_AT. */
function dangerColor(danger: number): number {
  const d = H.DANGER;
  if (danger <= d.CALM_TO) return d.CALM;
  if (danger < d.WARN_AT) return lerpColor(d.CALM, d.WARN, (danger - d.CALM_TO) / (d.WARN_AT - d.CALM_TO));
  return lerpColor(d.WARN, d.CRITICAL, Math.min(1, (danger - d.WARN_AT) / (d.CRITICAL_AT - d.WARN_AT)));
}

function vibrate(pattern: number | readonly number[]): void {
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate(pattern as number | number[]);
  } catch {
    // Some hosts (iframes) forbid it; the HUD still shows everything.
  }
}

/** One opponent's tile in the dock. */
interface Slot {
  seat: number;
  x: number;
  label: Phaser.GameObjects.Text;
  place: Phaser.GameObjects.Text;
  /** 0..1, decays: the tile lights up in `flashColor`. */
  flash: number;
  flashColor: number;
}

/**
 * The phone battle HUD (BATTLE_HUD): a dock under the energy meter and a glow
 * on the field's side edges.
 *
 * - **Tiles**, one per opponent in seat order (a tile never moves, so the
 *   thumb learns where P3 is): filled from the bottom by the player's danger,
 *   with their incoming attacks stacked on top in pink. An orange frame =
 *   they aim at you; white brackets = where your attacks go (blinking while a
 *   player you picked by hand isn't your target yet; the match re-picks every
 *   1.5 s); gold pips = badges; knocked out = dark with the final place.
 *   Tap a tile to aim at that player; tap it again to go back to your
 *   strategy.
 * - **Aim chip**: your strategy (or PICK) and target, plus ⚠n when n players
 *   aim at you. Tap = next strategy.
 * - **Info**: players left, your badges, the last KO for a moment.
 * - **Edge glow + vibration** when attacks are queued for you, so an attack
 *   is noticed while the eyes are on the sums.
 */
export class PhoneBattleDock implements BattleView {
  private readonly scene: Phaser.Scene;
  private readonly actions: BattleActions;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private slots: Slot[] = [];
  private tileW = 0;
  private chipAim!: Phaser.GameObjects.Text;
  private chipTarget!: Phaser.GameObjects.Text;
  private leftText!: Phaser.GameObjects.Text;
  private badgeText!: Phaser.GameObjects.Text;
  private feedText!: Phaser.GameObjects.Text;
  private feedLeftMs = 0;
  private glowFlash = 0;
  private chipFlash = 0;
  private clock = 0;
  private tiles: readonly PlayerTile[] = [];
  private you = -1;
  private live = false;
  /** The strategy to go back to after a hand-picked target. */
  private lastStrategy: TargetStrategy = TARGET_STRATEGIES[0];

  constructor(scene: Phaser.Scene, private readonly players: number, actions: BattleActions) {
    this.scene = scene;
    this.actions = actions;
    this.glow = this.keep(scene.add.graphics().setDepth(4));
    this.gfx = this.keep(scene.add.graphics().setDepth(5));
  }

  private keep<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.objects.push(obj);
    return obj;
  }

  /** Lay out the dock once the player's own seat is known. */
  private build(you: number): void {
    this.you = you;
    const { TOP, BOTTOM, MARGIN } = H.DOCK;
    const midY = (TOP + BOTTOM) / 2;
    const text = (x: number, y: number, size: number, color: number, bold = false) =>
      this.keep(
        this.scene.add
          .text(x, y, "", textStyle(size, color, { fontStyle: bold ? "bold" : "normal", ...outline(3) }))
          .setDepth(5),
      );

    // Aim chip (left). Its hit zone reaches the canvas' bottom edge.
    const chipX = MARGIN;
    this.chipAim = text(chipX + H.CHIP_W / 2, TOP + 11, 13, PALETTE.TEXT, true).setOrigin(0.5);
    this.chipTarget = text(chipX + H.CHIP_W / 2, BOTTOM - 10, 12, PALETTE.TEXT).setOrigin(0.5);
    this.zone(chipX + H.CHIP_W / 2, H.CHIP_W + H.GAP, () => this.tapChip());

    // Opponent tiles (middle), as wide as fits, centred in their span.
    const x0 = MARGIN + H.CHIP_W + H.GAP;
    const x1 = GAME.WIDTH - MARGIN - H.INFO_W - H.GAP;
    const seats = Array.from({ length: this.players }, (_, s) => s).filter((s) => s !== you);
    const n = Math.max(1, seats.length);
    this.tileW = Math.min(H.TILE_MAX_W, (x1 - x0 - (n - 1) * H.TILE_GAP) / n);
    const span = n * this.tileW + (n - 1) * H.TILE_GAP;
    const start = x0 + (x1 - x0 - span) / 2;
    this.slots = seats.map((seat, i) => {
      const x = start + i * (this.tileW + H.TILE_GAP);
      this.zone(x + this.tileW / 2, this.tileW + H.TILE_GAP, () => this.tapTile(seat));
      return {
        seat,
        x,
        label: text(x + 3, TOP + 1, 13, PALETTE.TEXT, true).setText(`P${seat + 1}`),
        place: text(x + this.tileW / 2, midY + 6, 12, PALETTE.TEXT_MUTED).setOrigin(0.5),
        flash: 0,
        flashColor: H.ATTACK,
      };
    });

    // Info (right): players left, your badges, the KO feed.
    const infoX = GAME.WIDTH - MARGIN - H.INFO_W;
    this.leftText = text(infoX + 1, TOP + 1, 15, PALETTE.TEXT, true);
    this.badgeText = text(GAME.WIDTH - MARGIN, TOP + 3, 12, PALETTE.GOLD).setOrigin(1, 0);
    this.feedText = text(infoX + 1, BOTTOM - 16, 12, PALETTE.TEXT_MUTED);
  }

  /** A tap target as tall as the dock down to the canvas' bottom edge. */
  private zone(cx: number, w: number, onTap: () => void): void {
    const top = H.DOCK.TOP - 3;
    const zone = this.keep(this.scene.add.zone(cx, (top + GAME.HEIGHT) / 2, w, GAME.HEIGHT - top));
    zone.setInteractive({ useHandCursor: true }).on("pointerdown", onTap);
  }

  private get me(): PlayerTile | undefined {
    return this.tiles[this.you];
  }

  private tapTile(seat: number): void {
    const me = this.me;
    if (!this.live || !me || !this.tiles[seat]?.alive) return;
    // Tapping the player you picked goes back to your strategy.
    if (typeof me.aim !== "string" && me.aim.seat === seat) this.actions.aimBy(this.lastStrategy);
    else this.actions.aimAt(seat);
  }

  private tapChip(): void {
    const aim = this.me?.aim;
    if (!this.live || aim === undefined) return;
    const next =
      typeof aim === "string"
        ? TARGET_STRATEGIES[(TARGET_STRATEGIES.indexOf(aim) + 1) % TARGET_STRATEGIES.length]
        : this.lastStrategy;
    this.chipFlash = 1;
    this.actions.aimBy(next);
  }

  update(frame: BattleFrame): void {
    if (this.you !== frame.you) this.build(frame.you);
    this.tiles = frame.tiles;
    this.live = !frame.paused && !frame.gameOver;
    this.clock += frame.delta;
    const me = this.me;
    if (!me) return;
    if (typeof me.aim === "string") this.lastStrategy = me.aim;

    for (const e of frame.events) this.onEvent(e);
    const decay = (v: number, ms: number) => Math.max(0, v - frame.delta / ms);
    for (const s of this.slots) s.flash = decay(s.flash, H.FLASH_MS);
    this.glowFlash = decay(this.glowFlash, H.GLOW.FLASH_MS);
    this.chipFlash = decay(this.chipFlash, H.FLASH_MS);
    this.feedLeftMs = Math.max(0, this.feedLeftMs - frame.delta);

    this.drawDock(me);
    this.drawGlow(me, frame);
  }

  private onEvent(e: MatchEvent): void {
    const you = this.you;
    const slot = (seat: number) => this.slots.find((s) => s.seat === seat);
    const flash = (seat: number, color: number) => {
      const s = slot(seat);
      if (s) {
        s.flash = 1;
        s.flashColor = color;
      }
    };
    switch (e.type) {
      case "attack":
        if (e.to === you) {
          // Who hit you lights up; the edges glow; the phone buzzes per 25.
          flash(e.from, H.ATTACK);
          this.glowFlash = 1;
          const pulses = Math.min(3, Math.max(1, Math.round(e.weight / 25)));
          const pattern: number[] = [];
          for (let i = 0; i < pulses; i++) pattern.push(...(i ? [H.VIBRATE.ATTACK_GAP] : []), H.VIBRATE.ATTACK_PULSE);
          vibrate(pattern);
        } else if (e.from === you) {
          flash(e.to, H.ATTACK);
        }
        break;
      case "ko": {
        if (e.seat === you) {
          vibrate(H.VIBRATE.OUT);
          break;
        }
        const mine = e.by === you;
        flash(e.seat, mine ? H.BADGE : PALETTE.TEXT);
        this.feedText.setText(mine ? `KO P${e.seat + 1}` : `P${e.seat + 1} OUT`).setColor(mine ? css(PALETTE.GOLD) : "#c9d1f0");
        this.feedLeftMs = H.FEED_MS;
        if (mine) vibrate(H.VIBRATE.KO);
        break;
      }
      case "over":
        if (e.winner === you) vibrate(H.VIBRATE.WIN);
        break;
    }
  }

  private drawDock(me: PlayerTile): void {
    const g = this.gfx.clear();
    const { TOP, BOTTOM, MARGIN } = H.DOCK;
    const h = BOTTOM - TOP;
    const blink = 0.5 + 0.5 * Math.sin(this.clock / 90);
    const picked = typeof me.aim === "string" ? null : me.aim.seat;

    // Aim chip: looks like a key (it is one).
    g.fillStyle(lerpColor(PALETTE.PANEL, PALETTE.PANEL_LIGHT, this.chipFlash), 1).fillRect(MARGIN, TOP, H.CHIP_W, h);
    g.lineStyle(2, PALETTE.ACCENT, 1).strokeRect(MARGIN, TOP, H.CHIP_W, h);
    this.chipAim.setText(picked === null ? STRATEGY_LABEL[me.aim as TargetStrategy] : "PICK");
    const aimedAt = me.targetedBy > 0 ? ` ⚠${me.targetedBy}` : "";
    this.chipTarget.setText(`→${me.target === null ? "--" : `P${me.target + 1}`}${aimedAt}`);

    for (const s of this.slots) {
      const t = this.tiles[s.seat];
      if (!t) continue;
      const x = s.x;
      const w = this.tileW;
      g.fillStyle(0x0d1226, t.alive ? 1 : 0.6).fillRect(x, TOP, w, h);
      if (t.alive) {
        // Danger fills from the bottom; incoming attacks stack on top of it.
        const dangerH = Math.round(t.danger * h);
        const critical = t.danger >= H.DANGER.CRITICAL_AT;
        g.fillStyle(dangerColor(t.danger), critical ? 0.55 + 0.45 * blink : 0.85);
        g.fillRect(x, BOTTOM - dangerH, w, dangerH);
        const incomingH = Math.min(h - dangerH, Math.round((Math.min(1, t.incoming / H.INCOMING_FULL) * h) / 2));
        if (incomingH > 0) {
          g.fillStyle(H.INCOMING, 0.95).fillRect(x, BOTTOM - dangerH - incomingH, w, incomingH);
          if (dangerH > 0) g.fillStyle(PALETTE.BACKGROUND, 1).fillRect(x, BOTTOM - dangerH - 1, w, 1);
        }
        // Badges: gold pips down the right edge.
        g.fillStyle(H.BADGE, 1);
        for (let b = 0; b < t.badges; b++) g.fillRect(x + w - 6, TOP + 4 + b * 6, 4, 4);
      }
      if (s.flash > 0) g.fillStyle(s.flashColor, 0.6 * s.flash).fillRect(x, TOP, w, h);
      // Orange frame: this player aims at you.
      const aimsAtYou = t.alive && t.target === this.you;
      g.lineStyle(aimsAtYou ? 2 : 1, aimsAtYou ? H.ATTACK : PALETTE.PANEL_LIGHT, t.alive ? 1 : 0.5);
      g.strokeRect(x, TOP, w, h);
      // White brackets: where your attacks go. A hand pick blinks until the
      // match makes it your target.
      const isTarget = me.target === s.seat;
      const pending = picked === s.seat && !isTarget;
      if (t.alive && (isTarget || pending)) this.brackets(g, x - 2, TOP - 2, w + 4, h + 4, pending ? blink : 1);

      s.label.setColor(t.alive ? css(PALETTE.TEXT) : "#56608a");
      s.place.setText(t.alive ? "" : `#${t.placement}`);
    }

    const alive = this.tiles.filter((t) => t.alive).length;
    this.leftText.setText(`${alive}/${this.tiles.length}`);
    this.badgeText.setText(me.badges ? `★${me.badges}` : "");
    if (this.feedLeftMs <= 0) this.feedText.setText("LEFT").setColor(css(PALETTE.TEXT_MUTED));
    this.feedText.setAlpha(this.feedLeftMs > 0 ? Math.min(1, this.feedLeftMs / 400) : 1);
  }

  private brackets(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, alpha: number): void {
    const arm = 8;
    g.lineStyle(3, PALETTE.TEXT, alpha);
    for (const [cx, cy, dx, dy] of [
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ]) {
      g.beginPath();
      g.moveTo(cx + dx * arm, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy + dy * arm);
      g.strokePath();
    }
  }

  /**
   * Orange glow on both side edges while attacks wait to land on you. Drawn
   * in bands; a band next to one of your aliens dims so its balls stay clear.
   */
  private drawGlow(me: PlayerTile, frame: BattleFrame): void {
    const g = this.glow.clear();
    if (frame.paused || frame.gameOver) return;
    const G = H.GLOW;
    const level = Math.min(1, me.incoming / G.FULL_AT);
    const pulse = 0.7 + 0.3 * Math.sin(this.clock / 110);
    const strength = Math.min(1, (me.incoming > 0 ? 0.4 + 0.6 * level * pulse : 0) + this.glowFlash);
    if (strength <= 0) return;

    const aliens = me.aliens.map((a) => ({ x: a.x * GAME.WIDTH, y: a.y * PLAYER.Y }));
    const band = 24;
    const strips = 4;
    for (const side of [0, 1] as const) {
      const edgeX = side ? GAME.WIDTH : 0;
      for (let y = G.TOP; y < G.BOTTOM; y += band) {
        const near = aliens.some((a) => Math.abs(a.x - edgeX) < G.DUCK_PX && Math.abs(a.y - (y + band / 2)) < 40);
        const alpha = G.ALPHA * strength * (near ? 0.15 : 1);
        for (let i = 0; i < strips; i++) {
          const w = G.W / strips;
          const x = side ? GAME.WIDTH - (i + 1) * w : i * w;
          g.fillStyle(H.INCOMING, alpha * (1 - i / strips) ** 1.5).fillRect(x, y, w, Math.min(band, G.BOTTOM - y));
        }
      }
    }
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
    this.objects.length = 0;
    this.slots = [];
  }
}
