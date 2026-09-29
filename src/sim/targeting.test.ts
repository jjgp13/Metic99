import { describe, expect, it } from "vitest";
import { MATCH, SIM } from "../config/constants";
import { Match, type MatchEvent } from "./Match";

const STEP = SIM.STEP_MS;

/** A match of people who never answer (seat 0..n-1), driven by the test. */
function idle(n: number, seed = 1): Match {
  return new Match({ seed, seats: Array.from({ length: n }, () => "human" as const) });
}

function stepFor(match: Match, ms: number): MatchEvent[] {
  const events: MatchEvent[] = [];
  for (let t = 0; t < ms && !match.over; t += STEP) {
    match.step(STEP);
    events.push(...match.takeEvents());
    match.fields.forEach((f) => f.takeEvents());
  }
  return events;
}

describe("targeting", () => {
  it("aims at a seat picked by hand, and re-picks once that seat is out", () => {
    const m = idle(4);
    m.fields[0].apply({ type: "target", aim: { seat: 2 } });
    stepFor(m, STEP);
    expect(m.targets[0]).toBe(2);
    stepFor(m, 5_000);
    expect(m.targets[0]).toBe(2); // a hand-picked target stays
    m.placements[2] = 4; // out (as if knocked out)
    stepFor(m, STEP);
    expect(m.targets[0]).not.toBe(2);
    expect(m.targets[0]).not.toBe(0);
  });

  it("KOs aims at whoever is closest to falling; badges at whoever has most", () => {
    const m = idle(4);
    m.fields[0].apply({ type: "target", aim: "kos" });
    m.fields[1].apply({ type: "target", aim: "badges" });
    // Let aliens come down; seat 3 gets an attack queued, which counts as danger.
    stepFor(m, 4_000);
    m.fields[3].receive({ type: "attack", from: 1, cost: 100, aliens: [{ kind: "darter", ability: null }] });
    m.badgePoints[2] = 3;
    stepFor(m, MATCH.RETARGET_MS + STEP);
    expect(m.targets[0]).toBe(3);
    expect(m.targets[1]).toBe(2);
  });

  it("attackers aims back at whoever aims at you", () => {
    const m = idle(5);
    m.fields[1].apply({ type: "target", aim: { seat: 0 } });
    m.fields[0].apply({ type: "target", aim: "attackers" });
    stepFor(m, MATCH.RETARGET_MS + STEP);
    expect(m.targets[0]).toBe(1);
    expect(m.targetedBy(0)).toBeGreaterThanOrEqual(1);
  });

  it("sends each attack to the sender's target, heavier with badges and defense", () => {
    const m = idle(4);
    m.fields[0].apply({ type: "target", aim: { seat: 3 } });
    stepFor(m, STEP);
    m.badgePoints[0] = 4; // badge level 2: +50%
    expect(Match.badgeLevel(4)).toBe(2);
    m.fields[0].attack.charge(50);
    m.fields[0].apply({ type: "send", cost: 50 });
    const [attack] = stepFor(m, STEP).filter((e) => e.type === "attack");
    expect(attack).toMatchObject({ from: 0, to: 3, cost: 50 });
    const bonus = 2 * MATCH.BADGE_BONUS + MATCH.DEFENSE_BONUS * Math.max(0, m.targetedBy(0) - 1);
    expect(attack.type === "attack" && attack.weight).toBeCloseTo(50 * MATCH.ATTACK_MULT * (1 + bonus));
    // The weight is what the receiver must cancel; extra weight adds darters.
    const queued = m.fields[3].incoming;
    expect(queued.reduce((t, a) => t + a.left, 0)).toBeCloseTo(attack.type === "attack" ? attack.weight : 0);
    expect(queued.length).toBeGreaterThan(1);
  });
});

describe("KO credit and badges", () => {
  it("credits a KO to the last attacker and passes on the victim's badges", () => {
    // Nobody answers, so the first aliens knock everyone out. Seat 1 attacks
    // seat 2 just before, so seat 2's KO is credited to seat 1.
    const m = idle(3, 5);
    m.badgePoints[2] = 2;
    m.fields[1].apply({ type: "target", aim: { seat: 2 } });
    let credited: MatchEvent | undefined;
    for (let i = 0; i < 60 * 120 && !credited; i++) {
      if (i % 120 === 0 && m.placements[1] === 0) {
        m.fields[1].attack.charge(25);
        m.fields[1].apply({ type: "send", cost: 25 });
      }
      m.step(STEP);
      credited = m.takeEvents().find((e) => e.type === "ko" && e.seat === 2);
      m.fields.forEach((f) => f.takeEvents());
    }
    expect(credited).toMatchObject({ type: "ko", seat: 2, by: 1, badges: 3 });
    expect(m.badgePoints[1]).toBe(3);
  });

  it("keeps the books straight over whole bot matches (tiles agree with events)", () => {
    const seats = ["ace", "ace", "pilot", "pilot", "pilot", "rookie", "rookie", "rookie"] as const;
    let credited = 0;
    for (const seed of [1, 2, 3]) {
      const m = new Match({ seed, seats });
      const earned = seats.map(() => 0);
      const kos = seats.map(() => 0);
      const koBy = seats.map((): number | null => null);
      while (!m.over) {
        m.step(STEP);
        for (const e of m.takeEvents()) {
          if (e.type !== "ko" || e.by === null) continue;
          credited++;
          earned[e.by] += e.badges;
          kos[e.by]++;
          koBy[e.seat] = e.by;
          expect(e.by).not.toBe(e.seat);
        }
      }
      expect(m.badgePoints).toEqual(earned);
      const tiles = m.tiles();
      expect(tiles.map((t) => t.placement).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(tiles.map((t) => t.badges)).toEqual(earned.map((p) => Match.badgeLevel(p)));
      expect(tiles.map((t) => t.kos)).toEqual(kos);
      expect(tiles.map((t) => t.koBy)).toEqual(koBy);
      // Bots aim by their level's strategy.
      expect(tiles[0].aim).toBe("kos");
      expect(tiles[2].aim).toBe("attackers");
      expect(tiles[5].aim).toBe("random");
    }
    expect(credited).toBeGreaterThan(6);
  });
});

describe("watching a player", () => {
  it("keeps the watched bot's field events for the viewer, and drops the others'", () => {
    const m = new Match({ seed: 3, seats: ["ace", "pilot", "rookie"] });
    m.spectate = 1;
    for (let i = 0; i < 60 * 20; i++) m.step(STEP);
    const kept = m.fields[1].takeEvents();
    expect(kept.some((e) => e.type === "solved")).toBe(true);
    expect(m.fields[0].takeEvents()).toEqual([]);
  });
});
