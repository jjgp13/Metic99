# Architecture — a guided tour of Metic99's patterns

This is a learning guide. It explains **how the code is organized** and
**which design patterns it uses**, where to find each one, what it buys us,
and what we chose it over. Read it with the code open.

Practices (naming, testing, how a change is made) are in
[`ENGINEERING.md`](ENGINEERING.md). Game rules are in `AGENTS.md`.

---

## 1. The big picture

```
            ┌────────────── browser ───────────────┐
 keyboard ─►│ GameScene  (composition root)        │
 keypad   ─►│   │ FieldInput        ▲ FieldEvent   │
 pad      ─►│   ▼                   │              │
            │  Field ──► Swarm ──► Alien, abilities│  sim/ objects/
            │   (rules, pure TypeScript)           │  no Phaser, no DOM
            │   │ state each frame                 │
            │   ▼                                  │
            │  World3D (Three.js)   ui/hud/* (Phaser)│ views
            └──────────────────────────────────────┘
   the same Field also runs in: npm run bots, tests, (later) a server
```

The single most important idea: **the rules (`sim/`) don't know they are
being drawn.** Everything else follows from it.

### One frame, step by step

1. Phaser calls `GameScene.update(time, delta)`.
2. Real time is banked; the rules run in whole **fixed steps** of 1/60 s
   (`SimClock`). Each step: the bot (if any) decides, `field.step()` moves
   everything, and the scene drains `field.takeEvents()` to play sounds and
   pops.
3. Input from keys/keypad/pad arrives between frames and becomes
   `field.apply({ type: "digits", digits: "12" })`.
4. The HUD components read the field and redraw (`GameScene.updateHud`).
5. `World3D.render(snapshot)` draws the playfield, interpolating between
   the last two steps.

---

## 2. Pattern catalog

Each entry: **what** it is in plain words, **where** it lives, **why** it
fits here, and **what we didn't do**.

### 2.1 Model–View separation (the sim is the model)

- **What:** game state and rules in one place (the *model*), drawing in
  another (the *views*). Views read the model; they never change it
  directly.
- **Where:** model = `sim/Field.ts`, `sim/Swarm.ts`, `objects/Alien.ts`.
  Views = `render3d/World3D.ts`, `ui/hud/*`, `ui/OpponentBoard.ts`.
- **Why:** the same rules run headless for bots, tests and a future server,
  and you can redesign the screen without touching the rules.
- **Instead of:** Phaser game objects holding the rules (Phaser's tutorials
  do this). That was the original design; it made bots and replays
  impossible and was moved out in M2.

### 2.2 Command pattern (inputs are data)

- **What:** every player action is a small object (`FieldInput`):
  `{ type: "digits", digits }`, `{ type: "power" }`, `{ type: "send", cost }`…
  The field has one entry point, `field.apply(input)`.
- **Where:** `sim/Field.ts` (`FieldInput`, `apply`).
- **Why:** keypad, keyboard, drawing pad, bots and (later) the network all
  produce the same commands, so the field has one door to guard. Commands
  can be **logged** and **replayed** (next pattern).
- **Instead of:** many methods (`field.typeDigit()`, `field.pressPower()`…).
  Easier to write at first, but nothing to log and five doors to keep
  consistent.

### 2.3 Deterministic simulation + replay (event sourcing, light)

- **What:** the same seed + the same inputs at the same steps = the same
  run, always. Each input is stored with its step number (`inputLog`), so a
  run is fully described by `seed + inputLog`.
- **Where:** `sim/rng.ts` (seeded `Rng`), `sim/Field.ts` (`inputLog`,
  `replayField`), fixed timestep in `scenes/GameScene.ts`.
- **Why:** replays of the owner's playtests, bots that can be compared
  fairly, golden-master tests, and a server that can re-run a player's
  field to check it.
- **The three rules that make it work:** no `Math.random()` in rules (use
  `Rng`), no wall clock in rules (use `elapsedMs`), and a fixed step size
  (frame rate never changes the outcome).
- **Instead of:** saving snapshots of the state (big, and you can't see
  *why* something happened).

### 2.4 Fixed timestep with interpolation

- **What:** rules advance in steps of exactly `SIM.STEP_MS`; the renderer
  draws between the previous and current step positions by `alpha`
  (`alien.viewX(alpha)`).
- **Where:** `GameScene.update` + `SimClock`, `Alien.savePrev/viewX`.
- **Why:** a 60 Hz laptop and a 120 Hz phone play identically, and motion
  still looks smooth.
- **Instead of:** `x += speed * delta` with the frame's delta. Simple, but
  runs differ by device, which breaks replays and fairness online.

### 2.5 Event queue (the sim reports, the scene reacts)

- **What:** during a step the field collects what happened (`solved`,
  `hit`, `fired`…) in a list; afterwards the scene calls `takeEvents()` and
  turns each into sound and animation.
- **Where:** `Field.takeEvents`, `Swarm.takeEvents`, `Match.takeEvents`;
  consumed in `GameScene.showFieldEvent`.
- **Why:** the sim stays free of Phaser, and it's obvious *when* effects
  happen (after a step, in order).
- **Instead of:** callbacks/listeners passed into the sim (`onHit: () =>
  sound.play()`): the sim would call view code in the middle of its own
  update, which is hard to follow and to run headless.

### 2.6 Strategy pattern, data-driven (powers, targeting, bot skill)

- **What:** behavior picked from a table instead of `if (name === ...)`.
  A power is a row in `POWERS` with an `EFFECT` (`time` / `blast` /
  `shield`); code switches on the *effect*, not the power's name.
- **Where:** `config/tuning/powers.ts` + `sim/energy.ts` (`Power`),
  `Bot.usePower`, targeting strategies in `sim/Match.ts` (`pickTarget`),
  bot levels in `BOT.LEVELS`.
- **Why:** a new power that reuses an effect is one table row; bots
  already know how to play it.
- **Instead of:** a class per power. More files for the same result while
  powers are mostly numbers.

### 2.7 Hooks (template method) for monster abilities

- **What:** a base class with empty methods (`update`, `onHit`,
  `onKilled`); each ability overrides only the ones it needs.
- **Where:** `objects/abilities.ts` (`Ability`, `Blinker`, `Shielded`,
  `Splitter`).
- **Why:** the field calls the same three hooks for every alien; adding an
  ability never touches the field's code.
- **Instead of:** `if (alien.kind === "shielded")` scattered through
  `Field` and `Swarm`.

### 2.8 Dependency inversion through small interfaces

- **What:** a piece of code asks for an *interface* describing exactly what
  it needs, not for the concrete class.
- **Where:**
  - `AbilityHost` (abilities may only `rerollSum` and `spawnSplitling`;
    `Swarm` implements it);
  - `BattleView` / `BattleActions` (`ui/battleViews.ts`): battle views get
    tiles + events and may only `aimAt` / `aimBy`;
  - HUD components (`ui/hud/`) get only what they need in their
    constructor: the field to read, plus named callbacks for what they may
    trigger (`onPower`, `onSend`, `onKey`, `onPause`).
- **Why:** each part can be read and tested alone, and the interface is a
  list of exactly what can happen across the boundary.
- **Instead of:** passing the whole `GameScene` or `Field` around ("just
  give it everything"): convenient, but then anything may change anything.

### 2.9 Composition root + components (the scene wires, components draw)

- **What:** `GameScene` creates the field and the HUD components, connects
  them, and runs the loop. Each component owns its Phaser objects and has
  `update()` and (if needed) `destroy()`.
- **Where:** `scenes/GameScene.ts`, `ui/hud/*.ts`.
- **Why:** each screen part (energy meter, answer display, pause overlay,
  game-over screen) is one short file you can read alone.
- **Instead of:** one scene class drawing everything (what `GameScene` was
  before the 2026-10-08 refactor: ~1300 lines, ten jobs).

### 2.10 Reconciliation (diffing a snapshot)

- **What:** each frame, `World3D.render(snapshot)` compares the aliens in
  the snapshot with the meshes it has: create the new, move the existing,
  remove the missing. (React does the same with the DOM.)
- **Where:** `World3D.syncAliens`, `syncBullets`.
- **Why:** game code never says "create a mesh" or "delete a mesh"; it
  just has state, and the view follows.
- **Instead of:** the sim calling `world.addAlien()` / `removeAlien()` and
  hoping every add has its remove.

### 2.11 Options object (named parameters)

- **What:** functions with many inputs take one object:
  `new Alien({ kind, x, y, result, ... })`, `makeAlien(rng, { kind, sum, x,
  y, ... })`.
- **Why:** call sites read like sentences, optional fields can be left
  out, and adding a field doesn't break every caller.
- **Instead of:** long positional lists (`f(a, b, undefined, null, x)`).

### 2.12 Single shared instance (page-wide singleton)

- **What:** one `World3D` for the whole page, made on first use by
  `getWorld3D()`.
- **Why:** phones allow only a few WebGL contexts; making one per run would
  leak them.
- **Caution:** singletons hide dependencies, so it is used only here, and
  the scene still receives it once in `create()` and passes it on.

### 2.13 Write-on-change caching (DOM)

- **What:** `OpponentBoard` remembers the last value written to each DOM
  node and skips writes that wouldn't change anything (`set(view, key,
  value, write)`).
- **Why:** writing to the DOM every frame for 7 tiles is slow on laptops;
  most values change a few times per second.

### 2.14 Functional core, imperative shell

- **What:** split a job into a *pure* function that only computes (same
  input → same output, touches nothing) and a thin outer part that does the
  input/output (storage, network, screen).
- **Where:** `services/masteryStats.ts`: `mergeRun()` and `rankFor()` are
  pure and unit-tested; `recordRun()` only reads `localStorage`, calls
  `mergeRun`, and writes back. `sim/SimClock.ts` is the same idea for time.
- **Why:** the logic that can be wrong is tested without a browser, and the
  part that touches the browser is too short to hide a bug.
- **Instead of:** reading and writing `localStorage` in the middle of the
  calculation (how the game-over code did it before), which can only be
  checked by playing a whole run.

### 2.15 Barrel module (one import path, many files)

- **What:** a file that only re-exports other files (`export * from …`).
- **Where:** `config/constants.ts` re-exports `config/tuning/*.ts`.
- **Why:** each tuning domain is its own short file, while every importer
  keeps writing `import { PLAYER } from "../config/constants"`. Moving a
  constant between domain files never touches the code that uses it.
- **Instead of:** importing from each domain file directly. More precise,
  but it would have changed ~40 imports in one go, and the barrel can be
  dropped later file by file if wanted.
- **Caution:** two domain files must not export the same name; TypeScript
  reports it as an error in the barrel.

---

## 3. Where to start when you want to…

| Change | Start in |
| --- | --- |
| Tune a number (speed, cost, time) | `src/config/tuning/<domain>.ts` |
| A UI color | `src/config/palette.ts` (`PALETTE`) |
| A new monster movement | `objects/Alien.ts` (`advance`), `config/tuning/monsters.ts`, content checklist in `MULTIPLAYER_DESIGN.md` §9 |
| A new ability | `objects/abilities.ts` (a new subclass), `ABILITY` in `config/tuning/monsters.ts` |
| A new power | a row in `config/tuning/powers.ts`; a new *effect* also needs `sim/energy.ts`, `Field`, `Bot.usePower` |
| Something on the HUD | the component in `ui/hud/`, wired in `GameScene.create` |
| What a sound/pop does on an event | `GameScene.showFieldEvent` |
| How something looks in 3D | `render3d/World3D.ts` |
| The battle side panels | `ui/battleViews.ts` (phone dock), `ui/OpponentBoard.ts` (desktop) |
