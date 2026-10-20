import { describe, expect, it } from "vitest";
import { PLAYER, POWER_CUE, POWERS } from "../../config/constants";
import { EnergyMeter, Power } from "../../sim/energy";
import { dangerClose, justBecameReady, powerCue } from "./powerCue";

function meterAt(value: number): EnergyMeter {
  const meter = new EnergyMeter();
  meter.value = value;
  return meter;
}

describe("powerCue", () => {
  it("is charging below the cost, ready at it, full at max", () => {
    const blast = new Power("blast");
    const cost = POWERS.blast.EFFECT === "blast" ? POWERS.blast.COST : 0;
    expect(powerCue(blast, meterAt(cost - 1))).toBe("charging");
    expect(powerCue(blast, meterAt(cost))).toBe("ready");
    expect(powerCue(blast, meterAt(100))).toBe("full");
  });

  it("is on while a time power runs or a shield is armed", () => {
    const slow = new Power("slow");
    const meter = meterAt(50);
    slow.trigger(meter);
    expect(powerCue(slow, meter)).toBe("on");

    const shield = new Power("shield");
    const shieldMeter = meterAt(100);
    shield.trigger(shieldMeter);
    expect(powerCue(shield, shieldMeter)).toBe("on");
  });
});

describe("justBecameReady", () => {
  it("fires only when energy crosses the cost", () => {
    expect(justBecameReady("charging", "ready")).toBe(true);
    expect(justBecameReady("charging", "full")).toBe(true); // a big kill can jump past
    expect(justBecameReady("ready", "full")).toBe(false);
    expect(justBecameReady("ready", "ready")).toBe(false);
    // Switching a time power off with energy left is not a new ready moment.
    expect(justBecameReady("on", "ready")).toBe(false);
  });
});

describe("dangerClose", () => {
  const near = { active: true, lethal: true, y: PLAYER.Y - POWER_CUE.NUDGE_PX + 10 };
  const far = { active: true, lethal: true, y: PLAYER.Y - POWER_CUE.NUDGE_PX - 10 };

  it("sees a lethal alien close to the ship", () => {
    expect(dangerClose([far, near], [])).toBe(true);
    expect(dangerClose([far], [])).toBe(false);
  });

  it("ignores the answered target, bonus aliens and dead ones", () => {
    expect(dangerClose([near], [near])).toBe(false);
    expect(dangerClose([{ ...near, lethal: false }], [])).toBe(false);
    expect(dangerClose([{ ...near, active: false }], [null])).toBe(false);
  });
});
