# Metic99 — Game Vision

Journal of the intended player experience and the design decisions actually
agreed, each with its source. Seeded 2026-11-08 from `AGENTS.md`,
`README.md`, `docs/MULTIPLAYER_DESIGN.md`, `docs/SOLO_MODES_DESIGN.md`,
`docs/ART_SPEC.md`, `docs/MUSIC_PROMPTS.md`, `docs/NETCODE.md`,
`docs/ENGINEERING.md` and `docs/ARCHITECTURE.md`.

This file summarizes and points. The source docs remain the evidence; when
they change, they win. "Decision Log" below means the dated list at the
bottom of `AGENTS.md`.

---

## 1. The game in one paragraph

Metic99 is a browser math-shooter, a web rewrite of the Unity game *Metic*.
Monsters come down the page carrying numbered balls. The player types the
**sum** (keypad, keyboard or handwriting), and the ship slides under the
matching monster and fires. A monster that reaches the ship costs a life.
The long-term goal is a Tetris 99-style battle royale where solving sums
lets you attack the other players.
Sources: `AGENTS.md` → "What Metic99 is"; `README.md` → Gameplay;
`docs/MULTIPLAYER_DESIGN.md` intro.

## 2. Design pillars (agreed)

1. **The math is the star.** The numbers must always be the most readable
   thing on screen. Accidental overlap of two monsters' balls is a bug.
   Hiding a number is allowed only as a deliberate, telegraphed monster
   ability the player can learn.
   - `docs/MULTIPLAYER_DESIGN.md` §3 (readability rule)
   - `docs/ART_SPEC.md` §1 and §3
   - Decision Log 2026-09-29 ("Numbers win over the HUD": the HUD fades
     when a monster is under it)
   - Decision Log 2026-10-19 (animated pages are faint, "so the numbers
     win")
2. **Difficulty is earned and fair.** Difficulty mostly follows the score,
   with only a gentle time floor, so a struggling player is never swamped
   and a strong one ramps up fast. One unsolved sum at a time at the start.
   An answered target holds still, and a shot hits only the monster that
   was solved.
   - `AGENTS.md` → Difficulty design
   - Decision Log 2026-06-02 (score-led difficulty; locked target holds
     still) and 2026-09-25 (bullets hit only the solved alien)
3. **Room to recover.** Losing a life (not the last) freezes the field
   briefly and pushes every monster back, so the player can catch their
   breath.
   - Decision Log 2026-06-02 (freeze-then-slow)
   - Decision Log 2026-10-19 (pushback, after the owner's first story
     playtest)
4. **Monsters have personality.** Each kind moves and behaves in its own
   way, not just a different skin. The owner's balance rule: the harder a
   monster is to beat, the slower it moves and the longer its pattern
   takes.
   - Decision Log 2026-09-25 (movement patterns; abilities)
   - Decision Log 2026-10-18 ("Creatures with personality")
   - `docs/SOLO_MODES_DESIGN.md` §7 "Creatures: personality, not just a
     skin"
5. **Ships are looks; the player picks one power.** The power is FREEZE,
   SLOW, BLAST or SHIELD, and a power never pays for itself. Ships never
   change the rules, so new ships are free cosmetics.
   - Decision Log 2026-09-29
   - `docs/MULTIPLAYER_DESIGN.md` §2 and §9 (Loadout contract)
6. **Energy is scarce, and timing the power is the skill.** Kills charge a
   meter, and when to spend it decides survival. Energy was cut on purpose
   so the bar is not full most of the time. A visible "ready" cue tells the
   player when the power can be used.
   - Decision Log 2026-10-19 (energy rework)
   - Decision Log 2026-10-20 (the power shows when it's ready)
   - `docs/MULTIPLAYER_DESIGN.md` §7 ("SLOW/FREEZE timing is the survival
     skill, as intended")
7. **It feels like playing on a sheet of paper.** Pencil doodles on lined
   notebook paper are the default art; the owner picked this over a 3D
   pencil shader. The 3D low-poly view stays as an alternative, and its
   rules on readable balls and reserved ball colors still apply.
   - Decision Log 2026-10-18 (art direction)
   - `docs/ART_SPEC.md` header note
8. **Ball color means the math operation.** Blue is a sum, red is
   subtraction, green is multiplication, yellow is division. Monsters and
   attack markers must not use these colors; sent attacks wear orange, not
   red.
   - `docs/ART_SPEC.md` §4
   - `docs/MULTIPLAYER_DESIGN.md` §6
9. **Instant load in a phone or desktop browser.** This was the reason to
   leave Unity, along with native handwriting and easy WebSocket PvP.
   - `AGENTS.md` → "What Metic99 is"
   - Decision Log 2026-05-28 and 2026-09-24
10. **More than one way to answer.** Keypad (the default), keyboard, and an
    opt-in handwriting pad. The ink of a handwritten answer turns into the
    answer stars.
    - Decision Log 2026-09-27 (handwriting; answer feedback)

## 3. Three ways to play

Source for the overall shape: `docs/SOLO_MODES_DESIGN.md` §1.

### STORY (owner's decisions, 2026-10-18 and later)

- **The world.** Ten notebook pages, each a kid's imagined nature world:
  backyard, pond, treetops, swamp, cave, volcano, sky, snow, night sky, and
  the kid's bedroom. Each page scrolls along a path that ends at a boss.
  (`docs/SOLO_MODES_DESIGN.md` §2, §3, §9)
- **The path is the timer.** No kill quota, so slow players don't get
  stuck. A level lasts about 2 minutes, boss included; it was 3–4 minutes
  until the 2026-10-19 playtest. (`docs/SOLO_MODES_DESIGN.md` §2, §9 item 4)
- **Load comes in waves.** Spikes, rests, a ramp and a burst, and each
  peak is bigger than the last; this was the owner's playtest ask. Each
  level's song rises and falls with its waves. (Decision Log 2026-10-19 and
  2026-10-20; `docs/MUSIC_PROMPTS.md` → "Why the songs follow the waves")
- **Arcade rules.** Lives carry over between levels. Game over sends you
  back to level 1. There is no practice mode; the story map shows how far
  you got. (`docs/SOLO_MODES_DESIGN.md` §6, §9)
- **Bosses.** Each boss has one signature trick that changes how the fight
  feels, not how long it lasts. Numbers stay readable whenever they count,
  danger is telegraphed, and harder means slower.
  (`docs/SOLO_MODES_DESIGN.md` §4; Decision Log 2026-10-20 "Every boss
  gets a signature trick" and "says its trick in one line")
- **Each level introduces one new monster**, with an intro banner.
  (`docs/SOLO_MODES_DESIGN.md` §2)
- **The math widens as the story goes on.** Levels 1–2 are sums only.
  Later levels add more balls, then other operations. Answers stay unique
  and in 0–99, and subtraction never goes negative.
  (`docs/SOLO_MODES_DESIGN.md` §3, §9 item 1; `docs/MULTIPLAYER_DESIGN.md`
  §9 checklist)
- **The power is picked before each level**, so each world can be met with
  a different tool. (`docs/SOLO_MODES_DESIGN.md` §6, §9 item 3)
- **Rewards.** Beating certain bosses unlocks themed ships. Finishing the
  story gives the kid's crayon ship, a crown and "STORY COMPLETE". Unlocks
  can never be lost. (Decision Log 2026-10-20 "Story unlocks ships")
- **The ending.** A kid's hands color the game's monsters in crayon (the
  owner's idea; the owner picked the top-down look of three sketches). It
  is followed by credits and the run's play time.
  (Decision Log 2026-10-20, two entries)
- **A level clear plays out beat by beat.** The minions pop, the ship
  blasts off, a jingle plays, the results count up, and then the map
  appears. (Decision Log 2026-10-20 "Level clear sequence")

### ENDLESS (decided 2026-10-20)

- One set of rules: every monster, the score-led curve, and one
  leaderboard. (Decision Log 2026-10-20 "Endless = one set of rules")
- A world beaten in story can be picked as a **theme**: its page and its
  song. A theme never changes the creatures or the difficulty, so scores
  stay comparable. Paid themes were skipped. (same entry)
- Each Endless score shows the ship, power, world and survival time it was
  played with. (Decision Log 2026-10-21)

### METIC 99, the battle royale (direction agreed 2026-09-25)

- **What it borrows from Tetris 99.** Attacks, an incoming queue that your
  kills cancel first, four targeting strategies plus tapping an opponent,
  badges from KOs, and a defense bonus when several players aim at you.
  (`docs/MULTIPLAYER_DESIGN.md` §1, §6)
- **One life in battle.** Solo keeps 3. (`docs/MULTIPLAYER_DESIGN.md` §2)
- **Sending must pay.** There is a separate attack gauge that only SEND
  spends, so attacking is worth it. (`docs/MULTIPLAYER_DESIGN.md` §6 "Two
  gauges"; Decision Log 2026-09-30)
- **Attacks arrive only as monsters** and obey the same readability rule.
  (`docs/MULTIPLAYER_DESIGN.md` §6, §9)
- **Bots are real players.** They have their own field, use the same
  inputs and see only what a human sees, and they fill empty seats. Fake
  timer bots were rejected. (`docs/MULTIPLAYER_DESIGN.md` §7)
- **Match size.** 8 players first, then 16, then 99.
  (`docs/MULTIPLAYER_DESIGN.md` §2)
- **Sudden death** ensures every match ends. (`docs/MULTIPLAYER_DESIGN.md`
  §6)
- **On a phone,** the opponents sit in a dock that is never over the
  field, incoming attacks glow on the edges, and the phone vibrates. On a
  desktop, Tetris 99-style tiles sit beside the field.
  (`docs/MULTIPLAYER_DESIGN.md` §6 "What you see of the others"; Decision
  Log 2026-09-30)
- **Online, there is no pause.** (`docs/NETCODE.md` → Decisions, 2026-10-18)
- **Single-player fun comes first,** before any server work.
  (`docs/MULTIPLAYER_DESIGN.md` §2)

## 4. Arcade identity

- **World leaderboards.** Players enter 3–6 initials, and there are boards
  for Endless, for each story stage and for whole runs.
  (`AGENTS.md` → "Global leaderboard & publishing"; Decision Log
  2026-06-02 and 2026-10-18)
- **Mastery ranks** (best combo, kills, fastest solve) give a sense of
  progress without changing difficulty. (Decision Log 2026-05-29)
- **Scoring rewards skill.** Harder sums, faster solves and streaks pay
  more. (Decision Log 2026-05-29)

## 5. Sound

- **One soundtrack across every screen.** Level path songs, boss tracks,
  menu, map, ending and Endless songs, all sharing one main theme.
  (Decision Log 2026-10-20 "New soundtrack"; `docs/MUSIC_PROMPTS.md`)
- **The game must have sound on iPhones**, even with the silent switch on.
  (Decision Log 2026-10-21)
- **Battles stay silent for now.** Music for battles is left open for the
  owner. (Decision Log 2026-10-20)

## 6. Project purpose (not a game goal)

Metic99 is also a learning project. The owner must be able to read and
change any code, and every change is explained. This shapes how the game is
built, not what it should feel like.
Sources: `docs/ENGINEERING.md` intro; `AGENTS.md` working agreement; see
`LEARNING_LOG.md`.

## 7. Recorded as open or undecided

These are things the docs leave open or only planned. They are not agreed
goals.

- **Story panels between levels**, or only themed pages: still open.
  (`docs/SOLO_MODES_DESIGN.md` §9)
- **Other operations** (subtraction, multiplication, division): planned,
  not built. (`AGENTS.md` Roadmap item 9; `docs/SOLO_MODES_DESIGN.md` §3)
- **Special solo monsters** (the Bouncer, the Heart balloon): planned.
  (`docs/SOLO_MODES_DESIGN.md` §5)
- **More abilities** (Hider, Orbiter, Worm), later sendable as attacks:
  planned. (`AGENTS.md` Roadmap 6d; `docs/MULTIPLAYER_DESIGN.md` §4)
- **Battle results screen and fast-forward after a KO**: decided, not
  built. (`docs/MULTIPLAYER_DESIGN.md` §6 and §10 M8)
- **Power balance**: open questions for the owner, such as a BLAST limit,
  SHIELD as the beginner pick, and rookie power use, which is guessed.
  (Decision Log 2026-09-30 and 2026-10-19; `docs/MULTIPLAYER_DESIGN.md` §7)
- **Number-ball ideas** such as monsters made of balls: "not decided".
  (`docs/ART_SPEC.md` §7 "Ideas to iterate on")
- **Per-player handwriting templates**: named as the likely next step, not
  decided. (Decision Log 2026-09-27; `AGENTS.md` Roadmap item 8)
- **Beginner experience**: rookie bot numbers are a guess until a beginner
  playtests. (Decision Log 2026-09-29; commit b452461)
