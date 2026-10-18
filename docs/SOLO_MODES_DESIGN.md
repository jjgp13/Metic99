# Solo modes: Story and Endless (plan)

> **Status:** draft plan, 2026-10-18. Nothing here is built yet. The owner
> decides the open questions in §7; then this file becomes the source of
> truth for story mode (like `MULTIPLAYER_DESIGN.md` for battles) and the
> decisions go into the AGENTS.md Decision Log.

## 1. The three ways to play

| Mode | What it is | Status |
| --- | --- | --- |
| **STORY** | 10 levels, each a page of the notebook with its own monsters, ending in a **boss**. Difficulty rises level by level. | new |
| **ENDLESS** | Today's PLAY: score-led difficulty, play until your lives run out, world leaderboard. | built (renamed) |
| **METIC 99** | Battle royale: today vs 7 bots (BATTLE beta), later online. | in progress (netcode chats) |

Menu: PLAY opens a mode choice (STORY / ENDLESS); BATTLE stays its own
button and becomes METIC 99 when online play lands.

## 2. What a level is

A level is **data**, not code: one entry in a `LEVELS` table, so adding or
retuning a level never touches the rules. Each has:

- **Page** (the "environment"): which notebook page it is drawn on, e.g.
  lined paper, graph paper, a page of sticky notes, a margin full of
  scribbles, a torn page, a page under a lamp at night. The doodle style
  stays; the page, colors and props change.
- **Roster:** which monster kinds and abilities may appear, with weights.
  Each level **introduces one new monster** (with the intro banner we
  already have) and keeps a few known ones.
- **Math:** ball count and digit range (and, later, the operation, §7 Q1).
- **Difficulty:** a fixed range for the level (`d` from → to as the level
  goes on) instead of the endless score-led curve, so level 4 always feels
  like level 4.
- **Goal:** clear a quota of monsters (e.g. 25 kills); the boss then comes
  in. A progress bar replaces the score bar at the top.
- **Boss** (§4) and the level's seed (same aliens every attempt, so a level
  can be learned and replays stay exact).

Finishing a level gives **1–3 stars** (lives left, or time), saved in
localStorage. The level map is the notebook's **table of contents**: one
line per level with its stars; the next level unlocks when the previous one
is cleared.

## 3. How it fits the code

The rules already run as a Phaser-free `Field` with a seeded `Swarm`, and
`Swarm` asks `difficultyAt(elapsed, score, dMatch)` what to spawn. Story mode
adds one seam and reuses everything else:

- **Spawn director** (a small interface, like `FieldView`): *what may
  spawn now, how hard it is, and is the level over?* `EndlessDirector`
  wraps today's curve (endless and battle unchanged, golden master green);
  `LevelDirector` reads a `LEVELS` entry and counts the quota.
- **Boss** = a new ability-like alien built on the existing hooks
  (`update` / `onHit` / `onKilled` + `AbilityHost`), plus a boss phase in
  the director (normal spawns stop or slow while it's up).
- **Field events** gain `levelCleared` and `bossPhase`; GameScene shows
  them (banner, level-complete screen), like it shows hits today.
- **Bots play levels:** `npm run bots -- --story 3` runs each bot level
  through level 3, which is how each level gets tuned (e.g. a rookie should
  clear levels 1–3, an ace all 10 with most stars).
- **Doodles:** each new monster and boss is a recipe in
  `renderDoodle/recipes.ts`; each page is a `paper.ts` variant.

## 4. Bosses (first ideas, to iterate)

A boss is a big doodle that takes **several answers**: each correct sum
knocks a piece off, and it fights back between answers. Each idea reuses
something the game already has:

| Level | Boss idea | Mechanic it tests |
| --- | --- | --- |
| 1 | **Big Blob:** a giant drifter; 3 sums in a row, each one shrinks it | reading under light pressure |
| 2 | **Twin Darters** joined by a string; kill both halves | two targets at once |
| 3 | **Shell Beetle:** a shield per sum (Shielded × 3) | sums that change |
| 4 | **Peek-a-boo:** balls blink in a pattern (Blinker) | memory |
| 5 | **Mama Splitter:** splits into 2, then 4 | many small sums |
| 6 | **Orbit King:** balls circle its body (Orbiter) | moving numbers |
| 7 | **Ink Worm:** a chain of balls; each answer removes a segment (Worm) | long sums |
| 8 | **Hider Hive:** sums hide behind its body (Hider) | timing |
| 9 | **Eraser:** rubs out your typed answer/HUD bits for a moment | focus |
| 10 | **The Teacher:** a mix of every earlier boss, in phases | everything |

Boss rule (from the owner's balance rule): the more answers a boss needs,
the slower it advances; a boss reaching the ship costs a life, not the run.

## 5. New monsters (one per level)

Today: darter, lumberer, strafer, swooper, drifter + Shielded, Blinker,
Splitter. Planned next on the same hooks: **Hider, Orbiter, Worm**. Story
needs ~2–3 more (ideas: a *Bouncer* that ricochets off the margins, a
*Paper plane* that crosses diagonally, a *Smudge* that leaves a cloud over
part of the field for a moment). Every new monster follows the content
checklist in `MULTIPLAYER_DESIGN.md` §9 and becomes sendable in battles too.

## 6. Milestones

| # | Milestone | Done when |
| --- | --- | --- |
| L0 | Decide §7 | answers in the Decision Log |
| L1 | Mode choice (STORY / ENDLESS) in the menu | ENDLESS = today's game |
| L2 | Spawn director seam (refactor only) | golden master unchanged |
| L3 | Level engine: `LEVELS` data, quota, level-complete screen, stars | level 1 playable without a boss |
| L4 | First boss + boss phase | level 1 complete |
| L5 | Table of contents (level map) + saved progress | levels unlock |
| L6 | Levels 2–5: pages, new monsters, bosses | bots clear them at the target rates |
| L7 | Levels 6–10 | same |
| L8 | Story bots report + balance pass | `npm run bots -- --story` |

L1–L4 is the smallest playable slice: one full level with a boss, to judge
the feel before building ten.

## 7. Open questions for the owner

1. **Math by level:** sums only, harder sums each level (more balls,
   bigger digits)? Or bring in the other operations (red = subtraction,
   green = multiplication, …) as the story goes, e.g. levels 1–3 sums, 4–6
   subtraction, 7–9 multiplication, 10 mixed? *(Suggestion: sums only for
   the first slice, decide operations after playing level 1.)*
2. **Lives:** 3 lives per level (a fresh start each level) or carried
   across levels? *(Suggestion: per level, simpler and kinder.)*
3. **Power:** picked on the menu as today, or given by the level?
4. **Level length:** about 2–3 minutes plus the boss?
5. **Goal:** a kill quota or a timer (survive N seconds)?
6. **Story:** just themed pages, or a small story told between levels
   (one doodled panel per level)?
