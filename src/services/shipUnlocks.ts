import { LEVELS, RENDER3D, STORY } from "../config/constants";
import type { ShipChoice } from "../config/ships";
import type { StoryProgress } from "./storyProgress";

/**
 * Which ships the story has unlocked. Nothing is stored for it: a ship with
 * a `beat` stage (RENDER3D.SHIPS) is unlocked once the story progress has
 * gone past that stage, i.e. its boss was beaten in some run. The progress
 * only ever grows, so a game over never takes a ship away, and players who
 * beat a boss before ships could be unlocked already have theirs.
 *
 * All pure: the scenes load the progress and pass it in.
 */

/** Unlocked from the start, or its stage's boss has been beaten. */
export function isUnlocked(ship: ShipChoice, progress: StoryProgress): boolean {
  return ship.beat === undefined || progress.furthest > ship.beat;
}

export function unlockedShips(progress: StoryProgress): ShipChoice[] {
  return RENDER3D.SHIPS.filter((ship) => isUnlocked(ship, progress));
}

/** The ships a change of progress unlocked (e.g. the progress before and
 * after a level clear), in menu order; empty when nothing new. */
export function newShips(before: StoryProgress, after: StoryProgress): ShipChoice[] {
  return RENDER3D.SHIPS.filter((ship) => isUnlocked(ship, after) && !isUnlocked(ship, before));
}

/** The last boss has been beaten (in any run). */
export function storyComplete(progress: StoryProgress): boolean {
  return progress.furthest >= STORY.STAGES;
}

/** The credits' reward line for ships just unlocked: "the crayon ship",
 * "the lava rocket and the crayon ship"; undefined when nothing is new (a
 * second finish unlocks nothing). One-word names get " ship" added. */
export function rewardLine(ships: readonly ShipChoice[]): string | undefined {
  if (ships.length === 0) return undefined;
  const names = ships.map((s) => {
    const name = s.name.toLowerCase();
    return `the ${name.includes(" ") ? name : `${name} ship`}`;
  });
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** How to unlock a ship, for the menu picker: "beat the GREAT OWL",
 * "finish the story"; "" for ships that are never locked. */
export function unlockHint(ship: ShipChoice): string {
  if (ship.beat === undefined) return "";
  if (ship.beat >= STORY.STAGES - 1) return "finish the story";
  const boss = LEVELS[ship.beat]?.BOSS.NAME;
  if (!boss) return `beat story stage ${ship.beat + 1}`;
  return `beat ${boss.startsWith("THE ") ? boss : `the ${boss}`}`;
}
