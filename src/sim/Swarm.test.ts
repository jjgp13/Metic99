import { describe, expect, it } from "vitest";
import { SIM, SPLITTER } from "../config/constants";
import type Alien from "../objects/Alien";
import { ABILITY_KINDS, type AbilityKind } from "../objects/abilities";
import { Swarm } from "./Swarm";

const STEP = SIM.STEP_MS;

interface PlayStats {
  steps: number;
  kills: number;
  hits: number;
  /** Steps on which two live aliens' boxes (plus READ_GAP) overlapped. */
  overlapSteps: number;
  kinds: Set<string>;
  abilities: Set<AbilityKind>;
}

/**
 * A scripted player standing in for Field: it takes the lowest visible
 * alien, "thinks" (longer for more balls), types the answer (the target then
 * holds still while the ship lines up), and a moment later the shot lands.
 */
function play(field: Swarm, minutes: number): PlayStats {
  const stats: PlayStats = {
    steps: Math.round((minutes * 60_000) / STEP),
    kills: 0,
    hits: 0,
    overlapSteps: 0,
    kinds: new Set(),
    abilities: new Set(),
  };
  let score = 0;
  let target: Alien | null = null;
  let thinkLeft = 0;

  for (let i = 0; i < stats.steps; i++) {
    if (target && !target.active) target = null;
    if (!target) {
      target =
        field.aliens.filter((a) => a.active && a.y > 0).sort((a, b) => b.y - a.y)[0] ?? null;
      thinkLeft = target ? 700 + 200 * target.ballCount : 0;
    }
    const typed = target && thinkLeft <= 0 ? target : null;
    field.step(STEP, { score, speed: 1, held: typed, locked: typed });
    for (const e of field.takeEvents()) {
      if (e.type === "reachedPlayer") stats.hits++;
      else {
        stats.kinds.add(e.alien.kind);
        if (e.alien.ability) stats.abilities.add(e.alien.ability.kind);
      }
    }

    if (target?.active) {
      thinkLeft -= STEP;
      if (thinkLeft <= -250) {
        const a = target;
        if (!a.ability?.onHit(a, field)) {
          field.remove(a);
          a.ability?.onKilled(a, field);
        }
        score += 100 * a.ballCount;
        stats.kills++;
        target = null;
      }
    }
    field.prune();

    const live = field.aliens.filter((a) => a.active);
    if (live.some((a, j) => live.slice(j + 1).some((b) => a.overlaps(b)))) stats.overlapSteps++;
  }
  return stats;
}

/** Everything about the field's aliens, to compare two runs exactly. */
function fingerprint(field: Swarm): string {
  return JSON.stringify(
    field.aliens.map((a) => [a.kind, a.digits, a.x, a.y, a.mode, a.ability?.kind ?? null]),
  );
}

describe("Swarm", () => {
  it("keeps every ball row readable (soak: 3 seeds × 8 simulated minutes)", () => {
    for (const seed of [1, 2, 3]) {
      const stats = play(new Swarm({ seed }), 8);
      expect(stats.overlapSteps, `seed ${seed}`).toBe(0);
      expect(stats.kills).toBeGreaterThan(100);
      expect([...stats.kinds].sort()).toEqual(["darter", "drifter", "lumberer", "strafer"]);
    }
  });

  it("keeps ability aliens readable too (every spawn forced to an ability)", () => {
    const field = new Swarm({ seed: 4, forcedAbilities: [...ABILITY_KINDS] });
    const stats = play(field, 8);
    expect(stats.overlapSteps).toBe(0);
    expect([...stats.abilities].sort()).toEqual([...ABILITY_KINDS].sort());
    // Splitters pop into splitlings (darters wearing the splitling model).
    expect(stats.kills).toBeGreaterThan(100);
  });

  it("replays exactly: same seed + same inputs → same field", () => {
    const a = new Swarm({ seed: 42 });
    const b = new Swarm({ seed: 42 });
    play(a, 3);
    play(b, 3);
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(a.aliens.length).toBeGreaterThan(0);

    const other = new Swarm({ seed: 43 });
    play(other, 3);
    expect(fingerprint(other)).not.toBe(fingerprint(a));
  });

  it("runs the game clock in steps and freezes aliens at speed 0", () => {
    const field = new Swarm({ seed: 5 });
    for (let i = 0; i < 60; i++) field.step(STEP, { score: 0, speed: 1, held: null, locked: null });
    expect(field.elapsedMs).toBeCloseTo(60 * STEP);
    expect(field.aliens.length).toBeGreaterThan(0);

    const before = field.aliens.map((a) => [a.x, a.y]);
    for (let i = 0; i < 60; i++) field.step(STEP, { score: 0, speed: 0, held: null, locked: null });
    expect(field.aliens.map((a) => [a.x, a.y])).toEqual(before);
    expect(field.elapsedMs).toBeCloseTo(120 * STEP);
  });

  it("frees an alien's answer when it is removed", () => {
    const field = new Swarm({ seed: 6 });
    field.step(STEP, { score: 0, speed: 1, held: null, locked: null });
    const [alien] = field.aliens;
    expect(field.alienFor(alien.result)).toBe(alien);
    field.remove(alien);
    expect(field.alienFor(alien.result)).toBeUndefined();
    expect(alien.active).toBe(false);
  });
});

describe("Splitter", () => {
  const ctx = (speed = 1) => ({ score: 0, speed, held: null, locked: null });

  /** A seed where killing the first splitter on screen hatches both children. */
  function hatchPair() {
    for (let seed = 1; seed < 50; seed++) {
      const swarm = new Swarm({ seed, forcedAbilities: ["splitter"] });
      let parent: Alien | undefined;
      let parentFrom = 0;
      for (let i = 0; i < 60 * 30 && !parent; i++) {
        swarm.step(STEP, ctx());
        swarm.takeEvents();
        parent = swarm.aliens.find((a) => a.active && a.model === "alien_splitter" && a.y > 120);
        if (!parent) continue;
        // Measure the parent's own fall pace over one second first.
        parentFrom = parent.y;
        for (let j = 0; j < 60; j++) swarm.step(STEP, ctx());
      }
      if (!parent?.active) continue;
      const parentPace = parent.y - parentFrom;
      swarm.remove(parent);
      parent.ability?.onKilled(parent, swarm);
      const kids = swarm.takeEvents().flatMap((e) => (e.type === "spawned" ? [e.alien] : []));
      if (kids.length === 2) return { swarm, kids, parentPace };
    }
    throw new Error("no seed hatched a pair");
  }

  it("hatches a staggered pair that holds still, then moves no faster than its parent", () => {
    const { swarm, kids, parentPace } = hatchPair();
    // Glide out: the pair lands at clearly different heights (so they reach
    // the player one after the other).
    for (let t = 0; t < SPLITTER.GLIDE_MS; t += STEP) swarm.step(STEP, ctx());
    expect(kids[0].y - kids[1].y).toBeGreaterThanOrEqual(30);
    // Hatch: both hold still for at least half a second, to read both sums.
    const landed = kids.map((k) => k.y);
    for (let t = 0; t < 500; t += STEP) swarm.step(STEP, ctx());
    expect(kids.map((k) => k.y)).toEqual(landed);
    // Then they fall, at their parent's pace at most (never a burst of speed).
    for (let t = 500; t < SPLITTER.HATCH_MS + 400; t += STEP) swarm.step(STEP, ctx());
    const from = kids.map((k) => k.y);
    for (let i = 0; i < 60; i++) swarm.step(STEP, ctx());
    kids.forEach((k, i) => {
      expect(k.y).toBeGreaterThan(from[i]);
      expect(k.y - from[i]).toBeLessThan(parentPace * 1.1);
    });
  });
});
