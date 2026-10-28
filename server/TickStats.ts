/**
 * How long the server's ticks take (docs/NETCODE.md, S5 capacity): one
 * 60 Hz step has 16.7 ms of real time, so p99 tick time per step must stay
 * well under that, or the room falls behind real time.
 */
export class TickStats {
  private samples: number[] = [];

  /** One tick took `ms` to run `steps` steps. */
  record(ms: number, steps: number): void {
    this.samples.push(ms / steps);
    if (this.samples.length > 20_000) this.samples.splice(0, 10_000);
  }

  /** "step p50 0.21 ms, p99 0.80 ms (n 3600)" */
  summary(): string {
    if (!this.samples.length) return "no ticks";
    const sorted = [...this.samples].sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].toFixed(2);
    const text = `step p50 ${q(0.5)} ms, p99 ${q(0.99)} ms (n ${sorted.length})`;
    this.samples = [];
    return text;
  }
}
