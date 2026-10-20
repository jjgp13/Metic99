import { OWL_RIDDLE } from "../config/levels/treetops";
import { Boss, type AbilityHost } from "./abilities";
import type Alien from "./Alien";

/**
 * The Great Owl (level 3's boss, MECHANIC "riddle"): a wise owl asking
 * "WHO?". Its two big eyes are its numbers, but only the first shows a
 * digit: the second is a "?", and its belly shows the total ("= 8"). The
 * answer is the missing number (3 + ? = 8: type 5), so its `result` is the
 * second ball, not the sum (AbilityHost.rerollMissing keeps it unique).
 * It moves like every boss: after an answer it flies to the other side
 * (eyes shut while flying), perches and asks a new riddle.
 *
 * Its first riddle replaces the plain sum it was spawned with, at its first
 * update (the same step, before anyone can read it). Without a host that
 * can roll riddles (a test's stand-in) it stays a plain sum.
 */
export class WiseOwl extends Boss {
  /** Its sum is a riddle (else a plain sum, if no riddle was free). */
  riddle = false;
  private asked = false;

  update(delta: number, alien?: Alien, host?: AbilityHost): void {
    super.update(delta);
    if (this.asked || !alien || !host) return;
    this.asked = true;
    this.newSum(alien, host);
  }

  /** A new riddle; if none is free it keeps the one it has. */
  protected newSum(alien: Alien, host: AbilityHost): void {
    if (host.rerollMissing?.(alien, OWL_RIDDLE.MIN_ANSWER)) this.riddle = true;
    else if (!this.riddle) host.rerollSum(alien);
  }

  ballText(i: number, digit: number): string {
    return this.riddle && i === 1 ? "?" : String(digit);
  }

  /** The total on its belly: what its two numbers add up to. */
  total(alien: Alien): number {
    return alien.digits.reduce((sum, d) => sum + d, 0);
  }
}
