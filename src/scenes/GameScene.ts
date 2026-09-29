import Phaser from "phaser";
import {
  ABILITY,
  BOT,
  FEEDBACK,
  GAME,
  KEYPAD_AREA,
  MATCH,
  PLAYER,
  POWER_NUDGE,
  RANKS,
  SCORE,
  SEND,
  SIM,
  STORAGE,
  TARGET_STRATEGIES,
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
import { Match, type MatchEvent } from "../sim/Match";
import { isDangerous } from "../sim/danger";
import { createBattleViews, type BattleView } from "../ui/battleViews";
import { BattleResults, WatchBar } from "../ui/BattleResults";
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
// Battle: attacks (the SEND button, incoming aliens on the meter). Not red:
// red is reserved for subtraction balls.
const ATTACK_COLOR = 0xff8c42;
const ATTACK_CSS = "#ff8c42";
// Incoming attacks waiting to land (pink: warning, but not a ball color).
const INCOMING_COLOR = 0xff5c8a;
const INCOMING_CSS = "#ff5c8a";
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
  /** Battle mode: the match; the player plays `match.fields[0]`. Null in solo. */
  private match: Match | null = null;
  private battleText: Phaser.GameObjects.Text | null = null;
  /** Battle: views of the other players (ui/battleViews.ts), and the match
   * events they haven't seen yet. */
  private battleViews: BattleView[] = [];
  private viewEvents: MatchEvent[] = [];
  /** Battle, after the player is out: the results panel (the match keeps
   * running live), fast-forwarding to the end, or watching another player. */
  private after: "results" | "ff" | "watch" | null = null;
  private results: BattleResults | null = null;
  private watchBar: WatchBar | null = null;
  private watchSeat: number | null = null;
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
  // Battle: the SEND button (the left gutter), its hold-to-step-down state,
  // and the incoming attacks drawn over the right end of the meter.
  private sendButton: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } | null = null;
  private sendHeldSince: number | null = null;
  /** Battle: the POWER button is pulsing (a dangerous moment), and since when
   * (game clock) the current nudge has gone unanswered. */
  private nudging = false;
  private nudgeAtMs: number | null = null;
  private incomingGfx!: Phaser.GameObjects.Graphics;
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

  create(data?: { battle?: boolean }): void {
    this.resetState(data?.battle ?? false);

    // The 3D playfield (starfield, ship, aliens, bullets, explosions) renders on
    // its own canvas under Phaser's; stop drawing it when we leave this scene.
    this.world = getWorld3D();
    this.world.begin(this.textures, this.game.canvas, selectedShip().model);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.world.end();
      for (const view of this.battleViews) view.destroy();
    });

    this.buildHud();
    this.buildKeypad();
    this.buildDrawPad();
    this.applyInputMode(inputMode());
    this.buildEnergyHud();
    this.bindKeyboard();
    if (this.match) {
      this.battleViews = createBattleViews(this, this.match, {
        aimAt: (seat) => this.aimAt(seat),
      });
    }

    // Open a server-gated match so this run's score can be submitted later.
    // Fire-and-forget: if it fails the player just gets an unsaved score.
    // Battles don't go on the (solo) leaderboard.
    if (!this.match) void startMatch();
    initPlaytestLog();
  }

  private resetState(battle: boolean): void {
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
    // Battle: you (seat 0) and the bots share the seed, one life each.
    if (battle) {
      this.match = new Match({ seed, seats: ["human", ...MATCH.OPPONENTS], humanPower: selectedPower() });
      this.field = this.match.fields[0];
      forcedAbilities = null;
    } else {
      this.match = null;
      this.field = new Field({ seed, forcedAbilities, power: selectedPower() });
    }
    this.battleText = null;
    this.battleViews = [];
    this.viewEvents = [];
    this.after = null;
    this.results = null;
    this.watchBar = null;
    this.watchSeat = null;
    this.sendButton = null;
    this.sendHeldSince = null;
    this.nudging = false;
    this.nudgeAtMs = null;
    this.powerButtons = [];
    this.runExtras = {
      lives: this.field.lives,
      forcedAbilities,
      battle: battle ? { players: MATCH.OPPONENTS.length + 1, opponents: [...MATCH.OPPONENTS], placement: null } : null,
      nudges: { shown: 0, answered: 0, atKo: false },
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
    } else if (this.after) {
      this.runRestOfMatch(delta);
    }

    if (this.match && this.battleViews.length) {
      const frame = {
        tiles: this.match.tiles(),
        events: this.viewEvents,
        you: 0,
        delta,
        paused: this.paused,
        gameOver: this.gameOver,
      };
      this.viewEvents = [];
      for (const view of this.battleViews) view.update(frame);
    }

    // Draw between the last two sim steps (interpolation) so motion is smooth
    // even when a frame runs zero or two steps.
    const alpha = this.stepAlpha;
    // Watching another player after a KO: draw their field instead.
    const watched = this.after === "watch" && this.watchSeat !== null ? this.match?.fields[this.watchSeat] : undefined;
    const f = watched ?? this.field;
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
    if (this.match) this.match.step(dt);
    else this.field.step(dt);
    for (const e of this.field.takeEvents()) this.show(e);
    for (const e of this.match?.takeEvents() ?? []) {
      this.showMatch(e);
      this.viewEvents.push(e);
    }
  }

  /** Battle: other players' KOs, attacks, the end of the match. */
  private showMatch(e: MatchEvent): void {
    const name = (seat: number) => (seat === 0 ? "YOU" : `P${seat + 1}`);
    switch (e.type) {
      case "ko":
        this.updateBattleText();
        if (e.seat !== 0) this.flashBattle(`${name(e.seat)} OUT`, "#8893b5");
        break;
      case "attack":
        if (e.from === 0) this.flashBattle(`SENT ${e.cost} → ${name(e.to)}`, ATTACK_CSS);
        else if (e.to === 0) this.flashBattle(`INCOMING ${Math.round(e.weight)} FROM ${name(e.from)}`, INCOMING_CSS);
        break;
      case "over":
        if (e.winner === 0) this.endGame();
        break;
    }
  }

  /**
   * Battle status (a stand-in until the battle UI): players left, your target
   * and strategy, badges and how many aim at you. Tap it or press T to cycle
   * the strategy.
   */
  private updateBattleText(): void {
    const m = this.match;
    if (!m || !this.battleText) return;
    const aim = this.field.aim;
    const target = m.targets[0];
    const badges = Match.badgeLevel(m.badgePoints[0]);
    const aimedAt = m.targetedBy(0);
    this.battleText.setText(
      `${m.alive.length}/${m.seats.length} LEFT\n` +
        `→ ${target === null ? "-" : `P${target + 1}`} ${typeof aim === "string" ? aim.toUpperCase() : "PICKED"}` +
        (badges ? `  ★${badges}` : "") +
        (aimedAt ? `  ⚠${aimedAt}` : ""),
    );
  }

  /** Aim at one opponent by hand (a view's tile was tapped). */
  private aimAt(seat: number): void {
    if (!this.match || this.gameOver || this.paused || seat === 0) return;
    this.field.apply({ type: "target", aim: { seat } });
    this.sound.play("blip", { volume: 0.4, rate: 1.3 });
    this.updateBattleText();
  }

  /** Next targeting strategy (random → KOs → attackers → badges). */
  private cycleAim(): void {
    if (!this.match || this.gameOver || this.paused) return;
    const aim = this.field.aim;
    const i = typeof aim === "string" ? TARGET_STRATEGIES.indexOf(aim) : -1;
    this.field.apply({ type: "target", aim: TARGET_STRATEGIES[(i + 1) % TARGET_STRATEGIES.length] });
    this.sound.play("blip", { volume: 0.4, rate: 1.3 });
    this.updateBattleText();
  }

  /** A one-line battle message under the top HUD that fades out. */
  private flashBattle(message: string, color: string): void {
    const text = this.duckable(
      this.add
        .text(GAME.WIDTH / 2, 112, message, {
          fontFamily: "monospace",
          fontSize: "14px",
          color,
          stroke: "#05060f",
          strokeThickness: 3,
        })
        .setOrigin(0.5),
    );
    this.tweens.add({
      targets: text,
      y: text.y - 12,
      alpha: 0,
      delay: 700,
      duration: 600,
      onComplete: () => text.destroy(),
    });
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
        if (e.cancelled >= 0.5) this.showCancel(e.cancelled);
        break;
      case "sent":
        this.sound.play("shoot", { volume: 0.5, rate: 0.5 });
        break;
      case "incoming":
        this.sound.play("hurt", { volume: 0.25, rate: 1.6 });
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
    this.updateBattleText();

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

    if (this.match) {
      this.battleText = this.duckable(
        this.add
          .text(GAME.WIDTH - 12, 54, "", {
            fontFamily: "monospace",
            fontSize: "13px",
            color: ATTACK_CSS,
            align: "right",
          })
          .setOrigin(1, 0)
          .setInteractive({ useHandCursor: true }),
      );
      this.battleText.on("pointerdown", () => this.cycleAim());
      this.updateBattleText();
    }

    if (this.autopilot) {
      this.duckable(
        this.add
          .text(GAME.WIDTH - 12, this.match ? 96 : 62, `AUTOPILOT: ${this.autopilot.level.toUpperCase()}`, {
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

  /** Kill energy that cancelled incoming attacks, popped at the meter's end. */
  private showCancel(amount: number): void {
    const pop = this.add
      .text(30, KEYPAD_TOP - 4, `-${Math.round(amount)}`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: INCOMING_CSS,
      })
      .setOrigin(0.5, 1)
      .setDepth(6);
    this.tweens.add({
      targets: pop,
      y: pop.y - 20,
      alpha: 0,
      duration: 800,
      onComplete: () => pop.destroy(),
    });
  }

  /**
   * SEND tiers the attack gauge buys now, strongest first. A tap sends the first;
   * holding the button steps down one tier per HOLD_STEP_MS after HOLD_MS.
   */
  private sendChoice(): number | null {
    const affordable = SEND.TIERS.filter((t) => this.field.attack.canSpend(t.COST))
      .map((t) => t.COST)
      .reverse();
    if (!this.match || !affordable.length) return null;
    if (this.sendHeldSince === null) return affordable[0];
    const held = this.time.now - this.sendHeldSince;
    const steps = held < SEND.HOLD_MS ? 0 : 1 + Math.floor((held - SEND.HOLD_MS) / SEND.HOLD_STEP_MS);
    return affordable[Math.min(steps, affordable.length - 1)];
  }

  private triggerSend(): void {
    const cost = this.sendChoice();
    this.sendHeldSince = null;
    if (this.gameOver || this.paused || cost === null) return;
    this.field.apply({ type: "send", cost });
    this.updateEnergyHud();
  }

  private triggerPower(): void {
    if (this.gameOver || this.paused) return;
    const used = this.field.apply({ type: "power" });
    if (used && this.nudgeAtMs !== null && this.field.elapsedMs - this.nudgeAtMs <= POWER_NUDGE.ANSWER_MS) {
      this.runExtras.nudges.answered++;
      this.nudgeAtMs = null;
    }
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
    // Battle: SEND takes the left gutter (POWER keeps the right). Tap =
    // strongest tier; hold to step down; slide off to cancel.
    if (this.match) {
      const bg = this.add
        .rectangle(30, KEYPAD_TOP + GUTTER_H / 2, 48, GUTTER_H, BUTTON_FILL)
        .setStrokeStyle(2, ATTACK_COLOR)
        .setDepth(HUD_DEPTH)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(30, KEYPAD_TOP + GUTTER_H / 2, "", {
          fontFamily: "monospace",
          fontSize: "18px",
          color: "#ffffff",
          align: "center",
          stroke: "#05060f",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(HUD_DEPTH + 0.2);
      bg.on("pointerdown", () => {
        if (this.sendChoice() !== null) this.sendHeldSince = this.time.now;
      });
      bg.on("pointerup", () => this.sendHeldSince !== null && this.triggerSend());
      bg.on("pointerout", () => (this.sendHeldSince = null));
      this.sendButton = { bg, text };
    } else {
      makeButton(30);
    }
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
    // Battle: the attack gauge and incoming attacks, drawn in the SEND column
    // over its background and under its label.
    this.incomingGfx = this.add.graphics().setDepth(HUD_DEPTH + 0.1);
    this.energyText = this.add
      .text(GAME.WIDTH - 30, METER_Y, "0", { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.add
      .text(GAME.WIDTH / 2, METER_Y + 22, this.match ? `SPACE send  ·  F ${def.NAME}` : `SPACE or F: ${def.NAME}`, {
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
    const nudge = this.updateNudge(on, usable);
    const pulse = nudge ? 0.5 + 0.5 * Math.sin((Math.PI * this.time.now) / POWER_NUDGE.PULSE_MS) : 0;
    for (const { bg, text } of this.powerButtons) {
      text.setScale(1 + 0.12 * pulse);
      if (nudge) {
        bg.setFillStyle(power.def.COLOR, 0.2 + 0.6 * pulse).setStrokeStyle(2 + 4 * pulse, 0xffffff).setAlpha(1);
      } else {
        bg.setFillStyle(on ? power.def.COLOR : BUTTON_FILL, on ? 0.45 : 1)
          .setStrokeStyle(2, power.def.COLOR)
          .setAlpha(on || usable ? 1 : 0.35);
      }
      text.setAlpha(on || usable ? 1 : 0.35);
    }
    this.updateSendHud();
    const def = power.def;
    if (power.running && def.EFFECT === "time") {
      this.slowTint.setVisible(true).setFillStyle(def.COLOR, def.FACTOR === 0 ? 0.22 : 0.1);
    } else {
      this.slowTint.setVisible(false);
    }
  }

  /**
   * Battle: pulse the POWER button in a dangerous moment while the power can
   * be used (the bots' own rule, at the owner's distances: POWER_NUDGE). A
   * soft tick when a moment starts; counted for the playtest log.
   */
  private updateNudge(on: boolean, usable: boolean): boolean {
    const nudge =
      this.match !== null &&
      !this.gameOver &&
      !this.paused &&
      !on &&
      usable &&
      isDangerous(this.field, {
        minOpen: BOT.FREEZE_MIN_OPEN,
        nearPx: POWER_NUDGE.NEAR_PX,
        panicPx: POWER_NUDGE.PANIC_PX,
      });
    if (nudge && !this.nudging) {
      this.sound.play("blip", { volume: 0.25, rate: 2 });
      this.runExtras.nudges.shown++;
      this.nudgeAtMs = this.field.elapsedMs;
    }
    this.nudging = nudge;
    return nudge;
  }

  /** Battle: the SEND button's tier and the incoming segments on the meter. */
  private updateSendHud(): void {
    if (!this.sendButton) return;
    const tier = this.sendChoice();
    const { bg, text } = this.sendButton;
    const held = this.sendHeldSince !== null;
    text.setText(`S\nE\nN\nD\n\n${tier ?? "--"}`).setAlpha(tier === null ? 0.5 : 1);
    bg.setFillStyle(held ? 0x5a3418 : 0x1b2340);

    // One segment per sent alien still to land, soonest at the right; it
    // blinks in its last second.
    // The SEND column is the attack gauge: it fills from the bottom (marks at
    // each tier), and incoming attacks hang from the top, one block per sent
    // alien, soonest at the top, blinking in their last second. A kill pays
    // the blocks off first; only the rest fills the gauge.
    const g = this.incomingGfx.clear();
    const x = 30 - 22;
    const unit = GUTTER_H / this.field.attack.max;
    const fill = GUTTER_H * this.field.attack.fraction;
    g.fillStyle(ATTACK_COLOR, 0.4).fillRect(x, KEYPAD_BOTTOM - fill, 44, fill);
    for (const t of SEND.TIERS) {
      if (t.COST < this.field.attack.max) g.fillStyle(ATTACK_COLOR, 0.8).fillRect(x, KEYPAD_BOTTOM - t.COST * unit, 44, 1);
    }
    let top = KEYPAD_TOP;
    for (const a of this.field.incoming) {
      const h = Math.min(KEYPAD_BOTTOM - top, Math.max(4, a.left * unit));
      const soon = a.landsAtMs - this.field.elapsedMs < 1000;
      const alpha = soon ? 0.55 + 0.45 * Math.sin(this.time.now / 60) : 0.9;
      g.fillStyle(INCOMING_COLOR, alpha).fillRect(x, top, 44, h - 1);
      top += h;
      if (top >= KEYPAD_BOTTOM) break;
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
      if (this.after) {
        this.afterKey(e.key);
        return;
      }
      if (e.key === "p" || e.key === "P") {
        this.togglePause();
        return;
      }
      // Space = SEND in a battle; otherwise Space and F both press POWER.
      if (e.key === " " && this.match) {
        e.preventDefault();
        this.triggerSend();
        return;
      }
      if (e.key === " " || e.key === "f" || e.key === "F") {
        e.preventDefault();
        this.triggerPower();
        return;
      }
      if ((e.key === "t" || e.key === "T") && this.match) {
        this.cycleAim();
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
      if (!this.match) this.proceedAfterGameOver(); // battle: the results panel's buttons
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
    if (this.gameOver) return;
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

    if (this.match) {
      this.runExtras.battle!.placement = this.match.placements[0];
      this.runExtras.nudges.atKo = this.nudging;
      this.saveRun(GAME.HEIGHT - 12);
      this.openResults();
      return;
    }

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
    const continueText = isLeaderboardEnabled() ? "tap / Enter to enter initials" : "tap / Enter to play again";
    this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT / 2 + 118, continueText, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#4ea1ff",
      })
      .setOrigin(0.5)
      .setDepth(11);

    this.saveRun(GAME.HEIGHT / 2 + 146);
    this.input.once("pointerdown", () => this.proceedAfterGameOver());
  }

  /** Playtest build (a claude.ai Artifact): save the run for analysis. */
  private saveRun(y: number): void {
    this.runExtras.inputMode = inputMode();
    void logRun(this.field, this.runExtras).then((status) => {
      if (status === "off" || !this.scene.isActive()) return;
      this.add
        .text(
          GAME.WIDTH / 2,
          y,
          status === "saved" ? "run saved for analysis ✓" : "couldn't save this run",
          { fontFamily: "monospace", fontSize: "13px", color: status === "saved" ? "#5ef0ff" : "#ef476f" },
        )
        .setOrigin(0.5)
        .setDepth(12);
    });
  }

  // ---------------------------------------------------------------------------
  // Battle: after the player is out (M8)
  // ---------------------------------------------------------------------------
  /** Open the results panel; the match keeps running behind it. */
  private openResults(): void {
    const f = this.field;
    const secs = Math.floor(f.elapsedMs / 1000);
    const stats =
      `Survived ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")} · ` +
      `${f.kills} kills · ${f.score.toLocaleString("en-US")} pts\n` +
      `Attack sent ${Math.round(f.attack.spent.send)} · cancelled ${Math.round(f.cancelledTotal)} · ` +
      `${f.power.def.NAME} ${Math.round(f.energy.spent[f.power.kind])}`;
    this.results = new BattleResults(this, this.match!.seats.length, stats, {
      fastForward: () => this.setAfter("ff"),
      watch: () => this.setAfter("watch"),
      again: () => this.scene.restart({ battle: true }),
      menu: () => this.proceedAfterGameOver(),
    });
    this.watchBar = new WatchBar(this, {
      next: (dir) => this.watchNext(dir),
      results: () => this.setAfter("results"),
    });
    this.stepAccMs = 0;
    this.setAfter("results");
  }

  private setAfter(mode: "results" | "ff" | "watch"): void {
    const m = this.match!;
    if (m.over && mode !== "results") return;
    this.after = mode;
    if (mode === "watch") {
      // Start on whoever knocked the player out, if they're still in.
      const by = m.koBy[0];
      this.watchSeat = by !== null && m.placements[by] === 0 ? by : null;
      if (this.watchSeat === null) this.watchNext(1);
      else m.spectate = this.watchSeat;
    } else {
      this.watchSeat = null;
      m.spectate = null;
    }
    this.results?.setVisible(mode !== "watch");
    this.watchBar?.setVisible(mode === "watch");
    this.refreshAfter();
  }

  /** Watch the next (dir 1) or previous player still in the match. */
  private watchNext(dir: 1 | -1): void {
    const m = this.match!;
    const alive = m.alive.filter((s) => s !== 0);
    if (!alive.length) return;
    const from = this.watchSeat ?? 0;
    const n = m.seats.length;
    let seat = from;
    do seat = (seat + dir + n) % n;
    while (!alive.includes(seat));
    this.watchSeat = seat;
    m.spectate = seat;
    this.refreshAfter();
  }

  /**
   * Keep the match going after the player's KO: live (results or watching)
   * or as fast as possible (fast-forward, nothing drawn). When it ends, the
   * results panel shows the winner.
   */
  private runRestOfMatch(delta: number): void {
    const m = this.match!;
    if (!m.over) {
      if (this.after === "ff") {
        for (let i = 0; i < MATCH.FAST_FORWARD_STEPS && !m.over; i++) this.stepRest();
      } else {
        this.stepAccMs = Math.min(this.stepAccMs + delta, SIM.STEP_MS * SIM.MAX_STEPS_PER_FRAME);
        while (this.stepAccMs >= SIM.STEP_MS && !m.over) {
          this.stepRest();
          this.stepAccMs -= SIM.STEP_MS;
        }
      }
      if (m.over) this.setAfter("results");
    }
    this.refreshAfter();
  }

  /** One match step with the player already out. */
  private stepRest(): void {
    const m = this.match!;
    m.step(SIM.STEP_MS);
    // The watched player's kills and hits explode on screen (no pops or HUD).
    if (this.watchSeat !== null) {
      for (const e of m.fields[this.watchSeat].takeEvents()) {
        if ((e.type === "solved" && !e.absorbed) || e.type === "hit") this.world.explode(e.alien.x, e.alien.y, e.alien);
        else if (e.type === "blasted") for (const a of e.aliens) this.world.explode(a.x, a.y, a);
      }
    }
    for (const e of m.takeEvents()) {
      this.viewEvents.push(e);
      if (e.type === "ko" && e.seat === this.watchSeat && !m.over) this.watchNext(1);
    }
  }

  private refreshAfter(): void {
    const m = this.match;
    if (!m || !this.results) return;
    const tiles = m.tiles();
    if (this.results.visible) {
      this.results.update({ tiles, you: 0, over: m.over, fastForwarding: this.after === "ff" && !m.over });
    }
    if (this.watchBar?.visible && this.watchSeat !== null) this.watchBar.update(tiles, this.watchSeat, 0);
  }

  /** Keys after a battle KO: F fast-forward, W watch, ←/→ switch, R again,
   * Enter back to results (while watching) or the menu. */
  private afterKey(key: string): void {
    const k = key.toLowerCase();
    if (k === "f") this.setAfter("ff");
    else if (k === "w") this.setAfter("watch");
    else if (k === "arrowleft" && this.after === "watch") this.watchNext(-1);
    else if (k === "arrowright" && this.after === "watch") this.watchNext(1);
    else if (k === "r" && this.match?.over) this.scene.restart({ battle: true });
    else if (k === "enter") {
      if (this.after === "watch") this.setAfter("results");
      else this.proceedAfterGameOver();
    }
  }

  /** Single, idempotent exit from game-over: leaderboard flow or plain restart. */
  private proceedAfterGameOver(): void {
    if (this.proceeding) return;
    this.proceeding = true;
    if (isLeaderboardEnabled() && !this.match) {
      this.scene.start("NameEntryScene", {
        score: this.field.score,
        personalBest: this.newHighScore,
      });
    } else {
      this.scene.start("MenuScene");
    }
  }
}
