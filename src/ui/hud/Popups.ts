import Phaser from "phaser";
import { ABILITY, FEEDBACK, GAME, KEYPAD_AREA } from "../../config/constants";
import { PALETTE } from "../../config/palette";
import type Alien from "../../objects/Alien";
import type { AbilityKind } from "../../objects/abilities";
import { outline, textStyle } from "../theme";
import type { Ducker } from "./Ducker";
import { DEPTH, GUTTER, METER } from "./layout";

/**
 * Short-lived text that pops up and fades: points and the solved sum over a
 * kill, energy beside the meter, ability intros. Each one destroys itself
 * when its fade ends. Pops over the field duck under aliens (see Ducker).
 */
export class Popups {
  /** Abilities and creatures already introduced this run (one banner each). */
  private readonly introduced = new Set<string>();
  /** Banners on screen right now, top to bottom (each new one goes below them). */
  private readonly banners: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ducker: Ducker,
  ) {}

  /** "+120" rising from a kill. */
  points(points: number, x: number, y: number): void {
    const pop = this.ducker.add(this.scene.add.text(x, y, `+${points}`, textStyle(16, PALETTE.GOLD)).setOrigin(0.5));
    this.riseAndFade(pop, 40, 700);
  }

  /**
   * The solved sum ("7 + 5 = 12") above the alien: a clear "that was right"
   * beat that also teaches the sum.
   */
  equation(digits: readonly number[], alien: Alien): void {
    const E = FEEDBACK.EQUATION;
    const result = digits.reduce((sum, d) => sum + d, 0);
    const y = alien.y - alien.top - 12;
    const text = this.ducker.add(
      this.scene.add
        .text(alien.x, y, `${digits.join(" + ")} = ${result}`, textStyle(E.FONT_PX, FEEDBACK.COLOR.match, { fontStyle: "bold", ...outline(4) }))
        .setOrigin(0.5),
    );
    // Keep the whole equation on screen near the side edges.
    const half = text.width / 2 + 4;
    text.setX(Phaser.Math.Clamp(alien.x, half, GAME.WIDTH - half)).setScale(1.4);
    this.scene.tweens.add({ targets: text, scale: 1, duration: E.POP_MS, ease: "Back.easeOut" });
    this.scene.tweens.add({
      targets: text,
      y: y - E.RISE_PX,
      alpha: 0,
      delay: E.HOLD_MS,
      duration: E.FADE_MS,
      onComplete: () => text.destroy(),
    });
  }

  /** The drifter's bonus energy, where it was solved. */
  energyBurst(amount: number, x: number, y: number): void {
    const pop = this.ducker.add(this.scene.add.text(x, y + 22, `+${amount} ENERGY`, textStyle(15, PALETTE.BONUS)).setOrigin(0.5));
    this.scene.tweens.add({ targets: pop, y: y - 30, alpha: 0, duration: 1100, onComplete: () => pop.destroy() });
  }

  /** Energy a kill stored, popped under the vertical meter (it ducks: it's over the field). */
  energyGain(stored: number): void {
    if (stored < 0.5) return;
    const pop = this.ducker.add(
      this.scene.add
        .text(METER.X, METER.TOP + METER.H + 18, `+${Math.round(stored)}`, textStyle(14, PALETTE.ENERGY))
        .setOrigin(0.5, 1),
    );
    this.riseAndFade(pop, 12, 700);
  }

  /** Battle: kill value that paid off incoming attacks, over the SEND column. */
  cancelledIncoming(amount: number): void {
    const pop = this.scene.add
      .text(GUTTER.LEFT_X, KEYPAD_AREA.TOP - 4, `-${Math.round(amount)}`, textStyle(13, PALETTE.INCOMING))
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.POP);
    this.riseAndFade(pop, 20, 800);
  }

  /** First sighting of an ability this run: a banner names it and its rule. */
  introduceAbility(kind: AbilityKind): void {
    this.introduce(kind, ABILITY.INTRO[kind]);
  }

  /** A one-line intro banner, once per run per `key`. */
  introduce(key: string, text: string): void {
    if (this.introduced.has(key)) return;
    this.introduced.add(key);
    this.banner(text, 15, ABILITY.INTRO_MS);
  }

  /** A line of text at the top of the field that fades after `ms`; banners
   * shown together stack downward instead of overlapping (each one sits
   * under the lowest one still shown, by their real heights: a big BOSS
   * banner and its small intro line differ). */
  banner(text: string, size: number, ms: number): void {
    const banner = this.ducker.add(
      this.scene.add.text(GAME.WIDTH / 2, ABILITY.INTRO_Y, text, textStyle(size, PALETTE.GOLD, outline(4))).setOrigin(0.5),
    );
    const above = this.banners[this.banners.length - 1];
    if (above) banner.setY(above.y + above.height / 2 + banner.height / 2);
    this.banners.push(banner);
    this.scene.tweens.add({
      targets: banner,
      alpha: 0,
      delay: ms,
      duration: 400,
      onComplete: () => {
        this.banners.splice(this.banners.indexOf(banner), 1);
        banner.destroy();
      },
    });
  }

  private riseAndFade(pop: Phaser.GameObjects.Text, risePx: number, durationMs: number): void {
    this.scene.tweens.add({
      targets: pop,
      y: pop.y - risePx,
      alpha: 0,
      duration: durationMs,
      onComplete: () => pop.destroy(),
    });
  }
}
