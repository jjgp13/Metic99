import { BOT, GAME, PLAYER } from "../config/constants";
import type Alien from "../objects/Alien";
import type { Field } from "./Field";

/**
 * What a person could read on a field right now: live aliens whose balls
 * are on screen (and not shut behind a Blinker's lids), minus the one already
 * answered or locked. Bots decide from this, and so does the battle HUD's
 * power nudge, so both judge the board the same way.
 */
export function readableAliens(field: Field): Alien[] {
  // The alien whose answer is typed and waiting for the ship is done.
  const answered = field.typed === "" ? undefined : field.alienFor(parseInt(field.typed, 10));
  return field.aliens.filter(
    (a) =>
      a.active &&
      a !== field.lockedTarget &&
      a !== answered &&
      a.y - a.top >= 0 && // its balls are on screen
      a.x >= 0 && a.x <= GAME.WIDTH && // not still coming in from a side edge
      (a.ability?.cover ?? 0) <= BOT.MAX_READ_COVER,
  );
}

/** Readable aliens that can cost a life (not the bonus drifter). */
export function openThreats(field: Field): Alien[] {
  return readableAliens(field).filter((a) => a.lethal);
}

/**
 * A dangerous moment, the owner's own FREEZE pattern (see BOT): at least
 * `minOpen` unanswered aliens with the nearest within `nearPx` of the ship,
 * or any one within `panicPx`.
 */
export function isDangerous(
  field: Field,
  rule: { minOpen: number; nearPx: number; panicPx: number },
): boolean {
  const open = openThreats(field);
  const nearest = open.reduce((d, a) => Math.min(d, PLAYER.Y - a.y), Infinity);
  return (open.length >= rule.minOpen && nearest <= rule.nearPx) || nearest <= rule.panicPx;
}
