import Phaser from "phaser";
import {
  ABILITY,
  FEEDBACK,
  GAME,
  KEYPAD_AREA,
  PLAYER,
  RANKS,
  SCORE,
  SIM,
  STORAGE,
  type InputMode,
} from "../config/constants";
import { isLeaderboardEnabled, startMatch } from "../services/leaderboard";
import {
  hitRecord,
  initPlaytestLog,
  logRun,
  type InputSource,
  type RunExtras,
} from "../services/playtestLog";
import type Alien from "../objects/Alien";
import { ABILITY_KINDS, type AbilityKind } from "../objects/abilities";
import World3D, { getWorld3D } from "../render3d/World3D";
import { selectedShip } from "../config/ships";
import { selectedPower } from "../config/powers";
import {
  ANSWER_MAX_DIGITS,
  Field,
  type AnswerView,
  type FieldEvent,
  type FieldInput,
} from "../sim/Field";
import { Bot } from "../sim/Bot";
import type { PowerUse } from "../sim/energy";
import { randomSeed } from "../sim/rng";
import { summarizeSolves } from "../sim/stats";
import { inputMode, setInputMode } from "../config/inputMode";
import type { InkEvent } from "../handwriting/inkReader";
import DrawPad from "../ui/DrawPad";
import { onKeyDown } from "../ui/keyboard";

// Energy HUD sits beside and under the keypad so it never covers the field or
// the keys: the POWER button in both gutters (one per thumb; the right one will
// become SEND in the battle royale), the meter under the keypad.
const KEYPAD_TOP = KEYPAD_AREA.TOP;
const KEYPAD_BOTTOM = KEYPAD_AREA.BOTTOM;
const GUTTER_H = KEYPAD_BOTTOM - KEYPAD_TOP;
const ENERGY_COLOR = 0x5ef0ff;
const METER_X = GAME.WIDTH / 2 - 180; // under the keypad, same width
const METER_W = 360;
const METER_Y = KEYPAD_BOTTOM + 22;
const BUTTON_FILL = 0x1b2340;
// The answer display's row, between the ship and the keypad: the input-mode
// switch sits on its right, the drawing pad's C button on its left.
const ANSWER_Y = PLAYER.Y + 36;

/**
 * GameScene owns the actual gameplay. A Phaser Scene has a lifecycle:
 *   create()  -> build the world once
 *   update(t, dt) -> called every frame (dt = ms since last frame)
 *
 * The rules live in `Field` (sim/Field.ts, no Phaser): this scene turns the
 * keypad, keyboard and drawing pad into field inputs, steps the field at a
 * fixed rate, and shows what happened (sounds, HUD, pops) from its events.
 * Phaser draws only the HUD and keypad; the playfield is drawn in 3D by
 * World3D, which reads a snapshot of the field at the end of each frame.
 */
export default class GameScene extends Phaser.Scene {
  private world!: World3D;
  private field!: Field;
  /** Dev only (`?bot=ace`): a bot plays this field through the same inputs. */
  private autopilot: Bot | null = null;
  /** What the playtest log records beyond the field (services/playtestLog.ts). */
  private runExtras!: RunExtras;
  /** Real time not yet simulated; the sim runs in whole SIM.STEP_MS steps. */
  private stepAccMs = 0;
  private typedText!: Phaser.GameObjects.Text;
  /** What the answer display shows (typed number or the locked answer). */
  private answer: AnswerView | null = null;
  /** Lock-on brackets around the current target. */
  private reticle!: Phaser.GameObjects.Graphics;
  private reticleTarget: Alien | null = null;
  private reticleAge = 0;
  private scoreText!: Phaser.GameObjects.Text;
  /** HUD pieces and pops over the field; each fades while an alien is under it. */
  private ducked: Phaser.GameObjects.Container[] = [];
  private lifeIcons: Phaser.GameObjects.Image[] = [];
  private comboText!: Phaser.GameObjects.Text;
  private gameOver = false;
  /** Guards the single transition out of the game-over screen. */
  private proceeding = false;
  /** Whether this run beat the stored personal best (drives name-entry copy). */
  private newHighScore = false;

  private diffBar!: Phaser.GameObjects.Rectangle;

  // Energy HUD: the meter under the keypad, the POWER button in the gutters.
  private energyFill!: Phaser.GameObjects.Rectangle;
  private energyText!: Phaser.GameObjects.Text;
  private powerButtons: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [];
  private slowTint!: Phaser.GameObjects.Rectangle;

  // Pause: while paused the field is frozen and aliens are hidden so the
  // player can't keep solving sums during the break.
  private paused = false;
  private pauseOverlay: Phaser.GameObjects.GameObject[] = [];

  /** Abilities already introduced this run (each gets one intro banner). */
  private seenAbilities = new Set<AbilityKind>();

  // On-screen input: the keypad or the handwriting pad in the same spot (the
  // keyboard works in both).
  private keypadParts: Phaser.GameObjects.GameObject[] = [];
  private pad!: DrawPad;
  private modeLabel!: Phaser.GameObjects.Text;
  private padClear: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.resetState();

    // The 3D playfield (starfield, ship, aliens, bullets, explosions) renders on
    // its own canvas under Phaser's; stop drawing it when we leave this scene.
    this.world = getWorld3D();
    this.world.begin(this.textures, this.game.canvas, selectedShip().model);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.world.end());

    this.buildHud();
    this.buildKeypad();
    this.buildDrawPad();
    this.applyInputMode(inputMode());
    this.buildEnergyHud();
    this.bindKeyboard();

    // Open a server-gated match so this run's score can be submitted later.
    // Fire-and-forget: if it fails the player just gets an unsaved score.
    void startMatch();
    initPlaytestLog();
  }

  private resetState(): void {
    this.stepAccMs = 0;
    this.answer = null;
    this.reticleTarget = null;
    this.reticleAge = 0;
    this.lifeIcons = [];
    this.ducked = [];
    this.gameOver = false;
    this.proceeding = false;
    this.newHighScore = false;
    this.paused = false;
    this.pauseOverlay = [];
    this.seenAbilities.clear();
    this.keypadParts = [];
    this.padClear = [];
    this.powerButtons = [];

    // The run's seed: the same seed and inputs roll the same aliens.
    // Dev: `?seed=123` replays a seed; `?ability=blinker,shielded` makes every
    // allowed spawn one of these (ignoring unlocks and chance) for play-testing.
    let seed = randomSeed();
    let forcedAbilities: AbilityKind[] | null = null;
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const seedParam = params.get("seed");
      if (seedParam && /^\d+$/.test(seedParam)) seed = Number(seedParam) >>> 0;
      console.info(`[metic] run seed ${seed} (replay with ?seed=${seed})`);
      const kinds = params
        .get("ability")
        ?.split(",")
        .filter((k): k is AbilityKind => (ABILITY_KINDS as string[]).includes(k));
      if (kinds?.length) forcedAbilities = kinds;
    }
    this.field = new Field({ seed, forcedAbilities, power: selectedPower() });
    this.runExtras = {
      lives: this.field.lives,
      forcedAbilities,
      inputMode: inputMode(),
      sources: { keypad: 0, keyboard: 0, pad: 0 },
      ink: { reads: 0, unknown: 0, scratch: 0 },
      pauses: 0,
      hits: [],
    };
    this.autopilot = null;
    if (import.meta.env.DEV) {
      const level = new URLSearchParams(window.location.search).get("bot") ?? "";
      if (Bot.isLevel(level)) this.autopilot = Bot.forSeat(level, seed);
    }
  }

  update(time: number, delta: number): void {
    // Game over / pause freeze the simulation, but the 3D view keeps rendering
    // (stars drift, the final explosion finishes, pause hides the aliens).
    if (!this.gameOver && !this.paused) {
      // Fixed timestep: bank real time and run the rules in whole steps, so a
      // run plays the same at any frame rate (docs/MULTIPLAYER_DESIGN.md §8).
      const maxAcc = SIM.STEP_MS * SIM.MAX_STEPS_PER_FRAME;
      this.stepAccMs = Math.min(this.stepAccMs + delta, maxAcc);
      while (this.stepAccMs >= SIM.STEP_MS && !this.gameOver) {
        this.step(SIM.STEP_MS);
        this.stepAccMs -= SIM.STEP_MS;
      }
      this.updateHud(delta);
      this.pad.update(delta);
    }

    // Draw between the last two sim steps (interpolation) so motion is smooth
    // even when a frame runs zero or two steps.
    const alpha = this.stepAlpha;
    const f = this.field;
    this.world.render(
      {
        shipX: f.prevShipX + (f.shipX - f.prevShipX) * alpha,
        shipTargetX: f.target?.active ? f.target.viewX(alpha) : null,
        aliens: f.aliens,
        bullets: f.bullets,
        alpha,
        aliensHidden: this.paused,
        shipShield: f.power.shieldArmed,
        answer: this.paused || this.gameOver ? null : this.answer,
      },
      time,
      delta,
    );
  }

  /** How far (0..1) real time is between the last sim step and the next. */
  private get stepAlpha(): number {
    return this.stepAccMs / SIM.STEP_MS;
  }

  /** One fixed sim step, then show what happened in it. */
  private step(dt: number): void {
    this.autopilot?.update(this.field, dt);
    this.field.step(dt);
    for (const e of this.field.takeEvents()) this.show(e);
  }

  /** Turn a field event into sound, pops and HUD changes. */
  private show(e: FieldEvent): void {
    switch (e.type) {
      case "spawned":
        if (e.alien.ability) this.introduceAbility(e.alien.ability.kind);
        break;
      case "fired":
        this.sound.play("shoot", { volume: 0.4 });
        break;
      case "solved":
        if (e.absorbed) this.sound.play("explode", { volume: 0.3, rate: 1.6 });
        else this.explode(e.alien);
        this.updateComboText();
        this.showScore(e.points, e.alien.x, e.alien.y);
        this.showEnergyGain(e.energy);
        this.popEquation(e.digits, e.alien);
        if (e.burst > 0) this.popBurst(e.burst, e.alien.x, e.alien.y);
        break;
      case "power":
        this.showPowerUse(e.use);
        break;
      case "blasted":
        for (const a of e.aliens) this.explode(a);
        this.cameras.main.flash(180, 255, 159, 90);
        this.cameras.main.shake(200, 0.012);
        this.world.shake(200, 0.012);
        break;
      case "shielded":
        this.explode(e.alien);
        this.sound.play("explode", { volume: 0.4, rate: 0.7 });
        this.cameras.main.flash(120, 255, 209, 102);
        break;
      case "hit":
        this.runExtras.hits.push(hitRecord(e.alien, this.field));
        this.explode(e.alien);
        this.sound.play("hurt", { volume: 0.5 });
        this.updateComboText();
        this.lifeIcons[e.livesLeft]?.setAlpha(0.15);
        this.cameras.main.shake(150, 0.01);
        this.world.shake(150, 0.01);
        break;
      case "knockedOut":
        this.endGame();
        break;
    }
  }

  /** Once per frame: HUD and answer feedback, which only show the rules' state. */
  private updateHud(delta: number): void {
    this.diffBar.setSize(this.field.difficulty.d * (GAME.WIDTH - 24), 4); // show ramp progress

    // Aliens come and go, so an answer can turn right or wrong without a key.
    this.refreshAnswer();
    this.drawReticle(delta);
    this.duckHud(delta);

    this.updateEnergyHud();
  }


  /** First sighting of an ability this run: a short banner names it and its rule. */
  private introduceAbility(kind: AbilityKind): void {
    if (this.seenAbilities.has(kind)) return;
    this.seenAbilities.add(kind);
    const banner = this.add
      .text(GAME.WIDTH / 2, ABILITY.INTRO_Y, ABILITY.INTRO[kind], {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#ffd166",
        stroke: "#05060f",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.duckable(banner);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: ABILITY.INTRO_MS,
      duration: 400,
      onComplete: () => banner.destroy(),
    });
  }

  // ---------------------------------------------------------------------------
  // Combat
  // ---------------------------------------------------------------------------





  private updateComboText(): void {
    const combo = this.field.combo;
    if (combo >= 2) {
      const mult = Math.min(SCORE.COMBO_MAX, 1 + (combo - 1) * SCORE.COMBO_STEP);
      this.comboText.setText(`x${mult.toFixed(2)}  (${combo} streak)`);
    } else {
      this.comboText.setText("");
    }
  }


  /**
   * Show the solved sum ("7 + 5 = 12") above the alien, and burst the answer's
   * background stars: a clear "that was right" beat that also teaches the sum.
   */
  private popEquation(digits: readonly number[], alien: Alien): void {
    const E = FEEDBACK.EQUATION;
    const result = digits.reduce((s, d) => s + d, 0);
    this.world.answerSolved(String(result));
    const y = alien.y - alien.top - 12;
    const text = this.add
      .text(alien.x, y, `${digits.join(" + ")} = ${result}`, {
        fontFamily: "monospace",
        fontSize: `${E.FONT_PX}px`,
        fontStyle: "bold",
        color: FEEDBACK.COLOR.match,
        stroke: "#05060f",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.duckable(text);
    const half = text.width / 2 + 4;
    text.setX(Phaser.Math.Clamp(alien.x, half, GAME.WIDTH - half)).setScale(1.4);
    this.tweens.add({ targets: text, scale: 1, duration: E.POP_MS, ease: "Back.easeOut" });
    this.tweens.add({
      targets: text,
      y: y - E.RISE_PX,
      alpha: 0,
      delay: E.HOLD_MS,
      duration: E.FADE_MS,
      onComplete: () => text.destroy(),
    });
  }

  /** Label the drifter's energy burst where it was solved (the meter pops too). */
  private popBurst(amount: number, x: number, y: number): void {
    const pop = this.add
      .text(x, y + 22, `+${amount} ENERGY`, {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#ff6be6",
      })
      .setOrigin(0.5);
    this.duckable(pop);
    this.tweens.add({
      targets: pop,
      y: y - 30,
      alpha: 0,
      duration: 1100,
      onComplete: () => pop.destroy(),
    });
  }

  private explode(alien: Alien): void {
    this.sound.play("explode", { volume: 0.5 });
    this.world.explode(alien.x, alien.y, alien);
  }

  // ---------------------------------------------------------------------------
  // Score & lives HUD
  // ---------------------------------------------------------------------------
  private showScore(points: number, x: number, y: number): void {
    this.scoreText.setText(this.field.score.toString().padStart(7, "0"));

    const pop = this.add
      .text(x, y, `+${points}`, { fontFamily: "monospace", fontSize: "16px", color: "#ffd166" })
      .setOrigin(0.5);
    this.duckable(pop);
    this.tweens.add({
      targets: pop,
      y: y - 40,
      alpha: 0,
      duration: 700,
      onComplete: () => pop.destroy(),
    });
  }


  /** Freeze the field and hide aliens so the player can't solve while paused. */
  private togglePause(): void {
    if (this.gameOver) return;
    this.paused = !this.paused;
    if (this.paused) this.runExtras.pauses++;

    // The 3D view hides the aliens while paused (see update()).
    this.reticle.setVisible(!this.paused);
    this.pad.setEnabled(!this.paused);
    if (this.paused) {
      this.typedText.setVisible(false);

      const dim = this.add
        .rectangle(GAME.WIDTH / 2, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x05060f, 0.92)
        .setDepth(9)
        .setInteractive();
      dim.on("pointerdown", () => this.togglePause());
      const label = this.add
        .text(GAME.WIDTH / 2, GAME.HEIGHT / 2, "PAUSED\n\ntap / P to resume", {
          fontFamily: "monospace",
          fontSize: "28px",
          color: "#4ea1ff",
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(10);
      this.pauseOverlay = [dim, label];
    } else {
      this.pauseOverlay.forEach((o) => o.destroy());
      this.pauseOverlay = [];
      this.typedText.setVisible(true);
    }
  }

  /**
   * Put a HUD piece or pop into its own container, which duckHud fades while
   * an alien is under it. The container's alpha multiplies the piece's own
   * (a lost life's dimmed icon, a pop fading out), so both still work.
   */
  private duckable<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.ducked.push(this.add.container(0, 0, [obj]).setDepth(5));
    return obj;
  }

  /** Fade HUD pieces and pops that overlap any alien's box (ball row + body). */
  private duckHud(delta: number): void {
    const alpha = this.stepAlpha;
    const boxes = this.field.aliens
      .filter((a) => a.active)
      .map((a) => {
        const x = a.viewX(alpha);
        const y = a.viewY(alpha);
        return new Phaser.Geom.Rectangle(x - a.halfW, y - a.top, a.halfW * 2, a.top + a.bottom);
      });
    const k = Math.min(1, delta / FEEDBACK.DUCK.MS);
    this.ducked = this.ducked.filter((c) => {
      if (c.list.length === 0) {
        c.destroy(); // its pop finished
        return false;
      }
      const bounds = c.getBounds();
      const under = boxes.some((b) => Phaser.Geom.Intersects.RectangleToRectangle(bounds, b));
      c.setAlpha(c.alpha + ((under ? FEEDBACK.DUCK.ALPHA : 1) - c.alpha) * k);
      return true;
    });
  }

  private buildHud(): void {
    // The top HUD is drawn over the field, so each piece fades while an alien
    // is under it (see duckHud): the sums always stay readable.
    const HUD_DEPTH = 5;
    this.scoreText = this.duckable(
      this.add.text(12, 12, "0000000", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffffff",
      }),
    );

    // Difficulty ramp indicator: a thin bar that fills as the game speeds up.
    this.duckable(this.add.rectangle(12, 44, GAME.WIDTH - 24, 4, 0x1b2340).setOrigin(0, 0.5));
    this.diffBar = this.duckable(this.add.rectangle(12, 44, 0, 4, 0x4ea1ff).setOrigin(0, 0.5));

    for (let i = 0; i < this.field.lives; i++) {
      const icon = this.add.image(GAME.WIDTH - 18 - i * 26, 22, "life").setScale(1.4);
      this.lifeIcons.push(this.duckable(icon));
    }

    this.typedText = this.add
      .text(GAME.WIDTH / 2, ANSWER_Y, "_", {
        fontFamily: "monospace",
        fontSize: "32px",
        fontStyle: "bold",
        color: FEEDBACK.COLOR.typing,
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    // Under the HUD, over the (3D) field.
    this.reticle = this.add.graphics().setDepth(4);

    // Combo / streak multiplier indicator.
    this.comboText = this.duckable(
      this.add.text(12, 56, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffd166",
      }),
    );

    if (this.autopilot) {
      this.duckable(
        this.add
          .text(GAME.WIDTH - 12, 62, `AUTOPILOT: ${this.autopilot.level.toUpperCase()}`, {
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#5ef0ff",
          })
          .setOrigin(1, 0.5),
      );
    }

    // Pause button (also bound to the P key).
    const pauseBtn = this.duckable(
      this.add
        .text(GAME.WIDTH / 2, 22, "II", {
          fontFamily: "monospace",
          fontSize: "20px",
          color: "#4ea1ff",
        })
        .setOrigin(0.5),
    ).setInteractive({ useHandCursor: true });
    pauseBtn.on("pointerdown", () => this.togglePause());
  }

  // ---------------------------------------------------------------------------
  // Energy & the power (picked on the menu)
  // ---------------------------------------------------------------------------
  /** Pop the energy a kill stored next to the meter. */
  private showEnergyGain(stored: number): void {
    if (stored < 0.5) return;
    const pop = this.add
      .text(METER_X + METER_W * this.field.energy.fraction, METER_Y - 8, `+${Math.round(stored)}`, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#5ef0ff",
      })
      .setOrigin(0.5, 1)
      .setDepth(6);
    this.tweens.add({
      targets: pop,
      y: pop.y - 20,
      alpha: 0,
      duration: 700,
      onComplete: () => pop.destroy(),
    });
  }

  private triggerPower(): void {
    if (this.gameOver || this.paused) return;
    this.field.apply({ type: "power" });
    this.updateEnergyHud();
  }

  /** Sound for what a power press did (BLAST and SHIELD also get field events). */
  private showPowerUse(use: PowerUse): void {
    if (use === "blast") {
      this.sound.play("explode", { volume: 0.6, rate: 0.5 });
      return;
    }
    const rate = use === "off" ? 1.2 : use === "armed" ? 0.9 : this.field.power.kind === "freeze" ? 0.4 : 0.6;
    this.sound.play("blip", { volume: 0.5, rate });
  }

  private buildEnergyHud(): void {
    const HUD_DEPTH = 5;
    const def = this.field.power.def;

    // Field tint while a time power runs. It is drawn on the transparent Phaser
    // canvas, so it tints the 3D playfield underneath (and sits below the HUD).
    this.slowTint = this.add
      .rectangle(GAME.WIDTH / 2, 0, GAME.WIDTH, PLAYER.Y + 20, def.COLOR, 1)
      .setOrigin(0.5, 0)
      .setDepth(4)
      .setVisible(false);

    // The same POWER button in both gutters beside the keypad, one per thumb.
    const makeButton = (x: number) => {
      const bg = this.add
        .rectangle(x, KEYPAD_TOP + GUTTER_H / 2, 48, GUTTER_H, BUTTON_FILL)
        .setStrokeStyle(2, def.COLOR)
        .setDepth(HUD_DEPTH)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(x, KEYPAD_TOP + GUTTER_H / 2, def.NAME.split("").join("\n"), {
          fontFamily: "monospace",
          fontSize: "18px",
          color: "#ffffff",
          align: "center",
          lineSpacing: def.NAME.length > 4 ? 0 : 8,
        })
        .setOrigin(0.5)
        .setDepth(HUD_DEPTH);
      bg.on("pointerdown", () => this.triggerPower());
      this.powerButtons.push({ bg, text });
    };
    makeButton(30);
    makeButton(GAME.WIDTH - 30);

    // Horizontal energy meter under the keypad.
    this.add
      .text(30, METER_Y, "EN", { fontFamily: "monospace", fontSize: "12px", color: "#5ef0ff" })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.add
      .rectangle(METER_X, METER_Y, METER_W, 12, BUTTON_FILL)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x33406e)
      .setDepth(HUD_DEPTH);
    this.energyFill = this.add
      .rectangle(METER_X, METER_Y, 0, 8, ENERGY_COLOR)
      .setOrigin(0, 0.5)
      .setDepth(HUD_DEPTH);
    // Marks the energy needed to use the power.
    this.add
      .rectangle(METER_X + METER_W * (this.field.power.cost / this.field.energy.max), METER_Y, 2, 18, 0xffd166)
      .setDepth(HUD_DEPTH);
    this.energyText = this.add
      .text(GAME.WIDTH - 30, METER_Y, "0", { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.add
      .text(GAME.WIDTH / 2, METER_Y + 22, `SPACE or F: ${def.NAME}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8892b0",
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    this.updateEnergyHud();
  }

  private updateEnergyHud(): void {
    const e = this.field.energy;
    const power = this.field.power;
    this.energyFill.setSize(METER_W * e.fraction, 8);
    this.energyText.setText(String(Math.floor(e.value)));

    // Lit while running (time) or armed (shield); dim when it can't be used.
    const on = power.running || power.shieldArmed;
    const usable = power.canTrigger(e);
    for (const { bg, text } of this.powerButtons) {
      bg.setFillStyle(on ? power.def.COLOR : BUTTON_FILL, on ? 0.45 : 1).setAlpha(on || usable ? 1 : 0.35);
      text.setAlpha(on || usable ? 1 : 0.35);
    }
    const def = power.def;
    if (power.running && def.EFFECT === "time") {
      this.slowTint.setVisible(true).setFillStyle(def.COLOR, def.FACTOR === 0 ? 0.22 : 0.1);
    } else {
      this.slowTint.setVisible(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Input: on-screen keypad + physical keyboard
  // ---------------------------------------------------------------------------
  private buildKeypad(): void {
    const labels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"];
    const cols = 3;
    const cellW = 120;
    const cellH = 42;
    const startX = GAME.WIDTH / 2 - cellW;
    const startY = PLAYER.Y + 70;

    labels.forEach((label, i) => {
      const cx = startX + (i % cols) * cellW;
      const cy = startY + Math.floor(i / cols) * cellH;

      const btn = this.add
        .rectangle(cx, cy, cellW - 8, cellH - 6, 0x1b2340)
        .setStrokeStyle(2, 0x4ea1ff)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(cx, cy, label, { fontFamily: "monospace", fontSize: "22px", color: "#ffffff" })
        .setOrigin(0.5);
      this.keypadParts.push(btn, text);

      btn.on("pointerdown", () => {
        btn.setFillStyle(0x33406e);
        this.handleInput(label, "keypad");
      });
      btn.on("pointerup", () => btn.setFillStyle(0x1b2340));
      btn.on("pointerout", () => btn.setFillStyle(0x1b2340));
    });
  }

  /**
   * The handwriting pad covers the keypad's area (never the field, so the
   * finger doesn't hide the aliens). The mode switch shows the other mode.
   */
  private buildDrawPad(): void {
    const top = KEYPAD_TOP;
    const bottom = KEYPAD_BOTTOM;
    this.pad = new DrawPad(this, GAME.WIDTH / 2, (top + bottom) / 2, KEYPAD_AREA.PAD_W, bottom - top, (e) =>
      this.onInk(e),
    );

    const button = (x: number, w: number, label: string, onPress: () => void) => {
      const bg = this.add
        .rectangle(x, ANSWER_Y, w, 26, 0x1b2340)
        .setStrokeStyle(1, 0x4ea1ff)
        .setDepth(5)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(x, ANSWER_Y, label, { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" })
        .setOrigin(0.5)
        .setDepth(5);
      bg.on("pointerdown", onPress);
      return { bg, text };
    };
    const mode = button(GAME.WIDTH - 62, 76, "", () =>
      this.applyInputMode(inputMode() === "draw" ? "keys" : "draw"),
    );
    this.modeLabel = mode.text;
    const clear = button(62, 44, "C", () => this.handleInput("C", "pad"));
    this.padClear = [clear.bg, clear.text];
  }

  private applyInputMode(mode: InputMode): void {
    setInputMode(mode);
    const draw = mode === "draw";
    for (const o of this.keypadParts) {
      (o as Phaser.GameObjects.Rectangle).setVisible(!draw);
      if (o.input) o.input.enabled = !draw;
    }
    for (const o of this.padClear) {
      (o as Phaser.GameObjects.Rectangle).setVisible(draw);
      if (o.input) o.input.enabled = draw;
    }
    this.pad.setVisible(draw);
    this.modeLabel.setText(draw ? "KEYPAD" : "✎ DRAW");
  }

  /**
   * The pad read some ink. Digits go through handleInput like keys, so answer
   * feedback works unchanged; their stars start on the ink. A drawn answer that
   * no longer fits after the typed digits starts a fresh answer instead (a
   * redraw costs more than a key press).
   */
  private onInk(e: InkEvent): void {
    if (this.gameOver || this.paused) return;
    if (e.type === "scratch") {
      this.runExtras.ink.scratch++;
      this.handleInput("C", "pad");
      return;
    }
    if (e.type === "unknown") {
      this.runExtras.ink.unknown++;
      this.sound.play("blip", { volume: 0.4, rate: 0.5 });
      return;
    }
    const typed = this.field.typed;
    const fresh = typed.length + e.digits.length > ANSWER_MAX_DIGITS;
    const text = (fresh ? "" : typed) + e.digits;
    const inks = e.inks.map((g) => g.flat());
    this.world.answerInk(text, [...text].map((_, i) => inks[i - (text.length - inks.length)] ?? null));
    if (fresh) this.field.apply({ type: "clear" });
    this.runExtras.ink.reads++;
    this.handleInput(e.digits, "pad");
  }

  private bindKeyboard(): void {
    onKeyDown(this, (e) => {
      if (e.key === "p" || e.key === "P") {
        this.togglePause();
        return;
      }
      if (e.key === " " || e.key === "f" || e.key === "F") {
        e.preventDefault();
        this.triggerPower();
        return;
      }
      if (e.key >= "0" && e.key <= "9") this.handleInput(e.key, "keyboard");
      else if (e.key === "Backspace") this.handleInput("<", "keyboard");
      else if (e.key === "Escape") this.handleInput("C", "keyboard");
      else if (e.key === "Enter" && this.gameOver) this.proceedAfterGameOver();
    });
  }

  /** A key: a digit (or several, from the drawing pad), C or <. */
  private handleInput(key: string, source: InputSource): void {
    if (this.gameOver) {
      this.proceedAfterGameOver();
      return;
    }
    if (this.paused) return;
    this.runExtras.sources[source]++;
    this.sound.play("blip", { volume: 0.3 });
    const input: FieldInput =
      key === "C" ? { type: "clear" } : key === "<" ? { type: "back" } : { type: "digits", digits: key };
    this.field.apply(input);
    this.refreshAnswer();
  }


  // ---------------------------------------------------------------------------
  // Answer feedback: the display, the lock-on brackets, the flying number
  // ---------------------------------------------------------------------------


  /** Recompute the answer and react when its text or state changes. */
  private refreshAnswer(): void {
    const view = this.field.answerView();
    const prev = this.answer;
    this.answer = view;
    if (view?.text === prev?.text && view?.state === prev?.state) return;

    const state = view?.state ?? "typing";
    this.tweens.killTweensOf(this.typedText);
    this.typedText
      .setText(view?.text ?? "_")
      .setColor(FEEDBACK.COLOR[state])
      .setScale(1)
      .setX(GAME.WIDTH / 2);

    const typed = this.field.typed;
    if (state === "match" && typed !== "") {
      this.sound.play("blip", { volume: 0.35, rate: 1.5 });
      this.typedText.setScale(FEEDBACK.MATCH_POP_SCALE);
      this.tweens.add({
        targets: this.typedText,
        scale: 1,
        duration: FEEDBACK.MATCH_POP_MS,
        ease: "Back.easeOut",
      });
      const alien = this.field.alienFor(parseInt(typed, 10));
      if (alien) this.flyAnswer(typed, alien);
    } else if (state === "wrong") {
      this.sound.play("blip", { volume: 0.4, rate: 0.5 });
      this.tweens.add({
        targets: this.typedText,
        x: GAME.WIDTH / 2 + FEEDBACK.WRONG_SHAKE_PX,
        duration: 45,
        yoyo: true,
        repeat: 2,
        ease: "Sine.easeInOut",
      });
    }
  }

  /** A matched number flies from the display up to its alien. */
  private flyAnswer(text: string, alien: Alien): void {
    const fly = this.add
      .text(this.typedText.x, this.typedText.y, text, {
        fontFamily: "monospace",
        fontSize: "32px",
        fontStyle: "bold",
        color: FEEDBACK.COLOR.match,
        stroke: "#05060f",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.tweens.add({
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

  /** Corner brackets around the target's box; they snap in when it is acquired. */
  private drawReticle(delta: number): void {
    const a = this.field.target?.active ? this.field.target : null;
    if (a !== this.reticleTarget) {
      this.reticleTarget = a;
      this.reticleAge = 0;
    }
    this.reticle.clear();
    if (!a) return;
    this.reticleAge += delta;
    const R = FEEDBACK.RETICLE;
    const ax = a.viewX(this.stepAlpha);
    const ay = a.viewY(this.stepAlpha);
    const t = Math.min(1, this.reticleAge / R.SNAP_MS);
    const grow = 1 + (R.SNAP_FROM - 1) * (1 - t) * (1 - t);
    const top = ay - a.top - R.PAD;
    const bottom = ay + a.bottom + R.PAD;
    const cy = (top + bottom) / 2;
    const hw = (a.halfW + R.PAD) * grow;
    const hh = ((bottom - top) / 2) * grow;
    this.reticle.lineStyle(R.WIDTH, R.COLOR, 0.4 + 0.6 * t);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = ax + sx * hw;
        const y = cy + sy * hh;
        this.reticle.beginPath();
        this.reticle.moveTo(x - sx * R.ARM, y);
        this.reticle.lineTo(x, y);
        this.reticle.lineTo(x, y - sy * R.ARM);
        this.reticle.strokePath();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------------------
  private endGame(): void {
    this.gameOver = true;
    this.reticle.clear();
    this.pad.setEnabled(false);
    if (import.meta.env.DEV) {
      // Calibrate the bots against your own play: compare with `npm run bots`.
      const who = this.autopilot ? `bot ${this.autopilot.level}` : "you";
      console.info(
        `[metic] ${who}: survived ${Math.round(this.field.elapsedMs / 1000)} s, ` +
          `score ${this.field.score}, ${this.field.kills} kills. Solve times by ball count:`,
      );
      console.table(summarizeSolves(this.field.solves));
    }

    // Merge this run into the persistent mastery stats.
    const num = (k: string) => Number(localStorage.getItem(k) ?? 0);
    const f = this.field;
    const priorHigh = num(STORAGE.HIGHSCORE);
    this.newHighScore = f.score > 0 && f.score >= priorHigh;
    const best = Math.max(f.score, priorHigh);
    const bestCombo = Math.max(f.bestCombo, num(STORAGE.BEST_COMBO));
    const totalKills = num(STORAGE.TOTAL_KILLS) + f.kills;
    const priorFastest = num(STORAGE.FASTEST_MS); // 0 = none recorded yet
    const fastest =
      f.fastestSolveMs === Infinity
        ? priorFastest
        : priorFastest === 0
          ? f.fastestSolveMs
          : Math.min(priorFastest, f.fastestSolveMs);

    localStorage.setItem(STORAGE.HIGHSCORE, String(best));
    localStorage.setItem(STORAGE.BEST_COMBO, String(bestCombo));
    localStorage.setItem(STORAGE.TOTAL_KILLS, String(totalKills));
    localStorage.setItem(STORAGE.FASTEST_MS, String(fastest));

    const rank = RANKS.reduce((acc, r) => (best >= r.min ? r.name : acc), RANKS[0].name);
    const fastestStr = fastest > 0 ? `${(fastest / 1000).toFixed(2)}s` : "—";

    this.add
      .rectangle(GAME.WIDTH / 2, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x05060f, 0.8)
      .setDepth(10);
    this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT / 2 - 110, "GAME OVER", {
        fontFamily: "monospace",
        fontSize: "40px",
        color: "#ef476f",
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT / 2 - 60, `Rank: ${rank}`, {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffd166",
      })
      .setOrigin(0.5)
      .setDepth(11);
    // This run's pace, to compare with the bots (`npm run bots`).
    const secs = Math.floor(f.elapsedMs / 1000);
    const survived = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    const medians = summarizeSolves(f.solves)
      .map((s) => `${s.balls} balls ${s.median.toFixed(1)}s`)
      .join(" · ");
    this.add
      .text(
        GAME.WIDTH / 2,
        GAME.HEIGHT / 2 + 24,
        `Score: ${f.score}    Best: ${best}\n` +
          `Best combo: ${bestCombo}    Kills: ${totalKills}\n` +
          `Survived ${survived}    Fastest solve: ${fastestStr}\n` +
          `Median solve: ${medians || "—"}\n` +
          `Energy earned ${Math.round(f.energy.earned)} · ` +
          `${Math.round(f.energy.spent[f.power.kind])} on ${f.power.def.NAME}`,
        { fontFamily: "monospace", fontSize: "16px", color: "#ffffff", align: "center", lineSpacing: 8 },
      )
      .setOrigin(0.5)
      .setDepth(11);
    const continueText = isLeaderboardEnabled()
      ? "tap / Enter to enter initials"
      : "tap / Enter to play again";
    this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT / 2 + 118, continueText, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#4ea1ff",
      })
      .setOrigin(0.5)
      .setDepth(11);

    // Playtest build (a claude.ai Artifact): save the run for analysis.
    this.runExtras.inputMode = inputMode();
    void logRun(this.field, this.runExtras).then((status) => {
      if (status === "off" || !this.scene.isActive()) return;
      this.add
        .text(
          GAME.WIDTH / 2,
          GAME.HEIGHT / 2 + 146,
          status === "saved" ? "run saved for analysis ✓" : "couldn't save this run",
          { fontFamily: "monospace", fontSize: "13px", color: status === "saved" ? "#5ef0ff" : "#ef476f" },
        )
        .setOrigin(0.5)
        .setDepth(11);
    });

    this.input.once("pointerdown", () => this.proceedAfterGameOver());
  }

  /** Single, idempotent exit from game-over: leaderboard flow or plain restart. */
  private proceedAfterGameOver(): void {
    if (this.proceeding) return;
    this.proceeding = true;
    if (isLeaderboardEnabled()) {
      this.scene.start("NameEntryScene", {
        score: this.field.score,
        personalBest: this.newHighScore,
      });
    } else {
      this.scene.start("MenuScene");
    }
  }
}
