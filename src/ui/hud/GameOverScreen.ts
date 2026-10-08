import type Phaser from "phaser";
import { GAME } from "../../config/constants";
import { PALETTE } from "../../config/palette";
import type { Mastery } from "../../services/masteryStats";
import type { Field } from "../../sim/Field";
import { summarizeSolves } from "../../sim/stats";
import { textStyle } from "../theme";
import { DEPTH } from "./layout";

export interface GameOverInfo {
  field: Field;
  /** The stored personal bests, this run included. */
  mastery: Mastery;
  rank: string;
  /** Battle: where the player placed, of how many (null in solo play). */
  battle: { placement: number; players: number } | null;
  /** What tapping does next ("tap / Enter to …"). */
  continueHint: string;
}

const CENTER_X = GAME.WIDTH / 2;
const CENTER_Y = GAME.HEIGHT / 2;

/**
 * The game-over screen over the frozen field: the result (or the battle
 * placement), this run's stats next to the personal bests, the run's pace
 * (to compare with `npm run bots`), and what a tap does next.
 */
export class GameOverScreen {
  constructor(
    private readonly scene: Phaser.Scene,
    info: GameOverInfo,
  ) {
    scene.add
      .rectangle(CENTER_X, CENTER_Y, GAME.WIDTH, GAME.HEIGHT, PALETTE.BACKGROUND, 0.8)
      .setDepth(DEPTH.GAME_OVER - 1);

    const won = info.battle?.placement === 1;
    const title = won ? "WINNER!" : info.battle ? "KNOCKED OUT" : "GAME OVER";
    this.line(-110, title, textStyle(info.battle && !won ? 34 : 40, won ? PALETTE.GOLD : PALETTE.DANGER));

    const subtitle = info.battle ? `Place #${info.battle.placement} of ${info.battle.players}` : `Rank: ${info.rank}`;
    this.line(-60, subtitle, textStyle(24, PALETTE.GOLD));

    this.line(24, statsText(info), textStyle(16, PALETTE.TEXT, { align: "center", lineSpacing: 8 }));
    this.line(118, info.continueHint, textStyle(16, PALETTE.ACCENT));
  }

  /** The playtest build saved this run (or failed to): say so at the bottom. */
  showSaveStatus(saved: boolean): void {
    const text = saved ? "run saved for analysis ✓" : "couldn't save this run";
    this.line(146, text, textStyle(13, saved ? PALETTE.ENERGY : PALETTE.DANGER));
  }

  /** A centered line `dy` px below the screen's center. */
  private line(dy: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle): void {
    this.scene.add.text(CENTER_X, CENTER_Y + dy, text, style).setOrigin(0.5).setDepth(DEPTH.GAME_OVER);
  }
}

function statsText({ field: f, mastery, battle }: GameOverInfo): string {
  const fastest = mastery.fastestSolveMs > 0 ? `${(mastery.fastestSolveMs / 1000).toFixed(2)}s` : "—";
  const medians = summarizeSolves(f.solves)
    .map((s) => `${s.balls} balls ${s.median.toFixed(1)}s`)
    .join(" · ");
  const powerName = f.power.def.NAME;
  const powerSpent = Math.round(f.energy.spent[f.power.kind]);
  const energyLine = battle
    ? `Attack sent ${Math.round(f.attack.spent.send)} · ${powerName} ${powerSpent} · cancelled ${Math.round(f.cancelledTotal)}`
    : `Energy earned ${Math.round(f.energy.earned)} · ${powerSpent} on ${powerName}`;
  return [
    `Score: ${f.score}    Best: ${mastery.highScore}`,
    `Best combo: ${mastery.bestCombo}    Kills: ${mastery.totalKills}`,
    `Survived ${formatMinutes(f.elapsedMs)}    Fastest solve: ${fastest}`,
    `Median solve: ${medians || "—"}`,
    energyLine,
  ].join("\n");
}

/** 125000 ms → "2:05". */
function formatMinutes(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
