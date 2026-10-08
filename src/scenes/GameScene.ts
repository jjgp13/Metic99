import Phaser from "phaser";
import { MATCH, TARGET_STRATEGIES, type TargetStrategy } from "../config/constants";
import { inputMode } from "../config/inputMode";
import { selectedShip } from "../config/ships";
import type { InkEvent } from "../handwriting/inkReader";
import type Alien from "../objects/Alien";
import World3D, { getWorld3D } from "../render3d/World3D";
import { isLeaderboardEnabled, startMatch } from "../services/leaderboard";
import { rankFor, recordRun } from "../services/masteryStats";
import { hitRecord, initPlaytestLog, logRun, type InputSource, type RunExtras } from "../services/playtestLog";
import type { Bot } from "../sim/Bot";
import { ANSWER_MAX_DIGITS, type Field, type FieldEvent, type FieldInput } from "../sim/Field";
import type { Match, MatchEvent } from "../sim/Match";
import { SimClock } from "../sim/SimClock";
import type { PowerUse } from "../sim/energy";
import { summarizeSolves } from "../sim/stats";
import { createBattleViews, type BattleView } from "../ui/battleViews";
import { AnswerDisplay } from "../ui/hud/AnswerDisplay";
import { Ducker } from "../ui/hud/Ducker";
import { EnergyHud } from "../ui/hud/EnergyHud";
import { GameOverScreen } from "../ui/hud/GameOverScreen";
import { InputPanel, type PadKey } from "../ui/hud/InputPanel";
import { PauseOverlay } from "../ui/hud/PauseOverlay";
import { Popups } from "../ui/hud/Popups";
import { Reticle } from "../ui/hud/Reticle";
import { SendButton } from "../ui/hud/SendButton";
import { TopHud } from "../ui/hud/TopHud";
import { onKeyDown } from "../ui/keyboard";
import { setUpRun } from "./runSetup";

/**
 * The game screen. It is the *composition root* (docs/ARCHITECTURE.md §2.9):
 * it builds the run (a Field, or a battle Match) and the screen's parts,
 * connects them, and runs the frame loop. It holds no rules and draws
 * nothing itself:
 *
 * - the rules live in `Field` (sim/, no Phaser) and change only through
 *   `field.apply(input)` and `field.step()`;
 * - the HUD is made of components in ui/hud/, each owning its own objects;
 * - the playfield is drawn in 3D by World3D from a snapshot each frame.
 *
 * Each frame: run the rules in fixed steps (SimClock), turn what happened
 * (field events) into sound and pops, let the HUD read the field, draw 3D.
 */
export default class GameScene extends Phaser.Scene {
  // --- The run (rebuilt in create(): Phaser reuses the scene object) ---
  private field!: Field;
  /** Battle mode: the match; the player plays `match.fields[0]`. */
  private match: Match | null = null;
  /** Dev (`?bot=ace`): a bot plays this field through the same inputs. */
  private autopilot: Bot | null = null;
  private clock!: SimClock;
  /** What the playtest log records beyond the field (services/playtestLog.ts). */
  private runExtras!: RunExtras;
  private paused = false;
  private gameOver = false;
  /** Guards the single way out of the game-over screen. */
  private leaving = false;
  /** Whether this run set a new personal best (name entry says so). */
  private newHighScore = false;

  // --- The screen ---
  private world!: World3D;
  private topHud!: TopHud;
  private popups!: Popups;
  private ducker!: Ducker;
  private answer!: AnswerDisplay;
  private reticle!: Reticle;
  private energyHud!: EnergyHud;
  private sendButton: SendButton | null = null;
  private inputPanel!: InputPanel;
  private pauseOverlay!: PauseOverlay;
  /** Battle: views of the other players, and the match events they haven't seen. */
  private battleViews: BattleView[] = [];
  private unseenMatchEvents: MatchEvent[] = [];

  constructor() {
    super("GameScene");
  }

  create(data?: { battle?: boolean }): void {
    const run = setUpRun(data?.battle ?? false);
    this.field = run.field;
    this.match = run.match;
    this.autopilot = run.autopilot;
    this.clock = new SimClock();
    this.paused = false;
    this.gameOver = false;
    this.leaving = false;
    this.newHighScore = false;
    this.runExtras = {
      lives: this.field.lives,
      forcedAbilities: run.forcedAbilities,
      battle: this.match
        ? { players: MATCH.OPPONENTS.length + 1, opponents: [...MATCH.OPPONENTS], placement: null }
        : null,
      inputMode: inputMode(),
      sources: { keypad: 0, keyboard: 0, pad: 0 },
      ink: { reads: 0, unknown: 0, scratch: 0 },
      pauses: 0,
      hits: [],
    };

    this.buildScreen();
    onKeyDown(this, (e) => this.onKeyboard(e));

    // Open a server-gated match so this run's score can be submitted later.
    // Fire-and-forget: if it fails the player just gets an unsaved score.
    // Battles don't go on the (solo) leaderboard.
    if (!this.match) void startMatch();
    initPlaytestLog();
  }

  /** Build every part of the screen, back to front. */
  private buildScreen(): void {
    // The 3D playfield renders on its own canvas under Phaser's.
    this.world = getWorld3D();
    this.world.begin(this.textures, this.game.canvas, selectedShip().model);

    this.ducker = new Ducker(this);
    this.topHud = new TopHud(this, this.ducker, {
      lives: this.field.lives,
      autopilotLevel: this.autopilot?.level ?? null,
      onPause: () => this.togglePause(),
    });
    this.answer = new AnswerDisplay(this);
    this.reticle = new Reticle(this);
    this.inputPanel = new InputPanel(this, {
      onKey: (key, source) => this.onAnswerKey(key, source),
      onInk: (e) => this.onInk(e),
    });
    this.sendButton = this.match ? new SendButton(this, this.field, (cost) => this.sendAttack(cost)) : null;
    this.energyHud = new EnergyHud(this, this.field, { battle: this.match !== null, onPower: () => this.usePower() });
    this.popups = new Popups(this, this.ducker);
    this.pauseOverlay = new PauseOverlay(this, () => this.togglePause());

    this.unseenMatchEvents = [];
    this.battleViews = this.match
      ? createBattleViews(this, this.match, { aimAt: (seat) => this.aimAt(seat), aimBy: (s) => this.aimBy(s) })
      : [];

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.world.end();
      for (const view of this.battleViews) view.destroy();
    });
  }

  update(time: number, delta: number): void {
    // Pause and game over freeze the rules, but the 3D view keeps rendering
    // (stars drift, the last explosion finishes, pause hides the aliens).
    if (!this.paused && !this.gameOver) {
      this.clock.advance(delta, () => this.step());
      this.updateHud(delta);
      this.inputPanel.update(delta);
    }
    this.updateBattleViews(delta);
    this.renderWorld(time, delta);
  }

  /** One fixed rule step, then show what happened in it. False once the run ended. */
  private step(): boolean {
    this.autopilot?.update(this.field, this.clock.stepMs);
    if (this.match) this.match.step(this.clock.stepMs);
    else this.field.step(this.clock.stepMs);

    for (const e of this.field.takeEvents()) this.showFieldEvent(e);
    for (const e of this.match?.takeEvents() ?? []) {
      this.unseenMatchEvents.push(e);
      if (e.type === "over" && e.winner === 0) this.endGame();
    }
    return !this.gameOver;
  }

  /** Once per frame: the HUD reads the field (it never changes it). */
  private updateHud(delta: number): void {
    const f = this.field;
    this.topHud.setDifficulty(f.difficulty.d);
    this.answer.refresh(f);
    this.reticle.update(f.target?.active ? f.target : null, this.clock.alpha, delta);
    this.ducker.update(f.aliens, this.clock.alpha, delta);
    this.energyHud.update(f);
    this.sendButton?.update();
  }

  private updateBattleViews(delta: number): void {
    if (!this.match || !this.battleViews.length) return;
    const frame = {
      tiles: this.match.tiles(),
      events: this.unseenMatchEvents,
      you: 0,
      delta,
      paused: this.paused,
      gameOver: this.gameOver,
    };
    this.unseenMatchEvents = [];
    for (const view of this.battleViews) view.update(frame);
  }

  /** Draw the 3D field `alpha` of the way between the last two steps. */
  private renderWorld(time: number, delta: number): void {
    const f = this.field;
    const alpha = this.clock.alpha;
    const hidden = this.paused || this.gameOver;
    this.world.render(
      {
        shipX: f.prevShipX + (f.shipX - f.prevShipX) * alpha,
        shipTargetX: f.target?.active ? f.target.viewX(alpha) : null,
        aliens: f.aliens,
        bullets: f.bullets,
        alpha,
        aliensHidden: this.paused,
        shipShield: f.power.shieldArmed,
        answer: hidden ? null : this.answer.view,
      },
      time,
      delta,
    );
  }

  // ---------------------------------------------------------------------------
  // What happened in the field → sound, pops and HUD
  // ---------------------------------------------------------------------------

  private showFieldEvent(e: FieldEvent): void {
    switch (e.type) {
      case "spawned":
        if (e.alien.ability) this.popups.introduceAbility(e.alien.ability.kind);
        break;
      case "fired":
        this.sound.play("shoot", { volume: 0.4 });
        break;
      case "solved":
        // A shield breaking (absorbed) only cracks; a kill explodes.
        if (e.absorbed) this.sound.play("explode", { volume: 0.3, rate: 1.6 });
        else this.explode(e.alien);
        this.topHud.setCombo(this.field.combo);
        this.topHud.setScore(this.field.score);
        this.popups.points(e.points, e.alien.x, e.alien.y);
        this.popups.energyGain(e.energy, this.field.energy.fraction);
        this.popups.equation(e.digits, e.alien);
        this.world.answerSolved(String(e.digits.reduce((sum, d) => sum + d, 0)));
        if (e.burst > 0) this.popups.energyBurst(e.burst, e.alien.x, e.alien.y);
        if (e.cancelled >= 0.5) this.popups.cancelledIncoming(e.cancelled);
        break;
      case "sent":
        this.sound.play("shoot", { volume: 0.5, rate: 0.5 });
        break;
      case "incoming":
        this.sound.play("hurt", { volume: 0.25, rate: 1.6 });
        break;
      case "power":
        this.playPowerSound(e.use);
        break;
      case "blasted":
        for (const alien of e.aliens) this.explode(alien);
        this.cameras.main.flash(180, 255, 159, 90);
        this.shake(200, 0.012);
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
        this.topHud.setCombo(this.field.combo);
        this.topHud.loseLife(e.livesLeft);
        this.shake(150, 0.01);
        break;
      case "knockedOut":
        this.endGame();
        break;
    }
  }

  private explode(alien: Alien): void {
    this.sound.play("explode", { volume: 0.5 });
    this.world.explode(alien.x, alien.y, alien);
  }

  /** Shake the HUD camera and the 3D view together. */
  private shake(durationMs: number, intensity: number): void {
    this.cameras.main.shake(durationMs, intensity);
    this.world.shake(durationMs, intensity);
  }

  /** BLAST and SHIELD also get their own field events. */
  private playPowerSound(use: PowerUse): void {
    if (use === "blast") {
      this.sound.play("explode", { volume: 0.6, rate: 0.5 });
      return;
    }
    const freezeOn = this.field.power.kind === "freeze";
    const rate = use === "off" ? 1.2 : use === "armed" ? 0.9 : freezeOn ? 0.4 : 0.6;
    this.sound.play("blip", { volume: 0.5, rate });
  }

  // ---------------------------------------------------------------------------
  // The player's input → field inputs
  // ---------------------------------------------------------------------------

  private onKeyboard(e: KeyboardEvent): void {
    const key = e.key;
    if (key === "p" || key === "P") return this.togglePause();
    // Space = SEND in a battle; otherwise Space and F both press POWER.
    if (key === " " && this.sendButton) {
      e.preventDefault();
      return this.sendButton.send();
    }
    if (key === " " || key === "f" || key === "F") {
      e.preventDefault();
      return this.usePower();
    }
    if ((key === "t" || key === "T") && this.match) return this.cycleAim();
    if (key >= "0" && key <= "9") this.onAnswerKey(key, "keyboard");
    else if (key === "Backspace") this.onAnswerKey("<", "keyboard");
    else if (key === "Escape") this.onAnswerKey("C", "keyboard");
    else if (key === "Enter" && this.gameOver) this.leaveGameOver();
  }

  /** A digit (or several, from the drawing pad), C or <. After game over,
   * any key moves on. */
  private onAnswerKey(key: PadKey, source: InputSource): void {
    if (this.gameOver) return this.leaveGameOver();
    if (this.paused) return;
    this.runExtras.sources[source]++;
    this.sound.play("blip", { volume: 0.3 });
    const input: FieldInput =
      key === "C" ? { type: "clear" } : key === "<" ? { type: "back" } : { type: "digits", digits: key };
    this.field.apply(input);
    this.answer.refresh(this.field);
  }

  /**
   * The pad read some ink. Digits go through onAnswerKey like keys, so the
   * answer feedback works unchanged; their stars start on the ink. A drawn
   * answer that no longer fits after the typed digits starts a fresh answer
   * (a redraw costs more than a key press).
   */
  private onInk(e: InkEvent): void {
    if (this.gameOver || this.paused) return;
    if (e.type === "scratch") {
      this.runExtras.ink.scratch++;
      return this.onAnswerKey("C", "pad");
    }
    if (e.type === "unknown") {
      this.runExtras.ink.unknown++;
      this.sound.play("blip", { volume: 0.4, rate: 0.5 });
      return;
    }
    const typed = this.field.typed;
    const fresh = typed.length + e.digits.length > ANSWER_MAX_DIGITS;
    const text = (fresh ? "" : typed) + e.digits;
    // One ink per drawn digit, lined up with the last digits of `text`.
    const inks = e.inks.map((strokes) => strokes.flat());
    this.world.answerInk(text, [...text].map((_, i) => inks[i - (text.length - inks.length)] ?? null));
    if (fresh) this.field.apply({ type: "clear" });
    this.runExtras.ink.reads++;
    this.onAnswerKey(e.digits, "pad");
  }

  private usePower(): void {
    if (this.gameOver || this.paused) return;
    this.field.apply({ type: "power" });
    this.energyHud.update(this.field);
  }

  private sendAttack(cost: number): void {
    if (this.gameOver || this.paused) return;
    this.field.apply({ type: "send", cost });
    this.energyHud.update(this.field);
    this.sendButton?.update();
  }

  /** Battle: aim at one opponent by hand (a tile was tapped). */
  private aimAt(seat: number): void {
    if (!this.match || this.gameOver || this.paused || seat === 0) return;
    this.field.apply({ type: "target", aim: { seat } });
    this.sound.play("blip", { volume: 0.4, rate: 1.3 });
  }

  /** Battle: aim by a targeting strategy (the aim chip, or T). */
  private aimBy(strategy: TargetStrategy): void {
    if (!this.match || this.gameOver || this.paused) return;
    this.field.apply({ type: "target", aim: strategy });
    this.sound.play("blip", { volume: 0.4, rate: 1.3 });
  }

  /** The next targeting strategy (random → KOs → attackers → badges). */
  private cycleAim(): void {
    const aim = this.field.aim;
    const i = typeof aim === "string" ? TARGET_STRATEGIES.indexOf(aim) : -1;
    this.aimBy(TARGET_STRATEGIES[(i + 1) % TARGET_STRATEGIES.length]);
  }

  // ---------------------------------------------------------------------------
  // Pause and game over
  // ---------------------------------------------------------------------------

  /** Freeze the field and hide the aliens, so sums can't be solved on a break. */
  private togglePause(): void {
    if (this.gameOver) return;
    this.paused = !this.paused;
    this.reticle.setVisible(!this.paused);
    this.answer.setVisible(!this.paused);
    this.inputPanel.setEnabled(!this.paused);
    if (this.paused) {
      this.runExtras.pauses++;
      this.pauseOverlay.show();
    } else {
      this.pauseOverlay.hide();
    }
  }

  private endGame(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.reticle.clear();
    this.inputPanel.setEnabled(false);
    if (import.meta.env.DEV) this.logPaceToConsole();

    const f = this.field;
    const { mastery, newHighScore } = recordRun(f);
    this.newHighScore = newHighScore;
    const placement = this.match ? this.match.placements[0] : null;
    if (this.runExtras.battle) this.runExtras.battle.placement = placement;

    const screen = new GameOverScreen(this, {
      field: f,
      mastery,
      rank: rankFor(mastery.highScore),
      battle: this.match && placement !== null ? { placement, players: this.match.seats.length } : null,
      continueHint: this.match
        ? "tap / Enter for the menu"
        : isLeaderboardEnabled()
          ? "tap / Enter to enter initials"
          : "tap / Enter to play again",
    });

    // Playtest build (a claude.ai Artifact): save the run for analysis.
    this.runExtras.inputMode = inputMode();
    void logRun(f, this.runExtras).then((status) => {
      if (status !== "off" && this.scene.isActive()) screen.showSaveStatus(status === "saved");
    });

    this.input.once("pointerdown", () => this.leaveGameOver());
  }

  /** Dev: compare your pace (or the autopilot's) with `npm run bots`. */
  private logPaceToConsole(): void {
    const f = this.field;
    const who = this.autopilot ? `bot ${this.autopilot.level}` : "you";
    console.info(
      `[metic] ${who}: survived ${Math.round(f.elapsedMs / 1000)} s, ` +
        `score ${f.score}, ${f.kills} kills. Solve times by ball count:`,
    );
    console.table(summarizeSolves(f.solves));
  }

  /** The single way out of game over: name entry (solo, leaderboard on) or the menu. */
  private leaveGameOver(): void {
    if (this.leaving) return;
    this.leaving = true;
    if (isLeaderboardEnabled() && !this.match) {
      this.scene.start("NameEntryScene", { score: this.field.score, personalBest: this.newHighScore });
    } else {
      this.scene.start("MenuScene");
    }
  }
}
