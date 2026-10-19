# Solo modes: Story and Endless (plan)

> **Status:** plan, decided with the owner 2026-10-18 (§7). Nothing here is
> built yet. This file is the source of truth for story mode (like
> `MULTIPLAYER_DESIGN.md` for battles); changes go into the AGENTS.md
> Decision Log too. The level list may still change as we build.

## 1. The three ways to play

| Mode | What it is | Status |
| --- | --- | --- |
| **STORY** | 10 levels, each a scrolling notebook page of a kid's imagined world, ending in a **boss**. An arcade run: lives carry over, game over = back to level 1. | new |
| **ENDLESS** | Today's PLAY: score-led difficulty, play until your lives run out, world leaderboard. | built (renamed) |
| **METIC 99** | Battle royale: today vs 7 bots (BATTLE beta), later online. | in progress (netcode chats) |

Menu: PLAY opens a mode choice (STORY / ENDLESS); BATTLE stays its own
button and becomes METIC 99 when online play lands.

## 2. What a level is

A level is a **scrolling path** across one notebook page (like Aero Fighters
flying a map): the page and its props scroll down, a progress bar shows how
far along the map you are, and the **boss waits at the end**. The path is the
timer: ~3–4 minutes to the boss, so the 10 levels take ~25–35 minutes.

- **Fair:** a slow player isn't stuck in a level that never ends (a kill
  quota could do that).
- **Game clock:** the scroll runs on the game clock, so FREEZE, SLOW and the
  hit freeze slow or stop it too. The sim only needs
  "level progress = game time".

A level is **data**, not code: one entry in a `LEVELS` table, so adding or
retuning a level never touches the rules. Each has:

- **Page:** the paper tint and the **props** scrolling past (rocks, grass
  tufts, lily pads, branches…). Props are short doodle recipes, drawn once
  and copied as they scroll (pre-rendered, cheap on phones), scattered by a
  seeded layout. **Props are faint pencil:** the numbers must still win
  (readability rule). About 5–8 props per level.
- **Roster:** which monster kinds and abilities may appear, with weights,
  re-skinned to the level's theme (a darter is a beetle in the backyard and
  a fish in the pond). Each level **introduces one new monster** with the
  intro banner we already have.
- **Math:** operations, ball count and digit range (§3).
- **Difficulty:** a fixed range for the level (`d` from → to along the path)
  instead of the Endless score-led curve, so level 4 always feels like
  level 4.
- **Boss** (§4) and the level's seed (same path and aliens every attempt, so
  a level can be learned and replays stay exact).

## 3. Levels (owner's pick; may change while building)

A kid's imagination of nature and the elements, doodled in a notebook.

| # | Page | Monsters | Boss | Math |
| --- | --- | --- | --- | --- |
| 1 | Backyard dirt | bugs, worms | Giant Mole | sums |
| 2 | Pond (water) | frogs, fish, dragonflies | Big Frog | sums, 3–4 balls |
| 3 | Treetops | squirrels, owls | Owl (blinking eyes) | + subtraction |
| 4 | Mud swamp | blobs that split | Mud Monster | + / − |
| 5 | Dark cave | bats, glowworms | Cave Troll (a flashlight shows its numbers) | + / − |
| 6 | Volcano (fire) | fireflies, lava drips | Dragon | + multiplication |
| 7 | Windy sky (air) | birds, kites, paper planes | Storm Cloud | × mixed |
| 8 | Snowy mountain | penguins, snowballs | Yeti | mixed |
| 9 | Night sky | comets, aliens (the original game) | The Moon | everything |
| 10 | The kid's bedroom | toys come alive | Under-the-Bed Monster | everything |

Ending idea: it was all the kid's homework doodles.

**Math ramp:** levels 1–2 are sums only. Sum levels move up to monsters with
4+ balls. New operations join as the story goes (ball color = operation:
red subtraction, green multiplication, yellow division). Rules they need:
subtraction never goes negative (bigger number first), every answer on the
field stays unique, and wider 4+ ball rows need room in the readability
boxes and the spawner.

## 4. Bosses

A boss is a big doodle that takes **several answers**: each correct sum
knocks a piece off, and it fights back between answers (minions, attacks,
moving or hiding its numbers). Bosses reuse the ability hooks
(`update` / `onHit` / `onKilled` + `AbilityHost`): the Owl blinks like the
Blinker, the Mud Monster splits like the Splitter, and so on. Balance rule
(owner's): the more answers a boss needs, the slower it advances. A boss
reaching the ship costs a life, not the run. Each boss gets designed in its
own level's milestone.

## 5. Special monsters

- **Attackers:** come at the ship; reaching it costs a life (all of today's
  lethal kinds).
- **Points bonus:** a *Bouncer* that ricochets off the margins and never
  attacks; solving it pays big points.
- **Energy bonus:** the drifter (built).
- **Extra life:** a *Heart balloon* that floats up and away fast and carries
  a hard sum; at most once per level, only when a life has been lost.

Every new monster follows the content checklist in `MULTIPLAYER_DESIGN.md`
§9 and can be sent in battles too.

## 6. Lives, scores and leaderboards

- **Arcade rules:** 3 lives for the whole run; they carry over between
  levels. Losing the last life ends the run and the next one starts at
  level 1. (The Heart balloon is the way to earn lives back.)
- **Power:** picked on a "pick your power" card **before each level**, so
  each world can be tackled with a different tool. Ships stay a look only
  (Decision Log 2026-09-29).
- **Leaderboards:** a score per level, plus the full-run score, on the world
  leaderboard (the `scores` table gains a `level` column, 0 = Endless, with a
  per-level plausibility cap in `submit_run`).
- **Proposed, not decided:** *practice* any level already reached from the
  table of contents, scoring only on that level's board, so the hard levels
  can be trained without replaying the run.

## 7. How it fits the code

The rules already run as a Phaser-free `Field` with a seeded `Swarm`, and
`Swarm` asks `difficultyAt(elapsed, score, dMatch)` what to spawn. Story mode
adds one seam and reuses everything else:

- **Spawn director** (a small interface, like `FieldView`): *what may
  spawn now, how hard is it, and where are we on the path?* `EndlessDirector`
  wraps today's curve (Endless and battles unchanged, golden master green);
  `LevelDirector` reads a `LEVELS` entry.
- **Boss phase** in the director: normal spawns stop or slow while the boss
  is up. Field events gain `levelCleared` and `bossPhase`; GameScene shows
  them (banner, level-complete card), like it shows hits today.
- **Bots play levels:** `npm run bots -- --story 3` runs each bot level
  through level 3; that is how levels get tuned (e.g. a rookie clears 1–3,
  an ace reaches 10).
- **Doodles:** each level's page, props, creatures and boss doodles live in
  `renderDoodle/levels/<page>.ts`; the scroll is the view reading level
  progress.

### Creatures: personality, not just a skin

Each level turns the monster kinds into its own creatures
(`LevelDef.SPECIES`): a creature keeps its kind's movement and adds
- a **ball layout** (`BALL_LAYOUTS`, a rule: it sets the readability
  box): "row", "eyes" (beetle: its eyes are the balls), "chain" (worm: its
  body is the balls, any count), "wings" (butterfly: a ball on each wing);
- a **trait** (`objects/traits.ts`): an Ability on the usual hooks, e.g.
  "wings" folds the wings over the numbers on a rhythm (like the Blinker);
  a trait sees its alien in `update(delta, alien, host)`, so it can move
  it in glides and holds (`Alien.scripted`) or change its sum;
- a **speed** (`SPEED`, × its kind's): the harder to kill, the slower;
- a **march** (`MARCH: { SIZE, CHANCE }`): sometimes comes in a line, in
  step; a line skips the unsolved cap but obeys the threat budget;
- an **intro** line shown the first time it appears.
Bosses fight by a **mechanic** (`objects/bosses.ts`; "burrow" = the mole).

### Adding a level (one file each, so levels can be built in parallel)

1. `src/config/levels/<page>.ts`: the `LevelDef` (name, page id, seed,
   path, d range, kind weights, species, boss with its `BOX`) and one line
   in `src/config/levels/index.ts` (`LEVELS`, in story order).
2. `src/renderDoodle/levels/<page>.ts`: the `PageDef` (paper colors,
   props, a `CreatureLook` per species, a `BossLook` per boss model) and
   one line in `src/renderDoodle/levels/index.ts`.
3. New rules only if needed: a trait (an Ability class + one line in
   `TRAITS`), a boss mechanic (subclass `Boss` + one line in
   `BOSS_MECHANICS`), a layout (BALL_LAYOUTS + `Alien.boxFor`/`ballOffset`).
4. Check: `story.test.ts`-style run (every creature appears, no box
   overlaps), bots per level (rookie mostly clears early levels), the level
   played in the browser (`?bot=ace`), golden master unchanged.

## 8. Milestones

| # | Milestone | Done when |
| --- | --- | --- |
| L1 ✓ | Mode choice (STORY / ENDLESS) in the menu | ENDLESS = today's game |
| L2 ✓ | Spawn director seam (refactor only) | golden master unchanged |
| L3 ✓ | Level engine: `LEVELS` data, scrolling page + props, progress bar, level-complete card, lives carried over | level 1 playable to the end of the path |
| L4 ✓ | Boss phase + Giant Mole | level 1 complete |
| L5 | Table of contents + per-level and full-run scores | runs save and restart at level 1 |
| L6 | Levels 2–5 (pond, treetops, swamp, cave), subtraction, 4-ball rows, Bouncer, Heart balloon | bots clear them at the target rates |
| L7 | Levels 6–10, multiplication | same |
| L8 | Story bots report + balance pass; leaderboard `level` column | `npm run bots -- --story` |

L1–L4 is the smallest playable slice: one full level with a boss, to judge
the feel before building ten.

**Level 6, THE VOLCANO (built 2026-10-18, on its own branch):** d 0.6 →
0.75 over 200 s, sums only (multiplication waits for the shared operations
piece). Creatures: **lava drips** (darters, "chain": cling, swell, then drop
70 px; trait `drip`), **fireflies** (strafers, ×0.8: their lanterns go dark
on ONE rhythm from the game clock, so the whole swarm blinks together;
`flash`), **lava tortoises** (3-ball lumberers, ×0.45: a shell that takes an
answer first, the Shielded rule; `shell`), and the bonus **spark** (drifter,
"eyes": crosses in hops, readable when it lands; `spark`). Boss **DRAGON**
(mechanic `breath`, 6 answers of 3 balls, ×0.2): walks 50 px, stops and
inhales (shakes), then breathes fire: its numbers melt into a new sum and it
rears back 30 px. Bots (20 seeds, 3 fresh lives): rookie 0/20 (dies around
40% of the path), pilot 14/20 (27/40), ace 20/20; hits spread evenly over the
three creatures. Rules `config/levels/volcano.ts`, `objects/volcanoTraits.ts`,
`objects/dragon.ts`; looks `renderDoodle/levels/volcano.ts`; test
`sim/volcano.test.ts`. **Built 2026-10-18.** Not in it yet: the
"pick your power" card before each level (the menu's pick is used), monsters
re-skinned per page (level 1 still draws the standard darter/swooper
doodles), story scores on the leaderboard, a dev shortcut to a level.

## 9. Decisions (owner, 2026-10-18)

1. **Math:** levels 1–2 sums only; operations widen as levels go on; sum
   levels use 4+ ball monsters.
2. **Lives:** carried across levels (arcade).
3. **Power:** picked before each level; ships stay looks.
4. **Length:** 3–4 min per level, ~25–35 min for the run.
5. **Goal:** a scrolling path that ends at the boss (path = timer).
6. **Game over:** back to level 1.
7. **Levels:** the 10 in §3, in that order, open to change.
8. **Scores:** per level and per run, on the world leaderboard.

Still open: practice mode (§6); a small story between levels (one doodled
panel per level) or just themed pages.
