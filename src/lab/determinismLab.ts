import { SIM } from "../config/constants";
import { PALETTE, css } from "../config/palette";
import {
  checkMath,
  checkRun,
  withBrokenSin,
  type MathMismatch,
  type Recording,
  type RunResult,
} from "../sim/determinism";
import { replayField } from "../sim/Field";
import { stateDump } from "../sim/fingerprint";

/**
 * The determinism lab (`?lab=determinism`, docs/NETCODE.md S0 step 3): a
 * plain page, no Phaser, that replays Node's recorded runs on THIS device's
 * JavaScript engine and shows whether it computes exactly what Node did.
 *
 * Open it on each phone. Per run it shows whether every fingerprint (one per
 * game second) matches Node's, and if not, the first second that differs;
 * then whether the outcome a player sees (score, kills, lives) matches. It
 * also re-asks this engine every Math.sin / Math.exp question the rules asked
 * Node. The report box at the bottom is what to paste back into the chat.
 *
 * Break it: `&break=sin` makes Math.sin off by one last bit (as if this
 * engine rounded differently), `&break=sin1` makes it 1% wrong.
 */
export async function runDeterminismLab(): Promise<void> {
  const breakMode = new URLSearchParams(window.location.search).get("break");
  const page = setUpPage();
  page.innerHTML = header(breakMode) + `<p id="status">Loading Node's recording…</p>`;

  const recording = (await import("./determinism-recording.json")).default as unknown as Recording;
  status(page, "Replaying… (a few seconds on a phone)");
  await nextPaint();

  const run = () => {
    const results = recording.runs.map((r) => checkRun(r));
    const math = checkMath(recording.math);
    return { results, math };
  };
  const { results, math } =
    breakMode === "sin" ? withBrokenSin(run) : breakMode === "sin1" ? withBrokenSin(run, 0.01) : run();

  const firstBad = recording.runs.find((_run, i) => !results[i].ok);
  const dump = firstBad ? dumpAt(firstBad, results.find((r) => r.name === firstBad.name)!, breakMode) : [];

  page.innerHTML =
    header(breakMode) +
    verdict(results, math.mismatches) +
    results.map((r, i) => runCard(r, recording.runs[i].about, recording.runs[i].outcome)).join("") +
    mathCard(math.checked, math.mismatches) +
    reportBox({
      engine: navigator.userAgent,
      build: __BUILD_ID__,
      recorded: recording.recorded,
      break: breakMode,
      runs: results,
      math: { checked: math.checked, mismatches: math.mismatches.slice(0, 20) },
      firstMismatchDump: dump,
    });
  wireCopyButton(page);
}

/** The state at the first differing checkpoint, to diff against Node's. */
function dumpAt(run: Recording["runs"][number], result: RunResult, breakMode: string | null): string[] {
  const step = result.firstMismatch!.step;
  const replay = () => stateDump(replayField(run.options, run.log, step, SIM.STEP_MS));
  return breakMode === "sin" ? withBrokenSin(replay) : breakMode === "sin1" ? withBrokenSin(replay, 0.01) : replay();
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
        } on purpose, as if this engine computed it differently from Node.</p>`
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

function verdict(results: RunResult[], mathMismatches: MathMismatch[]): string {
  const same = results.every((r) => r.ok) && mathMismatches.length === 0;
  const color = same ? PALETTE.GOLD : PALETTE.DANGER;
  const text = same
    ? "✓ This engine computes exactly what Node computed."
    : "✗ This engine differs from Node (details below).";
  return `<p style="${box(color)};font-size:18px"><b>${text}</b></p>`;
}

function runCard(r: RunResult, about: string, nodeOutcome: RunResult["outcome"]): string {
  const prints = r.ok
    ? `✓ all ${r.checkpoints} fingerprints match`
    : `✗ first differs at step ${r.firstMismatch!.step} (${(r.firstMismatch!.step / 60).toFixed(0)} s): Node ${
        r.firstMismatch!.expected
      }, here ${r.firstMismatch!.got}`;
  const outcome = r.sameOutcome
    ? `✓ same outcome (score ${r.outcome.score}, ${r.outcome.kills} kills, ${r.outcome.lives} lives)`
    : `✗ different outcome: score ${r.outcome.score} vs Node ${nodeOutcome.score}, kills ${r.outcome.kills} vs ${nodeOutcome.kills}, lives ${r.outcome.lives} vs ${nodeOutcome.lives}`;
  return `<section style="${box(PALETTE.PANEL_LIGHT)}">
    <b>${r.name}</b> <span style="color:${css(PALETTE.TEXT_MUTED)}">${about} · replayed in ${r.ms.toFixed(0)} ms</span><br>
    Fingerprints: ${prints}<br>Outcome: ${outcome}</section>`;
}

function mathCard(checked: number, mismatches: MathMismatch[]): string {
  const list = mismatches
    .slice(0, 5)
    .map((m) => `<br><code>Math.${m.fn}(${m.x})</code>: Node ${m.expected}, here ${m.got}`)
    .join("");
  const text = mismatches.length
    ? `✗ ${mismatches.length} of ${checked} answers differ from Node's${list}`
    : `✓ all ${checked} answers are bit-identical to Node's`;
  return `<section style="${box(PALETTE.PANEL_LIGHT)}"><b>Math.sin / Math.exp</b> <span style="color:${css(
    PALETTE.TEXT_MUTED,
  )}">every input the rules used, asked again</span><br>${text}</section>`;
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
