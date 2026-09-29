import { SIM } from "../config/constants";
import type Alien from "../objects/Alien";
import { Field, feed, type FieldOptions, type LoggedInput } from "./Field";

/**
 * Answer times by ball count (ms), the measure bots are calibrated with.
 *
 * Solve time (spawn → hit) mixes thinking with things that aren't: how long
 * an alien takes to come on screen, how long a slow alien is left alone
 * because it isn't urgent, the ship's travel. Answer time counts from when an
 * alien became readable, or the previous answer matched if that was later, to
 * the typed answer matching it. It replays the run, so it works the same for
 * a logged playtest and a bot's input log.
 */
export function answerTimes(
  options: FieldOptions,
  log: readonly LoggedInput[],
  steps: number,
): Map<number, number[]> {
  const field = new Field(options);
  const readableAt = new Map<Alien, number>();
  const times = new Map<number, number[]>();
  let lastMatch = 0;
  let next = 0;
  for (let i = 0; i <= steps; i++) {
    for (const a of field.aliens) {
      if (a.active && !readableAt.has(a) && a.y - a.top >= 0) readableAt.set(a, field.elapsedMs);
    }
    let applied = false;
    while (next < log.length && log[next].step === i) {
      feed(field, log[next++].input);
      applied = true;
    }
    if (applied && field.typed !== "" && field.answerView()?.state === "match") {
      const alien = field.alienFor(parseInt(field.typed, 10));
      if (alien) {
        const from = Math.max(readableAt.get(alien) ?? field.elapsedMs, lastMatch);
        const list = times.get(alien.ballCount) ?? [];
        list.push(field.elapsedMs - from);
        times.set(alien.ballCount, list);
        lastMatch = field.elapsedMs;
      }
    }
    if (i < steps) {
      field.step(SIM.STEP_MS);
      field.takeEvents();
    }
  }
  return times;
}

/** Add one run's answer times into a running total. */
export function mergeTimes(into: Map<number, number[]>, from: Map<number, number[]>): void {
  for (const [balls, list] of from) into.set(balls, [...(into.get(balls) ?? []), ...list]);
}

/** "2b 1.2s  3b 2.3s": median answer time per ball count. */
export function formatTimes(times: Map<number, number[]>): string {
  return [...times.entries()]
    .sort(([a], [b]) => a - b)
    .map(([balls, list]) => {
      const sorted = [...list].sort((x, y) => x - y);
      return `${balls}b ${(sorted[Math.floor(sorted.length / 2)] / 1000).toFixed(1)}s`;
    })
    .join("  ");
}
