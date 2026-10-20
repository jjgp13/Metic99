import { MOLE_HILLS as H } from "../config/levels/backyard";
import { Boss, type AbilityHost } from "./abilities";
import type Alien from "./Alien";

/** Where the mole is in its whack-a-mole: walking in, out of a hill,
 * ducking back in, digging to the next hill. */
export type MolePhase = "walk" | "peek" | "duck" | "dig";

/**
 * The GIANT MOLE (level 1, mechanic "molehills"): whack-a-mole. It walks in,
 * ducks into the ground, and from then on pops out of one of three molehills
 * (MOLE_HILLS.X): it peeks out (numbers readable, holding still), ducks back
 * in, and digs to another hill, which shakes while it comes (the telegraph).
 * Each new hill is a little closer to the ship. Its sum doesn't change
 * between peeks, so a sum read once can be typed while it is underground.
 * After an answer it digs to a hill higher up and peeks out of it with its
 * new sum; reaching the ship sends it digging back up.
 *
 * Every phase is a glide or a hold, so the rhythm runs in field time
 * (`steer`: FREEZE and SLOW hold it) and stops while it is the held target.
 * It digs instead of the base Boss's burrow, so every time it comes up, the
 * hill it comes out of has shaken first.
 */
export class GiantMole extends Boss {
  phase: MolePhase = "walk";
  /** The hill it is in or under (index into MOLE_HILLS.X). */
  hill = 0;
  /** The hill it is digging to (shakes while it comes), or null. */
  nextHill: number | null = null;
  /** The y of the hills' row, or null while it is still walking in. */
  hillsY: number | null = null;
  /** Ms it has dug past DIG_MS because something blocked the way. */
  private extraDigMs = 0;

  /** Underground (numbers hidden, can't reach the ship) while it digs. */
  get burrowing(): boolean {
    return this.phase === "dig";
  }

  update(delta: number, alien?: Alien): void {
    super.update(delta); // cover 1 while it digs
    if (this.phase === "duck" && alien) this.cover = 1 - alien.holdLeftMs / H.DUCK_MS;
  }

  steer(alien: Alien): void {
    if (alien.scripted) return;
    switch (this.phase) {
      case "walk":
        if (alien.y < this.def.MIN_Y) return; // its numbers aren't well on the page yet
        this.hillsY = alien.y;
        this.hill = nearestHill(alien.x);
        this.duck(alien);
        return;
      case "peek":
        this.duck(alien);
        return;
      case "duck":
        this.digTo(alien, (this.hillsY ?? alien.y) + H.STEP_DOWN_PX, H.DIG_MS);
        return;
      case "dig":
        if (this.blocked(alien) && this.extraDigMs < H.EXTRA_DIG_MS) {
          // A creature stood in the way (readability rule): keep digging to
          // the shaking hill a little longer, then pop out wherever it is.
          this.extraDigMs += H.RETRY_DIG_MS;
          alien.glideTo(H.X[this.nextHill!], this.hillsY!, H.RETRY_DIG_MS);
          return;
        }
        this.extraDigMs = 0;
        this.hill = this.nextHill ?? this.hill;
        this.nextHill = null;
        this.phase = "peek";
        alien.hold(H.PEEK_MS);
        return;
    }
  }

  /** An answer it survives: a new sum, and it digs to another hill higher
   * up (that hill shakes, like every dig), then peeks out of it. */
  onHit(alien: Alien, host: AbilityHost): boolean {
    this.hp -= 1;
    if (this.hp <= 0) return false;
    this.newSum(alien, host);
    this.digTo(alien, Math.max(this.def.MIN_Y, alien.y - this.def.BURROW_UP_PX), this.def.BURROW_MS);
    return true;
  }

  /** It reached the ship (the life is already lost): it digs back up. */
  retreat(alien: Alien): void {
    this.digTo(alien, this.def.RETREAT_Y, this.def.BURROW_MS);
  }

  /** Its dig stopped short of the hill it was digging to. */
  private blocked(alien: Alien): boolean {
    return this.nextHill !== null && Math.abs(alien.x - H.X[this.nextHill]) > 2;
  }

  /** Dig to another hill, in the row at `hillsY`; that hill shakes until it pops out. */
  private digTo(alien: Alien, hillsY: number, ms: number): void {
    this.nextHill = this.pickHill(alien);
    this.hillsY = hillsY;
    this.extraDigMs = 0;
    this.phase = "dig";
    this.cover = 1; // now, not at the next update: a hit can start a dig mid-step
    alien.hold(0); // an answer can come mid-peek: drop the rest of that peek
    alien.glideTo(H.X[this.nextHill], hillsY, ms);
  }

  private duck(alien: Alien): void {
    this.phase = "duck";
    alien.hold(H.DUCK_MS);
  }

  /** One of the other two hills; which one follows from its sum (seeded),
   * so the order can't be learned by heart but replays exactly. */
  private pickHill(alien: Alien): number {
    const others = H.X.map((_, i) => i).filter((i) => i !== this.hill);
    return others[alien.result % others.length];
  }
}

function nearestHill(x: number): number {
  let best = 0;
  for (let i = 1; i < H.X.length; i++) if (Math.abs(H.X[i] - x) < Math.abs(H.X[best] - x)) best = i;
  return best;
}
