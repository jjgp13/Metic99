import type { AlienKind, TargetStrategy } from "../config/constants";
import type Alien from "../objects/Alien";
import type { AbilityKind } from "../objects/abilities";
import type { Field, FieldInput, MatchMessage } from "../sim/Field";

/**
 * Playtest logger. When the game runs as a claude.ai Artifact with the `db`
 * capability, every finished run is saved as one document in the `runs`
 * collection, where Claude can read it (ArtifactData) and analyze it. Anywhere
 * else (GitHub Pages, `npm run dev`) there is no `window.claude` and this does
 * nothing.
 *
 * The record stores the run's seed and full input log, so the run can be
 * replayed exactly (`replayField`, scripts/playtest-report.ts) and measured
 * after the fact, plus what the rules never see: which device each input came
 * from, drawing-pad reads, pauses, the screen.
 */

/** Where an input came from. */
export type InputSource = "keypad" | "keyboard" | "pad";

/** The slice of the platform's `db` capability this uses. */
interface RunsDb {
  collection(path: string): { add(data: Record<string, unknown>): Promise<unknown> };
}

type ClaudeHost = { use(name: "db"): Promise<RunsDb | null> };

let dbPromise: Promise<RunsDb | null> | null = null;

/** The artifact's store, or null when this page isn't one (or it's not granted). */
function runsDb(): Promise<RunsDb | null> {
  if (!dbPromise) {
    const host = (window as unknown as { claude?: ClaudeHost }).claude;
    dbPromise = host?.use ? host.use("db").catch(() => null) : Promise.resolve(null);
  }
  return dbPromise;
}

/** Start asking for the store early, so game over doesn't wait on it. */
export function initPlaytestLog(): void {
  void runsDb();
}

/** Everything the scene knows about a run that the field doesn't. */
export interface RunExtras {
  lives: number;
  forcedAbilities: string[] | null;
  inputMode: string;
  /** Digit/clear/back inputs per device. */
  sources: Record<InputSource, number>;
  /** Drawing pad: digits read, "?" (unreadable), scratch-outs. */
  ink: { reads: number; unknown: number; scratch: number };
  pauses: number;
  /** Battle mode: the lineup and where the player placed (null in solo). */
  battle: { players: number; opponents: string[]; placement: number | null } | null;
  hits: { atMs: number; kind: string; model: string | null; ability: string | null; digits: readonly number[]; d: number }[];
}

/** A hit, as the run record keeps it. */
export function hitRecord(alien: Alien, field: Field): RunExtras["hits"][number] {
  return {
    atMs: Math.round(field.elapsedMs),
    kind: alien.kind,
    model: alien.model,
    ability: alien.ability?.kind ?? null,
    digits: alien.digits,
    d: Math.round(field.difficulty.d * 1000) / 1000,
  };
}

/**
 * Save a finished run. Resolves "saved", "failed", or "off" (not running as
 * an Artifact with a store: nothing to do).
 */
export async function logRun(field: Field, extras: RunExtras): Promise<"saved" | "failed" | "off"> {
  const db = await runsDb();
  if (!db) return "off";
  const record = {
    v: 2,
    build: __BUILD_ID__,
    at: new Date().toISOString(),
    device: {
      ua: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      dpr: window.devicePixelRatio,
      touch: navigator.maxTouchPoints > 0,
    },
    // Enough to replay the run exactly with this build.
    replay: {
      seed: field.seed,
      lives: extras.lives,
      forcedAbilities: extras.forcedAbilities,
      power: field.power.kind,
      steps: field.steps,
      inputs: field.inputLog.map(({ step, input }) => [step, compact(input)]),
    },
    summary: {
      survivedMs: Math.round(field.elapsedMs),
      score: field.score,
      kills: field.kills,
      bestCombo: field.bestCombo,
      fastestSolveMs: Number.isFinite(field.fastestSolveMs) ? Math.round(field.fastestSolveMs) : null,
      power: field.power.kind,
      energy: {
        earned: Math.round(field.energy.earned),
        spent: Math.round(field.energy.spent[field.power.kind]),
        send: Math.round(field.energy.spent.send),
        cancelled: Math.round(field.cancelledTotal),
      },
    },
    solves: field.solves.map((s) => [s.balls, Math.round(s.ms)]),
    hits: extras.hits,
    inputMode: extras.inputMode,
    sources: extras.sources,
    ink: extras.ink,
    pauses: extras.pauses,
    battle: extras.battle,
  };
  try {
    await db.collection("runs").add(record);
    return "saved";
  } catch {
    return "failed";
  }
}

/** A short form of an input for the log: "d12", "b", "c", "p" (power),
 * "S50" (send), "tkos" / "t@3" (aim by a strategy / at seat 3); from the match "s5/8" (standing) and
 * "a3:50:lumberer/shielded" (attack from seat 3: aliens as kind[/ability]). */
export function compact(input: FieldInput | MatchMessage): string {
  switch (input.type) {
    case "digits":
      return `d${input.digits}`;
    case "back":
      return "b";
    case "clear":
      return "c";
    case "power":
      return "p";
    case "send":
      return `S${input.cost}`;
    case "target":
      return typeof input.aim === "string" ? `t${input.aim}` : `t@${input.aim.seat}`;
    case "standing":
      return `s${input.alive}/${input.total}`;
    case "reward":
      return `r${input.energy}`;
    case "attack": {
      const aliens = input.aliens.map((a) => (a.ability ? `${a.kind}/${a.ability}` : a.kind));
      return `a${input.from}:${input.cost}:${aliens.join(",")}`;
    }
  }
}

/** Undo `compact` (scripts/playtest-report.ts replays runs with it). */
export function expand(code: string): FieldInput | MatchMessage {
  if (code.startsWith("d")) return { type: "digits", digits: code.slice(1) };
  if (code.startsWith("S")) return { type: "send", cost: Number(code.slice(1)) };
  if (code.startsWith("t@")) return { type: "target", aim: { seat: Number(code.slice(2)) } };
  if (code.startsWith("t")) return { type: "target", aim: code.slice(1) as TargetStrategy };
  if (code.startsWith("a")) {
    const [from, cost, aliens] = code.slice(1).split(":");
    return {
      type: "attack",
      from: Number(from),
      cost: Number(cost),
      aliens: aliens.split(",").map((a) => {
        const [kind, ability] = a.split("/");
        return { kind: kind as AlienKind, ability: (ability ?? null) as AbilityKind | null };
      }),
    };
  }
  if (code.startsWith("r")) return { type: "reward", energy: Number(code.slice(1)) };
  if (code.startsWith("s")) {
    const [alive, total] = code.slice(1).split("/").map(Number);
    return { type: "standing", alive, total };
  }
  if (code === "b") return { type: "back" };
  if (code === "c") return { type: "clear" };
  // "p", or "ps" / "pf" from v1 logs (two power buttons; they no longer replay).
  return { type: "power" };
}
