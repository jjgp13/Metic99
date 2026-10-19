import { ENEMY } from "../config/constants";
import { STORM } from "../config/levels/sky";
import { Boss, type AbilityHost } from "./abilities";
import type Alien from "./Alien";
import { Wind, inField } from "./skyTraits";

/**
 * The STORM CLOUD (level 7, mechanic "sky_storm"). Like every boss it takes
 * HP answers and blows away after each one but the last (Boss: hidden while
 * it moves, then it gathers itself and holds still). Its own fight:
 *
 *   drift down (and across with each gust of the level's wind) → every
 *   RAIN_EVERY_MS it rumbles (it darkens and shakes; its numbers stay
 *   readable) → THUNDER: lightning strikes and a raindrop falls out of it
 *
 * An answer it survives makes it thunder at once (a raindrop falls) before
 * it blows away, so the rain comes even to a player who never lets the
 * rumble finish.
 *
 * A raindrop is a part of the boss (BossDef.PART, `RainDrop`): a 2-ball sum
 * that wobbles down. Only one falls at a time, and the next rumble waits
 * until it is answered, so the cloud is beaten between its rains. The level
 * is cleared once the cloud and every raindrop are gone (Field checks that
 * no boss part is left). The rumble borrows the strafer's "windup" mode, the
 * game's telegraph: the view shakes the cloud and bots see the danger.
 */
export class StormCloud extends Boss {
  readonly wind = new Wind();
  /** It is rumbling: thunder comes when the rumble's hold ends. */
  rumbling = false;
  /** Ms left of the lightning bolt the view draws; `boltTo` is where it struck. */
  flashLeftMs = 0;
  boltTo: readonly [number, number] | null = null;
  /** Field ms since it last rained (counted while no raindrop is falling). */
  private sinceRainMs = 0;
  private drop: Alien | null = null;

  update(delta: number, alien?: Alien, host?: AbilityHost): void {
    this.wind.tick(delta, alien);
    this.flashLeftMs = Math.max(0, this.flashLeftMs - delta);
    // The rumble is a hold, so it lasts in field time (and never ends while
    // the cloud is the held target: the shot comes first).
    if (alien && host && this.rumbling && !alien.scripted) this.thunder(alien, host);
    super.update(delta); // sets the cover: hidden while it blows away
  }

  steer(alien: Alien, delta: number): void {
    if (this.burrowing || this.rumbling) return;
    // The rain clock runs once its numbers are well on the page (also while
    // it holds still after an answer), one raindrop at a time.
    if (alien.y >= this.def.MIN_Y && !this.drop?.active) this.sinceRainMs += delta;
    if (alien.scripted) return;
    if (this.wind.takeGust(alien, delta)) {
      alien.glideTo(inField(alien, alien.x + this.wind.dir * STORM.GUST_DX), alien.y, STORM.GUST_MS);
      return;
    }
    if (this.sinceRainMs < STORM.RAIN_EVERY_MS) return;
    this.sinceRainMs = 0;
    this.rumbling = true;
    alien.mode = "windup";
    alien.hold(STORM.RUMBLE_MS);
  }

  /** An answer it survives makes it thunder too (if no raindrop is falling),
   * then it blows away like any boss. */
  onHit(alien: Alien, host: AbilityHost): boolean {
    this.calmDown(alien);
    const survives = this.hp > 1;
    if (survives && !this.drop?.active) this.thunder(alien, host);
    return super.onHit(alien, host);
  }

  retreat(alien: Alien): void {
    this.calmDown(alien);
    super.retreat(alien);
  }

  /** Lightning, and a raindrop falls out of the cloud's underside. */
  private thunder(alien: Alien, host: AbilityHost): void {
    this.calmDown(alien);
    this.sinceRainMs = 0;
    this.flashLeftMs = STORM.FLASH_MS;
    const part = this.def.PART;
    if (!part) return;
    // Just under the cloud's box, so the two never break the readability rule.
    const y = alien.y + alien.bottom + ENEMY.READ_GAP + part.BOX.BALLS_Y + ENEMY.BALL_RADIUS + 1;
    this.boltTo = [alien.x, y];
    this.drop = host.spawnBossPart(part, alien.x, y);
    if (this.drop) this.drop.hold(STORM.DROP_REVEAL_MS);
    else this.sinceRainMs = STORM.RAIN_EVERY_MS - STORM.RETRY_MS; // no room: rumble again soon
  }

  private calmDown(alien: Alien): void {
    this.rumbling = false;
    alien.mode = "move";
  }
}

/**
 * A raindrop out of the storm (mechanic "sky_raindrop"): one answer beats it.
 * If it reaches the ship it splashes (a life is lost, like any boss reaching
 * the ship), evaporates back up the page (hidden) and falls again.
 */
export class RainDrop extends Boss {}
