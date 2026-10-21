import Phaser from "phaser";
import { artMode } from "../config/artMode";
import { GAME, LEADERBOARD, POWERS, type PowerKind } from "../config/constants";
import { shipIconFrames } from "../renderDoodle/shipIcons";
import { type EndlessDetails, formatSurvival } from "../services/endlessDetails";
import { type Board, ScoreRow, getTop, isLeaderboardEnabled } from "../services/leaderboard";
import { PALETTE } from "../config/palette";
import { textStyle } from "../ui/theme";

interface LeaderboardData {
  /** When true the scene was opened from the menu to browse the board, so it
   * fetches the top scores itself and offers BACK instead of "play again". */
  browse?: boolean;
  /** Which board (default Endless) and its heading. */
  board?: Board;
  title?: string;
  /** Browse: the player's own best on this board, to compare (0 = none). */
  yourBest?: number;
  /** Post-run: one more line under the rank (a story run's stage ranks). */
  note?: string;
  /** The scene to go back to (default the menu). */
  back?: string;
  playerName?: string;
  score?: number;
  rank?: number;
  top?: ScoreRow[];
  ok?: boolean;
  rowId?: number;
}

/** The Endless board's columns (x in the 480-wide layout): rank + name,
 * ship icon (center), power, world, then time and score (right edges). */
const COLS = { NAME: 20, SHIP: 140, POWER: 160, WORLD: 226, TIME: 380, SCORE: 460 } as const;
const SHIP_ICON_PX = 20;

/**
 * Global high-score board, for one board (Endless, a story stage or a whole
 * story run). Two modes:
 *   - post-run  (from NameEntryScene): highlights the player's submitted run and
 *     shows their world rank; tap/Enter goes back.
 *   - browse    (from the menu or the story map): fetches and shows the top
 *     scores; BACK goes back.
 */
export default class LeaderboardScene extends Phaser.Scene {
  private result!: {
    browse: boolean;
    board: Board;
    title: string;
    yourBest: number;
    note: string;
    back: string;
    playerName: string;
    score: number;
    rank: number;
    top: ScoreRow[];
    ok: boolean;
    rowId?: number;
  };
  private rowObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("LeaderboardScene");
  }

  init(data: LeaderboardData): void {
    this.result = {
      browse: Boolean(data.browse),
      board: data.board ?? LEADERBOARD.ENDLESS_BOARD,
      title: data.title ?? "HIGH SCORES",
      yourBest: data.yourBest ?? 0,
      note: data.note ?? "",
      back: data.back ?? "MenuScene",
      playerName: data.playerName ?? "",
      score: data.score ?? 0,
      rank: data.rank ?? 0,
      top: data.top ?? [],
      ok: Boolean(data.ok),
      rowId: data.rowId,
    };
    this.rowObjects = [];
  }

  create(): void {
    const cx = GAME.WIDTH / 2;

    this.add
      .text(cx, 70, this.result.title, textStyle(30, PALETTE.GOLD))
      .setOrigin(0.5);

    const sub = this.result.browse
      ? this.result.yourBest > 0 ? `your best: ${this.result.yourBest}` : ""
      : this.result.note;
    if (sub) this.add.text(cx, 134, sub, textStyle(14, PALETTE.TEXT_MUTED)).setOrigin(0.5);

    if (!this.result.browse) {
      if (this.result.ok && this.result.rank > 0) {
        this.add
          .text(cx, 112, `YOUR RANK: #${this.result.rank}`, textStyle(18, PALETTE.ACCENT))
          .setOrigin(0.5);
      } else if (!this.result.ok) {
        this.add
          .text(cx, 112, "Offline — score not saved", textStyle(14, PALETTE.TEXT_MUTED))
          .setOrigin(0.5);
      }
    }

    if (this.result.browse) {
      // Browsing from the menu: fetch the board ourselves.
      if (!isLeaderboardEnabled()) {
        this.add
          .text(cx, 200, "World scores are offline", textStyle(16, PALETTE.TEXT_MUTED))
          .setOrigin(0.5);
      } else {
        const loading = this.add
          .text(cx, 200, "Loading…", textStyle(16, PALETTE.TEXT_MUTED))
          .setOrigin(0.5);
        getTop(this.result.board)
          .then((rows) => {
            loading.destroy();
            this.result.top = rows;
            this.renderTable(cx);
          })
          .catch(() => loading.setText("Could not load scores"));
      }
    } else {
      this.renderTable(cx);
    }

    const label = this.result.browse ? "BACK" : "tap or press Enter to continue";
    this.add
      .text(cx, GAME.HEIGHT - 50, label, textStyle(14, PALETTE.TEXT_MUTED))
      .setOrigin(0.5);

    // Both modes go back where they came from.
    this.input.keyboard?.once("keydown-ENTER", () => this.toMenu());
    this.input.keyboard?.once("keydown-ESC", () => this.toMenu());
    this.input.keyboard?.once("keydown-SPACE", () => this.toMenu());
    // Defer the pointer handler a beat so the tap that opened this scene doesn't
    // immediately dismiss it.
    this.time.delayedCall(250, () => {
      this.input.once("pointerdown", () => this.toMenu());
    });
  }

  private renderTable(cx: number): void {
    this.rowObjects.forEach((o) => o.destroy());
    this.rowObjects = [];

    const rows = this.result.top.slice(0, LEADERBOARD.TOP_N);
    const top = 166;
    const lineH = 24;
    const leftX = cx - 150;
    const rightX = cx + 150;

    if (rows.length === 0) {
      this.rowObjects.push(
        this.add
          .text(cx, top + 40, "No scores yet — be the first!", textStyle(16, PALETTE.TEXT_MUTED))
          .setOrigin(0.5),
      );
      return;
    }

    // Endless rows also show what the run was played with (EndlessDetails).
    const endless = this.result.board === LEADERBOARD.ENDLESS_BOARD;
    if (endless) this.addHeader(top - 18);

    // Highlight the player's freshly-submitted run (post-run mode only): by
    // unique row id when we have it, else the first name+score match.
    let highlighted = false;

    rows.forEach((row, i) => {
      const y = top + i * lineH;
      const isPlayer =
        !this.result.browse &&
        !highlighted &&
        this.result.ok &&
        (this.result.rowId != null
          ? row.id === this.result.rowId
          : row.name === this.result.playerName && row.score === this.result.score);
      if (isPlayer) highlighted = true;

      const color = isPlayer ? PALETTE.GOLD : PALETTE.TEXT;
      const rankStr = `${i + 1}`.padStart(2, " ");

      if (endless) {
        this.rowObjects.push(this.add.text(COLS.NAME, y, `${rankStr}. ${row.name}`, textStyle(16, color)));
        if (row.details) this.addDetails(row.details, y, color);
      } else {
        this.rowObjects.push(this.add.text(leftX, y, `${rankStr}. ${row.name}`, textStyle(16, color)));
      }
      this.rowObjects.push(
        this.add
          .text(endless ? COLS.SCORE : rightX, y, `${row.score}`, textStyle(16, color))
          .setOrigin(1, 0),
      );
    });
  }

  /** Endless: the column names over the rows. */
  private addHeader(y: number): void {
    const style = textStyle(12, PALETTE.TEXT_MUTED);
    const add = (x: number, label: string, originX = 0) =>
      this.rowObjects.push(this.add.text(x, y, label, style).setOrigin(originX, 0));
    add(COLS.SHIP, "SHIP", 0.5);
    add(COLS.POWER, "POWER");
    add(COLS.WORLD, "WORLD");
    add(COLS.TIME, "TIME", 1);
    add(COLS.SCORE, "SCORE", 1);
  }

  /** Endless: one row's ship, power, world and survival time. */
  private addDetails(d: EndlessDetails, y: number, color: number): void {
    const icon = this.add.image(COLS.SHIP, y + 10, this.shipIcon(d.ship));
    if (artMode() === "doodle") icon.setScale(0.5);
    else icon.setDisplaySize(SHIP_ICON_PX, SHIP_ICON_PX);
    const power = POWERS[d.power as PowerKind]?.NAME ?? d.power.toUpperCase();
    this.rowObjects.push(
      icon,
      this.add.text(COLS.POWER, y + 2, power, textStyle(13, color)),
      this.add.text(COLS.WORLD, y + 2, d.theme.toUpperCase(), textStyle(13, PALETTE.TEXT_MUTED)),
      this.add.text(COLS.TIME, y + 1, formatSurvival(d.survivalMs), textStyle(14, color)).setOrigin(1, 0),
    );
  }

  /** A ship's small picture: its doodle (drawn at 2× for sharpness), or the
   * 3D model's icon in the 3D art. */
  private shipIcon(model: string): string {
    if (artMode() !== "doodle") return `icon:${model}`;
    return shipIconFrames(this.textures, model, SHIP_ICON_PX * 2)[0];
  }

  private toMenu(): void {
    this.scene.start(this.result.back);
  }
}
