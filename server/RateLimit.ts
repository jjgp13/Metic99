/**
 * A token bucket (docs/NETCODE.md, launch): the classic rate limiter. The
 * bucket holds up to `burst` tokens and refills at `perSecond`; each message
 * takes one. A normal client sends ~22 messages a second (inputs every
 * 50 ms, a ping and a fingerprint each second) with short bursts when the
 * player taps fast, so it never runs dry; a flood empties it within a
 * second and the connection is closed.
 *
 * Why a bucket and not "N per second" counted per clock second: a fixed
 * window lets 2N through around a second's boundary; the bucket smooths it.
 */
export class RateLimit {
  private tokens: number;
  private last: number;

  constructor(
    readonly perSecond: number,
    readonly burst: number,
    now: number,
  ) {
    this.tokens = burst;
    this.last = now;
  }

  /** Take one token; false = over the limit. */
  take(now: number): boolean {
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
