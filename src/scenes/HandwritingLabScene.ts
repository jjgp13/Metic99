import Phaser from "phaser";
import { GAME, HANDWRITING_LAB, KEYPAD_AREA, STORAGE } from "../config/constants";
import { DIGIT_TEMPLATES } from "../handwriting/digitTemplates";
import type { InkEvent } from "../handwriting/inkReader";
import { rankDigits } from "../handwriting/recognizer";
import { encodeGroups, type Sample, type SampleFile } from "../handwriting/samples";
import DrawPad from "../ui/DrawPad";

const PAD_CX = GAME.WIDTH / 2;
const PAD_CY = (KEYPAD_AREA.TOP + KEYPAD_AREA.BOTTOM) / 2;
const PAD_H = KEYPAD_AREA.BOTTOM - KEYPAD_AREA.TOP;
const PAD_LEFT = PAD_CX - KEYPAD_AREA.PAD_W / 2;
const GOOD = "#06d6a0";
const BAD = "#ef476f";

/**
 * Handwriting lab, opened with `?lab=draw` (not linked from the game). It asks
 * for each digit a few times, then some 2-digit numbers, on the same pad as
 * the game (same size and place, so the hand moves as in play). Each drawing
 * shows what was read and the closest digits, and its ink is kept. At the end
 * the samples are exported as JSON to paste into the repo's tests
 * (src/handwriting/samples/). Progress survives a reload.
 */
export default class HandwritingLabScene extends Phaser.Scene {
  private pad!: DrawPad;
  private prompts: string[] = [];
  private samples: Sample[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private rankText!: Phaser.GameObjects.Text;
  private tallyText!: Phaser.GameObjects.Text;
  private overlay: HTMLElement | null = null;

  constructor() {
    super("HandwritingLabScene");
  }

  create(): void {
    this.restore();
    const text = (y: number, size: number, color = "#ffffff") =>
      this.add
        .text(GAME.WIDTH / 2, y, "", { fontFamily: "monospace", fontSize: `${size}px`, color, align: "center" })
        .setOrigin(0.5);
    text(40, 24, "#ffd166").setText("HANDWRITING LAB");
    text(72, 13, "#8892b0").setText("draw like you do in the game · scribble = redo");
    this.countText = text(118, 15, "#8892b0");
    this.promptText = text(190, 64);
    this.resultText = text(290, 20);
    this.rankText = text(324, 14, "#8892b0");
    this.tallyText = text(360, 14, "#8892b0");

    this.pad = new DrawPad(this, PAD_CX, PAD_CY, KEYPAD_AREA.PAD_W, PAD_H, (e) => this.onInk(e));
    this.pad.setVisible(true);

    const button = (x: number, label: string, onPress: () => void) => {
      const bg = this.add
        .rectangle(x, 440, 120, 34, 0x1b2340)
        .setStrokeStyle(1, 0x4ea1ff)
        .setInteractive({ useHandCursor: true });
      this.add.text(x, 440, label, { fontFamily: "monospace", fontSize: "15px", color: "#ffffff" }).setOrigin(0.5);
      bg.on("pointerup", onPress);
    };
    button(95, "UNDO", () => this.undo());
    button(240, "SKIP", () => this.skip());
    button(385, "EXPORT", () => this.showExport());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.closeExport());
    this.refresh();
  }

  update(_time: number, delta: number): void {
    if (!this.overlay) this.pad.update(delta);
  }

  // ---------------------------------------------------------------------------

  private get current(): string | undefined {
    return this.prompts[this.samples.length];
  }

  private onInk(e: InkEvent): void {
    const expected = this.current;
    if (!expected || e.type === "scratch") return; // a scratch just redoes it
    const read = e.type === "digits" ? e.digits : null;
    this.samples.push({ expected, read, groups: encodeGroups(e.inks, PAD_LEFT, KEYPAD_AREA.TOP) });
    this.save();

    const ok = read === expected;
    this.resultText
      .setText(`drew ${expected} → read ${read ?? "?"}  ${ok ? "✓" : "✗"}`)
      .setColor(ok ? GOOD : BAD);
    // The closest digits per group, with $P distances (lower = closer).
    this.rankText.setText(
      e.inks
        .map((g) =>
          rankDigits(g, DIGIT_TEMPLATES)
            .slice(0, 3)
            .map((r) => `${r.digit} ${r.distance.toFixed(2)}`)
            .join(" · "),
        )
        .join("   |   "),
    );
    this.refresh();
    if (!this.current) this.showExport();
  }

  /** A drawing that was not what the prompt asked (or went wrong): drop it. */
  private undo(): void {
    if (!this.samples.length) return;
    this.samples.pop();
    this.save();
    this.resultText.setText("");
    this.rankText.setText("");
    this.pad.cancel();
    this.refresh();
  }

  private skip(): void {
    const expected = this.current;
    if (!expected) return;
    this.prompts.splice(this.samples.length, 1);
    this.prompts.push(expected);
    this.pad.cancel();
    this.save();
    this.refresh();
  }

  private refresh(): void {
    const expected = this.current;
    const total = this.prompts.length;
    this.countText.setText(expected ? `${this.samples.length + 1} / ${total}` : `${total} / ${total}`);
    this.promptText.setText(expected ? `draw ${expected}` : "done!");
    const right = this.samples.filter((s) => s.read === s.expected).length;
    this.tallyText.setText(this.samples.length ? `read right ${right} of ${this.samples.length}` : "");
  }

  // ---------------------------------------------------------------------------
  // Progress (localStorage) and export
  // ---------------------------------------------------------------------------

  private restore(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE.HW_LAB) ?? "null");
      if (saved?.prompts?.length) {
        this.prompts = saved.prompts;
        this.samples = saved.samples ?? [];
        return;
      }
    } catch {
      // Nothing saved (or storage blocked): start fresh.
    }
    this.newRun();
  }

  private newRun(): void {
    const singles: string[] = [];
    for (let r = 0; r < HANDWRITING_LAB.ROUNDS; r++) {
      singles.push(...Phaser.Utils.Array.Shuffle(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]));
    }
    this.prompts = [...singles, ...HANDWRITING_LAB.NUMBERS];
    this.samples = [];
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE.HW_LAB, JSON.stringify({ prompts: this.prompts, samples: this.samples }));
    } catch {
      // Not persisted; the export still works for this visit.
    }
  }

  private exportJson(): string {
    const file: SampleFile = {
      kind: "metic-handwriting",
      version: 1,
      date: new Date().toISOString(),
      pad: { w: KEYPAD_AREA.PAD_W, h: PAD_H },
      samples: this.samples,
    };
    return JSON.stringify(file);
  }

  /**
   * A plain HTML panel over the game with the JSON, since copying and sharing
   * need real DOM controls. The page blocks touch scrolling and text selection
   * for play, so both are switched back on while it is open.
   */
  private showExport(): void {
    if (this.overlay) return;
    const json = this.exportJson();
    const right = this.samples.filter((s) => s.read === s.expected).length;
    const root = document.documentElement;
    root.style.touchAction = document.body.style.touchAction = "auto";

    const panel = document.createElement("div");
    panel.style.cssText =
      "position:fixed;inset:0;z-index:10;background:rgba(5,6,15,.96);color:#fff;font:15px monospace;" +
      "display:flex;flex-direction:column;gap:12px;padding:max(16px,env(safe-area-inset-top)) 16px 16px;box-sizing:border-box;" +
      "user-select:text;-webkit-user-select:text;touch-action:auto";
    const title = document.createElement("div");
    title.textContent = `${this.samples.length} samples · read right ${right}. Copy this and paste it to Claude:`;
    const area = document.createElement("textarea");
    area.value = json;
    area.readOnly = true;
    area.style.cssText =
      "flex:1;min-height:120px;width:100%;box-sizing:border-box;background:#0b1024;color:#bfd4ff;" +
      "border:1px solid #4ea1ff;font:11px monospace;user-select:text;-webkit-user-select:text";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
    const btn = (label: string, onClick: (b: HTMLButtonElement) => void) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText =
        "flex:1;min-width:90px;padding:12px;font:15px monospace;color:#fff;background:#1b2340;border:1px solid #4ea1ff;border-radius:4px";
      b.onclick = () => onClick(b);
      row.appendChild(b);
    };
    btn("COPY", async (b) => {
      try {
        await navigator.clipboard.writeText(json);
        b.textContent = "COPIED ✓";
      } catch {
        // No clipboard API (or refused): fall back to the old copy command.
        area.focus();
        area.select();
        b.textContent = document.execCommand("copy") ? "COPIED ✓" : "select + copy";
      }
    });
    if (typeof navigator.share === "function") {
      btn("SHARE", () => void navigator.share({ title: "Metic handwriting samples", text: json }).catch(() => {}));
    }
    btn("BACK", () => this.closeExport());
    btn("START OVER", () => {
      if (!window.confirm("Delete these samples and start again?")) return;
      this.newRun();
      this.resultText.setText("");
      this.rankText.setText("");
      this.closeExport();
      this.refresh();
    });
    panel.append(title, area, row);
    document.body.appendChild(panel);
    this.overlay = panel;
  }

  private closeExport(): void {
    if (!this.overlay) return;
    this.overlay.remove();
    this.overlay = null;
    document.documentElement.style.touchAction = document.body.style.touchAction = "";
  }
}
