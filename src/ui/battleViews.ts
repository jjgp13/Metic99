import type Phaser from "phaser";
import type { Match, MatchEvent, PlayerTile } from "../sim/Match";
import { OpponentBoard, boardFits } from "./OpponentBoard";

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
}

/**
 * The views for this screen. Add a view here (one line), e.g. an opponent
 * board when the window is wide enough and a compact strip on phones.
 */
export function createBattleViews(
  scene: Phaser.Scene,
  _match: Match,
  actions: BattleActions,
): BattleView[] {
  const views: BattleView[] = [];
  // Desktop: the other players' tiles beside the canvas, when there is room.
  if (boardFits(scene.game.canvas)) views.push(new OpponentBoard(scene.game.canvas, actions));
  return views;
}
