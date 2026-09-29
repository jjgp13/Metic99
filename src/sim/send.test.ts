import { describe, expect, it } from "vitest";
import { SEND, SIM } from "../config/constants";
import { Field, type FieldEvent } from "./Field";
import type { SentAlien } from "./Swarm";

const STEP = SIM.STEP_MS;
const DARTER: SentAlien = { kind: "darter", ability: null };
const SHIELDED: SentAlien = { kind: "lumberer", ability: "shielded" };

/** A field in an 8-player battle. */
function battleField(seed: number, lives = 1): Field {
  const f = new Field({ seed, lives });
  f.receive({ type: "standing", alive: 8, total: 8 });
  return f;
}

/** The field's private kill-energy path, to test the cancel math on exact numbers. */
const cancel = (f: Field, energy: number): number =>
  (f as unknown as { cancelIncoming(e: number): number }).cancelIncoming(energy);

describe("SEND", () => {
  it("spends the chosen tier and hands its aliens to the match", () => {
    const f = battleField(1);
    expect(f.sendTier()).toBeNull();
    f.energy.charge(60);
    expect(f.sendTier()).toBe(50); // the strongest the energy buys
    expect(f.apply({ type: "send", cost: 100 })).toBe(false); // can't afford it
    expect(f.apply({ type: "send", cost: 30 })).toBe(false); // no such tier
    expect(f.apply({ type: "send", cost: 50 })).toBe(true);
    expect(f.energy.value).toBe(10);
    expect(f.energy.spent.send).toBe(50);
    const [attack, ...rest] = f.takeOutgoing();
    expect(rest).toEqual([]);
    expect(attack.cost).toBe(50);
    expect(attack.aliens).toHaveLength(SEND.TIERS[1].ALIENS.length);
    expect(attack.aliens[0].ability).not.toBeNull();
    expect(f.takeOutgoing()).toEqual([]);
  });

  it("does nothing outside a battle", () => {
    const f = new Field({ seed: 1 });
    f.energy.charge(100);
    expect(f.sendTier()).toBeNull();
    expect(f.apply({ type: "send", cost: 25 })).toBe(false);
    expect(f.energy.value).toBe(100);
  });
});

describe("incoming attacks", () => {
  it("wait in the queue, then land as marked aliens, even over the unsolved cap", () => {
    const f = battleField(2);
    // Let the field's own first alien come on screen (the cap starts at 1).
    while (!f.aliens.some((a) => a.active && a.lethal && a.y > 0)) f.step(STEP);
    f.receive({ type: "attack", from: 5, cost: 25, aliens: [DARTER] });
    const [queued] = f.incoming;
    expect(queued.landsAtMs - f.elapsedMs).toBe(SEND.DELAY_MS.easy);
    expect(f.summary().incoming).toBe(25);

    let landed = null;
    while (!landed && f.elapsedMs < queued.landsAtMs + 1000) {
      f.step(STEP);
      landed = f.aliens.find((a) => a.sentBy === 5) ?? null;
    }
    expect(landed).not.toBeNull();
    expect(f.elapsedMs).toBeGreaterThanOrEqual(queued.landsAtMs);
    expect(f.incoming).toEqual([]);
    // Two unsolved aliens although the cap is still 1: the attack came on top.
    expect(f.difficulty.maxUnsolved).toBe(1);
    expect(f.aliens.filter((a) => a.active && a.lethal).length).toBeGreaterThanOrEqual(2);
  });

  it("are paid off by kill energy first, soonest first; the rest charges the meter", () => {
    const f = battleField(3);
    // A 100 attack of two aliens: each costs 50 to cancel.
    f.receive({ type: "attack", from: 1, cost: 100, aliens: [SHIELDED, DARTER] });
    expect(f.incoming.map((a) => a.left)).toEqual([50, 50]);
    expect(f.incoming[0].alien).toEqual(SHIELDED); // it lands first

    expect(cancel(f, 70)).toBe(0); // the first is cancelled, 20 off the second
    expect(f.incoming.map((a) => [a.alien.kind, a.left])).toEqual([["darter", 30]]);
    expect(cancel(f, 40)).toBe(10); // 10 left over for the meter
    expect(f.incoming).toEqual([]);
    expect(f.cancelledTotal).toBe(100);
    expect(cancel(f, 12)).toBe(12); // nothing incoming: all of it charges
  });

  it("a real kill cancels instead of charging (solved event)", () => {
    const f = battleField(4);
    f.receive({ type: "attack", from: 1, cost: 100, aliens: [DARTER, DARTER] });
    const events: FieldEvent[] = [];
    // Answer the first readable alien until one kill lands.
    while (!events.some((e) => e.type === "solved")) {
      const a = f.aliens.find((x) => x.active && x.lethal && x.sentBy === null && x.y - x.top >= 0);
      if (a && f.typed === "" && !f.lockedTarget) f.apply({ type: "digits", digits: String(a.result) });
      f.step(STEP);
      events.push(...f.takeEvents());
    }
    const solved = events.find((e) => e.type === "solved");
    expect(solved?.type === "solved" && solved.cancelled).toBeGreaterThan(0);
    expect(solved?.type === "solved" && solved.energy).toBe(0); // a kill < 100 energy
    expect(f.energy.value).toBe(0);
    expect(f.summary().incoming).toBeLessThan(100);
  });

  it("keep every ball row readable and the on-screen cap under constant attack (soak)", () => {
    for (const seed of [5, 6]) {
      const f = battleField(seed, 1000); // many lives: soak the full 5 minutes
      let overlapSteps = 0;
      let overCap = 0;
      let sentLanded = 0;
      let busy = 0;
      const steps = Math.round((5 * 60_000) / STEP);
      for (let i = 0; i < steps && !f.knockedOut; i++) {
        // An attack every 2 s, mixing every tier.
        if (i % 120 === 0) {
          const tier = SEND.TIERS[(i / 120) % SEND.TIERS.length];
          const aliens = tier.ALIENS.map((k, j): SentAlien =>
            k === "darter" ? DARTER : [SHIELDED, { kind: "strafer", ability: "blinker" }, { kind: "darter", ability: "splitter" }][(i / 120 + j) % 3] as SentAlien,
          );
          f.receive({ type: "attack", from: 1, cost: tier.COST, aliens });
        }
        // A quick player: answers the lowest alien after a short think.
        if (f.typed === "" && --busy <= 0) {
          const a = f.aliens
            .filter((x) => x.active && x.lethal && x !== f.lockedTarget && x.y - x.top >= 0 && (x.ability?.cover ?? 0) < 0.5)
            .sort((x, y) => y.y - x.y)[0];
          if (a) {
            f.apply({ type: "digits", digits: String(a.result) });
            busy = 40;
          }
        }
        f.step(STEP);
        for (const e of f.takeEvents()) if (e.type === "spawned" && e.alien.sentBy !== null) sentLanded++;
        const live = f.aliens.filter((a) => a.active);
        if (live.some((a, j) => live.slice(j + 1).some((b) => a.overlaps(b)))) overlapSteps++;
        if (live.filter((a) => a.lethal).length > f.difficulty.maxOnScreen + 2) overCap++; // + a splitter's pair
      }
      expect(f.elapsedMs).toBeGreaterThanOrEqual(5 * 60_000 - STEP);
      expect(overlapSteps, `seed ${seed}`).toBe(0);
      expect(overCap, `seed ${seed}`).toBe(0);
      expect(sentLanded, `seed ${seed}`).toBeGreaterThan(50);
    }
  });
});
