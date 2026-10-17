/**
 * Fake network trouble for the "break it" experiment (docs/NETCODE.md, S5):
 * every message waits `ms` (plus a random extra up to `jitterMs`) before it
 * is sent or handled, as if the player were on a slow phone network. Order
 * is kept (a later message never overtakes an earlier one), like TCP, which
 * is what a WebSocket runs on. Server: `NET_LAG_MS=150 NET_JITTER_MS=100`;
 * browser: `?lag=150&jitter=100`. With 0 / 0 it does nothing.
 */
export class Lag {
  private lastAt = 0;

  constructor(
    readonly ms: number,
    readonly jitterMs: number,
  ) {}

  static fromEnv(env: Record<string, string | undefined>): Lag {
    return new Lag(Number(env.NET_LAG_MS ?? 0) || 0, Number(env.NET_JITTER_MS ?? 0) || 0);
  }

  get on(): boolean {
    return this.ms > 0 || this.jitterMs > 0;
  }

  /** Run `fn` after the fake delay (at once when lag is off). Visual-only
   * randomness here is fine: it only decides when a message is handled. */
  later(fn: () => void): void {
    if (!this.on) return fn();
    const now = Date.now();
    const at = Math.max(this.lastAt, now + this.ms + Math.random() * this.jitterMs);
    this.lastAt = at;
    setTimeout(fn, at - now);
  }
}
