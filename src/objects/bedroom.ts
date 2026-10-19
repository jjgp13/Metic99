import { ENEMY, GAME } from "../config/constants";
import { BOUNCE, JACK, LOOP, NAP, PEEK, TOY_THROW, WINDUP } from "../config/levels/bedroom";
import { Ability, Boss, blinkCover, type AbilityHost } from "./abilities";
import type Alien from "./Alien";

/**
 * Level 10, THE KID'S BEDROOM's own rules (config/levels/bedroom.ts): the
 * toys' traits (listed in objects/traits.ts) and the Under-the-Bed Monster
 * (listed in objects/bosses.ts). Every name starts with "bedroom_" so no
 * other level can pick the same one.
 */

const TAU = Math.PI * 2;

/** Where a wind-up soldier is in its spring: marching, running down, stopped. */
export type WindPhase = "march" | "slow" | "stop";

/**
 * Wind-up soldier: it marches (its kind's own pattern) while the key turns,
 * slows down as the spring runs out, stands still while the key is wound
 * again, then marches on. The spring runs on field time (`pace`), so FREEZE
 * holds it, and soldiers that came in together (a marching line) stop and
 * start together.
 */
export class Windup extends Ability {
  readonly kind = "bedroom_windup";
  phase: WindPhase = "march";
  /** How far round the key is (radians), for the view. */
  key = 0;
  private t = 0;

  pace(_alien: Alien, delta: number): number {
    const W = WINDUP;
    this.t = (this.t + delta) % (W.WALK_MS + W.SLOW_MS + W.STOP_MS);
    let k: number;
    if (this.t < W.WALK_MS) {
      this.phase = "march";
      k = 1;
    } else if (this.t < W.WALK_MS + W.SLOW_MS) {
      this.phase = "slow";
      k = 1 - (this.t - W.WALK_MS) / W.SLOW_MS;
    } else {
      this.phase = "stop";
      k = 0;
    }
    // The key unwinds as it marches and is wound back while it stands.
    this.key += (k > 0 ? -k : 3) * ((TAU * delta) / 1000);
    return delta * k;
  }
}

/** Where a jack-in-the-box is: shut and cranking, popping, out, ducking back. */
export type JackPhase = "crank" | "pop" | "open" | "duck";

/**
 * Jack-in-the-box: it moves only when the jack pops. Shut, it cranks its
 * handle (numbers hidden inside; the box shakes for the last WARN_MS), then
 * the lid flies open, the jack springs out with his eyes (the numbers) and
 * the box jumps POP_PX closer. He stays out OPEN_MS, then squeezes back in.
 * Each phase is a glide or a hold, so the rhythm runs in field time, and the
 * kind's own pattern never runs.
 */
export class JackInTheBox extends Ability {
  readonly kind = "bedroom_jack";
  /** It starts as if it just ducked in: the first thing it does is crank. */
  phase: JackPhase = "duck";

  update(_delta: number, alien?: Alien): void {
    if (!alien) return;
    if (!alien.scripted) this.next(alien);
    this.cover = this.coverNow(alien);
  }

  /** The last WARN_MS of the crank: the box shakes (view, telegraph). */
  shaking(alien: Alien): boolean {
    return this.phase === "crank" && alien.holdLeftMs <= JACK.WARN_MS;
  }

  private next(alien: Alien): void {
    switch (this.phase) {
      case "duck":
        this.phase = "crank";
        alien.hold(JACK.CRANK_MS);
        break;
      case "crank":
        this.phase = "pop";
        alien.glideTo(alien.x, alien.y + JACK.POP_PX, JACK.POP_MS);
        break;
      case "pop":
        this.phase = "open";
        alien.hold(JACK.OPEN_MS);
        break;
      case "open":
        this.phase = "duck";
        alien.hold(JACK.DUCK_MS);
        break;
    }
  }

  private coverNow(alien: Alien): number {
    switch (this.phase) {
      case "crank":
        return 1;
      case "duck":
        return 1 - alien.holdLeftMs / JACK.DUCK_MS; // the lid closing
      default:
        return 0; // the jack is out (he springs out at once)
    }
  }
}

/** Where a rubber ball is: rolling in, in the air, squashed on landing. */
export type BouncePhase = "roll" | "air" | "squash";

/**
 * Rubber ball: it rolls in from a side (the swooper's flight in), then
 * bounces down the page, DX sideways and DY down per bounce. It bounces off
 * the page's edges, and off another toy when one stops it (the readability
 * rule cut its last bounce short). Glides and holds: field time.
 */
export class Bounce extends Ability {
  readonly kind = "bedroom_bounce";
  phase: BouncePhase = "roll";
  /** How far through the current bounce (0..1), for the arc in the view. */
  progress = 0;
  private dir: 1 | -1 | null = null;
  private fromY = 0;
  private aimX = 0;

  update(_delta: number, alien?: Alien): void {
    if (!alien) return;
    if (alien.mode === "enter") return; // still rolling in
    if (!alien.scripted) this.bounce(alien);
    this.phase = alien.gliding ? "air" : "squash";
    this.progress = alien.gliding ? Math.min(1, Math.max(0, (alien.y - this.fromY) / BOUNCE.DY)) : 1;
  }

  private bounce(alien: Alien): void {
    let dir = this.dir ?? alien.heading;
    // Blocked last time (another toy in the way): bounce back off it.
    if (this.dir !== null && Math.abs(alien.x - this.aimX) > BOUNCE.DX / 2) dir = dir > 0 ? -1 : 1;
    // Off the page's edges.
    const x = alien.x + dir * BOUNCE.DX;
    if (x - alien.halfW < 0 || x + alien.halfW > GAME.WIDTH) dir = dir > 0 ? -1 : 1;
    this.dir = dir;
    this.aimX = alien.x + dir * BOUNCE.DX;
    this.fromY = alien.y;
    alien.glideTo(this.aimX, alien.y + BOUNCE.DY, BOUNCE.HOP_MS);
    alien.hold(BOUNCE.SQUASH_MS);
  }
}

/** Where a teddy bear is: waddling, yawning (a nap is coming), napping. */
export type NapPhase = "waddle" | "yawn" | "nap";

/**
 * Teddy bear: it waddles (its kind's stomp, swaying side to side in step),
 * yawns, then sits down for a nap and doesn't move. Its numbers never hide:
 * it carries the page's hardest sums, and the nap is time to read them.
 * Field time (`pace`), like the bat's roost.
 */
export class Nap extends Ability {
  readonly kind = "bedroom_nap";
  phase: NapPhase = "waddle";
  private t = 0;
  private sway = 0;

  pace(alien: Alien, delta: number): number {
    this.t = (this.t + delta) % (NAP.WALK_MS + NAP.NAP_MS);
    if (this.t >= NAP.WALK_MS) {
      this.phase = "nap";
      return 0;
    }
    this.phase = this.t >= NAP.WALK_MS - NAP.YAWN_MS ? "yawn" : "waddle";
    // Incremental, so a sway refused by the readability rule never makes it jump.
    const g = this.sway + (TAU * delta) / NAP.WADDLE_MS;
    alien.x += NAP.WADDLE_PX * (Math.sin(g) - Math.sin(this.sway));
    this.sway = g % TAU;
    return delta;
  }
}

/**
 * Paper plane (the bonus): it glides across the room (the drifter's own
 * crossing) and every EVERY_MS flies a loop-the-loop: up, over and back
 * down, drawn on top of its crossing. Field time (`pace`).
 */
export class LoopTheLoop extends Ability {
  readonly kind = "bedroom_loop";
  /** Radians round the current loop, or null while gliding straight. */
  loop: number | null = null;
  private leftMs: number = LOOP.EVERY_MS;

  pace(alien: Alien, delta: number): number {
    if (this.loop === null) {
      this.leftMs -= delta;
      if (this.leftMs > 0) return delta;
      this.loop = 0;
    }
    const g0 = this.loop;
    const g = Math.min(TAU, g0 + (TAU * delta) / LOOP.LOOP_MS);
    const R = LOOP.RADIUS_PX;
    alien.x += alien.heading * R * (Math.sin(g) - Math.sin(g0));
    alien.y -= R * (Math.cos(g0) - Math.cos(g)); // up first, then back down
    this.loop = g >= TAU ? null : g;
    if (this.loop === null) this.leftMs = LOOP.EVERY_MS;
    return delta;
  }
}

/**
 * The UNDER-THE-BED MONSTER (mechanic "bedroom_underbed"): a Boss whose
 * body is a bed creeping toward the player, with the monster hiding under
 * it. Only its eyes (the numbers) peek out of the dark, and they duck back
 * in on a rhythm (PEEK, real time like the Blinker's eyes). After each
 * answer but the last it scoots across and up (the base Boss's burrow), and
 * as it comes back up it flings a toy out beside the bed (TOY_THROW). Its
 * last answer flips the bed: the monster climbs out in full where the bed
 * was (def.PART), and the level is cleared once that is beaten too.
 */
export class UnderTheBed extends Boss {
  private t = 0;
  private throws = 0;
  private throwPending = false;

  update(delta: number, alien?: Alien, host?: AbilityHost): void {
    super.update(delta); // hidden while it scoots after an answer
    this.t += delta;
    if (this.burrowing) return;
    this.cover = blinkCover(this.t, PEEK);
    if (this.throwPending && alien && host) {
      this.throwPending = false;
      this.throwToy(alien, host);
    }
  }

  onHit(alien: Alien, host: AbilityHost): boolean {
    const survives = super.onHit(alien, host);
    if (survives) this.throwPending = true;
    return survives;
  }

  onKilled(alien: Alien, host: AbilityHost): void {
    const part = this.def.PART;
    if (!part) return;
    // Same box as the bed and the bed is gone, so this spot is clear.
    const monster = host.spawnBossPart(part, alien.x, alien.y);
    monster?.hold(part.REVEAL_MS);
  }

  /** Beside the bed, on whichever side has room (nothing if neither has). */
  private throwToy(alien: Alien, host: AbilityHost): void {
    const kind = TOY_THROW.KINDS[this.throws++ % TOY_THROW.KINDS.length];
    const reach = alien.halfW + TOY_THROW.GAP_PX + ENEMY.READ_GAP + 2 * ENEMY.BALL_RADIUS + 4;
    const toward = alien.x < GAME.WIDTH / 2 ? 1 : -1; // the open side of the room first
    for (const side of [toward, -toward]) {
      const x = alien.x + side * reach;
      if (x < reach / 2 || x > GAME.WIDTH - reach / 2) continue;
      const toy = host.spawnCreature?.(kind, x, alien.y);
      if (toy) {
        toy.hold(TOY_THROW.HOLD_MS);
        return;
      }
    }
  }
}

export const BEDROOM_TRAITS: Record<string, () => Ability> = {
  bedroom_windup: () => new Windup(),
  bedroom_jack: () => new JackInTheBox(),
  bedroom_bounce: () => new Bounce(),
  bedroom_nap: () => new Nap(),
  bedroom_loop: () => new LoopTheLoop(),
};
