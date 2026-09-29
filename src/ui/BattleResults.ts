import Phaser from "phaser";
import { GAME, KEYPAD_AREA, PLAYER } from "../config/constants";
import type { PlayerTile } from "../sim/Match";

const DEPTH = 10;
const FONT = "monospace";
const GOLD = "#ffd166";
const BLUE = "#4ea1ff";
const RED = "#ef476f";
const GREEN = "#5ef08a";
const GREY = "#8893b5";

/** "YOU" for the player's own seat, else "P<n>". */
export function seatName(seat: number, you: number): string {
  return seat === you ? "YOU" : `P${seat + 1}`;
}

function winnerName(tiles: readonly PlayerTile[], you: number): string {
  const w = tiles.find((t) => t.placement === 1);
  if (!w) return "-";
  return w.who === "human" ? seatName(w.seat, you) : `${seatName(w.seat, you)} (${w.who})`;
}

/** What the results panel needs besides the tiles. */
export interface ResultsState {
  tiles: readonly PlayerTile[];
  you: number;
  /** The match has a winner. */
  over: boolean;
  /** The rest of the match is being simulated without drawing it. */
  fastForwarding: boolean;
}

export interface ResultsActions {
  fastForward(): void;
  watch(): void;
  again(): void;
  menu(): void;
}

type Button = { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text };

/**
 * Battle results (M8): opens when the player is knocked out (or wins). The
 * match keeps running behind it, so the standings stay live; the player can
 * fast-forward to the end, watch another player, or leave. Reads only the
 * tiles (the same data the opponent board uses).
 */
export class BattleResults {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly rows: Phaser.GameObjects.Text[] = [];
  private readonly status: Phaser.GameObjects.Text;
  private readonly buttons: Record<"ff" | "watch" | "again" | "menu", Button>;

  constructor(
    scene: Phaser.Scene,
    players: number,
    /** Lines about the player's own run (survived, kills, sent, …). */
    yourStats: string,
    private readonly actions: ResultsActions,
  ) {
    const cx = GAME.WIDTH / 2;
    // A full-screen backdrop that also swallows taps meant for the keypad.
    const backdrop = scene.add
      .rectangle(cx, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x05060f, 0.94)
      .setInteractive();
    this.title = scene.add.text(cx, 70, "", { fontFamily: FONT, fontSize: "36px" }).setOrigin(0.5);
    this.subtitle = scene.add
      .text(cx, 112, "", { fontFamily: FONT, fontSize: "20px", color: GOLD })
      .setOrigin(0.5);
    const stats = scene.add
      .text(cx, 146, yourStats, {
        fontFamily: FONT,
        fontSize: "13px",
        color: "#ffffff",
        align: "center",
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0);
    const header = scene.add
      .text(40, 222, "#   PLAYER       BADGES KOs     SCORE", { fontFamily: FONT, fontSize: "13px", color: GREY })
      .setOrigin(0, 0.5);
    // The standings fill 246–550 px: 8 players at 24 px, more closer together.
    const gap = Math.min(24, 304 / players);
    for (let i = 0; i < players; i++) {
      this.rows.push(
        scene.add
          .text(40, 246 + i * gap, "", { fontFamily: FONT, fontSize: players > 12 ? "12px" : "14px" })
          .setOrigin(0, 0.5),
      );
    }
    this.status = scene.add
      .text(cx, 572, "", { fontFamily: FONT, fontSize: "14px", color: GREY })
      .setOrigin(0.5);

    const button = (x: number, w: number, label: string, onPress: () => void): Button => {
      const bg = scene.add
        .rectangle(x, 622, w, 48, 0x1b2340)
        .setStrokeStyle(2, 0x4ea1ff)
        .setInteractive({ useHandCursor: true });
      const text = scene.add.text(x, 622, label, { fontFamily: FONT, fontSize: "18px" }).setOrigin(0.5);
      bg.on("pointerdown", onPress);
      return { bg, text };
    };
    this.buttons = {
      ff: button(92, 168, "FAST-FORWARD", () => this.actions.fastForward()),
      watch: button(254, 136, "WATCH", () => this.actions.watch()),
      again: button(170, 200, "AGAIN", () => this.actions.again()),
      menu: button(396, 136, "MENU", () => this.actions.menu()),
    };
    this.root = scene.add
      .container(0, 0, [
        backdrop,
        this.title,
        this.subtitle,
        stats,
        header,
        ...this.rows,
        this.status,
        ...Object.values(this.buttons).flatMap((b) => [b.bg, b.text]),
      ])
      .setDepth(DEPTH);
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  update(state: ResultsState): void {
    const { tiles, you, over } = state;
    const me = tiles[you];
    const won = me.placement === 1;
    this.title.setText(won ? "WINNER!" : "KNOCKED OUT").setColor(won ? GOLD : RED);
    this.subtitle.setText(
      `Place #${me.placement} of ${tiles.length}` +
        (me.koBy !== null ? ` · KO by ${seatName(me.koBy, you)}` : ""),
    );

    // Still playing first (best score first), then by final place.
    const order = [...tiles].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return a.alive ? b.score - a.score : a.placement - b.placement;
    });
    this.rows.forEach((row, i) => {
      const t = order[i];
      if (!t) return row.setText("");
      const place = t.alive ? "--" : String(t.placement).padEnd(2);
      const who = `${seatName(t.seat, you)} ${t.who === "human" ? "" : t.who}`.padEnd(13);
      const badges = (t.badges ? "★".repeat(t.badges) : "-").padEnd(7);
      const kos = String(t.kos).padStart(3);
      const score = t.score.toLocaleString("en-US").padStart(10);
      row
        .setText(`${place}  ${who}${badges}${kos}${score}${t.alive ? "  playing" : ""}`)
        .setColor(t.seat === you ? GOLD : t.alive ? GREEN : "#ffffff");
    });

    const left = tiles.filter((t) => t.alive).length;
    this.status.setText(
      over
        ? `Winner: ${winnerName(tiles, you)}`
        : state.fastForwarding
          ? `fast-forwarding… ${left} left`
          : `${left} still playing`,
    );
    this.status.setColor(over ? GOLD : GREY);
    const show = (b: Button, on: boolean) => {
      b.bg.setVisible(on);
      b.text.setVisible(on);
    };
    show(this.buttons.ff, !over && !state.fastForwarding);
    show(this.buttons.watch, !over && !state.fastForwarding);
    show(this.buttons.again, over);
    show(this.buttons.menu, true);
  }

  destroy(): void {
    this.root.destroy();
  }
}

export interface WatchActions {
  next(dir: 1 | -1): void;
  results(): void;
}

/**
 * While watching another player: a bar over the keypad area (never over the
 * field) naming who is shown, with ◀ ▶ to switch and RESULTS to go back.
 */
export class WatchBar {
  private readonly root: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, actions: WatchActions) {
    const top = PLAYER.Y + 26;
    const h = GAME.HEIGHT - top;
    const cx = GAME.WIDTH / 2;
    const backdrop = scene.add
      .rectangle(cx, top + h / 2, GAME.WIDTH, h, 0x05060f, 1)
      .setInteractive();
    this.label = scene.add
      .text(cx, top + 40, "", { fontFamily: FONT, fontSize: "18px", color: GOLD, align: "center", lineSpacing: 6 })
      .setOrigin(0.5, 0);
    const button = (x: number, w: number, label: string, onPress: () => void) => {
      const y = KEYPAD_AREA.BOTTOM - 20;
      const bg = scene.add
        .rectangle(x, y, w, 52, 0x1b2340)
        .setStrokeStyle(2, 0x4ea1ff)
        .setInteractive({ useHandCursor: true });
      bg.on("pointerdown", onPress);
      return [bg, scene.add.text(x, y, label, { fontFamily: FONT, fontSize: "20px" }).setOrigin(0.5)];
    };
    this.root = scene.add
      .container(0, 0, [
        backdrop,
        this.label,
        ...button(60, 80, "◀", () => actions.next(-1)),
        ...button(cx, 180, "RESULTS", () => actions.results()),
        ...button(GAME.WIDTH - 60, 80, "▶", () => actions.next(1)),
        scene.add
          .text(cx, GAME.HEIGHT - 22, "← → switch · Enter results", { fontFamily: FONT, fontSize: "12px", color: BLUE })
          .setOrigin(0.5),
      ])
      .setDepth(DEPTH)
      .setVisible(false);
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  update(tiles: readonly PlayerTile[], watched: number, you: number): void {
    const t = tiles[watched];
    const left = tiles.filter((x) => x.alive).length;
    this.label.setText(
      `WATCHING ${seatName(watched, you)} ${t.who === "human" ? "" : t.who.toUpperCase()}\n` +
        `${t.badges ? "★".repeat(t.badges) + "  " : ""}${t.kos} KO  ·  ${t.score.toLocaleString("en-US")}\n` +
        `${left} left`,
    );
  }

  destroy(): void {
    this.root.destroy();
  }
}
