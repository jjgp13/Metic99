import { ENDING } from "../config/constants";

/** What the credits say about the finished run. */
export interface CreditsRun {
  score: number;
  /** Game-clock time of the whole run, every level and boss. */
  playedMs: number;
  /** How many worlds were beaten (all of them, at the ending). */
  worlds: number;
  /** What beating the story unlocked ("the crayon ship"), if anything. */
  unlocked?: string;
}

/** How a line looks: the title, the author, the thank-you, the reward, the signature. */
export type CreditStyle = "title" | "author" | "body" | "reward" | "sign";

/** One handwritten line of the credits, sitting on notebook rule `rule`
 * (0 = the first rule under the page's header strip). */
export interface CreditLine {
  text: string;
  style: CreditStyle;
  rule: number;
}

/**
 * The credits page, line by line, in the order they are written. Pure (no
 * Phaser), so the words can be tested and changed without opening the game.
 * Each line has its own rule, so a missing reward leaves a gap instead of
 * moving the signature.
 */
export function creditLines(run: CreditsRun): CreditLine[] {
  const by = ENDING.CREDIT_NAME;
  const lines: CreditLine[] = [
    { text: "THE END", style: "title", rule: 4 },
    { text: `a game by ${by}`, style: "author", rule: 6 },
    { text: "Thank you so, so much for playing!", style: "body", rule: 9 },
    { text: `You spent ${playTime(run.playedMs)} in my notebook,`, style: "body", rule: 11 },
    { text: `beat all ${run.worlds} worlds`, style: "body", rule: 12 },
    { text: `and scored ${run.score.toLocaleString("en-US")} points.`, style: "body", rule: 13 },
    { text: "Every one of those minutes means a lot to me.", style: "body", rule: 15 },
  ];
  if (run.unlocked) lines.push({ text: `You unlocked ${run.unlocked}!`, style: "reward", rule: 17 });
  lines.push({ text: `- ${by}`, style: "sign", rule: 20 });
  return lines;
}

/** A play time in words: "25 minutes", "1 hour and 4 minutes", "2 hours". */
export function playTime(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (hours === 0) return count(rest, "minute");
  return rest === 0 ? count(hours, "hour") : `${count(hours, "hour")} and ${count(rest, "minute")}`;
}
