import type Phaser from "phaser";
import { FEEDBACK, GAME } from "../../config/constants";
import type Alien from "../../objects/Alien";
import type { AnswerView, Field } from "../../sim/Field";
import { outline, textStyle } from "../theme";
import { ANSWER_Y, DEPTH } from "./layout";

/**
 * The typed answer under the ship, with its feedback: white while typing,
 * gold with a pop and a blip when it matches an alien (and the number flies
 * up to it), red with a shake when no alien's answer can start with it.
 * The field decides the state (`field.answerView()`); this only shows it.
 */
export class AnswerDisplay {
  private readonly text: Phaser.GameObjects.Text;
  /** What is shown now, to react only when the text or state changes. */
  private shown: AnswerView | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.text = scene.add
      .text(GAME.WIDTH / 2, ANSWER_Y, "_", textStyle(32, FEEDBACK.COLOR.typing, { fontStyle: "bold" }))
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD);
  }

  /** The answer as last shown (the 3D answer stars spell the same). */
  get view(): AnswerView | null {
    return this.shown;
  }

  setVisible(visible: boolean): void {
    this.text.setVisible(visible);
  }

  /** Re-read the field's answer; animate if its text or state changed. Call
   * after every input and every frame (aliens come and go, so an answer can
   * turn right or wrong without a key). */
  refresh(field: Field): void {
    const view = field.answerView();
    const previous = this.shown;
    this.shown = view;
    if (view?.text === previous?.text && view?.state === previous?.state) return;

    const state = view?.state ?? "typing";
    this.scene.tweens.killTweensOf(this.text);
    this.text
      .setText(view?.text ?? "_")
      .setColor(FEEDBACK.COLOR[state])
      .setScale(1)
      .setX(GAME.WIDTH / 2);

    // The locked answer stays shown after firing; only a typed match pops.
    const typed = field.typed;
    if (state === "match" && typed !== "") {
      this.showMatch(typed, field.alienFor(parseInt(typed, 10)));
    } else if (state === "wrong") {
      this.showWrong();
    }
  }

  private showMatch(typed: string, alien: Alien | undefined): void {
    this.scene.sound.play("blip", { volume: 0.35, rate: 1.5 });
    this.text.setScale(FEEDBACK.MATCH_POP_SCALE);
    this.scene.tweens.add({ targets: this.text, scale: 1, duration: FEEDBACK.MATCH_POP_MS, ease: "Back.easeOut" });
    if (alien) this.flyTo(typed, alien);
  }

  private showWrong(): void {
    this.scene.sound.play("blip", { volume: 0.4, rate: 0.5 });
    this.scene.tweens.add({
      targets: this.text,
      x: GAME.WIDTH / 2 + FEEDBACK.WRONG_SHAKE_PX,
      duration: 45,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
    });
  }

  /** A copy of the matched number flies from the display up to its alien. */
  private flyTo(text: string, alien: Alien): void {
    const fly = this.scene.add
      .text(this.text.x, this.text.y, text, textStyle(32, FEEDBACK.COLOR.match, { fontStyle: "bold", ...outline(4) }))
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD);
    this.scene.tweens.add({
      targets: fly,
      x: alien.x,
      y: alien.y - alien.top,
      scale: 0.5,
      alpha: 0.2,
      duration: FEEDBACK.FLY_MS,
      ease: "Cubic.easeIn",
      onComplete: () => fly.destroy(),
    });
  }
}
