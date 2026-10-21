import { afterEach, describe, expect, it, vi } from "vitest";
import { LEVELS } from "./constants";
import { PLAIN_THEME, THEMES, isThemeUnlocked, levelTracks } from "./themes";
import { PAGES, propScreenY, type PlacedProp } from "../renderDoodle/pages";

describe("THEMES", () => {
  it("the plain page, then one theme per story level, each with a page and its path song", () => {
    expect(THEMES[0]).toBe(PLAIN_THEME);
    expect(THEMES.length).toBe(LEVELS.length + 1);
    THEMES.slice(1).forEach((theme, stage) => {
      expect(theme.stage).toBe(stage);
      expect(PAGES[theme.page!]).toBeDefined();
      expect(theme.music).toBe(levelTracks(stage).path);
    });
  });
});

describe("isThemeUnlocked", () => {
  it("the plain page always; a world once the story has gone past its boss", () => {
    const backyard = THEMES[1];
    const pond = THEMES[2];
    expect(isThemeUnlocked(PLAIN_THEME, 0)).toBe(true);
    // furthest 1 = stage 1's boss beaten, stage 2 reached but not beaten.
    expect(isThemeUnlocked(backyard, 0)).toBe(false);
    expect(isThemeUnlocked(backyard, 1)).toBe(true);
    expect(isThemeUnlocked(pond, 1)).toBe(false);
  });
});

describe("selectedTheme", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("falls back to the plain page when the saved world is locked", async () => {
    const stored = new Map([["metic-theme", "pond"]]);
    vi.stubGlobal("localStorage", { getItem: (k: string) => stored.get(k) ?? null, setItem: () => {} });
    const { selectedTheme } = await import("./themes");
    expect(selectedTheme(0).id).toBe("plain");
    expect(selectedTheme(2).id).toBe("pond");
  });
});

describe("propScreenY", () => {
  const prop = { pathY: 100 } as PlacedProp;

  it("a story page scrolls each prop once", () => {
    expect(propScreenY(prop, 500, null)).toBe(400);
    expect(propScreenY(prop, 5000, null)).toBe(4900);
  });

  it("a looping page brings the same prop back every loop", () => {
    expect(propScreenY(prop, 500, 2000)).toBe(400);
    expect(propScreenY(prop, 2500, 2000)).toBe(400);
    expect(propScreenY(prop, 50, 2000)).toBe(1950); // not on screen yet: one loop up
  });
});
