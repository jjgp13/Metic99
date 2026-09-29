import { BATTLE_BOARD as B, GAME, PLAYER, POWERS } from "../config/constants";
import type { MatchEvent, PlayerTile } from "../sim/Match";
import type { BattleActions, BattleFrame, BattleView } from "./battleViews";

/** Where the board goes, in CSS px of the page (see `layoutBoard`). */
export interface BoardLayout {
  /** Compact tiles: mini field + name only, for narrower sides. */
  compact: boolean;
  tileW: number;
  tileH: number;
  fieldW: number;
  fieldH: number;
  fontPx: number;
  /** Left edge of the left column / of the right column. */
  leftX: number;
  rightX: number;
  top: number;
}

/** The mini field's shape: the field above the player line (tile dots are
 * 0–1 of that area, see Field.summary). */
const FIELD_ASPECT = GAME.WIDTH / PLAYER.Y;
/** Danger below this draws no wash (aliens high up are normal). */
const DANGER_FROM = 0.35;
/** A tile's padding + border on each side (CSS below). */
const TILE_INSET = 6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Where the columns fit beside the game canvas (`canvas` = its page rect),
 * with `slots` tiles per column: full tiles when a side has MIN_SIDE_W,
 * compact ones down to COMPACT_MIN_W, else null. The board never covers
 * the canvas.
 */
export function layoutBoard(
  canvas: { left: number; right: number; top: number; height: number },
  viewportW: number,
  slots: number,
): BoardLayout | null {
  const side = Math.min(canvas.left, viewportW - canvas.right) - B.GAP - B.EDGE;
  if (canvas.height < B.MIN_H) return null;
  const slotH = (canvas.height - (slots - 1) * B.GAP) / slots;
  let tileW: number;
  let tileH: number;
  let fieldW: number;
  let fontPx: number;
  const compact = !(side >= B.MIN_SIDE_W && canvas.height >= B.FULL_MIN_H);
  if (!compact) {
    tileW = Math.floor(Math.min(B.MAX_TILE_W, side));
    tileH = Math.floor(Math.min(B.MAX_TILE_H, slotH));
    // As tall as the tile allows, leaving the info column its share.
    fieldW = Math.min((tileH - 2 * TILE_INSET) * FIELD_ASPECT, tileW * B.FIELD_SHARE);
    fontPx = clamp(tileH * 0.085, 11, 15);
  } else {
    if (side < B.COMPACT_MIN_W) return null;
    tileW = Math.min(B.COMPACT_MAX_W, side);
    fontPx = clamp(tileW * 0.08, 10, 13);
    // The name row above the mini field.
    const chrome = 2 * TILE_INSET + fontPx * 1.6;
    fieldW = tileW - 2 * TILE_INSET;
    if (fieldW / FIELD_ASPECT + chrome > slotH) fieldW = (slotH - chrome) * FIELD_ASPECT;
    if (fieldW < B.COMPACT_MIN_FIELD) return null;
    tileW = Math.floor(fieldW + 2 * TILE_INSET);
    tileH = Math.floor(fieldW / FIELD_ASPECT + chrome);
  }
  fieldW = Math.floor(fieldW);
  const columnH = slots * tileH + (slots - 1) * B.GAP;
  return {
    compact,
    tileW,
    tileH,
    fieldW,
    fieldH: Math.floor(fieldW / FIELD_ASPECT),
    fontPx: Math.round(fontPx),
    leftX: canvas.left - B.GAP - tileW,
    rightX: canvas.right + B.GAP,
    top: canvas.top + (canvas.height - columnH) / 2,
  };
}

/**
 * In a landscape window too narrow for even compact columns, the width to
 * give the game's box (#game) so that the canvas shrinks and makes room,
 * like Tetris 99; null when no room is needed, the window is portrait (the
 * phone view's job) or the game would shrink below MIN_GAME_SCALE.
 */
export function reserveWidth(viewportW: number, viewportH: number): number | null {
  const natural = Math.min(viewportW, (viewportH * GAME.WIDTH) / GAME.HEIGHT);
  const need = B.COMPACT_MIN_W + B.GAP + B.EDGE;
  if ((viewportW - natural) / 2 >= need || viewportW < viewportH) return null;
  const width = Math.floor(viewportW - 2 * need);
  return width >= natural * B.MIN_GAME_SCALE ? width : null;
}

/** Whether to build the board: on any desktop (a mouse or trackpad), where
 * it shows whenever the window has room, or wherever it fits right now. */
export function boardWanted(canvas: HTMLCanvasElement): boolean {
  if (window.matchMedia("(pointer: fine)").matches) return true;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  return layoutBoard(canvas.getBoundingClientRect(), vw, 4) !== null || reserveWidth(vw, vh) !== null;
}

const seatName = (seat: number, you: number) => (seat === you ? "YOU" : `P${seat + 1}`);

/** One opponent's tile and what it showed last (DOM writes only on change). */
interface TileView {
  seat: number;
  el: HTMLElement;
  field: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  name: HTMLElement;
  level: HTMLElement;
  badgesOn: HTMLElement;
  badgesOff: HTMLElement;
  bonus: HTMLElement;
  power: HTMLElement;
  energy: HTMLElement;
  incoming: HTMLElement;
  incomingText: HTMLElement;
  headIncoming: HTMLElement;
  aim: HTMLElement;
  tags: HTMLElement;
  flash: HTMLElement;
  place: HTMLElement;
  flashLeftMs: number;
  /** Who knocked this player out (from the KO event). */
  koBy: number | null | undefined;
  shown: Record<string, string>;
}

/**
 * The desktop opponent board (docs/MULTIPLAYER_DESIGN.md §6, M8): each other
 * player as a tile in the empty space left and right of the portrait canvas,
 * like Tetris 99. A tile shows the player's aliens as dots (orange = sent by
 * someone), how close they are to falling (a red wash rising from the
 * bottom), energy, power, badges, incoming, who they aim at, and after a KO
 * their place and who took them out. Gold brackets mark your target; an
 * orange edge marks everyone aiming at you. Clicking a tile aims at it.
 *
 * It is a DOM overlay rather than a wider Phaser layout (which would move
 * every HUD position and break FIT scaling on phones) or a second canvas
 * (which would need its own hit-testing and text): the page's own layout
 * gives crisp text at any size and free clicks, and nothing about the game
 * canvas changes. It reads only the tiles and match events, positions
 * itself from the canvas rect each frame, and hides when the window is too
 * narrow, so it can never cover the field.
 */
export class OpponentBoard implements BattleView {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly columns: HTMLDivElement[];
  private readonly feed: HTMLDivElement;
  private readonly feedLeft: HTMLElement;
  private readonly feedList: HTMLElement;
  private tiles = new Map<number, TileView>();
  private feedLines: string[] = [];
  private slots = 4;
  private layoutKey = "";
  private fieldW = 0;
  private fieldH = 0;
  private clock = 0;

  /** The game's box (#game), narrowed by `reserveWidth` while needed. */
  private readonly gameBox: HTMLElement | null;
  private reserved: number | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly actions: BattleActions,
    /** Refit the canvas at once after the game's box changes size. */
    private readonly refit: () => void,
  ) {
    this.gameBox = canvas.parentElement;
    this.style = document.createElement("style");
    this.style.textContent = CSS;
    document.head.append(this.style);
    this.root = div("mb-board");
    this.columns = [div("mb-col"), div("mb-col")];
    this.feed = div("mb-feed");
    this.feedLeft = div("mb-feed-left");
    this.feedList = div("mb-feed-list");
    this.feed.append(this.feedLeft, this.feedList, div("mb-feed-hint", "click a tile to aim at it"));
    this.root.append(...this.columns);
    document.body.append(this.root);
  }

  update(frame: BattleFrame): void {
    this.clock += frame.delta;
    if (!this.tiles.size) this.build(frame);
    // Events first: the KO feed must not miss any while the board is hidden.
    for (const e of frame.events) this.onEvent(e, frame);
    if (!this.layout()) return;
    const byseat = frame.tiles;
    const yours = byseat[frame.you];
    for (const view of this.tiles.values()) this.draw(view, byseat[view.seat], yours, frame);
    this.drawFeed(frame);
    this.root.classList.toggle("mb-paused", frame.paused && !frame.gameOver);
  }

  destroy(): void {
    this.reserve(null);
    this.root.remove();
    this.style.remove();
  }

  /** One tile per opponent, in seat order: the first half left, the rest
   * right, with the KO feed in the right column's free slot. */
  private build(frame: BattleFrame): void {
    const others = frame.tiles.filter((t) => t.seat !== frame.you);
    const leftCount = Math.ceil(others.length / 2);
    this.slots = Math.max(leftCount, others.length - leftCount + 1, 1);
    others.forEach((t, i) => this.columns[i < leftCount ? 0 : 1].append(this.makeTile(t.seat, frame.you)));
    this.columns[1].append(this.feed);
  }

  private makeTile(seat: number, you: number): HTMLElement {
    const el = document.createElement("button");
    el.type = "button";
    el.tabIndex = -1;
    el.className = "mb-tile";
    const field = document.createElement("canvas");
    field.className = "mb-field";
    const place = div("mb-place");
    const flash = div("mb-flash");
    const fieldBox = div("mb-field-box");
    fieldBox.append(field, place, flash);

    const name = div("mb-name", seatName(seat, you));
    const level = div("mb-level");
    const badgesOn = span("mb-badges-on");
    const badgesOff = span("mb-badges-off");
    const bonus = span("mb-bonus");
    const badges = div("mb-badges");
    badges.append(badgesOn, badgesOff);
    const headIncoming = span("mb-head-incoming");
    const head = div("mb-head");
    head.append(name, level, badges, headIncoming);

    const power = div("mb-power");
    const powerRow = div("mb-row");
    powerRow.append(power, bonus);
    const energy = div("mb-fill mb-energy");
    const energyBar = div("mb-bar");
    energyBar.append(energy);
    const incoming = div("mb-fill mb-incoming");
    const incomingBar = div("mb-bar");
    incomingBar.append(incoming);
    const incomingText = div("mb-incoming-text");
    const incomingRow = div("mb-row");
    incomingRow.append(incomingBar, incomingText);
    const aim = div("mb-aim");
    const tags = div("mb-tags");
    const info = div("mb-info");
    info.append(head, powerRow, energyBar, incomingRow, aim, tags);
    el.append(fieldBox, info);

    // pointerdown + preventDefault: aim at once and keep focus off the tile,
    // so SPACE (SEND) never "clicks" it again.
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!el.classList.contains("mb-out")) this.actions.aimAt(seat);
    });
    const ctx = field.getContext("2d");
    if (!ctx) throw new Error("OpponentBoard: no 2D canvas");
    this.tiles.set(seat, {
      seat, el, field, ctx, name, level, badgesOn, badgesOff, bonus, power, energy,
      incoming, incomingText, headIncoming, aim, tags, flash, place, flashLeftMs: 0, koBy: undefined, shown: {},
    });
    return el;
  }

  /** Place the columns beside the canvas; false (hidden) when they don't fit. */
  private layout(): boolean {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    this.reserve(reserveWidth(vw, vh));
    const r = this.canvas.getBoundingClientRect();
    const key = `${r.left},${r.top},${r.width},${r.height},${vw}`;
    if (key === this.layoutKey) return this.root.style.display !== "none";
    this.layoutKey = key;
    const l = layoutBoard(r, vw, this.slots);
    this.root.style.display = l ? "" : "none";
    if (!l) return false;
    const [left, right] = this.columns;
    left.style.left = `${l.leftX}px`;
    right.style.left = `${l.rightX}px`;
    for (const col of this.columns) {
      col.style.top = `${l.top}px`;
      col.style.width = `${l.tileW}px`;
    }
    this.root.classList.toggle("mb-compact", l.compact);
    this.root.style.setProperty("--tile-h", `${l.tileH}px`);
    this.root.style.setProperty("--gap", `${B.GAP}px`);
    this.root.style.fontSize = `${l.fontPx}px`;
    this.fieldW = l.fieldW;
    this.fieldH = l.fieldH;
    const dpr = window.devicePixelRatio || 1;
    for (const t of this.tiles.values()) {
      t.field.style.width = `${l.fieldW}px`;
      t.field.style.height = `${l.fieldH}px`;
      t.field.width = Math.round(l.fieldW * dpr);
      t.field.height = Math.round(l.fieldH * dpr);
      t.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return true;
  }

  /** Narrow the game's box to `width` (null: back to full width). */
  private reserve(width: number | null): void {
    if (width === this.reserved || !this.gameBox) return;
    this.reserved = width;
    this.gameBox.style.width = width === null ? "" : `${width}px`;
    this.gameBox.style.margin = width === null ? "" : "0 auto";
    this.refit();
  }

  private onEvent(e: MatchEvent, frame: BattleFrame): void {
    const name = (seat: number) => seatName(seat, frame.you);
    switch (e.type) {
      case "attack": {
        this.flashTile(e.from, `SENT ${e.cost} → ${name(e.to)}`, "mb-sending");
        this.flashTile(e.to, `+${Math.round(e.weight)} FROM ${name(e.from)}`, "mb-receiving");
        break;
      }
      case "ko": {
        const tile = this.tiles.get(e.seat);
        if (tile) tile.koBy = e.by;
        const by = e.by === null ? "" : ` by ${name(e.by)}`;
        this.feedLines.unshift(`#${e.placement} ${name(e.seat)} OUT${by}`);
        if (e.by !== null) this.flashTile(e.by, `KO ${name(e.seat)}`, "mb-sending");
        break;
      }
      case "over":
        this.feedLines.unshift(`${name(e.winner)} ${e.winner === frame.you ? "WIN" : "WINS"}!`);
        break;
    }
    this.feedLines.length = Math.min(this.feedLines.length, B.FEED_LINES);
  }

  private flashTile(seat: number, text: string, kind: string): void {
    const t = this.tiles.get(seat);
    if (!t) return;
    t.flash.textContent = text;
    t.flash.className = `mb-flash mb-show ${kind}`;
    t.flashLeftMs = B.FLASH_MS;
  }

  private draw(v: TileView, tile: PlayerTile, yours: PlayerTile, frame: BattleFrame): void {
    const you = frame.you;
    const out = !tile.alive;
    const isTarget = !out && yours.alive && yours.target === tile.seat;
    const onYou = !out && tile.target === you;
    const picked = isTarget && typeof yours.aim !== "string";

    set(v, "cls", `mb-tile${out ? " mb-out" : ""}${isTarget ? " mb-target" : ""}${onYou ? " mb-on-you" : ""}`, (c) => {
      v.el.className = c;
    });
    set(v, "level", tile.who === "human" ? "PLAYER" : tile.who.toUpperCase(), (s) => (v.level.textContent = s));
    set(v, "badges", String(tile.badges), () => {
      v.badgesOn.textContent = "★".repeat(tile.badges);
      v.badgesOff.textContent = "☆".repeat(Math.max(0, 4 - tile.badges));
    });
    set(v, "bonus", tile.bonus > 0 ? `+${Math.round(tile.bonus * 100)}%` : "", (s) => (v.bonus.textContent = s));

    const power = POWERS[tile.power];
    set(v, "power", `${tile.power}|${tile.powerOn}`, () => {
      v.power.textContent = tile.powerOn ? `${power.NAME} ON` : power.NAME;
      v.power.style.setProperty("--pc", `#${power.COLOR.toString(16).padStart(6, "0")}`);
      v.power.classList.toggle("mb-on", tile.powerOn);
    });
    set(v, "energy", `${Math.round(tile.energy * 100)}`, (s) => (v.energy.style.width = `${s}%`));
    const inc = Math.round(tile.incoming);
    set(v, "incoming", String(inc), () => {
      v.incoming.style.width = `${Math.min(100, inc)}%`;
      v.incomingText.textContent = inc > 0 ? `▼${inc}` : "";
      v.headIncoming.textContent = inc > 0 ? `▼${inc}` : "";
    });

    const aim = typeof tile.aim === "string" ? B.AIM_LABEL[tile.aim] : "PICKED";
    const aimText = out ? "" : `→ ${tile.target === null ? "—" : seatName(tile.target, you)} · ${aim}`;
    set(v, "aim", `${aimText}|${onYou}`, () => {
      v.aim.textContent = aimText;
      v.aim.classList.toggle("mb-at-you", onYou);
    });

    const tags = [
      isTarget ? `<span class="mb-tag mb-tag-target">◎ ${picked ? "PICKED" : "TARGET"}</span>` : "",
      onYou ? `<span class="mb-tag mb-tag-on-you">⚔ ON YOU</span>` : "",
    ].join("");
    set(v, "tags", tags, (s) => (v.tags.innerHTML = s));

    const place = out
      ? `<b>${tile.placement === 1 ? "WIN" : `#${tile.placement}`}</b><small>${
          v.koBy === undefined || v.koBy === null ? "OUT" : `KO by ${seatName(v.koBy, you)}`
        }</small>`
      : "";
    set(v, "place", place, (s) => (v.place.innerHTML = s));

    if (v.flashLeftMs > 0) {
      v.flashLeftMs -= frame.delta;
      if (v.flashLeftMs <= 0) v.flash.classList.remove("mb-show");
    }
    this.drawField(v, tile);
  }

  /** The mini field: a red wash rising with danger, the player line, dots. */
  private drawField(v: TileView, tile: PlayerTile): void {
    const ctx = v.ctx;
    const w = this.fieldW;
    const h = this.fieldH;
    ctx.clearRect(0, 0, w, h);
    if (!tile.alive) return;
    const d = tile.danger;
    // Calm fields stay dark; from DANGER_FROM a red wash rises with the
    // closest unanswered alien, and pulses near the line.
    const heat = Math.min(1, Math.max(0, (d - DANGER_FROM) / (1 - DANGER_FROM)));
    if (heat > 0) {
      const pulse = d > 0.8 ? 0.12 * Math.sin(this.clock / 90) : 0;
      const top = h * (1 - d);
      const g = ctx.createLinearGradient(0, h, 0, top);
      g.addColorStop(0, `rgba(${B.COLOR.DANGER}, ${Math.min(0.9, 0.15 + 0.6 * heat + pulse)})`);
      g.addColorStop(1, `rgba(${B.COLOR.DANGER}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, top, w, h - top);
    }
    ctx.fillStyle = "rgba(216, 222, 250, 0.35)";
    ctx.fillRect(0, h - 1.5, w, 1.5);
    const r = Math.max(2, w * 0.03);
    for (const a of tile.aliens) {
      const x = Math.min(1, Math.max(0, a.x)) * w;
      const y = Math.min(h - r, Math.max(0, a.y) * h);
      ctx.beginPath();
      ctx.arc(x, y, a.sent ? r * 1.35 : r, 0, Math.PI * 2);
      ctx.fillStyle = a.sent ? B.COLOR.SENT : B.COLOR.DOT;
      ctx.fill();
    }
  }

  private drawFeed(frame: BattleFrame): void {
    const alive = frame.tiles.filter((t) => t.alive).length;
    const over = frame.tiles.some((t) => t.placement === 1);
    const text = over ? "MATCH OVER" : `${alive}/${frame.tiles.length} LEFT`;
    if (this.feedLeft.textContent !== text) this.feedLeft.textContent = text;
    const list = this.feedLines.join("\n");
    if (this.feedList.textContent !== list) this.feedList.textContent = list;
  }
}

function div(className: string, text = ""): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  return el;
}

function span(className: string): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = className;
  return el;
}

/** Run `write` only when `value` changed since the last frame. */
function set(v: TileView, key: string, value: string, write: (value: string) => void): void {
  if (v.shown[key] === value) return;
  v.shown[key] = value;
  write(value);
}

const CSS = `
.mb-board { position: fixed; inset: 0; pointer-events: none; z-index: 2;
  font-family: monospace; color: #d8defa; transition: opacity 0.25s; }
.mb-board.mb-paused { opacity: 0.35; }
.mb-col { position: absolute; display: flex; flex-direction: column; gap: var(--gap); }
.mb-tile, .mb-feed { box-sizing: border-box; height: var(--tile-h); border-radius: 8px;
  background: rgba(13, 17, 38, 0.92); border: 2px solid #232b4d; }
.mb-tile { pointer-events: auto; cursor: pointer; display: flex; gap: 8px; padding: 4px;
  font: inherit; color: inherit; text-align: left; position: relative;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.3s; }
.mb-tile:hover { border-color: #4a5689; }
.mb-tile.mb-on-you { border-color: ${B.COLOR.SENT}; box-shadow: 0 0 10px ${B.COLOR.SENT}88; }
.mb-tile.mb-target::before { content: ""; position: absolute; inset: -7px; pointer-events: none;
  --c: ${B.COLOR.TARGET}; --l: 18px; --t: 3px; background:
    linear-gradient(var(--c), var(--c)) top left / var(--l) var(--t),
    linear-gradient(var(--c), var(--c)) top left / var(--t) var(--l),
    linear-gradient(var(--c), var(--c)) top right / var(--l) var(--t),
    linear-gradient(var(--c), var(--c)) top right / var(--t) var(--l),
    linear-gradient(var(--c), var(--c)) bottom left / var(--l) var(--t),
    linear-gradient(var(--c), var(--c)) bottom left / var(--t) var(--l),
    linear-gradient(var(--c), var(--c)) bottom right / var(--l) var(--t),
    linear-gradient(var(--c), var(--c)) bottom right / var(--t) var(--l);
  background-repeat: no-repeat; }
.mb-tile.mb-out { cursor: default; opacity: 0.45; filter: grayscale(1); }
.mb-tile.mb-out:hover { border-color: #232b4d; }
.mb-out .mb-row, .mb-out .mb-bar, .mb-out .mb-aim, .mb-out .mb-tags { visibility: hidden; }
.mb-field-box { position: relative; flex: none; align-self: center; line-height: 0; }
.mb-field { display: block; border-radius: 4px; background: #070a1a; }
.mb-place { position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; line-height: 1.1; }
.mb-place b { font-size: 2.4em; }
.mb-place small { font-size: 0.85em; color: #8893b5; }
.mb-flash { position: absolute; left: 0; right: 0; top: 38%; text-align: center;
  font-size: 0.8em; font-weight: bold; line-height: 1.3; padding: 1px 2px; border-radius: 3px;
  opacity: 0; transition: opacity 0.35s; white-space: nowrap; overflow: hidden; }
.mb-flash.mb-show { opacity: 1; transition: none; }
.mb-flash.mb-sending { background: ${B.COLOR.SENT}; color: #05060f; }
.mb-flash.mb-receiving { background: #05060fdd; color: ${B.COLOR.SENT}; }
.mb-info { flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column;
  justify-content: space-between; padding: 1px 2px 1px 0; }
.mb-head { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; }
.mb-name { font-size: 1.35em; font-weight: bold; color: #fff; }
.mb-level { font-size: 0.75em; color: #8893b5; }
.mb-badges { margin-left: auto; font-size: 0.95em; letter-spacing: -1px; }
.mb-badges-on { color: ${B.COLOR.BADGE}; }
.mb-badges-off { color: #3a4266; }
.mb-bonus { margin-left: auto; color: ${B.COLOR.BADGE}; font-size: 0.8em; }
.mb-power { font-size: 0.8em; font-weight: bold; padding: 1px 6px; white-space: nowrap;
  border-radius: 3px; color: var(--pc); border: 1px solid var(--pc); }
.mb-power.mb-on { background: var(--pc); color: #05060f; box-shadow: 0 0 8px var(--pc); }
.mb-row { display: flex; align-items: center; gap: 6px; }
.mb-row .mb-bar { flex: 1; }
.mb-bar { flex: none; height: 7px; border-radius: 4px; background: #1b2340; overflow: hidden; }
.mb-fill { height: 100%; width: 0; }
.mb-energy { background: ${B.COLOR.ENERGY}; }
.mb-incoming { background: ${B.COLOR.SENT}; }
.mb-incoming-text { font-size: 0.8em; color: ${B.COLOR.SENT}; min-width: 3.2em; text-align: right; }
.mb-aim { font-size: 0.85em; color: #8893b5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mb-aim.mb-at-you { color: ${B.COLOR.SENT}; font-weight: bold; }
.mb-tags { display: flex; gap: 4px; min-height: 1.3em; }
.mb-tag { font-size: 0.75em; font-weight: bold; padding: 0 4px; border-radius: 3px; line-height: 1.5; }
.mb-tag-target { background: ${B.COLOR.TARGET}; color: #05060f; }
.mb-tag-on-you { background: ${B.COLOR.SENT}; color: #05060f; }
.mb-head-incoming { display: none; }
.mb-compact .mb-tile { flex-direction: column-reverse; justify-content: flex-end; gap: 2px; }
.mb-compact .mb-info { flex: none; padding: 0; }
.mb-compact .mb-info > :not(.mb-head), .mb-compact .mb-level { display: none; }
.mb-compact .mb-name { font-size: 1.15em; }
.mb-compact .mb-head-incoming { display: inline; font-size: 0.85em; color: ${B.COLOR.SENT}; }
.mb-compact .mb-flash { font-size: 0.75em; }
.mb-compact .mb-feed { padding: 6px; }
.mb-compact .mb-feed-list { font-size: 0.75em; }
.mb-feed { padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; border-style: dashed; }
.mb-feed-left { font-size: 1.35em; font-weight: bold; color: #fff; }
.mb-feed-list { flex: 1; white-space: pre; font-size: 0.85em; line-height: 1.35; color: #8893b5;
  overflow: hidden; }
.mb-feed-hint { font-size: 0.75em; color: #56608a; }
`;
