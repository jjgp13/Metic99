import type { Field } from "./Field";
import type { Match, MatchEvent, PlayerTile } from "./Match";

/**
 * What the game screen needs from a battle, wherever it runs
 * (docs/NETCODE.md, S4): offline the whole `Match` runs on this device
 * (`LocalBattle`); online only your field runs here and the rest comes from
 * the server (`net/NetBattle`). GameScene and the battle views read only
 * this, so the screen is the same in both.
 */
export interface BattleSource {
  /** Your seat. */
  readonly you: number;
  /** Played against people over the network (no pausing: the others don't wait). */
  readonly online: boolean;
  /** Your field: the one you play (online: played here at once, the server
   * checks it from your inputs). */
  readonly field: Field;
  readonly seatCount: number;
  /** One fixed rule step. */
  step(dt: number): void;
  /** Once per frame, also while paused or after game over (online: talk to
   * the server). */
  poll(): void;
  /** Match events since the last call (KOs, attacks, the end). */
  takeEvents(): MatchEvent[];
  /** What everyone sees of everyone. */
  tiles(): PlayerTile[];
  /** Final place of a seat (1 = winner), 0 while still playing or unknown. */
  placementOf(seat: number): number;
  /** Online: why the server replaced you with a bot, else null. */
  readonly kicked: string | null;
}

/** An offline battle: the whole match runs here; you are seat 0. */
export class LocalBattle implements BattleSource {
  readonly you = 0;
  readonly online = false;
  readonly kicked = null;

  constructor(readonly match: Match) {}

  get field(): Field {
    return this.match.fields[this.you];
  }

  get seatCount(): number {
    return this.match.seats.length;
  }

  step(dt: number): void {
    this.match.step(dt);
  }

  poll(): void {}

  takeEvents(): MatchEvent[] {
    return this.match.takeEvents();
  }

  tiles(): PlayerTile[] {
    return this.match.tiles();
  }

  placementOf(seat: number): number {
    return this.match.placements[seat];
  }
}
