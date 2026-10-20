import { GAME } from "../config/constants";
import { SNOWBALL_GROW, YETI_STOMP as Y } from "../config/levels/snow";
import { Boss, type AbilityHost } from "./abilities";
import type Alien from "./Alien";

/**
 * The YETI (level 8, mechanic "snow_stomp"). Like every boss it takes HP
 * answers and dives away after each one but the last (Boss: hidden while it
 * tunnels through the snow, then it bursts out and holds still). Its own
 * fight is a clumsy stomp:
 *
 *   walk WALK_PX closer → stop and raise its fists (it shakes: the
 *   telegraph) → STOMP and throw a snowball to the side, which rolls down
 *   the slope like any snowball (and picks up a number if left too long)
 *
 * Its own sum never changes, so the yeti can be answered while its snowball
 * flies. At most MAX_THROWN of its snowballs are up at once, and a throw
 * that has no room (readability rule, a full field) is skipped. The windup
 * borrows the strafer's "windup" mode, the game's telegraph: the view
 * shakes it and bots see the danger.
 */
export class Yeti extends Boss {
  private windingUp = false;
  /** Where the current walk started (null: not walking yet). */
  private walkFromY: number | null = null;
  private stompLeftMs = 0;
  private readonly thrown: Alien[] = [];

  /** It just stomped (the view draws the thud). */
  get stomping(): boolean {
    return this.stompLeftMs > 0;
  }

  update(delta: number, alien?: Alien, host?: AbilityHost): void {
    this.stompLeftMs = Math.max(0, this.stompLeftMs - delta);
    if (alien && host && !this.burrowing) this.fight(alien, host);
    super.update(delta); // sets the cover: hidden while it tunnels
  }

  /** Walk → wind up → stomp and throw, while it isn't tunneling after an answer. */
  private fight(alien: Alien, host: AbilityHost): void {
    if (this.windingUp) {
      // The windup is a hold, so it lasts in field time (and never ends while
      // the yeti is the held target: the shot comes first).
      if (!alien.scripted) this.stomp(alien, host);
      return;
    }
    if (alien.scripted) return; // bursting out, revealing
    // Its walk counts only once its numbers are well on screen.
    this.walkFromY ??= Math.max(alien.y, this.def.MIN_Y);
    if (alien.y - this.walkFromY >= Y.WALK_PX) {
      this.windingUp = true;
      alien.mode = "windup";
      alien.hold(Y.WINDUP_MS);
    }
  }

  onHit(alien: Alien, host: AbilityHost): boolean {
    this.calmDown(alien);
    return super.onHit(alien, host);
  }

  retreat(alien: Alien): void {
    this.calmDown(alien);
    super.retreat(alien);
  }

  private stomp(alien: Alien, host: AbilityHost): void {
    this.calmDown(alien);
    this.stompLeftMs = Y.STOMP_MS;
    alien.hold(Y.STOMP_MS); // it stays put while the ground shakes
    for (let i = this.thrown.length - 1; i >= 0; i--) if (!this.thrown[i].active) this.thrown.splice(i, 1);
    if (this.thrown.length >= Y.MAX_THROWN) return;
    // Throw toward the roomier side, from just outside its own box.
    const side = alien.x < GAME.WIDTH / 2 ? 1 : -1;
    const startX = alien.x + side * (alien.halfW + Y.THROW_FROM_PX);
    const toX = Math.min(Math.max(alien.x + side * Y.THROW_DX, 40), GAME.WIDTH - 40);
    const y = Math.min(alien.y, Y.THROW_MAX_Y, SNOWBALL_GROW.GROW_Y - 60);
    const ball = host.spawnMinion?.("swooper", [startX, alien.y], [toX, y], Y.THROW_MS);
    if (ball) this.thrown.push(ball);
  }

  /** Back to walking: the next stomp needs a whole new walk. */
  private calmDown(alien: Alien): void {
    this.windingUp = false;
    this.walkFromY = null;
    alien.mode = "move";
  }
}
