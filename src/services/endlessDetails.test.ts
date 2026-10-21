import { describe, expect, it } from "vitest";
import { POWER_KINDS, RENDER3D } from "../config/constants";
import { THEMES } from "../config/themes";
import sql from "../../supabase/endless-details.sql?raw";
import { detailArgs, formatSurvival, parseDetails } from "./endlessDetails";

describe("detailArgs", () => {
  it("sends the four details under submit_run's parameter names", () => {
    const args = detailArgs({ ship: "ship_dart", power: "blast", theme: "pond", survivalMs: 125_400.6 });
    expect(args).toEqual({ p_ship: "ship_dart", p_power: "blast", p_theme: "pond", p_survival_ms: 125_401 });
  });

  it("sends nothing without details, so story and battle calls keep their old shape", () => {
    expect(detailArgs()).toEqual({});
  });
});

describe("parseDetails", () => {
  const embed = { ship: "ship_pod", power: "shield", theme: "plain", survival_ms: 61_000 };
  const details = { ship: "ship_pod", power: "shield", theme: "plain", survivalMs: 61_000 };

  it("reads a one-to-one embed (object) or a one-row array", () => {
    expect(parseDetails(embed)).toEqual(details);
    expect(parseDetails([embed])).toEqual(details);
  });

  it("gives null for a score without details or a malformed one", () => {
    expect(parseDetails(null)).toBeNull();
    expect(parseDetails(undefined)).toBeNull();
    expect(parseDetails([])).toBeNull();
    expect(parseDetails({ ...embed, survival_ms: "61" })).toBeNull();
  });
});

describe("formatSurvival", () => {
  it("shows minutes:seconds, and hours only past an hour", () => {
    expect(formatSurvival(42_900)).toBe("0:42");
    expect(formatSurvival(725_000)).toBe("12:05");
    expect(formatSurvival(3_725_000)).toBe("1:02:05");
  });
});

describe("supabase/endless-details.sql", () => {
  // The database checks ship, power and theme ids against its own copies of
  // the game's lists: a new ship, power or theme must be added there too.
  const checked = (column: string) => {
    const list = sql.match(new RegExp(String.raw`check \(${column} in \(([^)]*)\)`))?.[1] ?? "";
    return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  };

  it("knows every ship, power and theme the game can submit", () => {
    expect(checked("ship")).toEqual(expect.arrayContaining(RENDER3D.SHIPS.map((s) => s.model)));
    expect(checked("power")).toEqual(expect.arrayContaining([...POWER_KINDS]));
    expect(checked("theme")).toEqual(expect.arrayContaining(THEMES.map((t) => t.id)));
  });
});
