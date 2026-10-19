import { describe, expect, it } from "vitest";
import { LEVELS, SIM, STORY, type BossDef, type BotLevel } from "../config/constants";
import { SKY_WIND } from "../config/levels/sky";
import Alien from "../objects/Alien";
import type { AbilityHost } from "../objects/abilities";
import { Kite, Loop, Swoop, windAt } from "../objects/skyTraits";
import { RainDrop, StormCloud } from "../objects/stormCloud";
import { Bot } from "./Bot";
import { Field, type FieldEvent } from "./Field";
import { Rng } from "./rng";

const STEP = SIM.STEP_MS;
// Found by page, not index: levels 8–10 are built alongside it.
const SKY = LEVELS.find((l) => l.PAGE === "sky")!;

/** A bot plays the sky until it clears it, is knocked out, or time runs out. */
function playLevel(seed: number, level: BotLevel) {
  const field = new Field({ seed, level: SKY, lives: STORY.LIVES });
  const bot = Bot.forSeat(level, seed);
  const events: FieldEvent[] = [];
  const maxSteps = Math.round((SKY.PATH_MS * 3) / STEP);
  while (!field.knockedOut && !field.cleared && field.steps < maxSteps) {
    bot.update(field, STEP);
    field.step(STEP);
    events.push(...field.takeEvents());
  }
  return { field, events };
}

const live = (field: Field) => field.aliens.filter((a) => a.active);

describe("story level 7: the windy sky", () => {
  it("brings all its creatures, each with its trait, and keeps every box readable", () => {
    const traits = new Map<string, string>();
    let overlapSteps = 0;
    for (const seed of [1, 2, 3]) {
      const field = new Field({ seed, level: SKY, lives: STORY.LIVES });
      const bot = Bot.forSeat("ace", seed);
      while (!field.knockedOut && !field.cleared && field.steps < 30_000) {
        bot.update(field, STEP);
        field.step(STEP);
        for (const e of field.takeEvents()) {
          if (e.type === "spawned" && e.alien.species) traits.set(e.alien.species, e.alien.ability?.kind ?? "");
        }
        const a = live(field);
        if (a.some((x, i) => a.slice(i + 1).some((y) => x.overlaps(y)))) overlapSteps++;
      }
    }
    expect(Object.fromEntries(traits)).toEqual({
      swallow: "sky_swoop",
      kite: "sky_kite",
      "paper plane": "sky_loop",
      balloon: "sky_balloon",
    });
    expect(overlapSteps).toBe(0);
  });

  it("the wind blows in turns: calm, picking up, a gust, right then left", () => {
    const cycle = SKY_WIND.CALM_MS + SKY_WIND.WARN_MS + SKY_WIND.GUST_MS;
    expect(windAt(0)).toEqual({ gust: 0, dir: 1, phase: "calm" });
    expect(windAt(SKY_WIND.CALM_MS + 1).phase).toBe("warn");
    expect(windAt(cycle - 1)).toEqual({ gust: 0, dir: 1, phase: "gust" });
    expect(windAt(cycle + cycle - 1)).toEqual({ gust: 1, dir: -1, phase: "gust" });
  });

  it("every creature feels the same gust, and the gust moves them its own way", () => {
    const field = new Field({ seed: 4, level: SKY, lives: 99 });
    const moves = { kiteUp: 0, swallowDown: 0 };
    let together = 0;
    while (field.steps < 20_000) {
      const before = new Map(field.aliens.map((a) => [a, [a.x, a.y] as const]));
      field.step(STEP);
      const windy = live(field).filter((a) => a.ability instanceof Kite || a.ability instanceof Swoop);
      const phases = new Set(windy.map((a) => (a.ability as Kite | Swoop).wind.phase));
      if (windy.length >= 2) {
        expect(phases.size).toBe(1); // one wind for the whole sky
        together++;
      }
      if (field.recovering) continue; // the hit pushback isn't the wind
      for (const a of windy) {
        const was = before.get(a);
        if (!was || !a.gliding) continue;
        if (a.ability instanceof Kite && a.y < was[1]) moves.kiteUp++;
        if (a.ability instanceof Swoop && a.y > was[1]) moves.swallowDown++;
      }
    }
    expect(together).toBeGreaterThan(0);
    expect(moves.kiteUp).toBeGreaterThan(0); // kites climb in a gust
    expect(moves.swallowDown).toBeGreaterThan(0); // swallows swoop on it
  });

  it("paper planes loop the loop: nose up, up and over, then glide on", () => {
    const field = new Field({ seed: 5, level: SKY, lives: 99 });
    const poses = new Map<Alien, Set<string>>();
    while (field.steps < 20_000) {
      field.step(STEP);
      for (const a of live(field)) {
        if (!(a.ability instanceof Loop)) continue;
        const seen = poses.get(a) ?? new Set<string>();
        seen.add(a.ability.pose);
        poses.set(a, seen);
      }
    }
    const looped = [...poses.values()].filter((s) => s.has("nose") && s.has("up") && s.has("over"));
    expect(looped.length).toBeGreaterThan(0);
  });

  it("the storm cloud rumbles (the telegraph), then thunder drops a raindrop under it; one at a time", () => {
    // On its own (a test field's bots get hit, and each hit pushes the cloud
    // back up the page, where it doesn't rain): it stands still at MIN_Y.
    const def = SKY.BOSS;
    const cloud = new StormCloud(def);
    const make = (box: BossDef, y: number, ability?: StormCloud) =>
      new Alien({
        kind: "lumberer",
        x: 240,
        y,
        bodyKey: "alien1",
        result: 12,
        digits: [3, 4, 5],
        ballTexture: "blueBalls",
        fallSpeed: 0,
        homeSpeed: 0,
        spawnedAt: 0,
        rng: new Rng(1),
        ability,
        box: box.BOX,
      });
    const alien = make(def, def.MIN_Y, cloud);
    const drops: Alien[] = [];
    const host: AbilityHost = {
      rerollSum: () => true,
      spawnSplitling: () => false,
      spawnBossPart: (part, _x, y) => {
        drops.push(make(part, y));
        return drops[drops.length - 1];
      },
    };
    let rumbled = false;
    const tick = () => {
      cloud.update(STEP, alien, host);
      cloud.steer(alien, STEP);
      alien.advance(STEP);
    };
    while (drops.length === 0 && alien.y === def.MIN_Y) {
      tick();
      if (cloud.rumbling) {
        rumbled = true;
        expect(alien.mode).toBe("windup"); // the view shakes it; bots see the danger
        expect(cloud.cover).toBe(0); // its numbers stay readable
      }
    }
    expect(rumbled).toBe(true);
    expect(drops).toHaveLength(1);
    expect(drops[0].y - drops[0].top).toBeGreaterThanOrEqual(alien.y + alien.bottom); // under the cloud
    expect(cloud.flashLeftMs).toBeGreaterThan(0);
    for (let i = 0; i < 1200; i++) tick(); // 20 s: no more rain while its drop falls
    expect(drops).toHaveLength(1);
    drops[0].kill(); // answered
    for (let i = 0; i < 600 && drops.length === 1; i++) tick();
    expect(drops).toHaveLength(2);
  });

  it("an ace clears it on every one of 5 seeds; the cloud takes HP answers", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { field, events } = playLevel(seed, "ace");
      expect(field.cleared).toBe(true);
      const cloudAnswers = events.filter((e) => e.type === "solved" && e.alien === field.boss);
      expect(cloudAnswers).toHaveLength(SKY.BOSS.HP);
      expect(events[events.length - 1].type).toBe("levelCleared");
      // Its answers made it rain, one raindrop at a time.
      const drops = events.filter((e) => e.type === "spawned" && e.alien.ability instanceof RainDrop);
      expect(drops.length).toBeGreaterThan(0);
    }
  });
});
