import type Alien from "./Alien";

/** A player shot: pure state in the 2D logical playfield, drawn by World3D. */
export interface Bullet {
  x: number;
  y: number;
  /** False once it hits something or leaves the field. */
  active: boolean;
  /** The alien whose answer fired it; the only one it can hit. */
  target: Alien | null;
}
