# Engineering Practices — Metic99

How code is written and changed in this repo. It applies to people and AI
agents alike. Metic99 is a **learning project**: the owner must be able to
read any file, understand why it is built that way, and change it without
help. So every rule here serves one goal:

> **Code a person can read top to bottom, and every change explained.**

The design patterns the code already uses are explained in
[`ARCHITECTURE.md`](ARCHITECTURE.md). Game design lives in `AGENTS.md` and
`docs/MULTIPLAYER_DESIGN.md`.

---

## 1. Readability rules

These are what a reviewer checks first.

1. **Names say what a thing is, with units.** `fireCooldownMs`, `halfW`,
   `landsAtMs`, not `t`, `cd`, `tmp`. Short names are fine only in tiny
   scopes (`a` for an alien inside a one-line `filter`).
2. **One job per function, one job per file.** If you need "and" to say what
   a function does, split it. A file over ~400 lines usually has two jobs.
   (Check: can you name the file's job in one short sentence?)
3. **No more than three positional parameters.** More than that, or two
   arguments of the same type next to each other, become an **options
   object** with named fields (`new Alien({ kind, x, y, ... })`). A call
   such as `make(rng, kind, sum, x, y, diff, undefined, null, undefined,
   laneX)` can't be read without opening the function.
4. **No magic numbers.** Game tuning goes in `src/config/tuning/` (one file
   per domain, see §3). UI colors are named in `src/config/palette.ts`, text
   styles come from `textStyle()` in `src/ui/theme.ts`. A number
   in code needs a name unless its meaning is obvious (`/ 2`, `* 1000` for
   ms → s).
5. **Comments explain *why*, not *what*.** The code says what it does. A
   comment is for intent, a trap, or a reason ("Ability clocks run on real
   time: a blinker must not stay shut through the post-hit freeze"). History
   ("changed on 2026-09-30 because…") goes in the Decision Log, not in code.
6. **Early returns over deep nesting.** Handle the "nothing to do" cases first
   and leave the main path unindented.
7. **Let the types forbid bad states.** Prefer a discriminated union
   (`{ type: "digits"; digits } | { type: "clear" }`) to an object with many
   optional fields. `switch` on `type` and let TypeScript check every case.
8. **Read the surrounding code and match it.** Naming, comment density and
   idioms should look like the rest of the file.

## 2. Layers and dependencies

```
config/      numbers, types, the player's saved picks (imports only config/)
sim/ objects/ handwriting/   the rules, pure TS  (imports config only)
render3d/ ui/ services/      views and the outside world
scenes/      Phaser scenes: wire the above together
```

- **Dependencies point down this list, never up.** `sim/` must not import
  Phaser, Three.js, the DOM or `localStorage`. That is what lets the same rules
  run in the browser, in `npm run bots`, in tests and on a future server.
- **Game rules never use `Math.random()` or the wall clock.** Draw from the
  run's seeded `Rng` and read the game clock (`elapsedMs`). Visual-only
  randomness (stars, debris) may use `Math.random()`.
- **Views read state; they change it only through inputs.** A view calls
  `field.apply(input)` or a `BattleActions` callback, never sets a field
  property.
- **A scene is a composition root.** It builds the components, connects them,
  and runs the frame loop. Drawing details live in components under `ui/`.

## 3. Where things go

| Kind of code | Place |
| --- | --- |
| Tuning numbers for one domain | `src/config/tuning/<domain>.ts` (re-exported by `config/constants.ts`) |
| UI colors | `src/config/palette.ts` (`PALETTE`) |
| Fonts, text styles | `src/ui/theme.ts` (`textStyle`, `outline`) |
| Rules (anything a server would also run) | `src/sim/`, `src/objects/` |
| A piece of the in-game HUD | its own class in `src/ui/hud/` |
| Browser storage, network | `src/services/` (saved menu picks: `src/config/<pick>.ts`) |
| Pure helpers that need tests | next to their user, with a `*.test.ts` |

## 4. Testing and verifying

Before every commit, all three must pass:

```bash
npx tsc --noEmit   # types
npm test           # unit tests + the golden master
npm run build      # the real bundle
```

- **Unit tests** cover pure logic (`sim/`, `handwriting/`, layout math).
  Phaser scenes are not unit-tested; keep logic out of them so it can be.
- **The golden master** (`src/sim/golden.test.ts`) plays fixed-seed bot
  games and a bot match and compares the results with a saved snapshot. Any
  change to the rules makes it fail. That is the point:
  - a **refactor** must leave it green (proof that behavior didn't change);
  - a **rule change** updates it on purpose (`npx vitest run -u`) and the
    commit says why the numbers moved.
- After a balance change, compare with `npm run bots` / `npm run match`.

## 5. How a change is made

0. **Learn together.** For the owner, every change is also a lesson: before
   coding, run the learning loop (`docs/learning/HOW_WE_LEARN.md`; Claude:
   the `learning-loop` skill), so the owner thinks about the change first.
1. **Understand.** Read the code involved and the relevant docs. Say what the
   current behavior is before changing it.
2. **Choose.** Think of at least two ways to do it. Pick the simplest that
   fits the layers above; note why the others lost.
3. **Small steps.** One kind of change per commit. **Never mix a refactor with
   a behavior change**: first restructure with the golden master green, then
   change behavior in a separate commit.
4. **Verify.** §4. For UI changes, also run the game (`npm run dev`).
5. **Explain.** Write the change explanation (§6).
6. **Record decisions.** A game-design or architecture decision gets a Decision
   Log entry in `AGENTS.md` (see the self-updating rule there).

## 6. The change explanation

Every change ends with an explanation the owner can learn from, in the reply
to the owner and, for bigger changes, in `docs/learning/`. Claude follows the
`explain-change` skill (`.claude/skills/explain-change/SKILL.md`); other
agents follow this template directly:

```markdown
### <Change title>
**What changed:** one or two sentences, in terms of behavior or structure.
**Pattern:** the name of the pattern used (link to ARCHITECTURE.md if it is
  there), and a two-line description of it in plain words.
**Why this way:** the problem it solves in *this* code.
**Alternatives considered:** each other option and why it lost.
**How to change it later:** where to look and what to edit for the most
  likely next change.
**Verified by:** the commands/tests run and what they showed.
```

## 7. Commits

- Subject: imperative, ≤ 72 chars, says what changed (`Split GameScene's
  energy HUD into ui/hud/EnergyHud`).
- Body: why, and anything a reviewer can't see in the diff.
- One logical change per commit, so `git log` reads like the story of the
  project and any step can be reverted alone.
- The trailers listed in `AGENTS.md` → Conventions.

## 8. Open proposals (not adopted yet)

- **Formatter + linter** (Prettier + ESLint). The code is not consistently
  formatted (Prettier would rewrite ~25 files), so adopting it is one big
  formatting-only commit; worth doing when no other branch is in flight.
