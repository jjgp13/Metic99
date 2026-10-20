import Phaser from "phaser";
import { GAME, LEADERBOARD } from "../config/constants";
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
  private rowObjects: Phaser.GameObjects.Text[] = [];

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

      this.rowObjects.push(
        this.add.text(leftX, y, `${rankStr}. ${row.name}`, textStyle(16, color)),
      );
      this.rowObjects.push(
        this.add
          .text(rightX, y, `${row.score}`, textStyle(16, color))
          .setOrigin(1, 0),
      );
    });
  }

  private toMenu(): void {
    // Explicit (empty) data: started without any, Phaser would hand the
    // scene its last start's data again (e.g. the story map's flight).
    this.scene.start(this.result.back, {});
  }
}
