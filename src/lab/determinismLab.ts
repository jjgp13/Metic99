import { SIM } from "../config/constants";
import { PALETTE, css } from "../config/palette";
import {
  checkMath,
  checkRun,
  withBrokenSin,
  withEngineMath,
  type MathMismatch,
  type Recording,
  type RunResult,
} from "../sim/determinism";
import { replayField } from "../sim/Field";
import { stateDump } from "../sim/fingerprint";

/**
 * The determinism lab (`?lab=determinism`, docs/NETCODE.md S0 steps 3–4):
 * a plain page, no Phaser, that replays Node's recorded runs on THIS
 * device's JavaScript engine and shows whether it computes exactly what Node
 * did.
 *
 * Everything is measured twice: "Game" = the rules as they ship (their own
 * deterministic sin/exp, step 4) and "Before" = the same rules on this
 * engine's Math.sin/exp (as before step 4). Per run it shows whether every
 * fingerprint (one per game second) matches Node's, the first second that
 * differs, and whether the outcome a player sees (score, kills, lives)
 * matches; then it re-asks every sin/exp question the rules asked Node. The
 * report box at the bottom is what to paste back into the chat.
 *
 * Break it: `&break=sin` makes Math.sin off by one last bit (as if this
 * engine rounded differently), `&break=sin1` makes it 1% wrong. Only the
 * "Before" lines should notice.
 */
export async function runDeterminismLab(): Promise<void> {
  const breakMode = new URLSearchParams(window.location.search).get("break");
  const page = setUpPage();
  page.innerHTML = header(breakMode) + `<p id="status">Loading Node's recording…</p>`;

  const recording = (await import("./determinism-recording.json")).default as unknown as Recording;
  status(page, "Replaying… (a few seconds on a phone)");
  await nextPaint();

  const broken = <T>(body: () => T): T =>
    breakMode === "sin" ? withBrokenSin(body) : breakMode === "sin1" ? withBrokenSin(body, 0.01) : body();
  const game: Measured = broken(() => ({
    results: recording.runs.map((r) => checkRun(r)),
    math: checkMath(recording.math, "game"),
  }));
  const before: Measured = broken(() =>
    withEngineMath(() => ({
      results: recording.runs.map((r) => checkRun(r)),
      math: checkMath(recording.math, "engine"),
    })),
  );

  // The game's own state at its first mismatch, to diff against Node's.
  const firstBad = recording.runs.findIndex((_run, i) => !game.results[i].ok);
  const dump = firstBad < 0 ? [] : broken(() => dumpAt(recording.runs[firstBad], game.results[firstBad]));

  page.innerHTML =
    header(breakMode) +
    verdict(game) +
    recording.runs.map((r, i) => runCard(r.name, r.about, r.outcome, game.results[i], before.results[i])).join("") +
    mathCard(game.math, before.math) +
    reportBox({
      engine: navigator.userAgent,
      build: __BUILD_ID__,
      recorded: recording.recorded,
      break: breakMode,
      game: summary(game),
      before: summary(before),
      firstMismatchDump: dump,
    });
  wireCopyButton(page);
}

/** One column of measurements: every run, and the sin/exp answers. */
interface Measured {
  results: RunResult[];
  math: { checked: number; mismatches: MathMismatch[] };
}

/** A column for the report: per run, and how many math answers differ. */
function summary({ results, math }: Measured) {
  return {
    runs: results.map((r) => ({
      name: r.name,
      ok: r.ok,
      firstMismatch: r.firstMismatch,
      sameOutcome: r.sameOutcome,
      outcome: r.outcome,
      ms: Math.round(r.ms),
    })),
    math: { checked: math.checked, differ: math.mismatches.length, first: math.mismatches.slice(0, 10) },
  };
}

/** The state at the first differing checkpoint, to diff against Node's. */
function dumpAt(run: Recording["runs"][number], result: RunResult): string[] {
  return stateDump(replayField(run.options, run.log, result.firstMismatch!.step, SIM.STEP_MS));
}

function setUpPage(): HTMLElement {
  document.getElementById("game")?.remove();
  // index.html locks the page for the game (no scroll, no selection); undo it here.
  const body = document.body.style;
  body.overflow = "auto";
  body.touchAction = "auto";
  body.userSelect = "text";
  body.setProperty("-webkit-user-select", "text");
  body.color = css(PALETTE.TEXT);
  body.font = "15px/1.45 system-ui, sans-serif";
  const page = document.createElement("main");
  page.style.cssText = "max-width:640px;margin:0 auto;padding:16px 16px 48px;";
  document.body.appendChild(page);
  return page;
}

function header(breakMode: string | null): string {
  const banner =
    breakMode === "sin" || breakMode === "sin1"
      ? `<p style="${box(PALETTE.ATTACK)}"><b>BREAK IT:</b> Math.sin is ${
          breakMode === "sin" ? "off by one last bit" : "1% wrong"
        } on purpose, as if this engine computed it differently from Node. The game doesn't call
        Math.sin any more, so only the "Before" lines should change.</p>`
      : "";
  const links = [
    ["normal", "?lab=determinism"],
    ["break: one bit", "?lab=determinism&break=sin"],
    ["break: 1%", "?lab=determinism&break=sin1"],
  ]
    .map(([label, href]) => `<a href="${href}" style="color:${css(PALETTE.ACCENT)}">${label}</a>`)
    .join(" · ");
  return `<h1 style="font-size:22px;margin:0 0 4px">Determinism lab</h1>
    <p style="color:${css(PALETTE.TEXT_MUTED)};margin:0 0 12px">Same inputs as Node → same state on this engine? ${links}</p>
    ${banner}`;
}

function verdict({ results, math }: Measured): string {
  const same = results.every((r) => r.ok) && math.mismatches.length === 0;
  const color = same ? PALETTE.GOLD : PALETTE.DANGER;
  const text = same
    ? "✓ The game computes exactly what Node computed, on this engine."
    : "✗ The game differs from Node on this engine (details below).";
  return `<p style="${box(color)};font-size:18px"><b>${text}</b></p>`;
}

function runCard(
  name: string,
  about: string,
  nodeOutcome: RunResult["outcome"],
  game: RunResult,
  before: RunResult,
): string {
  const line = (label: string, r: RunResult) => {
    const prints = r.ok
      ? `✓ all ${r.checkpoints} fingerprints match`
      : `✗ fingerprints differ from step ${r.firstMismatch!.step} (${(r.firstMismatch!.step / 60).toFixed(0)} s)`;
    const outcome = r.sameOutcome
      ? `same outcome (score ${r.outcome.score}, ${r.outcome.kills} kills, ${r.outcome.lives} lives)`
      : `✗ different outcome: score ${r.outcome.score} vs Node ${nodeOutcome.score}, kills ${r.outcome.kills} vs ${nodeOutcome.kills}, lives ${r.outcome.lives} vs ${nodeOutcome.lives}`;
    return `<br><b>${label}:</b> ${prints} · ${outcome}`;
  };
  return `<section style="${box(PALETTE.PANEL_LIGHT)}">
    <b>${name}</b> <span style="color:${css(PALETTE.TEXT_MUTED)}">${about} · replayed in ${game.ms.toFixed(0)} ms</span>
    ${line("Game", game)}${line("Before (engine math)", before)}</section>`;
}

function mathCard(game: Measured["math"], before: Measured["math"]): string {
  const text = (label: string, source: string, { checked, mismatches }: Measured["math"]) => {
    const list = mismatches
      .slice(0, 3)
      .map((m) => `<br>&nbsp;&nbsp;<code>${m.fn}(${m.x})</code>: Node ${m.expected}, here ${m.got}`)
      .join("");
    return mismatches.length
      ? `<br><b>${label}</b> (${source}): ✗ ${mismatches.length} of ${checked} answers differ from Node's${list}`
      : `<br><b>${label}</b> (${source}): ✓ all ${checked} answers bit-identical to Node's`;
  };
  return `<section style="${box(PALETTE.PANEL_LIGHT)}"><b>sin / exp</b> <span style="color:${css(
    PALETTE.TEXT_MUTED,
  )}">every input the rules used, asked again</span>${text("Game", "math/detmath.ts", game)}${text(
    "Before",
    "this engine's Math",
    before,
  )}</section>`;
}

function reportBox(report: object): string {
  return `<h2 style="font-size:16px;margin:20px 0 6px">Report (paste this into the chat)</h2>
    <button id="copy" style="padding:8px 14px;margin-bottom:8px;background:${css(PALETTE.PANEL)};color:${css(
      PALETTE.TEXT,
    )};border:1px solid ${css(PALETTE.ACCENT)};border-radius:6px">Copy report</button>
    <textarea id="report" readonly style="width:100%;height:160px;box-sizing:border-box;background:${css(
      PALETTE.PANEL,
    )};color:${css(PALETTE.TEXT)};font:12px monospace">${escapeHtml(JSON.stringify(report))}</textarea>`;
}

function wireCopyButton(page: HTMLElement): void {
  const button = page.querySelector<HTMLButtonElement>("#copy")!;
  const text = page.querySelector<HTMLTextAreaElement>("#report")!;
  button.onclick = async () => {
    text.select();
    try {
      await navigator.clipboard.writeText(text.value);
      button.textContent = "Copied ✓";
    } catch {
      // The clipboard API needs https or localhost; on a LAN address copy by hand.
      document.execCommand("copy");
      button.textContent = "Selected: copy it";
    }
  };
}

function box(border: number): string {
  return `border:1px solid ${css(border)};border-radius:8px;padding:10px 12px;margin:10px 0;background:${css(
    PALETTE.PANEL,
  )}`;
}

function status(page: HTMLElement, text: string): void {
  page.querySelector("#status")!.textContent = text;
}

/** Let the browser paint the "Replaying…" text before the long replay blocks
 * it (a timer, not requestAnimationFrame, which never fires in a hidden tab). */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
