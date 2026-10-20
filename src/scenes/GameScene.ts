import Phaser from "phaser";
import { DOODLE, LEADERBOARD, LEVEL_CLEAR, LEVELS, MATCH, RECOVERY, STORY, TARGET_STRATEGIES, type TargetStrategy } from "../config/constants";
import { inputMode } from "../config/inputMode";
import type { InkEvent } from "../handwriting/inkReader";
import type Alien from "../objects/Alien";
import { ABILITY_KINDS, Boss, type AbilityKind } from "../objects/abilities";
import { isLeaderboardEnabled, stageBoard, startMatch } from "../services/leaderboard";
import { rankFor, recordRun } from "../services/masteryStats";
import { hitRecord, initPlaytestLog, logRun, type InputSource, type RunExtras } from "../services/playtestLog";
import { clearSavedRun, loadStoryProgress, recordLevel, recordStoryRun, saveRun as saveStoryRun } from "../services/storyProgress";
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
import { LevelClearCard } from "../ui/hud/LevelClearCard";
import { playLevelClearJingle, stopMenuTheme } from "./extraMusic";
import { LevelMusic } from "./levelMusic";
import { PauseOverlay } from "../ui/hud/PauseOverlay";
import { Popups } from "../ui/hud/Popups";
import { Reticle } from "../ui/hud/Reticle";
import { SendButton } from "../ui/hud/SendButton";
import { TopHud } from "../ui/hud/TopHud";
import { onKeyDown } from "../ui/keyboard";
import { createFieldView, type FieldView } from "./fieldView";
import type { BoardScore } from "./NameEntryScene";
import { setUpRun, type StoryRun } from "./runSetup";
import { ShipLaunch } from "./shipLaunch";

/**
 * The game screen. It is the *composition root* (docs/ARCHITECTURE.md §2.9):
 * it builds the run (a Field, or a battle Match) and the screen's parts,
 * connects them, and runs the frame loop. It holds no rules and draws
 * nothing itself:
 *
 * - the rules live in `Field` (sim/, no Phaser) and change only through
 *   `field.apply(input)` and `field.step()`;
 * - the HUD is made of components in ui/hud/, each owning its own objects;
 * - the playfield is drawn from a snapshot each frame by a FieldView: in 3D
 *   in pencil by DoodleWorld, or in 3D by World3D (`?art=3d`).
 *
 * Each frame: run the rules in fixed steps (SimClock), turn what happened
 * (field events) into sound and pops, let the HUD read the field, draw the field.
 */
export default class GameScene extends Phaser.Scene {
  // --- The run (rebuilt in create(): Phaser reuses the scene object) ---
  private field!: Field;
  /** Battle mode: the match; the player plays `match.fields[0]`. */
  private match: Match | null = null;
  /** Dev (`?bot=ace`): a bot plays this field through the same inputs. */
  private autopilot: Bot | null = null;
  /** Story mode: the run so far (this scene plays its current level). */
  private story: StoryRun | null = null;
  /** Story mode: the level's music. */
  private music: LevelMusic | null = null;
  private clock!: SimClock;
  /** What the playtest log records beyond the field (services/playtestLog.ts). */
  private runExtras!: RunExtras;
  private paused = false;
  private gameOver = false;
  /** Guards the single way out of the game-over screen. */
  private leaving = false;
  /** Scene time before which a tap can't leave (the level-clear card). */
  private leaveAllowedAt = 0;
  /** Whether this run set a new personal best (name entry says so). */
  private newHighScore = false;
  /** Story clear: the ship flying off, the minions popped, the results. */
  private launch: ShipLaunch | null = null;
  private readonly popped = new Set<Alien>();
  private clearCard: LevelClearCard | null = null;

  // --- The screen ---
  private world!: FieldView;
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

  create(data?: { battle?: boolean; story?: StoryRun }): void {
    this.story = data?.story ?? null;
    const run = setUpRun({ battle: data?.battle ?? false, story: this.story });
    this.field = run.field;
    this.match = run.match;
    this.autopilot = run.autopilot;
    this.clock = new SimClock();
    this.paused = false;
    this.gameOver = false;
    this.leaving = false;
    this.leaveAllowedAt = 0;
    this.newHighScore = false;
    this.launch = null;
    this.popped.clear();
    this.clearCard = null;
    this.runExtras = {
      lives: this.field.lives,
      forcedAbilities: run.forcedAbilities,
      battle: this.match
        ? { players: MATCH.OPPONENTS.length + 1, opponents: [...MATCH.OPPONENTS], placement: null }
        : null,
      story: this.story
        ? { level: this.story.level, startScore: this.story.score, startEnergy: this.story.energy ?? 0 }
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
    // A story run opens one per stage it plays, plus one for the whole run.
    // Battles don't go on a leaderboard yet.
    if (this.story) {
      if (this.story.level === 0) void startMatch(LEADERBOARD.STORY_RUN_BOARD);
      void startMatch(stageBoard(this.story.level));
    } else if (!this.match) {
      void startMatch();
    }
    initPlaytestLog();
    stopMenuTheme(this);
    this.music = this.story ? new LevelMusic(this, this.story.level) : null;
    // Story: a run left in the middle continues from the start of this level.
    if (this.story) saveStoryRun(this.story);
    if (this.story) {
      const level = LEVELS[this.story.level];
      this.popups.banner(`LEVEL ${this.story.level + 1} · ${level.NAME}`, 22, STORY.BANNER_MS);
    }
  }

  /** Build every part of the screen, back to front. */
  private buildScreen(): void {
    // The playfield renders on its own canvas under Phaser's.
    this.world = createFieldView(this);

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
    this.energyHud = new EnergyHud(this, this.ducker, this.field, { battle: this.match !== null, onPower: () => this.usePower() });
    this.popups = new Popups(this, this.ducker);
    this.pauseOverlay = new PauseOverlay(
      this,
      () => this.togglePause(),
      this.story ? () => this.scene.start("StoryMapScene") : null,
    );

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
    // Pause and game over freeze the rules, but the field view keeps rendering
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
    // Story: the bar shows how far along the level's path; Endless: difficulty.
    this.topHud.setDifficulty(f.levelProgress ?? f.difficulty.d);
    this.answer.refresh(f);
    const target = f.target?.active && !this.world.drawsTarget ? f.target : null;
    this.reticle.update(target, this.clock.alpha, delta);
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

  /** Draw the field `alpha` of the way between the last two steps. */
  private renderWorld(time: number, delta: number): void {
    const f = this.field;
    const alpha = this.clock.alpha;
    const hidden = this.paused || this.gameOver;
    this.world.render(
      {
        shipX: f.prevShipX + (f.shipX - f.prevShipX) * alpha,
        shipTargetX: f.target?.active ? f.target.viewX(alpha) : null,
        aliens: this.popped.size ? f.aliens.filter((a) => !this.popped.has(a)) : f.aliens,
        bullets: this.launch ? [] : f.bullets,
        alpha,
        aliensHidden: this.paused,
        shipShield: f.power.shieldArmed,
        shipHurt: Math.min(1, f.freezeLeftMs / RECOVERY.FREEZE_MS),
        shipDown: f.knockedOut,
        shipLaunch: this.launch?.pose ?? null,
        answer: hidden ? null : this.answer.view,
        target: !hidden && f.target?.active ? f.target : null,
        page: this.pageView(),
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
        if (e.alien.ability instanceof Boss) {
          // Only the boss itself: its parts (raindrops, halves) are bosses
          // too, but they come in quietly.
          if (e.alien !== this.field.boss) break;
          this.music?.boss();
          this.popups.banner(`BOSS · ${e.alien.ability.def.NAME}!`, 26, STORY.BANNER_MS);
          this.shake(300, 0.008);
        } else if (e.alien.species && this.story) {
          const species = LEVELS[this.story.level].SPECIES[e.alien.kind];
          if (species) this.popups.introduce(species.NAME, species.INTRO);
        } else if (e.alien.ability && (ABILITY_KINDS as string[]).includes(e.alien.ability.kind)) {
          this.popups.introduceAbility(e.alien.ability.kind as AbilityKind);
        }
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
        this.popups.energyGain(e.energy);
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
        // Let the ship's destruction play before GAME OVER covers the field.
        this.time.delayedCall(RECOVERY.GAME_OVER_DELAY_MS, () => this.endGame());
        break;
      case "levelCleared":
        this.clearLevel();
        break;
    }
  }

  private explode(alien: Alien): void {
    this.sound.play("explode", { volume: 0.5 });
    this.world.explode(alien.x, alien.y, alien);
  }

  /** Shake the HUD camera and the field view together. */
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
    this.music?.pause(this.paused);
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
    this.music?.stop();
    this.reticle.clear();
    this.inputPanel.setEnabled(false);
    if (import.meta.env.DEV) this.logPaceToConsole();

    const f = this.field;
    const { mastery, newHighScore } = recordRun(f);
    this.newHighScore = newHighScore;
    if (this.story) {
      clearSavedRun(); // arcade rules: a game over sends the next run to island 1
      recordLevel(this.story.level, f.score - f.startScore, false);
      this.newHighScore = recordStoryRun(f.score);
    }
    const placement = this.match ? this.match.placements[0] : null;
    if (this.runExtras.battle) this.runExtras.battle.placement = placement;

    const screen = new GameOverScreen(this, {
      field: f,
      mastery,
      rank: rankFor(mastery.highScore),
      battle: this.match && placement !== null ? { placement, players: this.match.seats.length } : null,
      continueHint: this.match
        ? "tap / Enter for the menu"
        : this.story && !isLeaderboardEnabled()
          ? "tap / Enter for the map"
          : isLeaderboardEnabled()
          ? "tap / Enter to enter initials"
          : "tap / Enter to play again",
    });

    this.saveRun((saved) => screen.showSaveStatus(saved));

    this.input.once("pointerdown", () => this.leaveGameOver());
  }

  /** Playtest build (a claude.ai Artifact): save the run (or the story level
   * attempt) for analysis; `onStatus` hears whether it was saved. */
  private saveRun(onStatus: (saved: boolean) => void): void {
    this.runExtras.inputMode = inputMode();
    void logRun(this.field, this.runExtras).then((status) => {
      if (status !== "off" && this.scene.isActive()) onStatus(status === "saved");
    });
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

  /**
   * Story: the boss is beaten and the field has stopped. In order: the
   * minions left pop, the ship squashes and blasts off the top while the
   * victory jingle plays, then the results card counts the score up; a tap
   * after that goes on (leaveGameOver).
   */
  private clearLevel(): void {
    if (this.gameOver || !this.story) return;
    this.gameOver = true;
    this.music?.stop();
    this.reticle.clear();
    this.answer.setVisible(false); // a half-typed answer for a minion that's about to pop
    this.inputPanel.setEnabled(false);
    this.sound.play("explode", { volume: 0.6, rate: 0.6 });
    const f = this.field;
    const stage = this.story.level;
    const levelScore = f.score - f.startScore;
    const hasNext = stage + 1 < LEVELS.length;
    const priorBest = loadStoryProgress().best[stage] ?? 0;
    recordLevel(stage, levelScore, true);
    // The last level built: the run ends here (the next stage isn't built yet).
    if (!hasNext) this.newHighScore = recordStoryRun(f.score);
    if (hasNext) saveStoryRun(this.nextRun());
    else clearSavedRun();
    this.saveRun(() => {});

    this.popLeftovers();
    this.launch = new ShipLaunch(this);
    // No way out until the results are up (the card's first tap skips its count).
    this.leaveAllowedAt = Infinity;
    this.time.delayedCall(LEVEL_CLEAR.LAUNCH_AT_MS, () => {
      playLevelClearJingle(this);
      this.launch!.start(() =>
        this.time.delayedCall(LEVEL_CLEAR.CARD_DELAY_MS, () => {
          this.clearCard = new LevelClearCard(this, {
            number: stage + 1,
            name: LEVELS[stage].NAME,
            levelScore,
            totalScore: f.score,
            livesLeft: f.lives,
            kills: f.kills,
            bestCombo: f.bestCombo,
            levelMs: f.elapsedMs,
            newBest: priorBest > 0 && levelScore > priorBest,
            hasNext,
          });
          this.leaveAllowedAt = this.time.now;
        }),
      );
    });
    this.input.on("pointerdown", () => this.leaveGameOver());
  }

  /** Story clear: the minions still on the field pop one by one (a look:
   * the rules have ended, so they only leave the picture). */
  private popLeftovers(): void {
    const left = this.field.aliens.filter((a) => a.active);
    left.forEach((alien, i) =>
      this.time.delayedCall(LEVEL_CLEAR.POP_START_MS + i * LEVEL_CLEAR.POP_STAGGER_MS, () => {
        this.popped.add(alien);
        this.world.explode(alien.x, alien.y, alien);
        this.sound.play("blip", { volume: 0.35, rate: 1.5 + i * 0.15 });
      }),
    );
  }

  /** Story: the run as it goes into the next level (after a clear). */
  private nextRun(): StoryRun {
    const f = this.field;
    const story = this.story!;
    return {
      level: story.level + 1,
      lives: f.lives,
      score: f.score,
      levelScores: [...story.levelScores, f.score - f.startScore],
      energy: f.carriedEnergy(),
    };
  }

  /** Story: the level's page and how far it has scrolled, for the field view. */
  private pageView(): { id: string; scrolledPx: number; lengthPx: number } | null {
    if (!this.story) return null;
    const level = LEVELS[this.story.level];
    const pxPerMs = DOODLE.PAGE_SCROLL_PX_PER_S / 1000;
    return {
      id: level.PAGE,
      scrolledPx: (this.field.levelProgress ?? 0) * level.PATH_MS * pxPerMs,
      lengthPx: level.PATH_MS * pxPerMs,
    };
  }

  /**
   * The single way out of game over (and of a cleared level): the next
   * level, name entry (leaderboard on), the story map or the menu.
   */
  private leaveGameOver(): void {
    if (this.leaving || this.time.now < this.leaveAllowedAt) return;
    if (this.clearCard?.finishCount()) return; // the first tap shows the whole score
    this.leaving = true;
    if (this.story) {
      const f = this.field;
      const next = this.story.level + 1;
      const levelScores = [...this.story.levelScores, f.score - f.startScore];
      if (f.cleared && next < LEVELS.length) {
        // Back to the map: the ship flies to the next island, then a tap starts it.
        this.scene.start("StoryMapScene", { travelTo: next });
      } else if (isLeaderboardEnabled()) {
        this.scene.start("NameEntryScene", {
          score: f.score,
          personalBest: this.newHighScore,
          headline: f.cleared ? "STORY COMPLETE!" : "GAME OVER",
          boards: storyBoards(f.score, levelScores),
          title: "STORY RUNS",
          back: "StoryMapScene",
        });
      } else {
        this.scene.start("StoryMapScene");
      }
    } else if (isLeaderboardEnabled() && !this.match) {
      this.scene.start("NameEntryScene", { score: this.field.score, personalBest: this.newHighScore });
    } else {
      this.scene.start("MenuScene");
    }
  }
}

/** A finished story run's scores, by board: the run's total first (shown
 * after name entry), then each stage played (stages without points skipped). */
function storyBoards(total: number, levelScores: number[]): BoardScore[] {
  const stages = levelScores.map((score, i) => ({ board: stageBoard(i), score, label: `stage ${i + 1}` }));
  return [{ board: LEADERBOARD.STORY_RUN_BOARD, score: total, label: "run" }, ...stages.filter((s) => s.score > 0)];
}
