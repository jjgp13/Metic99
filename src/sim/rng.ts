/**
 * Seeded random numbers for game logic (docs/MULTIPLAYER_DESIGN.md §8).
 *
 * `Math.random()` can't be seeded, so a run can't be replayed and two machines
 * can't roll the same aliens. Game rules draw from an `Rng` instead: the same
 * seed always gives the same numbers, in the browser and in Node. Visual-only
 * randomness (stars, debris) may keep using `Math.random()`.
 *
 * The generator is mulberry32: 32 bits of state, a few integer ops per draw,
 * good enough for games (not for cryptography). Changing it changes every
 * seeded run, so the golden test in rng.test.ts pins its output.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * An independent stream for one purpose, e.g. `derive(seed, SPAWN, 12, 0)`
   * for the 12th spawn's first attempt. Keying streams by a counter (instead
   * of sharing one long sequence) means an extra draw somewhere else, such as a
   * retried spawn, doesn't shift every number after it.
   */
  static derive(seed: number, ...keys: number[]): Rng {
    let h = mix(seed >>> 0);
    for (const k of keys) h = mix((h ^ (k >>> 0)) + 0x9e3779b9);
    return new Rng(h);
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max], both inclusive (like Phaser.Math.Between). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

/**
 * Streams for one spawner (lethal aliens, drifters). Try `attempt` of spawn
 * number `index` gets `derive(seed, stream, index, attempt)`, so with the same
 * seed the Nth alien's first try draws the same numbers however the player got
 * there. (What they become still depends on the field: a sum already in play
 * is rerolled, difficulty sets the ranges.) Retries roll fresh numbers.
 */
export class SpawnStreams {
  private index = 0;
  private attempt = 0;

  constructor(
    private readonly seed: number,
    private readonly stream: number,
  ) {}

  /** The stream for the next try. */
  next(): Rng {
    return Rng.derive(this.seed, this.stream, this.index, this.attempt++);
  }

  /** The last try spawned something: the next try starts a new spawn. */
  succeeded(): void {
    this.index++;
    this.attempt = 0;
  }
}

/** A fresh seed for a new run (not reproducible: that's its job). */
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/** 32-bit integer hash (murmur3 finalizer): nearby inputs → unrelated outputs. */
function mix(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
