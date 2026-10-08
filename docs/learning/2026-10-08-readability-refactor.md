# 2026-10-08 — Readability refactor

**Goal (owner):** make the code readable and self-explaining, set the
engineering practices for the project, and explain every change so the
patterns can be learned.

**Short answer to "should this be a skill or something I just expect?":**
both, at different levels.
- The **rules** are in files every agent reads: `AGENTS.md` (loaded by
  Claude, Copilot and others) points to `docs/ENGINEERING.md` (how to
  write and verify code) and `docs/ARCHITECTURE.md` (the patterns used).
- The **procedure** for explaining a change is a Claude skill,
  `.claude/skills/explain-change/SKILL.md`. Claude Code loads it on its own
  at the end of any code change in this repo, and you can call it yourself
  with `/explain-change` to ask "why is this file built like this?".

## First, what was *not* done: a rewrite

Before changing anything I read the whole codebase. The architecture was
already sound: the rules (`sim/`) don't know about Phaser, inputs are data,
runs are deterministic and replayable, and the renderer only reads a
snapshot. Those are the hard parts to get right, and they were right.

The readability problems were in a few places:

| Problem | Where | Size |
| --- | --- | --- |
| One class doing ten jobs | `scenes/GameScene.ts` | 1287 lines |
| One file with every number of every domain | `config/constants.ts` | 982 lines |
| Calls that can't be read without the definition | `Swarm.makeAlien(...11 args)` | 9 call sites |
| The same colors and text styles copied everywhere | scenes, ui | ~100 copies |

**Alternatives considered:**
- *Rewrite the whole code.* Rejected: it throws away code that works and is
  tested, it would take the battle-royale work off its tracks for weeks,
  and a diff of 12,000 changed lines can't be learned from (or reviewed).
- *Only write the practices down and apply them to new code.* Rejected: the
  file you read the most (`GameScene`) would still be the hardest one.
- **Chosen:** a *refactor* (change the structure, keep the behavior) of the
  four hotspots, in small commits, each proved safe by a test.

---

### 1. Engineering practices, the patterns guide, the explain-change skill
**What changed:** new `docs/ENGINEERING.md`, `docs/ARCHITECTURE.md`,
`.claude/skills/explain-change/SKILL.md`, and a working agreement at the top
of `AGENTS.md` that points to them.
**Pattern:** "Docs as code": the rules live in the repo, next to the code,
reviewed and versioned with it.
**Why this way:** the rules have to reach every session and every tool. A
chat message is forgotten; a file in the repo is read every time.
**Alternatives considered:**
- Everything in `AGENTS.md`: it is already ~600 lines of game design and
  decisions, so the practices would get lost. It now links to them instead.
- Only a skill: only Claude Code reads skills; Copilot and people don't.
**How to change it later:** edit `docs/ENGINEERING.md`; if a rule changes
how changes are explained, also edit the skill.
**Verified by:** the skill shows up in this session's skill list.

### 2. A golden-master test before touching anything
**What changed:** `src/sim/golden.test.ts` plays 8 solo bot runs (each power,
rookie and ace) and one 8-bot battle with fixed seeds, and compares a
summary (score, kills, events, placements…) with a saved snapshot.
**Pattern:** *Golden master* (also called characterization or snapshot
testing): record what the system does today, then check that a refactor
didn't change it. It works here because the sim is deterministic (same seed
+ inputs = same run, ARCHITECTURE.md §2.3).
**Why this way:** a refactor promises "nothing changed". Without a test that
promise is a guess. This test runs in ~1 s and covers spawning, movement,
abilities, powers, scoring, bots, SEND, targeting and KOs at once.
**Alternatives considered:**
- Write unit tests for each function first: much more work, and tests
  written *after* reading the code tend to test what you think it does, not
  what it does.
- Compare `npm run bots` output by hand: slow, and easy to miss a change.
**How to change it later:** if you change a rule on purpose, run
`npx vitest run -u` to accept the new snapshot, and say in the commit why
the numbers moved.
**Verified by:** it stayed green through every following commit.

### 3. Named colors and one text style helper
**What changed:** `config/palette.ts` names the UI colors by meaning
(`PALETTE.GOLD` = good/yours, `PALETTE.ATTACK` = attacks sent…).
`ui/theme.ts` has `textStyle(size, color, extra)` and `outline()`. All
scenes and UI files use them.
**Pattern:** *Design tokens* (named values for colors/sizes, used everywhere
instead of raw values) and DRY ("don't repeat yourself").
**Why this way:** `"#ffd166"` appeared 32 times. To understand it you had to
know it means "gold = good"; to change it you had to find all 32. Now
`textStyle(16, PALETTE.GOLD)` says it in one line instead of five.
**Alternatives considered:**
- Put the colors in `ui/theme.ts`: but the tuning files in `config/` use
  colors too, and `config/` must not import from `ui/` (layers,
  ENGINEERING.md §2). So the palette is in `config/`, the Phaser-specific
  text helper in `ui/`.
- A CSS-like theme object per scene: more structure than this game needs.
**How to change it later:** change a color's value in `palette.ts`; add a
new meaning as a new name, not a new hex in a scene.
**Verified by:** tsc, tests, build; screenshots in Chromium. One deliberate,
invisible difference: hints in `#8892b0` now use the muted `#8893b5` they
were clearly meant to match.

### 4. GameScene split into HUD components
**What changed:** GameScene went from 1287 to ~470 lines. Each part of the
screen is its own class in `src/ui/hud/`: `TopHud`, `Popups`,
`AnswerDisplay`, `Reticle`, `EnergyHud`, `SendButton`, `InputPanel`,
`PauseOverlay`, `GameOverScreen`, `Ducker` (fading the HUD under aliens),
with shared positions in `layout.ts`. Three more things moved out:
`scenes/runSetup.ts` (seed + dev URL params → field or match),
`sim/SimClock.ts` (fixed timestep) and `services/masteryStats.ts`
(personal bests).
**Pattern:** *Composition root + components* (ARCHITECTURE.md §2.9): one
place builds and connects the parts; each part owns its own objects and
gets only what it needs (the field to read, plus callbacks such as `onPower`
for what it may trigger). Also *functional core, imperative shell* (§2.14)
for `masteryStats` and `SimClock`.
**Why this way:** to change the energy meter you used to scroll through
pause, keypad, game-over and battle code in one file. Now you open
`EnergyHud.ts` (107 lines) and everything about the meter is there and
nothing else is. `GameScene` reads top to bottom as the story of a frame:
step the rules → show events → update HUD → draw.
**Alternatives considered:**
- Split GameScene into several Phaser *scenes* running in parallel (a HUD
  scene over a game scene): a known Phaser idiom, but scenes talk through
  events and the registry, which is harder to follow than plain method
  calls, and scene order bugs are hard to debug.
- Give every component the whole GameScene (`new EnergyHud(this)`): fewer
  constructor arguments, but then any component can change anything and
  you can't tell what it depends on from its constructor.
- One big `HudContext` object passed to all components: considered; each
  component needs different things, so explicit constructor arguments say
  more.
**How to change it later:** a new HUD element = a new class in `ui/hud/`,
created in `GameScene.buildScreen`, updated in `GameScene.updateHud`. What
a field event does on screen = `GameScene.showFieldEvent`.
**Verified by:** tsc, all tests (+ new tests for `SimClock` and
`masteryStats`), build, golden master unchanged, and a Chromium run: solo
play, typing a correct answer (it scored), pause, game over screen, battle
screen, the T key changing the aim strategy, with no console errors.
Not checked: touch input on a real phone, the drawing pad by hand.

### 5. Swarm builds aliens from a named spec
**What changed:** `makeAlien(rng, kind, sum, x, y, diff, undefined, null,
undefined, laneX)` became `makeAlien(rng, { kind: "swooper", sum, x, y,
pace, laneX })` (an `AlienSpec`); `enterFromTop` takes the same spec.
**Pattern:** *Options object / named parameters* (ARCHITECTURE.md §2.11).
**Why this way:** with positional arguments the reader has to count commas
to know which `undefined` is which, and adding a field means editing every
call. `Alien` already used this pattern (`AlienConfig`); now Swarm matches.
**Alternatives considered:**
- A *builder* (`new AlienBuilder().kind("darter").at(x, y).build()`): more
  code for the same readability in TypeScript, which has object literals.
- Several smaller functions (`makeSwooper`, `makeDrifter`…): they would
  repeat the shared part (speed, model, ability), which is the part most
  likely to change.
**How to change it later:** a new per-alien setting = a field in
`AlienSpec` and one line in `makeAlien`.
**Verified by:** golden master green (the random draws happen in the same
order, so every run is identical).

### 6. constants.ts split by domain
**What changed:** the 982-line file became ten files in
`src/config/tuning/` (game, monsters, difficulty, scoring, powers, answer,
battle, bots, storage, render3d). `config/constants.ts` re-exports them.
**Pattern:** *Barrel module* (ARCHITECTURE.md §2.15).
**Why this way:** to tune monsters you now open `monsters.ts` (209 lines),
not a 982-line file. No code that uses a constant had to change.
**Alternatives considered:**
- Change every import to the domain file: precise, but ~40 files touched
  for no behavior change, and conflicts with the battle-royale branch.
- Leave it as one file with better section headers: still one file to
  scroll for every tuning question.
**How to change it later:** add a constant to its domain file. A new domain
= a new file + one `export *` line in `constants.ts`.
**Verified by:** tsc, tests, build, golden master.

---

## Left for later (not done on purpose)

- `render3d/World3D.ts` (729 lines), `sim/Field.ts` (705) and
  `ui/OpponentBoard.ts` (559) are long but each has one job, and they are
  where the battle-royale work is happening. Split them when they next
  change (e.g. World3D's ship, aliens and debris into helpers).
- `config/ships.ts`, `powers.ts` and `inputMode.ts` repeat the same
  "remember a choice in memory + localStorage" code three times: a small
  `storedChoice()` helper would remove it.
- A formatter and linter (Prettier + ESLint): see ENGINEERING.md §8.
