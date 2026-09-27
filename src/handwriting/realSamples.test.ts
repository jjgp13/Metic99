import { describe, expect, it } from "vitest";
import InkReader from "./inkReader";
import { decodeGroups, type SampleFile } from "./samples";

/**
 * Real handwriting recorded on phones with the lab page (`?lab=draw`), saved as
 * src/handwriting/samples/*.json. Every drawing is replayed stroke by stroke
 * through the same InkReader the game uses (grouping, pause, recognizer), and
 * a per-digit report is printed. Skipped until a sample file exists.
 */
const files = Object.entries(
  import.meta.glob<SampleFile>("./samples/*.json", { eager: true, import: "default" }),
);

/** Share of real drawings that must read right. */
const MIN_ACCURACY = 0.9;

describe.skipIf(files.length === 0)("real handwriting samples", () => {
  it(`reads at least ${MIN_ACCURACY * 100}% of them right`, () => {
    const byDigit = new Map<string, { ok: number; total: number; misses: string[] }>();
    let ok = 0;
    let total = 0;
    for (const [, file] of files) {
      for (const s of file.samples) {
        const reader = new InkReader();
        for (const stroke of decodeGroups(s.groups).flat()) {
          reader.begin(stroke[0]);
          for (const p of stroke.slice(1)) reader.move(p);
          reader.end();
        }
        const ev = reader.read();
        const read = ev?.type === "digits" ? ev.digits : ev?.type === "unknown" ? "?" : "-";
        const row = byDigit.get(s.expected) ?? { ok: 0, total: 0, misses: [] };
        row.total++;
        total++;
        if (read === s.expected) {
          row.ok++;
          ok++;
        } else {
          row.misses.push(read);
        }
        byDigit.set(s.expected, row);
      }
    }
    const report = [...byDigit.entries()]
      .sort(([a], [b]) => a.length - b.length || a.localeCompare(b))
      .map(([d, r]) => `  ${d.padStart(2)}: ${r.ok}/${r.total}${r.misses.length ? `  misread as ${r.misses.join(", ")}` : ""}`)
      .join("\n");
    console.log(`real samples: ${ok}/${total} read right\n${report}`);
    expect(ok / total).toBeGreaterThanOrEqual(MIN_ACCURACY);
  });
});
