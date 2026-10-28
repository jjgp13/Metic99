/**
 * Fake network trouble for the "break it" experiment (docs/NETCODE.md, S5):
 * every message waits `ms` (plus a random extra up to `jitterMs`) before it
 * is sent or handled, as if the player were on a slow phone network. Server:
 * `NET_LAG_MS=150 NET_JITTER_MS=100`; browser: `?lag=150&jitter=100`; bot
 * clients: `--lag 150 --jitter 100`. With 0 / 0 it does nothing.
 *
 * Order is kept, like TCP (what a WebSocket runs on): messages wait in ONE
 * queue drained by ONE timer. The first version used a setTimeout per
 * message, and timers due at the same moment may fire in any order, so
 * messages overtook each other: the server saw steps go backwards and a
 * message arrive before the match had started. A real socket never does
 * that, so the fake one mustn't either.
 */
export class Lag {
  private readonly queue: { at: number; fn: () => void }[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

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

  /** Run `fn` after the fake delay, never before an earlier one (at once
   * when lag is off). Visual-only randomness: it only decides when. */
  later(fn: () => void): void {
    if (!this.on) return fn();
    const last = this.queue[this.queue.length - 1]?.at ?? 0;
    this.queue.push({ at: Math.max(last, Date.now() + this.ms + Math.random() * this.jitterMs), fn });
    this.schedule();
  }

  private schedule(): void {
    if (this.timer || !this.queue.length) return;
    this.timer = setTimeout(() => this.drain(), Math.max(0, this.queue[0].at - Date.now()));
  }

  private drain(): void {
    this.timer = null;
    while (this.queue.length && this.queue[0].at <= Date.now()) this.queue.shift()!.fn();
    this.schedule();
  }
}
