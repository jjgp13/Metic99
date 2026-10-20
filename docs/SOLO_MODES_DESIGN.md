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
| 4 ✓ | Mud swamp | slime blobs that split, peepers, snails, turtles | Mud Monster (splits in two) | + / − (sums for now) |
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
- **Leaderboards (built, L5):** a score per level, plus the full-run score,
  on the world leaderboard: the `scores` table gains a `level` column (0 =
  Endless, 1–10 = stage, 99 = whole run) with a per-board cap in
  `submit_run` (`supabase/story-boards.sql`). A stage's score is the points
  scored in it; the run's boards are submitted together after one name
  entry when the run ends.
- **Story map (built, L5; owner 2026-10-18):** the STORY button opens a map
  with one island per stage. Reached islands show the best score for the
  stage (tap = its world board); stages not reached are a "?". **No
  practice mode:** every run starts at island 1, the map only shows how
  far you got.

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
  a trait's `pace(alien, delta)` can hold, slow or speed its kind's
  movement (the cave's bat hangs, then drops);
  a trait sees its alien in `update(delta, alien, host)`, so it can move
  it in glides and holds (`Alien.scripted`) or change its sum;
- a **speed** (`SPEED`, × its kind's): the harder to kill, the slower;
- a **march** (`MARCH: { SIZE, CHANCE }`): sometimes comes in a line, in
  step; a line skips the unsolved cap but obeys the threat budget;
- an **intro** line shown the first time it appears.
Bosses fight by a **mechanic** (`objects/bosses.ts`; "burrow" = the mole,
"leap" = the Big Frog). A trait or boss that moves in its own way (darts,
dives, leaps) scripts it in `Ability.steer(alien, fieldDelta)` with
`alien.glideTo` / `alien.hold`; `steer` runs on field time, so freezes and
SLOW hold it like any other movement.
"lamp" = the cave troll). A boss's look may draw on the page under the
field (`BossLook.under`: the troll's lamp beam).

### Level status

| # | Level | Built | Bots (20 seeds, starting there, 3 lives) |
| --- | --- | --- | --- |
| 1 | THE BACKYARD | ✓ beetles (eyes, march), worms (chain), butterfly (wings fold); GIANT MOLE | rookie 16, pilot 20, ace 20 |
| 5 | THE DARK CAVE | ✓ bats (hang → wake → drop), glowworms (chain, glow on/off), mine cart (wheels = numbers); CAVE TROLL (numbers only in a swinging lamp's beam) | rookie 2, pilot 18, ace 20 |

**Level 5, THE DARK CAVE** (`config/levels/cave.ts`, 200 s, d 0.45 → 0.6,
sums only; + / − planned). Grey stone page (mid-grey, so pencil and the
white number balls still win) with stalactites, rocks, crystals, drips.
- **Bat** (strafer, "wings" layout, trait "roost"): flies to the ceiling and
  hangs upside down, still, wings wrapped round its numbers (3.4 s to read
  it), wakes with a shake (0.7 s, the telegraph), then drops at 65% of a
  strafer's dive, fluttering side to side. Always readable: the danger is
  the drop.
- **Glowworm** (darter for 2 balls, swinging on its silk thread; lumberer
  for 3, lowering itself in jerks; "chain" layout, trait "glow"): its
  segments are its numbers and glow on a fixed rhythm (3.2 s lit, 0.7 s
  flicker, 1 s dark; the first glow 4.2 s). It hides, so it moves at 60%.
- **Mine cart** (the drifter, "eyes" layout): rattles across on rails; its
  two wheels are its numbers.
- **CAVE TROLL** (mechanic "lamp", 6 answers of 3 balls, speed 0.3): a lamp
  above the page sweeps its beam back and forth at a steady speed (±56°,
  7 s there and back). The troll's numbers show only while its whole ball
  row is in the beam (fading at the edge), and the light stuns it: it
  stands still while lit and stomps on in the dark, 12% faster per answer.
  Fair because the beam is visible and steady (you see it coming), the sum
  never changes until answered (type it from memory), and the lamp keeps
  swinging during FREEZE. Each answer: it staggers across and up, hidden.
- Tuning by bots: d 0.5 → 0.65 left pilots 1/20 (darter glowworms caused
  most hits); glowworms at 60% pace, d 0.45 → 0.6, a wider and slower beam
  and a slower troll gave the table above.

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
   More balls than the d range gives: `LevelDef.MAX_BALLS` (3+ ball sums
   ride on lumberers, one on screen at a time).
   A level's own rule classes can live in `src/objects/<page>.ts`. Hooks
   already there: `SpeciesDef.SPEED` (a creature with a hard trait moves
   slower), `Boss.surfaceAt` (where a boss pops up after an answer),
   `BossDef.PART` + `AbilityHost.spawnBossPart` (a boss that splits; the
   level clears when no boss part is left).
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
| L5 ✓ | Story map + per-level and full-run scores | runs save and restart at level 1 |
| L6 ✓ | Levels 2–5 (pond, treetops, swamp, cave), 4-ball rows (`cluster`); still to do: subtraction, Bouncer, Heart balloon | bots clear them at the target rates |
| L7 | Levels 6–10 (volcano ✓), multiplication | same |
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

### Level 2, THE POND (built 2026-10-18)

`config/levels/pond.ts` + `renderDoodle/levels/pond.ts`, rules for its
traits and boss in `objects/pondCreatures.ts`. 3:20 of path, d 0.1 → 0.28,
sums of 2–4 balls (`MAX_BALLS: 4`).

| Creature | Kind | Personality |
| --- | --- | --- |
| Goldfish | darter | its numbers are the bubbles it blows (chain layout, wobbling); swims in **schools of 3** (march, 15%) |
| Dragonfly | strafer | its big eyes are its numbers; patrols and buzzes, then **darts down in zips, hovering between them** (trait `dart`) |
| Frog | lumberer (3–4 balls) | its spots are its numbers (`cluster` layout); hops, and **sits longer the more spots it has** (trait `hop`, +250 ms per ball) |
| Duck (bonus) | drifter | a number on each wing; paddles across, tips its head down, then **dives** (numbers hidden) and pops up 70 px on (trait `dive`) |
| **BIG FROG** | boss, `leap` | 6 answers of 4 balls; leaps onto the page, then **sits, croaks (shakes: the telegraph), and leaps** down and across to the next pad (~13 px/s, slower than the mole: more answers); each answer but the last sends it jumping back up, numbers hidden in the air |

Bots (20 seeds, 3 fresh lives): rookie clears 11/20, pilot 20/20, ace 20/20
(level 1: 16/20, 20/20, 20/20). Fish cause most hits. Ideas left for later:
a tongue that grabs (needs a way for a boss to act on the ship or a
minion), croaks that call tadpole minions (needs an `AbilityHost` call to
spawn one of the level's creatures).
**Level 3, THE TREETOPS (built 2026-10-18, sums only).** Rules in
`config/levels/treetops.ts`, traits in `objects/treetopsTraits.ts`, boss in
`objects/owlBoss.ts`, doodles in `renderDoodle/levels/treetops.ts`. Path
3.5 min, d 0.3 → 0.45 (two unsolved sums from the start).
| Creature (kind) | Personality |
| --- | --- |
| Squirrel (swooper) | leaps in from a trunk at the page's edge, then every 120 px of descent crouches and leaps 70 px sideways to the next branch (the other way each time) and freezes a moment; its two acorns are its numbers ("eyes" layout) |
| Owl (strafer, 0.9×) | its eyes are its numbers; perched, it turns its head away on the Blinker's rhythm (a glance first), but always looks at you while it winds up and swoops |
| Bird (darter, 0.6×) | flies in flocks of up to three (`MARCH`), a number on each wing ("wings" layout) |
| Hummingbird (drifter, bonus) | darts ahead and hovers, again and again: catch it while it hovers |
| GREAT OWL (boss, `blink`) | 6 answers of 2 balls in its big eyes; the eyes blink, and faster after each answer (open 2.6 s → 1.4 s); after an answer it flies to a branch on the other side, eyes shut; hops down at 0.4× |
Bots (20 seeds, 3 lives): rookie clears 10/20 (level 1: 16/20), pilot 19/20,
ace 20/20. Planned for this level once operations land: subtraction.
### Level 4: THE MUD SWAMP (built 2026-10-18, sums only)
`config/levels/swamp.ts` (rules), `objects/swamp.ts` (its traits and boss),
`renderDoodle/levels/swamp.ts` (looks). Path 200 s, d 0.3 → 0.55, seed 1004.
| Slime blob | darter, ×0.7 | trait "split" (the Splitter): beaten, it pops into two little blobs that land no lower than y 190 |
| Peeper | strafer, ×0.6 | its eyes are its numbers ("eyes"); trait "peek": ducks them under the mud on a rhythm, bubbling first |
| Mud snail | swooper, ×0.7 | trait "shell" (Shielded): the first answer knocks its shell off, the second beats the slug |
| Bog turtle | lumberer | three numbers on its shell; joins at d 0.5 (the last fifth) |
| Firefly (bonus) | drifter | a number on each wing ("wings"); trait "glow": its light flickers out and the numbers go dark |
**Boss, MUD MONSTER** (mechanic "split"): 3-ball sums. The first answer sinks
it into the mud (it pops up on the other side, like the mole); the second
splits it into two halves (`BossDef.PART`), each with a 2-ball sum that
sinks once and glops back up on its own side. Both halves must be beaten:
6 answers in all (the mole: 5), so it moves at ×0.4 (the mole: ×0.45).
While both halves are up no minions come (the boss phase allows 2 unsolved).
Bots (20 seeds): see the AGENTS.md Decision Log. Planned math: + and −
(subtraction comes as its own shared piece).

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

Decided later (2026-10-18): no practice mode; the story map shows
progress and opens each stage's board (§6).

Still open: a small story between levels (one doodled
panel per level) or just themed pages.
