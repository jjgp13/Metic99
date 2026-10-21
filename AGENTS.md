# AGENTS.md — Metic99

Project context and working agreement for any AI agent (or human) picking up
**Metic99**. Read this first; it is the source of truth for architecture and
design decisions.

> **Self-updating rule (IMPORTANT):** Whenever a **game design or architectural
> decision** is made or changed in a session, you MUST update this file in the
> same change:
> 1. Append a dated entry to the **Decision Log** at the bottom.
> 2. Update any affected section above (Gameplay, Difficulty, Assets, Roadmap…).
> 3. Commit the `AGENTS.md` update alongside the code change.
> Keep entries terse (1–3 lines). This keeps context portable across machines
> and sessions.

> **Working agreement (IMPORTANT): readable code, explained changes.** This is
> a learning project: the owner must be able to read, understand and change
> any code without help. Before writing code, read
> [`docs/ENGINEERING.md`](docs/ENGINEERING.md) (readability rules, layers,
> testing, how a change is made). The patterns the code uses are explained in
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). **Every change ends with an
> explanation** of the pattern used, why, the alternatives that lost, and how
> to change it later (template in ENGINEERING.md §6; Claude: the
> `explain-change` skill). Bigger changes get a note in `docs/learning/`.
>
> **Learning loop:** every change request is also a short tutoring session,
> built on learning research (`docs/learning/HOW_WE_LEARN.md`). Before
> coding, the owner thinks first (how would you do it? which option, how
> sure?), then we reason together, build, walk through, and check with 1–2
> questions; new concepts are added to `docs/learning/CONCEPTS.md`. Claude:
> the `learning-loop` skill. "Just do it" skips the waiting but not the
> explanation. **Spaced review happens in a separate quiz chat** (`/quiz`,
> the `quiz` skill, scheduled Mon/Wed/Fri), the only writer of
> `docs/learning/REVIEWS.md`.

---

## What Metic99 is

A web rewrite of **Metic**, a 2D math-shooter originally built in Unity
(`https://github.com/jjgp13/Metic`). Aliens descend carrying numbered balls; the
player types the **sum** of an alien's balls (on-screen keypad or keyboard) and
the ship slides under the matching alien and auto-fires. Reaching the player
line costs a life; lose all 3 → game over.

The web rewrite was chosen over staying in Unity to get: instant browser load,
mobile reach, native handwriting input, easy WebSocket PvP, and a fast feedback
loop. See the Decision Log.

## Tech stack

- **Phaser 3** — scenes, menus, HUD, keypad, input, audio and the asset loader.
  Its canvas is **transparent** and stacked above the 3D canvas. Arcade physics
  is no longer used (hits are a swept test in `Field.moveBullets`).
- **Doodle view (default art)** — the playfield is pencil doodles on lined
  notebook paper (`src/renderDoodle/`, Rough.js wobble, Patrick Hand font),
  drawn on a 2D canvas under Phaser's. The rules don't know which view draws:
  GameScene talks to a `FieldView` (`scenes/fieldView.ts`) that DoodleWorld
  and World3D both fill from the same snapshot; `?art=3d` picks the 3D view.
  Each ship has its own doodle (`SHIPS` in `recipes.ts`), also shown in the
  menu picker and as the top HUD's life icons (`renderDoodle/shipIcons.ts`;
  `?art=3d` keeps the old life sprite).
  **Ships the story unlocks** (`RENDER3D.SHIPS[].beat`, a look only like
  every ship): FALCON, DART and POD from the start; beating the Great Owl
  (stage 3) unlocks LEAF GLIDER, the Dragon (6) LAVA ROCKET, the Moon (9)
  STAR CRUISER, and finishing the story the kid's own CRAYON ship (drawn
  in crayon: `DoodleRecipe.look`). Unlocks are worked out from the stored
  story progress (`services/shipUnlocks.ts`: `progress.furthest > beat`),
  never saved, so a game over never takes one away. The picker shows a
  locked ship as a dashed "?" with its name and what to beat; finishers
  get a crown + STORY COMPLETE over the menu title and crowns on the map.
  They are doodles only (the 3D view flies a voxel ship for them).
  **Story pages are alive** (owner's playtest note): props with an `fps`
  loop their pre-drawn frames (grass sways, ripples spread, stars twinkle,
  lava cracks glow), and each page has `drifts` (`renderDoodle/drifts.ts`:
  seeds, falling leaves, mist, dust, ash, snow, stardust) that float across
  in screen space, recycled when they leave. Looks only (Math.random), drawn
  over the props and under every alien at `DOODLE.PAGE_DRIFT_ALPHA` (0.4,
  fainter than props), small and slow so the numbers win; nothing drifts
  that could pass for a monster. Cost: drifts 0.01–0.07 ms/frame on the dev
  PC (snow, 15 flakes, is the most), looping props ~0.
- **Three.js** — the older 3D view of the playfield (`src/render3d/`, `?art=3d`). Chosen
  over Babylon.js / Unity WebGL for desktop + phone browsers: small bundle
  (~150 kB gz), fast mobile load, and plain TS that a future Node game server can
  share with the client.
- **Vite** — dev server (HMR) + production bundler.
- **TypeScript** — strict mode.
- **Vitest** — unit tests for Phaser-free logic (`src/**/*.test.ts`, `npm test`).
- Node.js LTS required. `npm install` → `npm run dev` (port 5173) → `npm run build`.
  `npm run bots` plays every bot level headless and prints a report
  (`scripts/bot-report.ts`; `-- --lives 1 --seeds 20 --minutes 5
  --ability splitter`, `--story 1,7` for story stages), including which
  monsters cause the hits and how scarce energy is (first full bar, time
  full, overflow).
  `npm run bots:story -- --stage 4` plays story levels from their start
  (`scripts/story-report.ts`): clears, level/path/boss time, and in which
  stretch of the wave the hits land.
  `npm run playtest -- runs.json` replays saved playtest runs and prints
  them next to the bots (`scripts/playtest-report.ts`). `npm run bots:fit --
  ace 1.15 2.27` fits a bot level to a player's answer times. `npm run match`
  plays whole bot-only battle matches (`scripts/match-report.ts`; `--
  --matches 40 --players 16 --seats ace,pilot,...`): win rate and placement
  per level, match length, KO times, what knocks players out.

## Project layout

```
public/assets/        Game art/audio/fonts (reused verbatim from the Unity repo)
  sprites/  sounds/  fonts/
src/
  main.ts             Phaser.Game config + scene registration
  config/
    constants.ts      Re-exports every tuning file (import constants from here)
    tuning/           Tuning numbers, one file per domain: game, monsters,
                      difficulty, scoring, powers, answer, battle, bots,
                      storage, render3d, doodle, story (LEVELS + bosses)
    palette.ts        Named UI colors (PALETTE.GOLD, .ATTACK…) + css()
    difficulty.ts     Logistic difficulty curve
    ships.ts          Player's ship choice (menu picker, saved in localStorage)
    powers.ts         Player's power choice (menu picker, saved in localStorage)
    themes.ts         Endless themes (a beaten world's page + path song) and
                      the saved pick; never reaches the sim
    inputMode.ts      On-screen input choice: keypad or drawing pad (localStorage)
  scenes/
    BootScene.ts      Preloads assets; defers animations (static frames for now)
    MenuScene.ts      Title screen: ship picker + PLAY / BATTLE / HOW TO PLAY / SCORES
    StoryMapScene.ts  The STORY button: one island per stage, best scores,
                      "?" for stages not reached; PLAY = a run from island 1
    ThemePickerScene.ts The ENDLESS button: pick a theme, then PLAY
    HowToPlayScene.ts Static rules screen reached from the menu
    music.ts          The page's one music player (one song at a time,
                      crossfades, loads on demand); levelMusic.ts = a
                      run's path → boss tracks on top of it
    GameScene.ts      Composition root: builds the run and the HUD parts,
                      maps keypad/keyboard/pad to Field inputs, steps the
                      Field (or the battle Match) at a fixed 60 Hz (SimClock),
                      turns its events into sound and HUD calls, and hands
                      World3D a snapshot every frame.
    runSetup.ts       A run's seed + Field or Match, or a story level
                      (`StoryRun`: level, lives, score, energy) (+ dev URL params)
    shipLaunch.ts     The ship blasting off the top after a level clear:
                      `ShipLaunch` keeps the time, `shipLaunchPose` the
                      squash/stretch/climb; views draw `snapshot.shipLaunch`
    levelMusic.ts     A story level's path + boss tracks
    extraMusic.ts     Optional music: the menu/map theme, the level-clear
                      jingle (a blip fanfare until its file exists)
    NameEntryScene.ts Arcade 5-char initials entry shown at game over
    LeaderboardScene.ts Global top-N board; dual-mode (post-run / menu browse)
    EndingScene.ts    After the last level: a kid's hands color the bosses in
                      crayon, THANK YOU FOR PLAYING, the score; then the
                      credits on a new page (`?ending=1`)
    endingCredits.ts  The credits' lines (pure): author, thank-you, the run
                      told back (time, worlds, score), an unlock line
    HandwritingLabScene.ts `?lab=draw`: records real handwriting, exports JSON
  services/
    masteryStats.ts   Personal bests in localStorage (pure mergeRun + shell)
    storyProgress.ts  Story map progress in localStorage: furthest stage,
                      best per stage, best run (pure mergeLevel + shell)
    shipUnlocks.ts    Which ships the story progress unlocks (pure, derived:
                      isUnlocked, newShips(before, after), storyComplete,
                      unlockHint)
    leaderboard.ts    Supabase global high scores, one board per `level`
                      (Endless, each stage, story runs): startMatch(board) +
                      match-gated submitScore, plus getTop/getRank reads
    playtestLog.ts    Playtest logger: in the claude.ai playtest Artifact,
                      saves each finished run (seed + input log + extras)
                      to the Artifact's `db`; a no-op anywhere else
  handwriting/        Phaser-free digit recognition (unit-tested)
    recognizer.ts     $P point-cloud recognizer + scratch-out detector
    digitTemplates.ts 0–9 templates (~31 variants): line/arc/curve recipes plus
                      paths traced from real phone samples
    inkReader.ts      Strokes → digit groups (sideways overlap) → pause → InkEvent
    testShapes.ts     Test-only digits in other styles + a seeded shaky hand
    samples.ts        Lab sample file format (flat int points per stroke)
    samples/*.json    Real handwriting exported from the lab (test data)
    handwriting.test.ts
    realSamples.test.ts Replays samples/*.json through InkReader, prints a report
  ui/
    theme.ts          textStyle(size, color) / outline(): the one text style
    hud/              In-game HUD components, one job each: TopHud, Popups,
                      AnswerDisplay, Reticle, EnergyHud, SendButton,
                      InputPanel, PauseOverlay, GameOverScreen, Ducker
                      (fades HUD under aliens); positions in layout.ts
    DrawPad.ts        The drawing pad: pointer capture, glowing ink, "?" flash
    pencilButton.ts   A pencil-box button for the paper screens (map, themes)
    keyboard.ts       `onKeyDown`: each key press delivered once (Phaser bug)
    battleViews.ts    `BattleView` seam for the battle UI (M8): views of the
                      other players get `match.tiles()` + match events each
                      frame and act only via `BattleActions` (`aimAt`,
                      `aimBy`); register new views in `createBattleViews`.
                      `PhoneBattleDock`: the phone battle HUD (M8)
    OpponentBoard.ts  Desktop opponent board: DOM tiles beside the canvas
                      (`BATTLE_BOARD`), built on desktops, shown while wide
  sim/
    energy.ts         Phaser-free energy rules: energyForKill, EnergyMeter
                      (charge/spend/drain per spender), Power (the picked
                      power: time / blast / shield effects).
                      Kept pure so a future server sim can share it.
    rng.ts            Seeded random numbers (mulberry32 `Rng`, `derive` for
                      keyed streams, `SpawnStreams` keyed by spawn number).
    Field.ts          One player's whole field, Phaser-free: ship, bullets,
                      typed answer, targeting, score, lives, energy, powers.
                      Changes only via `apply(input)` + `step(dt)`, logs inputs
                      (`inputLog`, `replayField`), emits events (spawned,
                      fired, solved, hit, power, blasted, shielded,
                      knockedOut).
    Swarm.ts          The aliens inside a Field: game clock, seeded spawners,
                      movement + readability guard, AbilityHost. Asks its
                      SpawnDirector what to spawn.
    director.ts       SpawnDirector (strategy): EndlessDirector = today's
                      curve; LevelDirector = a story level's path, wave,
                      roster, creatures and boss.
    waves.ts          A level's wave profile → the stretch and its intensity.
    Match.ts          Battle match: N Fields on one seed stepped together, bots
                      per seat, KOs, placement, standing messages (pressure),
                      targeting, KO credit, badges, attack delivery, and
                      `tiles()`: what every player shows the others (the UI's
                      only source for opponents).
    Bot.ts            Bot player: reads only what's on screen, acts only via
                      `field.apply()`; skill levels in `BOT` (rookie/pilot/ace).
    SimClock.ts       Fixed timestep: real time → whole rule steps + alpha.
    stats.ts          Solve-time summaries.
    golden.test.ts    Golden master: fixed-seed bot runs + a match vs a
                      saved snapshot (refactors must keep it green).
    pace.ts           Answer times by ball count (replayed from an input
                      log): the measure bots are calibrated with.
  objects/
    Alien.ts          Pure alien state (x/y, digits, result, `kind`) + per-kind
                      movement patterns and readability box; no rendering.
                      Built from one `AlienConfig`. Optional `model` +
                      `ability`; `glideTo`/`hold` override the pattern for
                      scripted moves (knockback, splits).
    swamp.ts          Level 4's own rules: peeper/firefly traits, the slime's
                      split, the Mud Monster and its halves.
    abilities.ts      Monster abilities (Blinker, Shielded, Splitter): pure
                      state with update/steer/onHit/onKilled hooks + `AbilityHost`.
    traits.ts, bosses.ts  Story registries: creature traits, boss mechanics.
    mole.ts, owlBoss.ts, caveTroll.ts, …  One file per boss mechanic.
    pondCreatures.ts  Level 2's rules: Hop, Dart, Dive traits + the BigFrog.
    Bullet.ts         Pure bullet state {x, y, active}.
  renderDoodle/        The default view: DoodleWorld (FieldView), recipes.ts
                      (one short stroke recipe per ship/monster/boss),
                      pencil.ts (Rough.js + pre-drawn boil frames), paper.ts,
                      pages.ts (story pages: tinted paper + faint props that
                      scroll and loop), drifts.ts (things floating across a
                      page), shipIcons.ts, storyMap.ts (map islands +
                      trail), ending.ts (the ending's desk, hands, crayons),
                      font.ts
  render3d/
    World3D.ts        Three.js view: camera, lights, starfield, ship/alien/bullet
                      meshes, voxel-debris explosions, shake. Page-wide singleton.
    voxelize.ts       Extrudes a Phaser sprite frame into a voxel mesh (fallback art).
    NumberBall.ts     Glass sphere with the digit inside (number balls);
                      optional eyelids (`setBallCover`) for the Blinker.
    AnswerStars.ts    Background stars that gather into the typed answer
                      (glyphs sampled once at load) and burst when it's solved;
                      a drawn answer's stars start on its ink.
art/                  3D art source (docs/ART_SPEC.md)
  palette/palette.json  Shared color swatches for all models
  blender/            metic_kit.py helpers, build.py, recipes/<model>.py
  previews/           Rendered top-down + 3/4 previews per model
public/assets/models/ Built .glb models loaded by World3D
public/assets/icons/  Transparent top-down model renders for 2D menus (build output)
docs/ENGINEERING.md   How code is written, verified and explained (read first)
docs/ARCHITECTURE.md  Guided tour of the design patterns used, and why
docs/learning/        The owner's learning: HOW_WE_LEARN.md (the science),
                      CONCEPTS.md (catalog; feature chats add rows),
                      REVIEWS.md (review dates; quiz chat only), notes
.claude/skills/learning-loop/   Every change as a tutoring session (Claude)
.claude/skills/quiz/            /quiz: spaced-repetition review (quiz chat)
.claude/skills/explain-change/  How Claude explains every change
docs/ART_SPEC.md      3D art style, budgets, axes, pipeline
docs/MULTIPLAYER_DESIGN.md  Battle-royale design: energy, attacks, backend plan
docs/SOLO_MODES_DESIGN.md   Story mode plan: 10 scrolling levels + bosses, Endless
  env.d.ts            Types for Vite `import.meta.env` (Supabase env vars)
```

### Global leaderboard & publishing

- **Backend: Supabase** (hosted Postgres). Reads use `supabase-js` with the
  **anon public key** (public by design — top scores/rank are world-readable).
  No server to host.
- `scores(id, name varchar(6), score int 0..1_000_000, level smallint,
  created_at)`; RLS allows anon `SELECT` of all rows. `name` is
  `^[A-Z0-9]{3,6}$` (the player picks 3–6 initials at game over). **`level`
  is the board** (`supabase/story-boards.sql`): 0 = Endless, 1–10 = story
  stage N (points scored in that stage), 99 = a whole story run
  (`LEADERBOARD.*_BOARD`). `get_rank(s, p_level)` RPC = `count(*)+1 WHERE
  level = p_level AND score > s` (competition ranking; ties share a rank).
- **Score writes are server-gated (no anon INSERT).** Direct anon `INSERT` into
  `scores` is revoked, so a forged REST insert with the public key can't write a
  score. Two `SECURITY DEFINER` functions (anon-executable via RPC) are the only
  write path — schema in `supabase/match-gate.sql`:
  - `start_match(p_level)` → issues a single-use, server-timestamped `matches`
    row id for one board; called by `GameScene` (via `startMatch(board)`) when
    a run begins. A story run opens one for the run board and one per stage
    as each starts.
  - `submit_run(p_match, p_name, p_score, p_level)` → in ONE transaction:
    atomically consumes the match (rejects missing/used, another board's
    ticket, age <2s or >4h), plausibility-checks the score against elapsed
    time (cap `≈ elapsed·3000 + 5000`, far above real play) and the board's
    cap (a stage ≤ 300k; an ace scores ~40k on stage 1), inserts the score,
    and returns `{row_id, rank}`. A rejected/failed submit rolls back, so a
    legit match is never burned. `p_level` defaults to 0 (Endless), so the
    old call shapes still work.
  - **Migration order:** run `story-boards.sql` (after `match-gate.sql`)
    before deploying a build with the story map (it reads `scores.level`).
  - `matches` has RLS on with NO policies (only the definer functions touch it).
  - **Honest limit:** this blocks devtools/REST forgery and bots that skip the
    flow, but — like any client-scored game — can't stop a scripted
    "start → wait → submit a plausible score". Per-IP rate limiting is not yet
    implemented (RPC has no easy IP access).
- Credentials come from Vite env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (baked in at build, public by design). `isLeaderboardEnabled()` is true only
  when both are present, so the game **builds and runs locally without them** —
  game over just returns to the menu instead of routing to name entry.
- **Navigation:** `BootScene` → `MenuScene` (ship picker ◀ ▶ / ←→, then STORY /
  ENDLESS / BATTLE (beta) / HOW TO PLAY / SCORES). STORY → `StoryMapScene`
  (islands; tap a reached island = that stage's board, RUN SCORES = the run
  board, both `LeaderboardScene` browse with BACK → map; PLAY / Enter →
  `GameScene` with `{ story: { level: 0, lives, score, levelScores: [] } }`);
  ENDLESS (and
  Enter) → `ThemePickerScene` (pick a theme; PLAY / Enter → `GameScene`, BACK /
  Esc → menu); BATTLE → `GameScene` with `{ battle: true }` (no leaderboard); HOW TO PLAY → `HowToPlayScene`; SCORES → `LeaderboardScene` in
  **browse** mode (fetches `getTop()` itself, BACK → menu).
- Game-over flow (when enabled): GAME OVER overlay → `NameEntryScene` (3–6 char
  length selector + initials) → `submitScore` (via the match gate) →
  `LeaderboardScene` (post-run mode, shows world rank) → `MenuScene`. All restart
  triggers route through one idempotent `GameScene.leaveGameOver()`; when the
  leaderboard is disabled it goes straight to `MenuScene`. A story run ends
  (game over, or the last level cleared, which shows `EndingScene` first) the same way, but names are
  entered once and submitted to several boards (the run's total, shown
  after, then each stage played, ranks in one line), and it goes back to
  the story map.
- **Hosting: GitHub Pages** via `.github/workflows/deploy.yml` (build on push to
  `main`, deploy `dist`). Supabase env injected from repo **secrets**. Vite
  `base: "./"` keeps asset paths relative so the project subpath works.
- **Mobile:** Phaser `Scale.FIT` (portrait) centered by `#game`'s flexbox
  (Phaser's own `autoCenter` is off: both together pushed the canvas off
  center), pointer-based keypad,
  and `index.html` hardening (`viewport-fit=cover` + safe-area insets,
  `touch-action:none`, `overscroll-behavior:none`, no text selection).


### How assets are imported

Art lives in `public/`, which Vite serves verbatim at the site root, so it is
referenced by **URL string** (`assets/sprites/...`) in `BootScene.preload()` —
no JS `import`. Spritesheets are sliced by frame size. **Verified layouts**
(important — these were wrong initially):

| Asset                    | Frame size | Frames | Notes                              |
| ------------------------ | ---------- | ------ | ---------------------------------- |
| `Alien1-9.png`           | 16×16      | 2      | idle animation (use frame 0 now)   |
| `Alien10-13.png`         | 32×20      | 2 (vertical) | idle animation (frame 0 now)  |
| `SpaceShip.png`          | 16×16      | 4 (2×2 grid) | use frame 0                  |
| `bullet.png`             | 16×32      | 2      | use frame 0                        |
| `BlueBalls.png` (+Red/Green/Yellow) | 16×16 | 16-cell grid | **number N = frame N-1** |
| `SpaceShipLifeIcon.png`  | 16×16      | 1      | HUD life icon                      |
| `star.png`               | 16×16      | 1      | starfield particle                 |

Ball **color encodes the math operation** (future): Blue=sum, Red=subtraction,
Green=multiplication, Yellow=division.

### 3D rendering (Three.js)

- **Two stacked canvases:** Three.js draws the playfield on a `position: fixed`
  canvas that `World3D` keeps exactly under Phaser's (it copies Phaser's
  bounding rect each frame, so `Scale.FIT` letterboxing still works). Phaser's
  canvas is transparent (`transparent: true`) and on top (`#game > canvas`
  z-index 1), so HUD, keypad and input are unchanged.
- **Same 2D coordinates:** game logic stays in the 480×720 logical space. A
  perspective camera (`RENDER3D.FOV` 30°) sits at the distance where the z = 0
  plane maps 1:1 onto the Phaser canvas, so HUD elements anchored to world
  positions (score pops) still line up.
- **Voxel models from the existing sprites:** `voxelizeFrame` reads a frame's
  pixels from Phaser's texture manager and extrudes every opaque pixel into a
  lit box (only exposed faces). Geometries are cached per (key, frame, depth)
  and shared. Number balls never rotate, so digits stay readable.
- **Renderer is a view:** `World3D.render(snapshot)` diffs the snapshot's
  aliens/bullets against its meshes (create/move/remove). Game code never
  imports Three.js, which keeps the path open to a shared sim for multiplayer.
- **Fixed timestep + interpolation:** the rules run in fixed `SIM.STEP_MS`
  (60 Hz) steps from an accumulator (at most `MAX_STEPS_PER_FRAME` per frame);
  aliens, bullets and the ship keep their previous-step position and the
  renderer draws `alpha` of the way between the two, so motion stays smooth
  when a frame runs zero or two steps.
- **Motion polish:** aliens sway (yaw) and bank into sideways moves, the ship
  banks toward its target, the strafer shakes before it dives,
  explosions burst into voxel debris in the alien's colors with a flash from one
  reused point light (adding lights at runtime would trigger shader recompiles).
- **Models in play:** the player flies the ship picked on the menu (a look
  only; the power is a separate pick)
  (`RENDER3D.SHIPS`: FALCON `ship_player`, DART `ship_dart`, POD `ship_pod`; the
  pick is stored under `STORAGE.SHIP`). Each alien draws the model of its
  `kind` (`MONSTERS[kind].MODEL`: darter / lumberer / strafer / swooper /
  drifter), with
  its balls at the model's `socket_balls`. The kind lives in the `Alien` state
  (game logic picks it); `World3D` only draws it. Explosion debris uses the
  model's colors (`RENDER3D.ALIEN_MODELS`). The models' `anim_*` parts move
  with simple sine motion (`RENDER3D.ANIM`): darter tail wags, lumberer legs
  swing in step with its stomp (body lifts while stepping), drifter skirt spins
  and pulses, strafer and swooper wings flap (strafer: faster in windup/dive),
  swooper tail wags.
  **Ability aliens** set `Alien.model` and wear their ability's model
  (`ABILITY.MODEL`, debris in `RENDER3D.ABILITY_MODELS`) while moving as their
  `kind`; the renderer mirrors ability state (ball lids, the Blinker's
  `anim_lid`, the Shielded's `anim_emitter` and shield bubble + shatter, the
  splitters' pulsing `anim_nucleus_*`, a pop when the sum changes).
- One WebGL context for the whole page (singleton), hidden outside GameScene.
- Dev only: `window.__metic = { game, world }` for console inspection.
- **Art direction for new 3D models:** see [`docs/ART_SPEC.md`](docs/ART_SPEC.md)
  (script-built low-poly models from Blender, palette colors, reserved ball colors).

## Gameplay rules (current)

- Each alien carries **≥ 2 number balls** (a sum needs two numbers); `result` =
  sum of the balls. `enemiesInField: Map<result, Alien>` keeps results unique so
  a typed number maps to exactly one target.
- **Monster kinds** (`MONSTERS` in constants, movement in `Alien.advance`).
  3+ ball sums are always lumberers; 2-ball sums pick darter/strafer/swooper
  by `ENEMY.TWO_BALL_KINDS` weight (40/30/30):
  - **Darter** (2 balls): fast zig-zag dive (×1.25 speed, ±26 px around its lane).
  - **Lumberer** (3 balls): slow stop-and-go stomp: moves half of each
    `STOMP_MS` cycle and stands still for the other half (same ×0.85 average).
  - **Strafer** (2 balls, Galaga-style): flies into a band at the top, patrols
    sideways for `DIFFICULTY.STRAFER_PATROL_MS` (5 s → 2.8 s, time to read its
    sum), hovers and shakes for `WINDUP_MS` (telegraph), then dives fast.
  - **Swooper** (2 balls): flies in level from the left or right edge through
    a band below the top HUD (`BAND_Y` 100–160), brakes into a random lane,
    then glides straight down at ×0.9 speed (it skips the top of the field,
    so it descends a little slower). Its spawn needs the whole flight path
    clear (`Swarm.placeSwooper`); a flight held up once it is fully on screen
    turns down where it is. Bots read an alien only once its center is on
    screen sideways.
  - **Drifter** (2 balls, bonus): crosses sideways through a mid band and
    leaves; **non-lethal**. Solving it gives `ENERGY_BURST` energy (plus normal
    score). It runs on its own spawn clock (first after 15 s, then every
    18–28 s, one at a time) and does **not** count toward any spawn cap. Stray
    bullets fly through it (it must be solved, not hit by accident).
- **Drifter energy:** a solved drifter charges its `ENERGY_BURST` (16) on top
  of the normal kill energy (one `charge()` call, capped by the meter) and
  pops "+N ENERGY" where it died.
- **Scoring** rewards skill (`SCORE` in constants):
  `BASE × ballCountBonus × speedBonus × difficultyMult × comboMult`, where speed
  bonus decays from solving fast→slow, difficulty = `1 + d`, and the combo
  multiplier grows with an unbroken kill streak (a hit resets it).
- **Mastery stats** persist in `localStorage` (`STORAGE.*`): high score, best
  combo, total kills, fastest solve; a rank (`RANKS`) is shown on game over.
- **Readability rule** (docs/MULTIPLAYER_DESIGN.md §3): ball rows must never
  overlap by accident. Each alien owns a **box** around its ball row and body
  (`MONSTERS[kind]` `HALF_W` / `BALLS_Y` / `BOTTOM`, widened for 3 balls).
  Two layers keep boxes apart:
  1. **Spawner:** a new alien enters just above the top only where its whole
     horizontal **sweep** (zig-zag width, patrol span, a swooper's remaining
     flight in) clears the sweep of every alien still above
     `ENEMY.ENTRY_ZONE_Y`, and its box clears everyone. A swooper enters from
     a side only if its flight path is clear of every alien in it or above
     it (anything that could come down into it). No room → the spawn retries
     in `SPAWN_RETRY_MS`.
  2. **Runtime guard** (`Swarm.advanceReadable`): a move that would bring
     two boxes within `ENEMY.READ_GAP` is not made. It is retried one axis at a
     time; the refused axis holds still, and a refused sideways move turns
     zig-zags/patrols around (the drifter waits). Aliens queue behind each
     other instead of overlapping.
- Ship is input-driven only: it lerps horizontally to the targeted alien's x and
  auto-fires when lined up (`PLAYER.SHOOT_RANGE`, `FIRE_COOLDOWN`). The **active
  target STOPS** while locked: once its answer is typed it holds position (it
  does not advance and cannot cost a life), so a correct answer is never punished
  by the ship's travel time. The target stays **locked (`lockedTarget`) until a
  bullet destroys it** — independent of the typed string — so a committed kill
  stays committed. If a held target is at/below the muzzle the shot resolves
  point-blank.
- **Spawn pacing's primary gate is the count of UNSOLVED aliens.** The player
  starts facing **one unsolved sum at a time** (`DIFFICULTY.MAX_UNSOLVED` 1→3);
  the cap opens up only as they **score points** (it is driven by `dScore`
  alone, see Difficulty design). Already-answered (locked) aliens don't count. A
  secondary weighted threat budget (`ENEMY.THREAT_BY_BALLS`:
  2-ball=1, 3-ball=2, 4-ball=3 vs `threatBudget` 3→8) and the absolute
  `maxOnScreen` cap (4→8) are safety nets; spawns recheck every
  `ENEMY.SPAWN_RETRY_MS` (350ms) so deferred spawns don't pile up and burst.
- **Concurrent "hard" enemies are capped.** Aliens with
  `≥ ENEMY.HARD_BALL_THRESHOLD` (3) balls are slow multi-number sums; only one
  may be on screen until late game (`DIFFICULTY.SECOND_HARD_AT` = d≥0.85, then
  two), so the player never juggles two multi-number sums at once. When the cap
  is hit the spawn is forced to an easy 2-ball enemy.
- Input: on-screen keypad **or** drawing pad, **and** physical keyboard (0–9,
  Backspace, Esc, Space or F = POWER, P = pause). Max 2 typed digits.
  The **DRAW / KEYPAD** switch right of the answer display picks the on-screen
  one (saved under `STORAGE.INPUT_MODE`); the keyboard works in both.
- **Handwriting input** (`HANDWRITING`, `src/handwriting/`, `ui/DrawPad.ts`):
  the pad replaces the keypad in the same box (never over the field) and has a
  C button left of the answer display. Two touch pointers are active, so a
  thumb can hit POWER while the other finger draws (only the first
  finger draws).
  - Recognizer: **$P point cloud** against ~25 hand-built digit templates
    (1 with/without flag or base, open/closed 4, 7 with/without bar, …). $P
    ignores stroke order and direction by design, so a 0 drawn either way or a
    4 drawn stem-first match the same template. Cloud distance above
    `MAX_DISTANCE` → **"?"** (red ink + "?" in the pad, nothing entered).
  - **Digits:** a finished stroke joins the current digit if it overlaps it
    sideways, or starts the next digit if it lies to its right (overlap <
    `NEW_DIGIT_OVERLAP` of the narrower one). After `PAUSE_MS` (300) with the
    pen up, all digits are read left to right and entered **together** through
    `handleInput`, so "12" never passes through "1" (which could match another
    alien and fire). Pausing between digits also works (each appends). A drawn
    answer that no longer fits after the typed digits starts a fresh answer.
  - **Scratch-out** (one wide stroke turning back sideways ≥ 2 times) = C.
    Taps smaller than `MIN_INK_PX` are ignored. Pause/game over drop the ink.
  - **Feedback:** the ink glows while drawing; on a read it fades and the
    answer stars for each drawn digit start ON the ink and fly into the clean
    digit, so the player sees what was read. Everything after that (gold/red,
    brackets, solved sum, wrong auto-clear) is the normal answer feedback.
  - Measured on distorted test digits: ~96% per digit, ~94% for 2-digit reads;
    the known lookalikes are flat-top 3 ↔ 5 and short-bar 7 ↔ flagged 1.
    On the owner's phone it did worse (e.g. 4 read as 9), so real samples are
    the measure now:
  - **Handwriting lab** (`?lab=draw`, not linked in game; Boot opens it instead
    of the menu): asks for each digit 3× in random order plus six 2-digit
    numbers (`HANDWRITING_LAB`) on the game's pad (same size/place,
    `KEYPAD_AREA`), shows the read and the 3 closest digits with distances,
    keeps progress in localStorage (UNDO / SKIP), and exports JSON (copy /
    share) to save as `src/handwriting/samples/<name>.json`, which
    `realSamples.test.ts` replays (≥ 90% must read right).
  - First real session (`samples/owner-phone-1.json`): 25/36 → **33/36** after
    adding traced templates for the owner's style (one-stroke 4 with a bowl or
    flat bar, 3 with a middle cusp, 2 with a bottom loop, big-loop 6, wide 7).
    Some templates were traced from these same samples, so a fresh session is
    the honest check. Second session (`owner-phone-2.json`): **31/36 live**
    (the honest number); a stem drawn separately at a digit's right edge now
    joins it (`TOUCH_PX`), plus long-flag 1 and flat-loop 9 → 66/72 over both.
    Cross-session test: using the player's OWN drawings from the other session
    as templates reads 34–35/36 on unseen drawings (vs 31/36 built-in only).
- **Answer feedback** (`FEEDBACK`, `RENDER3D.ANSWER_STARS`): the typed number
  is white while typing, **gold** (with a pop and a confirm blip) when it
  matches an alien, and **red** (shake) as soon as no alien's answer can start
  with it; a wrong answer clears itself after `WRONG_CLEAR_MS`. The matched
  alien gets gold **lock-on brackets** around its box, and the number flies up
  to it. The answer stays shown (display + stars) until its alien dies, even
  after firing. Background **answer stars** (a separate pool at z = -500,
  drifting as normal stars when idle) gather into the answer's digits in the
  same colors; they burst gold when it's solved and scatter red when it was
  wrong. Every kill (and a shield break) pops the solved sum, e.g.
  `7 + 5 = 12`, above the alien. Pause hides all of it.
- **Energy** (`ENERGY`, `src/sim/energy.ts`): each kill has a value
  `BASE × ballBonus × digitBonus × speedBonus × comboBonus` (more balls, bigger
  average digit, faster solve, longer streak = more; ~8 for an easy early kill,
  ~20 for a strong player's kill on a streak). The 0–100 power meter gets
  **`POWER_RATE` (0.4) of it**: ~3 for an easy kill, ~8 on a streak, so
  ~12 strong kills fill the bar (scarce, worth saving). Overflow is lost. The
  meter only charges and spends; each use is a separate spender (one per
  power). Per-run earned/spent totals show on game over. In a battle the
  kill's full value goes to cancelling and the separate **attack gauge**
  (below), which SEND spends, never this meter. **Story: energy carries
  over** from level to level like lives and score (`StoryRun.energy`, saved
  with the run); an armed shield goes back into the bar as its cost.
- **Powers** (`POWERS`, `Power` in `src/sim/energy.ts`): the ship is only a
  look; the player picks ONE power on the menu (`STORAGE.POWER`), fixed for
  the run. One POWER input (`{ type: "power" }`) uses it. The set is data: each
  entry has an `EFFECT` (`time` / `blast` / `shield`) plus its numbers, and
  bots play any power by its effect.
  - **FREEZE** (time): field stopped, drains 15/s. The panic button.
  - **SLOW** (time): field at 45%, drains 6/s, so a bar lasts ~17 s. About
    1.4× FREEZE's alien movement saved per energy, but aliens still creep.
  - **BLAST**: 40 energy, destroys every alien on the field. No score, no
    energy, streak untouched, splitters don't split.
  - **SHIELD**: 33 energy to arm (one at a time); the next alien that reaches
    the ship is destroyed instead of costing a life (no hit freeze, streak kept).
    A gold bubble shows around the ship while armed.
  Time powers are toggles needing 10 energy to start; they turn off when empty
  and **hold** (no drain) while the hit-recovery freeze already stops the
  field; the field is tinted in the power's color while one runs.
  **Powers never pay for themselves:** kills made while a time power runs
  charge no energy (they still score and extend the streak) and, in a
  battle, cancel no incoming attacks; aliens destroyed by BLAST or SHIELD
  charge nothing.
  **Balance target:** ace bots (≈ the owner) survive within ~±10% with any
  power in Endless (12 seeds: FREEZE 185, SLOW 190, BLAST 197, SHIELD 171 s;
  no power 120 s), and win about a fair share in an ace mirror battle
  (`npm run match -- --powers freeze,slow,blast,shield --seats ace,ace,ace,ace,ace,ace,ace,ace`).
- **Energy HUD**: the POWER button (named after the picked power) sits in
  both gutters beside the keypad, one per thumb (in a battle the left one is
  SEND); it lights while running/armed and dims when unaffordable.
  The meter is a **small vertical bar in the top-right corner** (`METER` in
  `ui/hud/layout.ts`, 14 × 60 px), under the lives and the progress bar: it
  fills from the bottom, a gold mark shows the power's cost, and the value
  sits over the power's name to its left. Like the rest of the top HUD it
  ducks under aliens; a kill's "+N" pops under the bar. Under the keypad it
  went unseen; as a long horizontal bar it read like a second progress bar.
  **Ready cues** (`POWER_CUE`, `ui/hud/powerCue.ts`, looks only): when
  energy crosses the power's cost, the bar flashes in gold, a READY tag
  pops in under the name, both POWER buttons flash gold, and a two-note
  chime plays (not when a time power is switched off with energy left).
  While ready, the bar's gold glow and the buttons' gold fill breathe; at
  100 the tag says FULL and a light band runs up the bar (new energy is
  wasted). Ready with a lethal, unanswered alien within 200 px of the ship
  = a faster, stronger pulse (the nudge). EnergyHud works all of this out
  from the field each frame (last frame's cue vs this one); Field has no
  event for it, so bots, replays and the golden master don't change.
- HUD (score, lives, difficulty bar, typed display) draws above gameplay
  (`depth 5`), so entering aliens never obscure it. **The numbers win over
  the HUD:** every top-HUD piece, ability banner and score/equation/energy
  pop sits in its own container that fades to `FEEDBACK.DUCK.ALPHA` while
  any alien's box is under it (`ui/hud/Ducker`); its own alpha (a lost
  life, a pop's fade) multiplies on top.
- High score persisted in `localStorage` (`metic-highscore`).
- **Seeded runs + game clock** (`src/sim/rng.ts`): each run has a seed; the
  rules draw every random number from seeded streams (field, lethal spawns,
  drifters), so the same seed and inputs roll the same aliens. Rule timings
  (solve time, fire cooldown) read the game clock `elapsedMs`, which stops
  while paused. Dev: the seed is logged; `?seed=123` replays it.
- **Inputs, not state:** the field changes only through `FieldInput`s
  (digits, back, clear, power) and fixed steps. Every input is logged with
  its step (`field.inputLog`), so `replayField(seed, log)` rebuilds the exact
  run. Dev console: `__metic.game.scene.getScene("GameScene").field.inputLog`.
- **Bots** (`src/sim/Bot.ts`, `BOT`): notice (reaction) → think (base + per
  addition, i.e. balls − 1, + per carry, log-normal spread) → type the whole
  answer at once; slips (off by 1/10) at `ERROR_RATE`, noticed and cleared
  after `NOTICE_WRONG`. They go for the most dangerous readable alien (chance
  `FOCUS`), can't read shut Blinker lids, read the next sum while the ship
  lines up its shot, and drop a sum mid-thought when a clearly worse threat
  appears. Calibrated on the owner's runs by **answer time** (`sim/pace.ts`:
  readable or previous answer → matching answer): owner 1.15 s (2 balls) /
  2.27 s (3 balls); ace ≈ owner, pilot ≈ 1.5× slower, rookie a guess.
  **Powers (M4)**, by the power's effect: a **time** power (FREEZE, SLOW)
  goes on when ≥ `FREEZE_MIN_OPEN` (2) unanswered aliens are on screen and
  the nearest is within `FREEZE_AT_PX` of the ship (or one is within
  `PANIC_PX`), and off once the board is clear — the owner's own FREEZE
  pattern; each dangerous moment goes unnoticed with chance `MISS_DANGER`
  (humans got hit with energy to spare). **BLAST** fires in the same
  dangerous moment (the owner blasts at 2–4 unanswered aliens, nearest
  ~100–300 px away), with the same REACTION and MISS_DANGER; **SHIELD** is
  armed as soon as it's affordable. `bot.powerStyle = "sharp"` (`--sharp` in
  `npm run bots` / `npm run match`) is flawless power use instead (no missed
  moments, BLAST saved until 2+ aliens pass y 340 or one passes 385): a
  power's ceiling. `npm run bots` compares every power plus a no-power
  baseline (`--power`, `--level`); `npm run match -- --powers
  freeze,slow,blast,shield` gives the seats those powers in turn (`wins/seat`,
  fair share = 100 / players). **SEND (M6):** in a battle, a
  bot taps SEND once its attack gauge reaches `SEND_AT` (rookie 100, pilot
  75, ace 60; the moment barely matters, see log) while the board is calm (no time power on, nothing within
  `FREEZE_AT_PX`), after REACTION. Bots in a match play FREEZE unless
  `MatchOptions.powers` gives a seat another power.
  Seeded per seat (`Bot.forSeat`). Dev: `?bot=ace` puts a
  bot on autopilot on your field; at game over the console prints your (or
  the bot's) solve times by ball count to compare with `npm run bots`.
  The GAME OVER screen also shows the run's survival time and median solve
  time per ball count, so a phone playtest can be compared with the bots.
- **Playtest logging** (`src/services/playtestLog.ts`): the owner playtests a
  build published as a private claude.ai Artifact with the `db` capability
  (`npm run playtest:build`, then publish `dist/playtest.html` with the
  `dist/` files except `.glb`/`.map`). The Artifact host can't serve `.glb`,
  so that build (`--mode playtest`, `.env.playtest`) loads each model as
  `assets/models/<name>.json` = `{ glb: base64 }`. Each finished run is saved as one `runs` document: build
  commit, device, seed + picked power + compact input log + steps (replayable exactly),
  summary, solves, hits, input sources (keypad/keyboard/pad), pad reads vs
  "?", pauses. GAME OVER shows "run saved for analysis". Claude reads the
  runs (ArtifactData) and `npm run playtest -- runs.json` replays them.
  **Public run log:** outside the Artifact (GitHub Pages, any player) the
  same record goes to Supabase `run_logs` through the write-only RPC
  `log_run` (`supabase/run-logs.sql`; shape and size checked, a global flood
  guard, RLS with no policies, so the API can't read it). No user agent,
  name or IP: only screen size and touch. Story levels log one record per
  attempt (cleared or not). The menu footer says runs are saved
  anonymously. Claude reads them with SQL (Supabase MCP) and replays them
  with `npm run playtest`.
- **Keyboard:** raw key listeners use `onKeyDown` (`src/ui/keyboard.ts`).
  Phaser 3.90 re-delivers earlier keys when several arrive in one frame
  ("12" → "112", a power toggled twice); the helper drops repeats.
- **Pause** (`P` key or on-screen `II` button): freezes the field, difficulty
  timer, spawning and firing, and **hides all aliens + their number balls** (and
  the typed display) behind an overlay so the player can't solve sums on a break.
  Tap the overlay or press `P` to resume.
- **Monster abilities** (`objects/abilities.ts`, tunables `ABILITY`,
  `BLINKER`, `SHIELD`, `SPLITTER`). An ability is a special rule layered on
  top of the movement `kind`, built from three hooks: `update(delta)`
  (state the renderer reads, e.g. `cover` = how hidden the balls are),
  `onHit` (return true to absorb the shot) and `onKilled`. Field-wide effects
  go through `AbilityHost` (GameScene: `rerollSum`, `spawnSplitling`), so new
  abilities (Hider, Orbiter, Worm) reuse the hooks. An ability alien wears its
  ability's model (readability box from `MODEL_BOXES`) and moves as
  `ABILITY.KIND` at `ABILITY.SPEED`: **the harder to kill, the slower it
  moves and the longer its pattern takes to reach the player.** Built so far:
  - **Shielded** (moves as a lumberer, 70% speed): a magenta shield ring
    around the body. The first correct answer breaks it (scores, charges
    energy and extends the streak like a kill), rolls a new unique sum, and
    knocks the alien back and holds it while the new balls pop in. The second
    answer kills it.
  - **Blinker** (moves as a strafer, patrols 1.5× longer, dives at 60%): its
    balls have eyelids that close on a fixed rhythm (first open 3.2s, then
    open 2.4s → flutter 0.6s → shut 1.1s). The flutter is the telegraph, and
    the body's own eye closes in sync. The answer never changes, so it can be
    typed from memory. Blinking runs on real time: SLOW/FREEZE and the
    post-hit freeze stop movement, not the blinking.
  - **Splitter** (moves as a darter, 70% speed): when killed it pops into two
    2-ball splitlings (darters wearing `alien_splitling`) that glide out to
    either side (never closer to the player than `SPLITTER.MAX_CHILD_Y`). A
    splitling whose start or landing box would break the readability rule is
    not spawned; they start halfway out so their balls never overlap.
    Splitlings keep the parent's pace (`CHILD_SPEED` 0.7), hold still for
    `HATCH_MS` after landing so both sums can be read, and the second lands
    `STAGGER_PX` higher so the pair doesn't reach the player together.
  - **Solo ramp:** abilities unlock by difficulty (Shielded d≥0.25, Blinker
    0.4, Splitter 0.55). A spawn gets one with `abilityChance` (20%→40%), with
    at most 1 ability alien on screen (2 from d≥0.8). Ability aliens always
    carry 2 balls, add +1 threat, and pay a kill multiplier
    (`ABILITY.SCORE_MULT`). The first sighting per run shows a one-line intro
    banner.
  - **Play-testing (dev only):** `?ability=blinker,shielded,splitter` makes
    every allowed spawn one of the listed abilities, ignoring unlocks.
- **Story mode** (`config/tuning/story.ts`, docs/SOLO_MODES_DESIGN.md):
  levels are data (`LEVELS`: page, seed, path length, difficulty range,
  roster, drifters, boss). Swarm asks a `SpawnDirector` (`sim/director.ts`)
  what to spawn: `LevelDirector` lerps d from `D.FROM` to `D.TO` along the
  path (speed, sum size). The path runs on **field time** (freezes and SLOW
  hold it) but never slower than `STORY.PATH_MIN_PACE` (0.8) of the game
  clock, so a level lasts about **2 minutes, boss included** however it is
  played (path ~65–88 s). **Waves** (`LevelDef.WAVES`, `sim/waves.ts`):
  **escalating** pushes with rests back to the same base. The shape is a
  profile of rest / spike / ramp / burst stretches (shares of the path), a
  push carrying its own `HEIGHT` 0..1; every level uses `OWNER_WAVE`
  (in bars of level 1's song: rest 4, spike .35 ×4, rest 4, spike .7 ×8,
  rest 4, ramp to 1 ×8, burst ×8, rest 4; `npm run waves` prints each
  level's timeline in seconds, for its music). The intensity sets the unsolved cap (the
  level's `BASE` at rest → its `PEAK` in a burst) and the spawn interval
  (×1.5 → ×0.55, `WAVES`). The scale grows by level (BASE/PEAK: L1–2
  1/2, L3–6 1/3, L7–9 1/4, L10 2/4) on top of the D range, so a level's
  peaks are bigger than the last level's. The per-level
  path lengths and bot numbers below are from when each level was built,
  before the 2-minute change (docs/SOLO_MODES_DESIGN.md §2). At the end
  of the path no spawns come until the board is clear, then the **boss**
  comes in; while it's up, one minion at a time (`BOSS_PHASE_UNSOLVED`).
  The boss (`Boss` ability) takes `HP` answers: each but the last rolls a
  new sum and burrows to the other side and up (numbers hidden while it
  digs), then holds still to be read; reaching the ship costs a life and
  sends it back up; BLAST doesn't touch it. **Every boss has one signature
  trick** on top (owner: that's what makes a boss memorable; table in
  docs/SOLO_MODES_DESIGN.md §4): it changes how the fight feels, never its
  HP, with numbers readable when they count and a telegraph before danger.
  The first time a boss (or a boss part: halves, raindrops, the monster
  out from under the bed) comes in, one line under its banner names the
  trick and what to do (`BossDef.INTRO`, e.g. "WHO? · answer the missing
  number"); banners stack by their real heights.
  The last answer clears the
  level (`levelCleared`, the clear sequence below, then the next level
  with the same lives, score and energy). Game over = back to the story map (every run starts at
  level 1). The top bar shows the path's progress; the page scrolls
  (`DOODLE.PAGE_*`).
  **Story map** (`StoryMapScene`, `STORY_MAP`, owner's design): 10 islands
  (`STORY.STAGES`) up a notebook page joined by a pencil trail. A stage is
  reached once the previous boss is beaten (`services/storyProgress.ts`,
  `STORAGE.STORY`). The ship sits on the island of the run in progress
  (`runStage`: the saved run's level, island 1 when there is none, so after
  a game over); islands this run has reached are shaded in color with a
  sketch of their world, islands reached only in an earlier run are the same
  sketch in gray pencil until this run gets there again (`islandView`), and
  the rest are a dashed "?". Every reached island shows its best score (a
  flag = its boss ever beaten); the trail is solid up to the run's island and
  is rubbed out around every label, so it never crosses a name or a score
  (`STORY_MAP.LABEL_CLEAR_PX`). Built levels come from LEVELS; a
  reached stage that isn't built yet says "coming soon". Islands are not
  entry points: PLAY always starts at island 1 (no practice mode).
  **Ship unlocks on the map:** a clear that unlocks a ship hands its model
  to the map (`{ travelTo, newShips }`, from `newShips(before, after)` in
  `GameScene.clearLevel`); a NEW SHIP card (FLY IT picks it, LATER) comes
  before the ship flies on. Once the story is finished a gold crown sits
  over island 10 and beside the title. Every start of the map passes data
  (`{}` at least), so Phaser can't hand it a stale flight or card.
  **Creatures** (`LevelDef.SPECIES`): a level turns monster kinds into its
  own creatures with a ball layout (`BALL_LAYOUTS`: eyes, chain, wings; it
  sets the readability box), a trait (`objects/traits.ts`), an optional
  march (lines in step) and an intro line. Bosses fight by a mechanic
  (`objects/bosses.ts`). One file per level: `config/levels/<page>.ts`
  (rules) + `renderDoodle/levels/<page>.ts` (looks), each listed in its
  folder's index (docs/SOLO_MODES_DESIGN.md "Adding a level").
  **Flow:** STORY opens the map (CONTINUE a saved run, or a new run from
  island 1). **After a boss** (`GameScene.clearLevel`, timings in
  `LEVEL_CLEAR`, owner's order): the minions left pop one by one, the ship
  squashes, then blasts off the top on a flame and pencil speed lines
  ("zoom!", `scenes/shipLaunch.ts`) while the boss track fades and the
  victory jingle plays; once it is gone the results card
  (`ui/hud/LevelClearCard`) counts the level score up (the total with it)
  and shows lives, kills, best combo, the level's time and a NEW BEST
  stamp (beat an earlier best on that stage); a tap mid-count skips to the
  end, the next tap returns to the map, the ship flies to the next island,
  and a tap starts it. The run is saved when each level
  starts (`STORAGE.STORY_SAVE`: level, lives, score, energy, and `playedMs`,
  the game-clock time of the levels finished), so it can be left
  (pause → SAVE & QUIT TO MAP) and continued from that level's start; a
  game over deletes it. **The ending** (`EndingScene`, owner's pick of
  three looks): beating level 10 shows, after the clear card, a top-down
  desk where a kid's hands color the game's bosses (their real doodle
  recipes, in crayon: `Pencil` look `"crayon"`) and the player's ship on a
  small sheet; the last ones start as gray sketches and get colored in. THANK
  YOU FOR PLAYING is on the sheet, the score on a sticky note. Then **the
  credits** (owner's ask: "the game made by me, thanking the player a
  lot"): a fresh notebook page slides over the desk and lines are written
  on its rules one by one (`scenes/endingCredits.ts`): THE END, "a game by
  J²" (`ENDING.CREDIT_NAME`), a thank-you, the run told back (time played,
  worlds, score), "You unlocked …" when `EndingData.unlocked` names a
  reward (filled by `storyReward()` in GameScene), and a signed heart.
  **Taps never skip the thank-you:** taps count after 2 s; on the drawing
  a tap turns the page, while writing it shows every line, and only once
  all lines have been up `READ_MIN_MS` (4 s, "tap to continue" shows) does
  a tap fade the picture out to the `next` scene GameScene handed
  it (name entry, else the map). Its song is `ending.mp3` on the shared
  player below, once. Dev: `?ending=1` (with a made-up unlock line).
  **Music** (docs/MUSIC_PROMPTS.md): one shared
  player for the page (`scenes/music.ts`, `music.play(scene, file)`) plays
  one song at a time, crossfades from the one before, keeps a song that is
  asked for again (the menu's through HOW TO PLAY / SCORES), and loads
  each file the first time it's asked for (browsers hold audio until the
  first tap or key). Menu `menu.mp3`, story map `map.mp3`, Endless
  the picked theme's song (`endless.mp3` on the plain page), battles none
  yet. Each level plays its path track and crossfades to its boss track
  when the boss comes in (`LevelMusic`, `public/assets/music/levelNN-{path,
  boss}.mp3`); the ending (`EndingScene`) plays `ending.mp3` once, on
  through name entry and the map. Files: MP3, mono, 96 kbps (24 tracks, 16 MB).
  After each boss a victory jingle plays (`scenes/extraMusic.ts`:
  `level-clear.mp3` when it exists, else a rising blip fanfare).
  **Endless themes** (`config/themes.ts`, `ThemePickerScene`, like Tetris
  99's): the ENDLESS button opens a picker of the plain page plus one theme
  per story world; a world opens once its boss is beaten
  (`StoryProgress.furthest`), locked ones show a dashed "?" island and
  "beat its boss in STORY". A theme is only a look and a song: its page
  (paper + props, scrolling with the game clock and repeating its props
  every `DOODLE.THEME_LOOP_PX`) and its path song (looped, no boss track).
  Never its creatures, traits, ball layouts or waves: Endless keeps
  EndlessDirector, its curve and its one board. GameScene reads the pick
  (`STORAGE.THEME`; a locked pick falls back to the plain page) and gives
  it only to the snapshot's `page` and to `LevelMusic`; the Field never
  sees it. The plain page plays `endless.mp3` (docs/MUSIC_PROMPTS.md); a
  missing file just plays nothing. The 3D view (`?art=3d`) draws no pages,
  so there a theme is only its song.
  Built: level 1, THE BACKYARD (now 100 s, d 0.1 → 0.35; beetles whose eyes are
  the numbers and sometimes march in pairs, worms made of numbers, a
  butterfly that folds its wings over its numbers; boss GIANT MOLE, 4
  answers of 3 balls (5 before its trick), whack-a-mole: it peeks out of one of three molehills,
  ducks and digs to another, which shakes first; `objects/mole.ts`). Bots: rookie clears 16/20, pilot and ace 20/20.
  Level 2, THE POND (3:20, d 0.1 → 0.28, sums of 2–4 balls via
  `LevelDef.MAX_BALLS`): goldfish whose numbers are bubbles, swimming in
  schools of 3; dragonflies whose eyes are the numbers, darting down in
  zips with hovers (trait `dart`); frogs with 3–4 spots (`cluster` layout)
  that sit longer the more spots they carry (trait `hop`); a duck that dives
  and pops up further along (trait `dive`); boss BIG FROG (6 answers of 3–4
  balls, `leap`: sits, croaks, leaps from pad to pad; hungry: while it
  croaks its tongue aims at the nearest creature, then eats it and its sum
  grows a number, via `AbilityHost.preyNear` / `swallow` / `addBall`). Rules for the pond's
  traits/boss in `objects/pondCreatures.ts`; they move themselves through
  `Ability.steer(alien, fieldDelta)` (field time). Bots: rookie 11/20,
  pilot and ace 20/20.
  Level 3, THE TREETOPS (3.5 min, d 0.3 → 0.45; `config/levels/treetops.ts`):
  squirrels leap in from the trunks and then from branch to branch, two
  acorns (numbers) in their paws; owls whose eyes are the numbers turn
  their heads away while perched, never while they swoop; birds in flocks
  of up to three, a number on each wing (0.6× speed); a hummingbird bonus
  that darts and hovers; boss GREAT OWL (6 riddles, `riddle`: its eyes
  show "3" and "?", its belly "= 8", and the answer is the missing number,
  so its `result` is not its sum: `AbilityHost.rerollMissing`,
  `Ability.ballText`; flies to another branch after each). Traits that move
  their creature use `Ability.steer` (field time, glideTo/hold only).
  Bots: rookie clears 10/20, pilot 19/20, ace 20/20.
  Level 4, THE MUD SWAMP (200 s, d 0.3 → 0.55; slime blobs that pop in
  two, peepers whose eyes duck under the mud, snails that lose their
  shell, bog turtles, a firefly whose light flickers out; boss MUD
  MONSTER, which splits into two halves that must both be beaten, 6
  answers). A boss that splits clears the level only when no boss part is
  left (`BossDef.PART`, `AbilityHost.spawnBossPart`).
  Level 5, THE DARK CAVE (200 s, d 0.45 → 0.6): bats hang upside down,
  wake with a shake and drop (trait `roost`), glowworms on silk threads
  glow on and off (trait `glow`), a mine cart whose wheels are its numbers;
  boss CAVE TROLL (6 answers), whose numbers show only in a swinging
  lamp's beam; the light holds it still (`objects/caveTroll.ts`). Bots:
  rookie 2/20, pilot 18/20, ace 20/20. Traits can scale or hold their
  kind's movement with `Ability.pace(alien, delta)`; `update(delta, alien)`
  gets the alien; a boss look can draw under the field (`BossLook.under`).
  Level 6, THE VOLCANO: lava drips that drop in hops, fireflies that go
  dark together, lava tortoises (answer the shell first), a hopping spark;
  boss DRAGON, whose fire breath re-rolls its sum (docs/SOLO_MODES_DESIGN.md).
  Level 7, THE WINDY SKY (140 s, d 0.65 → 0.8): one wind for the page
  (calm, swirls, a gust, right then left; `objects/skyTraits.ts`); kites
  (numbers = tail bows) climb in gusts, then their string snaps and they
  tumble; swallows (eyes = numbers) swoop down on each gust; paper planes
  loop the loop; a balloon bonus is blown along; boss STORM CLOUD (5
  answers): rumbles, then thunder drops a raindrop (a 2-ball boss part),
  and so does every answer it survives. Bots: rookie 0/20, pilot 11/20,
  ace 20/20.
  Level 8, THE SNOWY MOUNTAIN (135 s, d 0.7 → 0.85; `config/levels/snow.ts`):
  penguins that lean and belly-slide (lines of 3), snowballs that pick up
  one more number past mid-field (`AbilityHost.addBall`, box sized ahead via
  `SpeciesDef.BOX`), ice blocks that speed up as they slide, a snowflake
  blown in gusts; boss YETI (7 answers) stomps and throws snowballs
  (`AbilityHost.spawnMinion`). Bots: rookie 0/20, pilot 6/20, ace 20/20.
  Level 9, THE NIGHT SKY (140 s, d 0.75 → 0.9): invaders that step on a
  beat in rows of three (Space Invaders, a nod to the original Metic),
  comets that bounce off the edges, UFOs that warp, a shooting star that
  burns out; boss THE MOON, whose numbers show only where it's lit
  (`Ability.ballCover`: per-ball cover). Bots: rookie 0/20, pilot 8/20,
  Level 10, THE KID'S BEDROOM, the finale (160 s, d 0.8 → 0.95): wind-up
  soldiers that march in lines and stop when their key runs down, a
  jack-in-the-box whose numbers show only when he pops, a bouncing rubber
  ball, a teddy bear that naps, a loop-the-loop paper plane; boss
  UNDER-THE-BED MONSTER (eyes peek from under a creeping bed, it flings toys
  out via `AbilityHost.spawnCreature`, then climbs out in full: 4 + 3
  answers). Bots: rookie 0/20, pilot 1/20, ace 20/20.
- **Bullets hit only their target.** Results are unique on the field, and each
  bullet carries the alien whose answer fired it (`Bullet.target`); it flies
  through every other alien, so only the solved alien can die or lose its
  shield.
- **Battle match** (`src/sim/Match.ts`, `MATCH`; headless until the M8 UI):
  N fields (8 to start) share ONE seed, so everyone meets the same base
  aliens; one life each (`MATCH.LIVES`); bots per seat (`Bot.forSeat`).
  **Placement** = players alive + 1 at the KO; players falling in the same
  step are ranked by score, then seat. The match only talks to a field
  through logged messages (`field.receive({type:"standing", alive, total})`)
  and reads `knockedOut`/`score`/`summary()` (the future protocol), so each
  field replays from its seed + log alone. **Pressure** `dMatch` =
  `min(0.99, 0.6·out/(N−2) + overtime)` (overtime +1 per 2 min from 3:00)
  joins `d = max(dScore, dTime, dMatch)` and the unsolved cap; from 5:00
  **sudden death** speeds aliens up +100%/min, so even a perfect player (or
  a script) falls (~6 min) and a match's length is bounded.
- **SEND and incoming** (`SEND`, M6; menu **BATTLE (beta)**: you + 7 bots,
  `MATCH.OPPONENTS`): the `send` input spends a tier's cost (25 = darter,
  50 = one ability alien, 100 = two; the sender's `SEND` stream picks which
  ability) and the match delivers the attack `{from, cost, aliens: [{kind,
  ability}]}` to the sender's target (M7). The receiver queues each
  alien for `DELAY_MS` (3 s → 1.5 s with `dMatch`, `STAGGER_MS` apart); then
  it enters from the top with an orange ring (`sentBy`), skipping the unsolved
  cap and threat budget and not holding back the field's own spawns, but
  obeying the on-screen cap and readability (no room → it waits).
  **Two gauges (owner's pick, 2026-09-30):** a kill charges the power meter
  (`POWER_RATE` of its value), and its full value (without the drifter burst) **pays off incoming
  first** (soonest first; each alien's share of the weight); only the rest
  fills the **attack gauge** (`field.attack`, max `SEND.GAUGE_MAX` 100,
  overflow lost), and SEND spends only the gauge. So attacking never costs
  the power's fuel. Kills while a time power runs charge neither (no energy,
  no cancel, no attack). Battle HUD: SEND takes the left gutter and is the
  gauge: it fills from the bottom in orange (marks at each tier) while
  incoming attacks hang from its top as pink blocks (blinking in their last
  second); tap = strongest affordable tier, hold steps down, slide off
  cancels; Space = send. Under the keypad sits the battle dock (see
  the phone battle HUD), and game over shows the placement.
- **Targeting, KO credit, badges** (M7, `MATCH`): the `target` input aims a
  player's attacks by a strategy (`TARGET_STRATEGIES`: random, kos = whoever
  is closest to falling (danger + incoming), attackers = whoever aims at you,
  badges = most badge points) or at a seat by hand (`{ seat }`, kept until
  that seat is out). The match re-picks targets every `RETARGET_MS` and at
  once when a target falls (ties at random, seeded). **KO credit** goes to
  the sender of the alien that did it, else the last attacker within
  `KO_CREDIT_MS`; it earns the victim's badge points + 1. Badge levels at
  2/4/8/16 points give +25% each; being aimed at by k > 1 players gives
  +25%·(k−1) defense (max +75%). An attack's weight = cost × `ATTACK_MULT` ×
  (1 + bonus): the receiver must cancel the weight, and each 25 above the
  cost adds a darter. `ATTACK_MULT` is a balance lever (1). Bots aim by level (`TARGETING`:
  rookie random, pilot attackers, ace kos). T cycles the strategy on a
  keyboard; on screen it is the dock's aim chip.
- **What others see = `match.tiles()`** (`PlayerTile`): per seat: who (level
  or human), alive, placement, score, kills, danger 0–1, incoming, energy
  0–1, attack gauge 0–1, power and whether it's on, alien dots (0–1 x/y, `sent` marked),
  badge points/level, aim, current target, how many aim at them, attack
  bonus, attack gauge 0–1. The battle UI reads only this (it is also what the phase 1 server
  will broadcast per player), through `BattleView`s (`src/ui/battleViews.ts`):
  GameScene calls each view once per frame with the tiles and new match
  events; a view acts only via `aimAt(seat)` / `aimBy(strategy)`.
- **Phone battle HUD** (M8, `PhoneBattleDock`, `BATTLE_HUD`): a **dock under
  the keypad** (the only portrait strip never over the field, so it
  never ducks or hides a sum; the solo key hint sits there otherwise).
  Left: the **aim chip** (strategy or PICK, `→P3` target, `⚠n` = n aim at
  you; tap = next strategy). Middle: **one tile per opponent** in seat order,
  filled from the bottom by their danger (blue → gold → red, pulsing near
  the line), their incoming stacked on top in pink, gold badge pips, an
  **orange frame = aims at you**, **white brackets = your target** (blinking
  while a hand pick waits for the 1.5 s re-pick); knocked out = dark + final
  place; tap = aim at them, tap again = back to your strategy. It flashes
  when it attacks you or you attack it, white/gold when it falls. Right:
  players left, your badges (★), the last KO ("P4 OUT", gold "KO P4" if
  yours). **Edge glow**: incoming pink on both field edges while attacks are queued
  for you (stronger with more incoming, a flash per attack), dimmed next to
  your own aliens. **Haptics** (`navigator.vibrate`, Android; iPhone has
  none): a pulse per 25 of an attack at you, a tap-tap for your KO, a long
  buzz when you're out. Replaced the top-right status line and the
  SENT / INCOMING / OUT flashes. Shown on every screen, next to the desktop
  board when that fits (the dock's chip is the on-screen strategy switch;
  colors match the board: sent/attackers orange, incoming pink, danger red).
- **Desktop opponent board** (`src/ui/OpponentBoard.ts`, `BATTLE_BOARD`):
  built on any desktop (fine pointer) or wherever it fits, and shown while
  the sides of the canvas have room: the 7 opponents are tiles in two
  columns beside the field (4 left, 3 right + a KO feed with "N/8 LEFT").
  Full tiles need `MIN_SIDE_W` per side (1280×720, 1920×1080); **compact**
  tiles (mini field + name, badges, incoming) need `COMPACT_MIN_W`, e.g. a
  claude.ai Artifact panel (~900 px); in a landscape window narrower still,
  the game's box (#game) narrows so the canvas shrinks (to ≥
  `MIN_GAME_SCALE`) and makes room. Never on phones or portrait tablets. A
  full tile: mini field with alien dots (orange = sent), a red
  wash rising with danger (pulsing near the line), name + bot level,
  badges ★ + attack bonus, power chip (filled while on/armed), power
  energy (cyan) beside the attack gauge (orange, ticks at 25/50), incoming
  (pink, like the SEND button's), "→ target · strategy"; after a KO it greys out with its
  place and who took it out. **Your target** gets the gold lock-on brackets
  (◎ TARGET / PICKED); **players aiming at you** get an orange edge + ⚔ ON
  YOU (attack orange, not red: red is for subtraction balls). Click a tile
  = `aimAt(seat)`. It is a DOM overlay placed from the canvas rect every
  frame and hidden when a side gets too narrow, so it never covers the field.
- **Lives** are a playtest constant, `PLAYER.LIVES` (3 by default; 1 = the
  battle-royale knockout rule). With 1 life the hit recovery below never runs:
  the only hit ends the game, so the power is the sole safety tool.
- **Hit recovery**: on losing a life (but not the last) the whole field **freezes
  for `RECOVERY.FREEZE_MS` (3s)** so the player can read the board, then resumes
  at `RECOVERY.POST_HIT_FACTOR` (80%) speed for the rest of the run. The slowdown
  is flat (non-stacking) and the difficulty curve keeps ramping underneath, so
  absolute speed still climbs over time. The ship can still fire during the
  freeze (so a frozen board can be cleared). The freeze is a countdown that
  only runs while unpaused, so pausing doesn't eat it.
  During the freeze every monster is also **pushed back up** the field by
  `RECOVERY.PUSHBACK_PX` (70) over `PUSHBACK_MS` (owner's ask: room to
  recover), all by the same amount so readability gaps hold (every mode).
  The ship shows it (doodle view): knocked down with an "ouch!", then blinks
  with stars circling it for the freeze. The last hit snaps it in two
  ("CRASH!"), and GAME OVER waits `RECOVERY.GAME_OVER_DELAY_MS` (1.6 s,
  presentation only) so the destruction is seen.

## Difficulty design

Difficulty is a normalized value `d ∈ [0,1)` that is **score-led with a gentle
time floor** — the player *earns* difficulty by scoring, so a struggling player
is never overwhelmed while a skilled one ramps up fast:

```
dScore     = score / (score + SCORE_HALF)        // earned via points (0.5 at SCORE_HALF)
dTimeFloor = min( logistic(t), TIME_FLOOR_MAX )  // slow ramp for everyone
d          = max( dScore, dTimeFloor )           // monotonic, never decreases
logistic(t)= 1 / (1 + e^(-k · (t - t0)))
```

`SCORE_HALF` = 6000 pts, `TIME_FLOOR_MAX` = 0.4, `t0` = `DIFFICULTY.MIDPOINT`
(50s), `k` = `DIFFICULTY.STEEPNESS` (0.055). Most parameters lerp on the blended
`d` as `easy + (hard - easy)·d`, **except `maxUnsolved`, which uses `dScore`
alone** so the number of concurrent unsolved sums grows only with points:

| Parameter      | easy | hard | driver |
| -------------- | ---- | ---- | ------ |
| Max unsolved   | 1    | 3    | **dScore only** (1 at start, 2 at ~2k, 3 at ~18k pts) |
| Fall speed     | 28   | 110 px/s | d |
| Home speed     | 45   | 150 px/s | d |
| Spawn interval | 2200 | 650 ms | d |
| Max on screen  | 4    | 8    | d (safety net) |
| Max balls      | 2    | 3    | d |
| Max digit      | 3    | 9    | d |
| Strafer patrol | 5000 | 2800 ms | d |

`MIN_BALLS` is fixed at 2. All knobs live in `src/config/tuning/difficulty.ts`; the
curve is in `src/config/difficulty.ts` (`difficultyAt(elapsedMs, score,
dMatch)`). In a battle, `dMatch` (`matchPressure`) joins both maxes: `d =
max(dScore, dTimeFloor, dMatch)` and the unsolved cap uses `max(dScore,
dMatch)`; it is 0 in solo play.

## Roadmap

1. [x] Core loop (keypad/keyboard input)
2. [x] Static sprites + logistic difficulty ramp + parallax starfield
3. [x] ≥2-number sums + no-overlap lanes
4. [x] Pause (hides field) + freeze-then-slow hit recovery
5. [x] Fair targeting: locked target holds still; concurrent-alien cap
6. [x] Enemy personality by ball count + skill-based scoring + mastery ranks
6b. [x] Selectable player ship (3 models) + random monster models (darter,
       lumberer, drifter).
6c. [x] **Monster movement patterns** — kind in the `Alien` state; darter
       zig-zag, lumberer stomp, new Galaga-style strafer (patrol → dive),
       readability boxes + sweep-aware spawner, animated `anim_*` parts;
       swooper enters from a side edge below the HUD (2026-09-28).
6d. [x] **Monster abilities:** ability system (update/onHit/onKilled hooks) with
       Shielded, Blinker and Splitter (+ splitling), riding on the movement
       kinds and unlocked by difficulty in solo play. **Next:** Hider, Orbiter
       and Worm on the same hooks; later these are the aliens players send
       each other.
7. [x] **Drifter bonus enemy** — non-lethal, crosses sideways; solving it
       gives an energy burst on top of the normal kill energy.
7b. [x] **Answer feedback** — gold/red typed number, lock-on brackets, answer
       stars in the background, solved sum popped on each kill.
8. [x] **Handwriting input** — DRAW/KEYPAD switch; a pad in the keypad area
       (not over the field); $P point-cloud recognizer with ~25 templates;
       digits split by sideways overlap and read together after a pause;
       scratch-out clears, unlike ink shows "?"; the ink turns into the answer
       stars. **Next:** record real samples with the lab (`?lab=draw`), tune
       templates until `realSamples.test.ts` passes; maybe learn the player's
       own strokes as extra templates (measured: ~86% → ~95% on unseen drawings).
9. [ ] Other operations (subtraction/multiplication/division) via color-coded balls
10. [ ] Sprite animations + richer explosion/background VFX
10b. [x] **3D playfield (Three.js)** — same top-down view, voxel models built
       from the sprites, 3D starfield parallax, voxel-debris explosions.
11. [x] Leaderboard backend (Supabase) + world leaderboard — 5-char initials at
       game over, world rank, top-N board. **Needs Supabase creds + Pages setup.**
12. [ ] Publish on GitHub Pages (workflow added; enable Pages = "GitHub Actions"
       and add repo secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
13. [ ] **Battle-royale multiplayer (Tetris 99-style)** — see
       `docs/MULTIPLAYER_DESIGN.md`. Single player first: [x] energy bar +
       one picked power (FREEZE / SLOW / BLAST / SHIELD), [x] alien
       movement patterns, [x] monster abilities; then offline bots (and energy
       "send"), then the WebSocket match server (8 players to start).
       **Phase 0 (offline vs bots)** milestones M0–M9 are in
       `docs/MULTIPLAYER_DESIGN.md` §10: [x] M0 battle rules/bots/contracts
       written down, [x] M1 seeded random numbers + game clock, [x] M2a
       Phaser-free `Field` (aliens, spawning, readability) + fixed timestep,
       [x] M2b ship/combat/scoring/lives/energy/input into the sim (input log
       + exact replay), [x] M3 bot v1 (solving, 3 skill levels, `?bot=`,
       `npm run bots`; calibrated on playtests), [x] M4 bot powers (FREEZE,
       fitted to the owner), [x] M5 match (N fields, KOs, placement,
       pressure + sudden death, `npm run match`), [x] M6 SEND + incoming
       queue + cancel (menu BATTLE beta), [x] M7 targeting, KO credit,
       badges, `tiles()`, [x] sending pays: separate attack gauge,
       [ ] M8 battle UI: [x] desktop opponent board, [x] phone feedback
       (dock + edge glow + haptics), [ ] results + fast-forward.

14. [ ] **Solo modes: STORY + ENDLESS** — 10 notebook-page levels, each
       with a new monster and a boss; today's game becomes ENDLESS. Plan
       and milestones L1–L8: `docs/SOLO_MODES_DESIGN.md` (decided
       2026-10-18). [x] L1 menu modes, [x] L2 director seam, [x] L3 level
       engine (level 1 page + path), [x] L4 boss (Giant Mole), level 2 the pond (Big Frog); next: L5
       table of contents + scores, power card before each level.
       engine (level 1 page + path), [x] L4 boss (Giant Mole), [x] L5 story
       map + per-stage and run boards (SQL not applied yet); next: power
       card before each level.

## Conventions

- Follow `docs/ENGINEERING.md` (readability rules, layers, verification) and
  explain every change (§6 there; Claude: the `explain-change` skill).
- Keep all tunables in `config/tuning/<domain>.ts` (imported through
  `config/constants.ts`), UI colors in `config/palette.ts`, text styles via
  `ui/theme.ts`; avoid magic numbers in scenes.
- Comment only non-obvious intent (per repo style); history goes in the
  Decision Log, not in code comments.
- Verify changes: `npx tsc --noEmit`, `npm test` and `npm run build` must pass.
  **Never mix a refactor and a behavior change in one commit**: a refactor
  keeps the golden master (`src/sim/golden.test.ts`) green; an intended rule
  change updates it (`npx vitest run -u`) and says why.
- **Game rules never use `Math.random()` or the wall clock** (`this.time.now`):
  draw from the run's seeded streams and read the game clock. Visual-only
  randomness (stars, debris) may use `Math.random()`. New monsters and
  abilities follow the content checklist in `docs/MULTIPLAYER_DESIGN.md` §9.
- **Git workflow:** feature branches are **local only** (never push them). Merge
  into `master` locally and push only `master` (pushing it deploys GitHub Pages).
  Every local merge into `master` is followed, without asking, by deleting the
  merged branch (`git branch -d`) and pushing `master` (after tsc + build pass).
  **Cloud sessions** (Claude Code on the web) instead push their assigned
  `claude/*` branch; the owner merges it into `master`.
- Commit trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

---

## Decision Log

Newest first. Format: `YYYY-MM-DD — decision — rationale`.

- **2026-10-21 — Playtest round 2 merged into master: one music player.**
  Round 2 (energy rework, boss tricks, level-clear sequence, ending,
  credits, ship unlocks) had its own song helpers; master's shared player
  (`scenes/music.ts`) now plays every song, the ending's included (once,
  on through name entry and the map). Kept from round 2: the level-clear
  jingle (`scenes/extraMusic.ts`) and its waves module (`tuning/waves.ts`),
  now holding master's escalating waves.

- **2026-10-20 — New soundtrack in; one shared music player for every
  screen.** The owner's 24 tracks (44-bar wave-timed path songs, bosses,
  menu, map, ending, Endless), re-encoded from the WAV masters to MP3 mono
  96 kbps: plays on every browser (iPhone too), 16 MB for all, ~1.3 MB per
  level; the masters are mono already. Chosen over OGG/Opus (smaller,
  but older iPhones can't play it) and 128 kbps (no audible gain on these
  square waves for +33%). Player: one page-wide instance (like World3D),
  because a song must outlive its scene (menu → SCORES, ending → name
  entry); LevelMusic now runs on it (owner said "just do it"; chosen over
  a player per scene, which restarts songs, and handing it through
  scene data). Battles stay silent for now (open for the owner). Found: ENDLESS
  after a battle/story level replayed it (Phaser reuses a scene's last
  data); fixed.

- **2026-10-20 — Endless = one set of rules; story worlds are cosmetic
  themes (owner's pick).** Endless keeps every monster, the score-led curve
  and one leaderboard; a world the player unlocked in story (boss beaten)
  can be picked as a theme: its page and path song, never its creatures or
  traits (those change difficulty). Rejected: picking a level with its own
  rules (scores not comparable, or 10 boards). Like Tetris 99's themes.
  Paid themes skipped (accounts, payments). Menu, map, ending and Endless
  songs share one main theme (docs/MUSIC_PROMPTS.md); not wired yet.

- **2026-10-20 — Endless themes live outside the sim.** A beaten world can
  dress Endless in its page and path song. The pick is read by GameScene
  and handed only to the view (snapshot `page`) and the music, not put on
  `Field` like the story level (the owner's first guess): a level is rules
  (species, waves, seed), a theme is not, and keeping it out means replays,
  bots and the future server never carry it and no rule can start reading
  it. Picker = its own paper screen after ENDLESS (11 cards, island
  sketches reused from the map). An Endless page has no end, so its props
  repeat every 3 screens. Also fixed an import cycle (tuning/story ↔
  levels) that had left GitHub Pages blank since the escalating-waves
  merge: LEVELS is now exported by the constants barrel.

- **2026-10-20 — Level songs follow the level's waves (docs/MUSIC_PROMPTS.md).**
  Owner's ask: the first soundtrack looped a short phrase; songs should
  rise and fall with the difficulty. Each path song is 44 bars, one per
  unit of the shared wave shape, with BPM = 10 560 ÷ path seconds, so its
  sections (calm, wave 1, breath, wave 2, breath, climb, peak, settle)
  play with their waves. Chords move away from home as intensity grows;
  the peak changes key. Sync is approximate (freezes stretch the path).

- **2026-10-20 — Story waves escalate: each peak bigger, every rest back to
  the base, bigger swings level by level (owner's ask).** A push now
  carries its own HEIGHT (wave 1 .35, wave 2 .7, then a climb to a full
  burst) and each level sets its scale (`WAVES.BASE` / `PEAK` unsolved
  sums), chosen by the owner over per-level heights (10 lists to tune)
  and over heights computed from a formula (every level the same shape):
  one shared profile + a scale per level. Profile in 4-bar phrases at
  120 BPM so level 1's music can follow the waves (level 1 path 85 → 88
  s = 44 bars); `npm run waves` prints every level's timeline for the
  soundtrack. Bots (20 seeds, SLOW): aces clear all 10 in
  111–129 s; pilots 20/16/19/18/19/19/16/19/19/13; rookies 4/3/11/0/1/5/0/1/0/0.
  The monsters that hit come in during pushes (~90%), not rests
  (`npm run bots:story` now shows both when and where hitters came in).
  Two level tests assumed a calm field (a row's step held by the
  readability guard, a snowball lifted by pushback) and were loosened.
- **2026-10-20 — Life icons show the picked ship.** They always drew the
  old FALCON sprite. GameScene picks the picture (the ship's doodle, one
  boil frame, or the sprite in 3D art) and hands TopHud a texture key,
  which TopHud fits into a 22 px slot (owner's pick over TopHud reading
  the art mode itself, or the FieldView supplying it).

- **2026-10-20 — The power shows when it's ready (owner's Playtest 3
  note: "the energy bar is very small").** Replayed: in dangerous moments
  the power was ready but off 12–74% of the time per level, the owner took
  a median 8–32 s to press it after it became ready, and the bar sat full
  27–66% of levels 1–8. Owner picked all four cues: a ready moment (flash,
  READY, buttons, chime), breathing while ready, FULL + shimmer, and a
  nudge when an alien is near, plus a 14 × 60 bar (was 10 × 44). Motion
  over size, so the bar still ducks and the numbers win. The cue is worked
  out in the view (EnergyHud compares last frame's state), not a Field
  event (owner's first pick): it is two numbers the HUD already reads, and
  in Field every bot, replay and the future server would compute it for
  nothing. Not yet playtested by the owner.

- **2026-10-20 — The ending gets credits, the run's time and music
  (owner's Playtest 3 ask).** Owner's picks: credited as **J²**; the
  credits go on a new notebook page after the drawing (over a note on the
  desk or text under the drawing: more room, readable on a phone); the
  run's time is the sum of each level's game-clock time, saved in the run
  (`playedMs`, 0 for old saves), over a wall-clock start time, which would
  count pauses, breaks and days between quit and continue. A quit level's
  attempt isn't counted (the level restarts). The reward line is data
  (`EndingData.unlocked`), so the unlockable-ships work fills it without
  touching the scene. Fallback music = the level-10 track slowed (Claude's
  pick, over a blip melody: a real track for ~40 s), so the ending is never
  silent.

- **2026-10-20 — Story unlocks ships; finishers get the kid's crayon ship
  and a crown (owner's picks).** Three themed ships after the Great Owl,
  the Dragon and the Moon (over five or ten: fewer doodles, each one an
  event), and all three finisher rewards (crayon ship, crown on the map,
  STORY COMPLETE on the menu). Unlocks are derived from `furthest` instead
  of a saved list (the owner first picked the list, then switched): it is
  the same fact twice otherwise, and players who beat a boss before this
  change get their ship with no migration. Ships stay looks only (rule of
  2026-09-29); no 3D models for them.

- **2026-10-20 — Every boss says its trick in one line (owner's picks).**
  The owl's riddle changes what you type and only a "who?" bubble said so.
  Owner picked the creature-intro shape "TRICK · rule" (over a worked
  example like "3 + ? = 8 → type 5", and over a tip with no trick name),
  and a line for second forms too (halves, raindrops, the monster out from
  under the bed), shown once per run with no big banner. `INTRO` is
  required on `BossDef`, so a new boss can't forget it. Found while
  checking: banners stacked by count × the new one's size, so a 26 px BOSS
  banner and a 15 px line overlapped when other banners were up; they now
  stack by measured height.

- **2026-10-20 — The energy meter is a small vertical bar, top right
  (owner's phone playtest).** The long horizontal meter under the progress
  bar was easy to confuse with it. Owner's pick of three: a 10 × 44 px
  bar under the lives (over the POWER buttons filling up like SEND, or
  both), so it stays where the eyes are and looks nothing like the path.

- **2026-10-20 — Level clear sequence: pop, launch, jingle, results, map
  (owner's ask).** Owner's picks: one beat after another (minions pop →
  squash → blast off → results count up → map), and the card shows kills,
  best combo, the level's time and a NEW BEST stamp. The launch is a look,
  so it lives in the snapshot (`shipLaunch`) timed on the scene clock, not
  in `Field` (owner's first pick: the rules have ended by then, and bots,
  replays and the server would carry an animation nobody sees). `ShipLaunch`
  is its own component so the story ending can fly the ship off too. Music
  files made one at a time are optional: `menu.mp3` and `level-clear.mp3`
  play when present, else silence / a blip fanfare.

- **2026-10-20 — The story's ending: a kid coloring the game's monsters
  (owner's idea and pick).** Three looks were sketched (kid at a desk seen
  from the side, top-down hands on the sheet, kid on the floor with the
  bosses on the wall); the owner picked top-down hands: the monsters stay
  big enough to read on a phone. The sheet reuses every level's boss
  recipe (and the picked ship) drawn with a new crayon look of the same
  `Pencil`, so new bosses appear there for free. GameScene decides where
  the run goes after the ending and hands it over as data (`next`), so
  EndingScene doesn't need to know about the leaderboard. Music is
  optional: loaded at the ending, played only if it reached the cache.

- **2026-10-20 — Every boss gets a signature trick; the three plain ones
  got theirs (owner's picks).** Audit: 7 bosses already had one (split,
  lamp, breath, rain, stomp-and-throw, moon phases, under-the-bed); the
  mole, frog and owl were "answer, move away" (the owl's blink repeated the
  butterfly's). Owner picked from two each: **mole = whack-a-mole** (three
  molehills, the next one shakes; over "it hears wrong answers"), **frog =
  hungry** (tongue aims while it croaks, eats a creature, its sum grows a
  number; over a belly-flop that shoves creatures back), **owl = "WHO?"
  riddles** (3 + ? = 8, answer the missing number; over a hoot that
  freezes the page). Rule: a trick changes the feel, not the HP. The
  hiding made mole fights ~5 s longer, so it takes 4 answers (was 5); the
  frog starts at 3 numbers (was 4); the owl stopped blinking (riddle + blink
  was harder, not different) and moves at 0.35 (was 0.4). New hooks, all
  no-ops elsewhere (levels 4–10 bots identical): `Boss.newSum`,
  `Ability.ballText`, `BossLook.over`, optional `AbilityHost.preyNear` /
  `swallow` / `rerollMissing`; bots answer `alien.result` (the owl's answer
  isn't its sum). Bots (24 seeds, rookie/pilot/ace clears, SLOW then
  FREEZE): mole 6/24/24 → 6/24/24 and 11/24/24 → 15/24/24, fight 38 → 37 s
  (rookie); frog 4/22/24 → 8/21/24 and 9/23/24 → 13/24/24; owl 17/24/24 →
  17/24/24 and 19/24/24 → 18/24/24. Not yet playtested by the owner.

- **2026-10-19 — Powers rebalanced after the energy cut: the weak three
  got cheaper (owner picked C).** With scarce energy SLOW's cheap drain made
  it the best pick (ace Endless FREEZE 160 / SLOW 190 / BLAST 144 / SHIELD
  150 s; ace mirror battle wins per seat 7 / 28 / 4 / 12%, fair 12.5).
  Tested three sets with bots: A = SLOW 9/s only (all ~150 s, BLAST still
  4% in battle), B = SLOW 7/s, FREEZE 18/s, BLAST 44, SHIELD 36 (most even in
  Endless, ±3%), C = FREEZE 25 → 15/s, BLAST 60 → 40, SHIELD 50 → 33, SLOW
  unchanged. C: Endless 185 / 190 / 197 / 171 s (±7%), mirror battle 9 / 14
  / 15 / 12% (most even), pilots story L4 clears 1/7/5/8 → 6/7/8/11 of 12;
  the bar still sits full only 16–21% of the time, so energy stays scarce.
  Flawless BLAST's ceiling rose 180 → 230 s (was 457 before the cut).
  Aces clear story 1/4/8 with any power, so Endless and battles set the
  numbers. Rookie SLOW stays weakest (113 s vs 93 with no power): rookie
  power use is guessed. Tables: docs/learning/2026-10-19-power-balance.md.

- **2026-10-19 — Energy is scarce, carries over between story levels, and
  its bar is at the top (owner's playtest notes 2+3).** Replayed playtest: a
  kill charged 16–22, the bar was full 10–17 s into every level, full 47–93%
  of the time, 75–97% of energy lost to overflow, and 2 of 3 hits came with
  the power affordable and unused (the bar under the keypad went unseen).
  Owner's picks: cut every kill evenly (over dropping the combo bonus or
  charging only hard sums) at rate 0.4 (over 0.5 / 0.3), and carry energy
  over like lives and score. The power meter gets `ENERGY.POWER_RATE` of a
  kill's value; the battle attack gauge keeps the full value, so SEND's
  balance holds. The drifter burst was cut with it (40 → 16): at 40 it
  became a quarter of early income. Results: owner's runs replayed, first
  full bar 10–17 s → 18–31 s; ace bots 14–22 s → 25–46 s, still clear every
  level (an ace's bar still sits full in easy levels: it doesn't need the
  power there, and with carry-over that saved bar now pays at the next
  level). Cost, as warned: pilots lean on the power (story L8 SLOW 7/12 →
  3/12, SHIELD 12/12 → 6/12; whole runs with SHIELD reach stage 8 → 4);
  Endless ace survival FREEZE 215 → 160 s, BLAST 257 → 144 s, SLOW 211 →
  190 s (SLOW is now the strongest: power costs may need a retune);
  battles ace win 95 → 85%, matches 83 → 77 s. The meter moved to the top
  HUD under the progress bar and ducks like the rest of it; the battle dock
  grew into the freed strip under the keypad. Golden master updated (rule
  change). `npm run bots -- --story 1,7` measures energy per level.

- **2026-10-19 — Story map shows this run, not the furthest ever (owner's
  playtest).** "Reached in this run" comes from the saved run alone (its
  level; none = island 1), chosen over a new `runFurthest` field in the
  progress (owner's pick): two stored copies of one fact can disagree.
  Islands reached only before are gray pencil (owner's pick over faded or
  dashed), keeping their score, flag and board. Labels stay readable by
  erasing the trail around them (chosen over a paper backing, which hides the
  ruled lines).

- **2026-10-19 — Animated story pages: looping props + drifts (owner's
  playtest note 1).** Owner picked both kinds of motion, backyard first.
  Props loop the 6 frames every doodle already has (a prop's recipe draws
  frame `t`), so moving props cost nothing extra; drifts are a fixed set
  per page that re-enter where they came from (no creating/destroying).
  Chosen over redrawing Rough.js shapes per frame (ms each, too slow on
  phones) and over a full-screen animated layer (fill-rate). Drifts live in
  screen space and ignore FREEZE and the sky's wind (the view gets neither);
  they are faint and small so the numbers stay the most readable thing.

- **2026-10-19 — Story levels come in waves and last ~2 minutes (owner's
  playtest notes 4 + 7).** The felt load was flat (the unsolved cap sat at
  2 for whole levels; d only changed speed), so a level's wave is now data:
  rest / spike / ramp / burst stretches that move the unsolved cap (1 →
  `PEAK`) and the spawn rate (owner's pick over speed: count + rate), with
  the D ramp kept underneath for speed. Path = max(field time, 0.8 × game
  time) (owner's pick: SLOW on ~30% of the time stretched levels ~25%).
  Paths 65–88 s. Bots (8 seeds, SLOW): aces clear every level in 111–121 s
  (was 126–269 s); pilots now clear 7–8/8 everywhere (were 1–8/8: shorter
  levels and rests make L8–L10 easier); rookies 0–8/8. Ace hits land in
  bursts and boss fights. Not yet tuned per level (PEAK, D) or playtested.

- **2026-10-19 — Level 7, THE WINDY SKY: one wind, a storm that rains
  minions.** The page's wind is a rhythm on the game clock shared by every
  creature (like the volcano's fireflies), and each species reacts to a gust
  its own way (kites climb, swallows swoop, planes and the balloon are
  swept). The Storm Cloud's raindrops are boss parts (`BossDef.PART`, no
  shared change), so the level clears only when the last drop is answered.
  Rain comes on a telegraphed timer AND on each answer the cloud survives:
  a held target runs no rules, so an ace who keeps the cloud locked was
  never rained on by the timer alone. Cloud HP 5 (drops add ~4 answers).
  Known: every raindrop shows the "BOSS · RAINDROP!" banner (GameScene
  banners every boss part; left for a shared fix).
- **2026-10-19 — Level 8, THE SNOWY MOUNTAIN: a sum that grows, a boss
  that throws minions.** A snowball adds one number (its old ones stay, so
  work already done still counts) instead of re-rolling, chosen over a
  sum that changes (the dragon's) to reward answering early without wiping
  progress. Three small generic hooks, no-ops elsewhere (golden master
  green): `SpeciesDef.BOX` (a box that already fits the last ball, since a
  box is fixed when an alien is built), optional `AbilityHost.addBall` and
  `spawnMinion` (optional so stand-in hosts in other levels' tests still
  compile). Bots set the numbers: snowballs growing at y 235 at full speed
  and ice blocks up to 1.4× cleared pilots 0/12; now pilot 6/20, ace 20/20.
- **2026-10-19 — Level 9, THE NIGHT SKY: invaders march in rows, the Moon
  is read by its light.** Invaders are scripted steps (glide + hold, field
  time) on a beat that quickens lower down, and a march can now come side by
  side (`MARCH.ROW`) as well as in a line. The Moon's shadow covers its
  numbers one by one (`Ability.ballCover(i, n)`, default = `cover`), chosen
  over a gravity pull on other creatures (traits can't see the field) and
  over phases that change its ball count (the readability box follows it).
  Bots set the numbers: pilots cleared 12–16/20 at first; faster invader
  beat, rows on 60% of spawns, comets ×0.9 and the Moon ×0.3 give rookie
  0/20, pilot 8/20, ace 20/20.
- **2026-10-19 — Level 10, THE KID'S BEDROOM (the finale, own chat).**
  The boss's two phases are two BossDefs (the bed, then `PART` = the
  monster, same box so it always fits where the bed was) instead of one
  boss with a phase switch: the view picks a look by model, and the swamp's
  split already clears the level when no boss is left. New optional
  `AbilityHost.spawnCreature(kind, x, y)` so a boss can call one of its
  level's creatures (the pond wanted it too); optional, so test fakes and
  other levels compile unchanged. Bots set the numbers: soldiers at full
  darter speed in lines of 3 left pilots 0/12 and aces 7/12; ×0.6, lines on
  25%, teddies ×0.8, balls 44 px a bounce: ace 20/20, pilot 1/20.

- **2026-10-19 — Owner's first story playtest: faster start, pushback,
  music, map flow, saves, public logs.** Levels 1–2 felt long and easy
  (shield never needed): paths 180/200 s → 100/120 s and d up (bots:
  ace clears L1 in ~2:10, was ~3:30; rookie 4/12). A hit now also pushes
  every monster back 70 px during the freeze (every mode; golden master
  updated). The 20-track soundtrack ships as 96 kbps MP3 (6.9 MB, was 35
  MB WAV), loaded per level, not at boot. After a clear the ship flies to
  the next island on the map and waits for a tap; runs are saved per
  level and can be continued. Logs: the Artifact keeps the owner's runs;
  the public game now logs to Supabase `run_logs` (anonymous, write-only)
  so other players' runs can be studied; the MeticWeb project was
  restored (it had been paused) and story-boards + run-logs applied (an
  old 1–5 char name check that refused 6-letter initials was dropped).

- **2026-10-18 — Level 2, THE POND, and three small generic rules.**
  `Ability.steer(alien, fieldDelta)` lets a trait or boss script its own
  moves on field time (`update` runs on real time, so it can't drive
  movement fairly under FREEZE/SLOW); `LevelDef.MAX_BALLS` lets a level
  carry 3–4 ball sums below the d that would give them; the `cluster`
  layout keeps 3–4+ balls compact (rows of 2). The owner's speed rule
  applied to creatures: a frog sits 250 ms longer per spot. Bots set the
  range: d 0.2 → 0.35 cleared rookies 0/20 (fish schools + frogs), d 0.1
  → 0.28 with schools on 15% of fish spawns clears 11/20 (level 1: 16/20).
- **2026-10-18 — Level 3, THE TREETOPS (built in its own chat).** Creature
  traits that move their alien go through `Ability.steer(alien, fieldDt)`
  (glideTo/hold on field time; same hook as the pond branch) and trigger
  on position, so freezes stop them too; `SpeciesDef.SPEED` (same as the
  swamp branch) slows creatures that are harder to beat. Bots set the
  numbers: flocks of three full-speed darters knocked out every rookie
  (0/20), so birds fly at 0.6 and owls (they hide) at 0.9: rookie 10/20
  (level 1: 16/20), pilot 19/20, ace 20/20. Sums only; subtraction comes
  with the shared operations piece.
- **2026-10-18 — Level 4, THE MUD SWAMP: every creature has a trait; the
  Mud Monster splits.** Slime = Splitter, snail = Shielded, peeper and
  firefly = blink rhythms, given as species traits; `SpeciesDef.SPEED`
  slows a creature whose trait makes it harder (owner's rule). The boss's
  last answer spawns two boss parts (`spawnBossPart`), and the level now
  clears when no boss is left instead of when "the" boss dies (chosen over
  a dying boss that waits as a hidden puddle: it would block the field and
  keep a typeable answer). Bots (20 seeds): rookie 0/20 (out in ~1.5 min),
  pilot 15/20, ace 20/20; d 0.4 → 0.55 gave pilots 5–9/20 (splitlings
  caused ~70% of their hits), so d starts at 0.3 and splitlings land no
  lower than y 190 (Endless: 260).
- **2026-10-18 — Level 5, THE DARK CAVE: creatures by movement, a boss read
  by lamplight.** Bats hang still (easy read), shake, then drop; glowworms
  glow on a telegraphed rhythm and move at 60% (they hide: owner's rule);
  the troll's numbers show only in a steady sweeping beam and it freezes
  while lit (a beam from the ship was rejected: the ship only moves toward
  a target, so the player couldn't aim it). New generic hooks, no-ops
  elsewhere: `Ability.pace` (hold/scale the kind's pattern; complements
  the pond's `steer`), `update(delta, alien)`, `BossLook.under`. d range
  0.45 → 0.6, not 0.5 → 0.65: pilots cleared 1/20 at the planned range.
- **2026-10-18 — Level 6, THE VOLCANO; traits can move their alien.**
  Ability `update` now also gets its alien and the host (like onHit), and
  Alien says when a glide/hold runs (`scripted`): lava drips and the spark
  move only in hops, in field time, and the Dragon breathes (a new sum)
  after a telegraphed inhale. `SpeciesDef.SPEED` added for the owner's rule
  (tortoise answers twice: ×0.45, it caused 90% of hits at ×1; flashing
  fireflies ×0.8). Bots: rookie 0/20, pilot 14/20, ace 20/20.
- **2026-10-18 — Story map (L5): islands show progress, every run starts at
  island 1; one leaderboard table with a `level` column.** Owner's picks:
  reached islands show their best score, the rest a "?"; no practice mode
  (arcade rules hold: a run always starts at stage 1, so an island opens
  its stage's world board, not the level). Boards: `scores.level` (0
  Endless, 1–10 stages, 99 runs) over a second table (two of every
  function). Tickets are per board; a story run submits all its boards once,
  after one name entry. Migration in `supabase/story-boards.sql`, not
  applied yet.

- **2026-10-18 — Creatures with personality; one file per level.** Owner's
  ask: each level's monsters behave differently, not just look different.
  A creature = a monster kind + a ball layout (beetle eyes, worm chain,
  butterfly wings: a rule, since it sets the readability box) + a trait
  (an Ability) + an optional march. Marches skip the unsolved cap (else
  they never form in level 1, whose cap is 1) but obey the threat budget;
  bots: lines on every beetle dropped rookies from 18/20 to 8/20, so lines
  come on 35% of beetle spawns (16/20). Levels moved to one file each
  (rules + looks) with small registries, so several chats can build levels
  at once with only one-line merges.

- **2026-10-18 — Story slice L1–L4: a SpawnDirector, level 1 and the Giant
  Mole.** Story pacing goes behind a `SpawnDirector` interface (strategy
  pattern) instead of `if (story)` in Swarm or a copied `StorySwarm` (owner's
  first pick; a copy would duplicate ~550 lines, against the owner's own
  "no duplicated code"). Endless/battles unchanged (golden master). Bosses
  ride on the ability hooks; BLAST can't hit them; reaching the ship costs a
  life and the boss retreats instead of leaving. Level 1 range set by bots:
  d 0 → 0.4 let rookies clear 2/20, d 0 → 0.25 clears 18/20 (losing ~1.5
  lives: lives carry over). Each level has a fixed seed (learnable).

- **2026-10-18 — Story mode decided (docs/SOLO_MODES_DESIGN.md).** 10
  levels, a kid's imagined nature worlds (dirt, pond, treetops, swamp,
  cave, volcano, sky, snow, night sky, bedroom), each a scrolling page that
  ends at a boss (path = timer, 3–4 min: fairer than a kill quota, which can
  stall slow players). Arcade rules (owner): lives carry over, game over =
  back to level 1. Power picked before each level; ships stay looks. Sums
  only in levels 1–2, then more operations and 4+ ball sums. Scores per
  level and per run. Today's PLAY becomes ENDLESS. Open: practice mode,
  story panels between levels.

- **2026-10-18 — Art direction: pencil doodles on notebook paper (owner's
  pick of two prototypes).** Built both side by side: A = the 3D models
  through a pencil post-process shader, B = a new 2D view with doodle
  recipes. Owner picked B: it reads as "playing on a sheet of paper", fits
  the handwriting input, and is lighter (+15 kB, ~0.2 ms/frame). B is the
  default; the 3D view stays behind `?art=3d` (both fill `FieldView`).
  Prototype A stays on its local branch, unmerged.
  Same day: the three ships got their own doodles (all three drew FALCON),
  and the ship got hit / dazed / destroyed animations (owner's ask).

- **2026-10-08 — Reviews move to a dedicated quiz chat (owner's design).**
  One chat per feature teaches; one long-lived chat quizzes (`/quiz`, and a
  Mon/Wed/Fri Routine bound to that chat) on due concepts and the week's
  features. Progress split by writer: feature chats add rows to
  `CONCEPTS.md`, the quiz chat alone writes `REVIEWS.md` on its own branch,
  so they never conflict. Chosen over one shared file (both sides editing
  the same table → merge conflicts) and over a claude.ai Artifact database
  (works across chats, but a second system to learn and keep running).

- **2026-10-08 — Every change is a tutoring session (learning-loop skill).**
  Owner's ask: learn by back-and-forth, grounded in learning science. The
  owner thinks first (pretesting, generation), we reason together, Claude
  builds and walks through (worked examples with subgoals, PRIMM), then 1–2
  retrieval questions; concepts get spaced reviews in
  `docs/learning/PROGRESS.md`, and help fades into "your turn" tasks.
  Chosen over explanations alone (re-reading gives an illusion of
  competence) and over quizzing on every change (overload): ≤ 2 questions
  per message, "just do it" skips the waiting.

- **2026-10-08 — Engineering practices + readability refactor (no
  behavior change).** Owner's ask: readable, self-explaining code and every
  change explained, for learning. Wrote `docs/ENGINEERING.md`,
  `docs/ARCHITECTURE.md` (patterns tour) and the `explain-change` skill;
  `AGENTS.md` now requires an explanation per change. Refactored the four
  hotspots instead of a rewrite (the architecture was sound; a rewrite
  can't be reviewed or learned from): GameScene 1287 → ~470 lines with HUD
  components in `ui/hud/`, constants split into `config/tuning/` behind a
  barrel, named palette + `textStyle()`, Swarm's 11-parameter `makeAlien`
  → an `AlienSpec`. A golden-master test (fixed-seed bots + a match) proved
  every step kept the game identical. Details: `docs/learning/2026-10-08-readability-refactor.md`.

- **2026-09-30 — Merged the phone battle HUD with the desktop board and
  the attack gauge.** Both views run together: the dock (in the canvas,
  every screen) and the board beside the canvas when it fits; the dock took
  the board's colors (incoming pink, danger red). Owner's 4 battles on the
  dock build (desktop app, keyboard, one meter, before the gauge) confirm
  the gauge pick: placed 4, 2, 5, 6 (44–80 s); SEND took 225–425 of
  392–761 energy while the power got 0–140, and 3 of 4 KOs came with the
  bar under the power's cost (FREEZE 0 right after a SEND 100; BLAST never
  pressed; SHIELD pressed 3× unaffordable). No KO was a sent alien (they
  were 2–4 of 20–39 kills). Aim was clicked only in the first 7 s of 2 runs.

- **2026-09-30 — Phone battle HUD = a dock under the energy meter + edge
  glow + haptics (M8, phone half).** Owner's pick of three (top strip under
  the score: closer to the eyes but ducks whenever an alien enters; ambient
  only: no tiles, so no hand-picking or seeing who is about to fall). The
  dock is the only portrait strip never over the field and it sits by the
  thumbs; the glow brings attacks to the eyes. The glow is for incoming
  only: in 20 simulated matches "2+ aim at you" toggled ~10×/min (re-picks
  every 1.5 s), so aim is shown on the tiles and chip instead. `BattleActions`
  gained `aimBy(strategy)` for the chip (phones had no way to change
  strategy once the stand-in line went).

- **2026-09-30 — Power balance by simulation (no numbers changed yet).**
  Owner's 28 runs: presses a power almost only at a full bar, sits full
  40–73% of the time, loses 55–80% of energy to overflow, and half the
  lives lost in v2 runs went with the bar full; SHIELD blocked 3 and 5 hits
  in two battles. Bots now blast when the owner does (not at the last
  moment), so powers compare fairly; "sharp" bots give each power's
  ceiling. Played like the owner (ace), powers are even: solo 3 lives
  220/231/222/222 s (FREEZE/SLOW/BLAST/SHIELD), ace mirror battles 13/14/14/9%
  wins per seat (fair 12.5%). Outliers: flawless BLAST (solo 457 s, battle
  30% vs 2–10%), and SHIELD at low skill (rookie mirror 27% vs SLOW 2%).
  In the real lineup an ace wins 36% with BLAST, 35% SHIELD, 25% FREEZE/SLOW.
  Cost changes can't fix a ceiling or a floor (BLAST 65–75 weakens it for
  owner-like play first; SHIELD 60 hurts aces more than rookies); SLOW's
  FACTOR is the touchiest knob (0.40 → ace 19%, 0.30 → dominant). Open for
  the owner: BLAST limit (e.g. the 3 lowest aliens: flawless 30 → 23%),
  SHIELD as the beginner pick, a "use your power" cue. Rookie/pilot power
  use is guessed, not fitted.

- **2026-09-30 — Desktop opponent board = a DOM overlay beside the canvas
  (M8).** Rejected a wider Phaser layout (moves every HUD position, breaks
  FIT on phones, touches all scenes) and a second canvas (own hit tests,
  text and DPI handling). DOM gives crisp text, free clicks and CSS layout,
  and the game canvas is untouched; the board reads only tiles + events.
  Built on desktops and shown while the sides fit a column: full tiles,
  compact tiles in an Artifact panel (the first build needed 256 px per
  side and showed nothing there), and in a nearly square window the game
  shrinks up to 25% to make room. Found on the way: Phaser `CENTER_BOTH`
  + the flexbox centered the canvas twice (300 px right at 1920, 65 px low on phones), so Phaser's
  centering is off now.
- **2026-09-30 — Separate attack gauge: sending pays (owner picked A).**
  Kills charge the power meter in full; their value pays off incoming first
  and the rest fills an attack gauge that only SEND spends (like Tetris 99,
  where attacks come free with clears). Mirror matches (250, half never
  send): senders now win — aces 61/39, pilots 67/33 (were 40/60 with one
  meter). Mixed lineup: 34 attacks per match (was 28), matches ~83 s. When
  bots send (gauge 25 / 50 / 100) barely matters (ace wins 88 / 87 / 81%).
  Kills during a time power still charge nothing, so FREEZE can't farm
  attacks. The `reward` message and `KO_ENERGY` lever were removed.
- **2026-09-30 — Owner's M7 battles (2, Android phone, keypad).** Won one
  (114 s, 66 kills) with zero incoming attacks all match; lost one (55 s,
  4th) under 10 attacks in 55 s, mostly from the two aces. Aim stayed on
  random both times. Being targeted decides a lot; the battle UI must show it.

- **2026-09-30 — Targeting, KO credit and badges (battle royale M7); the
  tile contract for the battle UI.** Tetris 99's four strategies plus a seat
  picked by hand, re-picked every 1.5 s; KO credit to the sender, else the
  last attacker within 10 s; badges from KOs, +25% per level; defense bonus
  when several aim at you; bonus weight = heavier cancel + extra darters.
  `match.tiles()` is what the UI (and later the server) shows of each
  player, so the UI chats can build on it without touching the sim.
  **Finding:** sending still doesn't pay. Mirror matches (8 aces, half never
  send, 300 matches): non-senders win 60/40; attack ×1.5 55/45, ×2 48/52,
  ×3 50/50, KO +50 energy 57/43, send only at a full bar 57/43. It's a
  public good: the sender pays, every opponent (other senders too) shares
  the damage, and non-senders keep their bar for FREEZE. Levers kept in
  `MATCH` (off); the fix is a design call for the owner (see §6).
- **2026-09-30 — Owner's first battles (6 runs, desktop keyboard, M6
  build).** Placed 6, 1, 4, 2, 5, 5 (an ace bot on the same seeds: 3, 3,
  1, 1, 2, 1). Answers stay fast (0.9 s / 2.6 s); the KOs came from board
  management: out of energy in 4 of 5 (once right after a SEND left < 10
  for FREEZE), a 13 typed for 15, the sent (ringed) alien picked over a
  closer lumberer, one easy darter reached with a full bar. No KO was a
  sent alien, but 3 of 5 had attackers on the board.

- **2026-09-30 — Merged the powers rework into the battle branch.** One
  POWER input and the picked power carry into battles (bots play FREEZE).
  Bots keep the M4 time-power rule fitted to the owner (on at 2 open aliens
  near the ship, off once the board is clear), which replaces the y-line
  rule and its micro-freezes; BLAST/SHIELD keep theirs. "Powers never pay
  for themselves" extends to battle: kills while a time power runs cancel
  no incoming either. SEND takes the left gutter (the owner played M6 that
  way). After the merge, solo with 3 lives (8 seeds): ace FREEZE 230 s,
  frozen 20%; ace BLAST 490 s, far above the rest (open, powers chat).

- **2026-09-29 — SEND, incoming queue and cancel; battle playable (battle
  royale M6).** An attack is a message `{from, cost, aliens: [{kind,
  ability}]}`: the sender's field decides what the tier buys, the receiver
  rolls sums and columns, so it replays from each field's own log. Sent
  aliens are added on top (they don't hold back the field's own spawns) but
  obey readability and the on-screen cap; kills pay off incoming first.
  Menu BATTLE (beta): you + 7 bots, SEND in SLOW's gutter (unused by owner
  and bots; ship powers are being redesigned). Measured (100 matches):
  attacks shorten matches 94 → 73 s, but sending is **neutral for the
  sender** (aces win 84% sending or not): random targets give no reward.
  Badges/KO targeting (M7) are meant to fix that; making sent kills give no
  energy was tried (≈ neutral too) and left for the owner.

- **2026-09-29 — Battle match: one seed, messages in, sudden death (battle
  royale M5).** `Match` steps N fields on one seed (same base aliens for all;
  fair and compressible online) and only talks to them through logged
  messages (`standing`), so a field still replays from seed + log: the seam
  the server will use. Measured (`npm run match`): with one life, matches
  end on their own (8 mixed bots ~2 min; aces win 55–80%; darters cause
  ~65% of KOs), so `dMatch` rarely binds (aces' own score is higher). But a
  perfect instant solver survived 20 min at max difficulty: raising the curve
  can't bound a match, so from 5:00 sudden death speeds aliens up without
  limit (perfect player out at ~6 min). Same-step KOs rank by score, then seat.

- **2026-09-29 — Bots use FREEZE like the owner (battle royale M4).** From 72
  owner freezes: on when ≥ 2 unanswered aliens are up and the nearest is
  ~170 px away (energy usually ~full), off once the board is clear (~3.2 s).
  Bots copy that rule per level. A perfect freezer outlived the owner 2×
  (ace 600 s cap, 179k): 6 of the owner's 9 hits came with energy to spare,
  so each dangerous moment now goes unnoticed with `MISS_DANGER` (ace 0.2 →
  293 s, 80k, 25% frozen vs owner 266 s, 74k, 27%). A/B: FREEZE lifts
  survival ~1.3× (rookie), 1.5× (pilot), 2.6× (ace). No SLOW: unused by the
  owner and under redesign in the powers chat.

- **2026-09-29 — Bots think per addition and are fitted to the owner.**
  Measured by answer time (not solve time, which mixes in entry time, slow
  aliens left for later and ship travel), the owner answers 2-ball sums in
  1.15 s and 3-ball in 2.27 s: each addition costs the same, while bots
  charged per ball and made the 3rd ball nearly free. Bots now pay per
  addition (`PER_ADD × (balls − 1)`), read ahead while their shot lines up,
  and were fitted with `npm run bots:fit`: ace 1.30 / 2.35 s ≈ owner, pilot
  1.87 / 3.42 s, rookie a guess until a beginner playtests.

- **2026-09-29 — Ship = look; the player picks ONE power (FREEZE / SLOW /
  BLAST / SHIELD); powers never pay for themselves.** Replayed runs showed
  FREEZE on 24–29% of the time because kills made while frozen paid back
  40–50% of its cost, which also erased SLOW's efficiency edge. Tying a power
  to each ship was rejected (every new look = balance work, a must-pick
  ship, a new bot rule); ships stay unlimited cosmetics and powers are a
  small data set played by bots per EFFECT. No power's kills charge energy,
  so BLAST no longer needs a full bar (60) to stop a snowball. Bots (24
  seeds): rookie/pilot survive within ~±10% across the four in both 3-life
  and 1-life play; open issue: an ace with FREEZE and 1 life lasts 301 s
  vs 100–190 s for the others (many ~1.6 s micro-freezes).
- **2026-09-28 — Swooper: a 2-ball alien that enters from the side.** Flies in
  level from the left/right edge below the HUD band, then glides down, so
  fewer numbers start under the top HUD and the field gets a new pattern
  (manta-ray model `alien_swooper`). 30% of 2-ball spawns. Readability: its
  sweep is its remaining flight, its spawn needs the path clear, and a flight
  held up on screen turns down early; soak with only swoopers = 0 overlaps.
  `npm run bots` (20 seeds): at ×1.0 descent it was a bit deadlier than a
  darter for pilots (starts lower), so it descends at ×0.9; survival in the
  normal mix is now at or above the old baseline for every level.

- **2026-09-29 — Numbers win over the HUD; playtest build ships its models.**
  Second playtest (3 runs, desktop app + keyboard, 241–358 s, 64k–97k pts):
  alien numbers sat under the top HUD for ~half of every run and 36–56% of
  FREEZE time. HUD pieces and pops now fade while an alien is under them
  (chosen over moving the HUD, which has no free space in portrait). The
  playtest page showed voxel fallbacks (no .glb hosting), so all ships looked
  the same; its build now loads models from base64 JSON.

- **2026-09-28 — Splitlings keep their parent's pace, hatch, and stagger
  (first phone playtest).** 4 logged runs (Android app, keypad): splitlings
  caused 8 of 14 hits, fell at 123 px/s vs the parent's 67, and 7 of 8 hit in
  same-step pairs (2 lives at once; on the last life it ended the run twice,
  saving it twice — fixed: a knocked-out field ignores further hits). Now
  children move at 70%, hold 0.7 s after landing and land 40 px apart in
  height. Bot A/B with every spawn a splitter: survival rookie/pilot/ace
  35/47/66 s → 60/84/95 s; in the normal mix splitlings fell from 49% to 19%
  of ace hits. Owner's pace: 2-ball 3.3 s (≈ ace), 3-ball 6.8 s (slower than
  every bot); FREEZE on/off every 10–15 s, SLOW almost unused.

- **2026-09-27 — Playtests log themselves to a claude.ai Artifact db.** The
  owner just plays; each finished run is saved (seed + input log + what the
  sim can't see) so Claude can replay and measure it later instead of
  choosing metrics up front. Chosen over a server or analytics service: no
  backend, private to the owner, and the replay makes the log tiny. Only
  active inside the Artifact (no `window.claude` elsewhere). Builds carry
  their git commit (`__BUILD_ID__`) so a run replays with the same rules.

- **2026-09-27 — Bot v1: human-like solver on the real inputs (battle royale
  M3).** Bots see only the screen and act only through `field.apply()`, so
  they can't cheat and replay exactly. Three levels from the design table.
  Simulation findings (8 seeds, no powers): rookie/pilot/ace survive ~90/110/
  105 s with 3 lives (~55/70/70 s with 1); aces earn difficulty by scoring,
  so skill shows as score (3k/10k/27k), not survival. Half of ace deaths were
  splitlings: two full-speed darters mid-field ≈ 1.6 s for two sums. Slower
  splitlings (70%) gave aces +10 s; left for the owner to decide. Bots
  interrupt a sum for a much worse threat (like people do).

- **2026-09-27 — The whole field is sim, driven by inputs (battle royale
  M2b).** Ship, bullets, targeting, the typed answer (incl. wrong auto-clear),
  scoring, lives, hit recovery, energy and SLOW/FREEZE moved from GameScene
  into `Field`; the aliens part became `Swarm`. The field changes only via
  `apply(FieldInput)` + `step(dt)` and reports events; GameScene is now input
  mapping + presentation (1449 → ~930 lines). Inputs apply at once but are
  logged with their step, which replays identically (an input between steps
  N and N+1 = start of step N+1), so UI response stays instant. Tests replay
  runs exactly from seed + log. Found while testing: Phaser 3.90 re-delivers
  queued keys within a frame (pre-existing: 20 presses → 49 calls); fixed
  with `onKeyDown`, which drops repeats of the same event object.

- **2026-09-27 — Phaser-free `Field` + fixed 60 Hz timestep (battle royale
  M2a).** Aliens, spawners, the game clock and the readability guard moved
  from GameScene into `src/sim/Field.ts`, driven by `step(dt, ctx)` and
  reporting events; bots and a server can now run fields headless (Vitest
  soaks 32 simulated minutes in < 1 s with zero box overlaps). The rules run in
  fixed steps (a variable frame delta made runs differ by device; the ship's
  per-frame lerp was also faster on 120 Hz screens) and the renderer
  interpolates between steps instead of snapping. Ship/bullets/score/energy
  follow in M2b.

- **2026-09-27 — Seeded random numbers + game clock (battle royale M1).** Game
  rules draw from a seeded mulberry32 `Rng` instead of `Math.random()`, with
  spawner streams keyed by spawn number so an extra draw (a retry) doesn't
  shift every later alien, and rule timings read the game clock instead of
  `this.time.now`. Needed for replays, bots and a server that re-runs a
  field. Side effect: solve times no longer count paused time (they used to).
- **2026-09-27 — Battle rules, bots and contracts decided
  (docs/MULTIPLAYER_DESIGN.md §6–§10).** Owner's picks: targeting = Tetris 99
  strategies AND tapping an opponent; SEND = one tier button (25/50/100,
  strongest affordable, hold for smaller); one life in battle (solo keeps 3);
  8-player matches first. Bots are real players on their own field sim using
  human inputs (rejected: timer-based fake bots). The design is not frozen:
  content (monsters, tuning) changes any time; only the contracts (inputs,
  attack shape, what others see, time model, KO rules) get locked before the
  phase 1 server. Cloud sessions push their `claude/*` branch, not `master`.

- **2026-09-27 — A separately drawn stem joins its digit.** The second lab
  session split a two-stroke 9 into "0" + a 1-like stem ("96" → "06"): a thin
  stroke touching the digit's right edge now always joins it. Also measured
  that the player's own samples beat more hand-traced templates (94–97% vs
  86% on unseen drawings), which makes per-player templates the next step.
- **2026-09-27 — Templates traced from real handwriting.** The owner's first
  lab session read 25/36; every 4 failed because it is written in one stroke
  (down-left, across, up, down the stem), a shape no template had, so $P chose
  9. Six traced templates (4 ×2, 3, 2, 6, 7) raised it to 33/36 without
  hurting the synthetic tests. Adding templates is the cheap fix; if more
  players' styles miss, the next step is per-player templates recorded in-game.
- **2026-09-27 — Handwriting is tuned on real samples from a lab page.** On
  the owner's phone some digits misread (4 → 9) although synthetic tests
  passed, so the synthetic hand isn't a good enough measure. A hidden
  `?lab=draw` page (shipped in the build so it runs on real phones) records
  prompted digits on the game's own pad and exports them as JSON test data;
  `realSamples.test.ts` replays them through the game's reader. Drawing stays
  an opt-in mode (keypad default) meanwhile.
- **2026-09-27 — Handwriting input: $P recognizer, overlap-split digits read
  together after a pause.** Own $P point-cloud recognizer (no ML model, no
  browser handwriting API, which iPhone Safari lacks): tiny, ~2 ms per read,
  and deliberately blind to stroke order/direction, so ~25 shape templates
  cover 0–9. Of the two ways to enter 2 digits, neither alone was enough: one
  digit at a time after pauses lets "1" match and fire before "12" is done,
  and splitting a finished drawing by gaps breaks on 4/7 bars. So strokes are
  grouped into digits by sideways overlap as each ends (a stroke that begins
  the next digit may start anywhere to the right), and all digits are entered
  together after 300 ms. Trade-off: digits that overlap sideways merge (the
  pause still separates them), and an open 4 whose stem stands clear of its
  bar reads as two strokes of different digits. The pad replaces the keypad
  (switch saved in localStorage), and the ink becomes the answer stars. Added
  Vitest for the recognizer.
- **2026-09-27 — Answer feedback at the target and in the stars.** The typed
  number was small, below the ship and cleared on fire, so a right answer
  gave no clear signal. Now: gold/red states (wrong clears itself), lock-on
  brackets on the matched alien, the answer kept until the kill, the solved
  sum popped on each kill, and the owner's idea of background stars forming
  the answer (glyphs pre-sampled so they form in ~150 ms; kept dim and deep
  so the balls stay the most readable thing). Handwriting input will
  reuse the stars to show what the recognizer read.
- **2026-09-25 — Monster abilities as a hook-based system on top of the
  movement kinds; Shielded, Blinker and Splitter first.** An ability is a
  separate field from the movement `kind`, with `update`/`onHit`/`onKilled`
  hooks plus an `AbilityHost` for field effects. The first three each prove one
  hook (hide state, absorb a hit, spawn on death), and Hider/Orbiter/Worm reuse
  them. Balance rule (owner): the harder an ability is to kill, the slower it
  moves and the longer its pattern takes (Shielded = slow lumberer, Blinker =
  long-patrol strafer with a slow dive, Splitter = slower darter). A shield
  break charges energy like a kill; blinking runs on real time. Solo play
  unlocks them by difficulty with a one-time intro banner. Four new models:
  `alien_shielded`, `alien_blinker`, `alien_splitter`, `alien_splitling`.
- **2026-09-25 — Bullets hit only the alien that was solved.** Replaces "any
  alien in the path is hit": results are unique on the field, so a bullet
  carries its target and flies through everything else. A stray shot can no
  longer kill an unsolved alien or break a shield (owner's call).

- **2026-09-25 — SLOW and FREEZE are both player powers.** The first playtest
  found 60% slow too weak; rather than pick 30% slow vs full freeze, the player
  gets both (two buttons, one meter), and they differ in trade-off: SLOW is
  cheaper per saved second, FREEZE is total but burns twice as fast. The M
  playtest switch and the one-shot 1.5 s stop were removed.

- **2026-09-25 — Monsters get their own movement; readability boxes replace
  fixed lanes.** The kind moved from World3D (random) into `Alien`, so logic
  and a future shared sim know it. Darter zig-zags, lumberer stomps, the new
  strafer patrols the top then dives (read time + a telegraphed windup), and
  the drifter crosses as a non-lethal energy bonus outside the spawn caps.
  Sideways movement broke the lane guarantee, so each alien owns a box: the
  spawner reserves sweep columns near the top, and a runtime guard never lets
  a move enter another box (queue/turn around instead). Soak-tested: 0
  overlapping frames in ~8.5 min of simulated play.
- **2026-09-25 — Energy bar + slow time (two playtest modes).** Kills charge a
  0–100 meter (more balls, bigger digits, fast solves, streaks charge more).
  Slow time spends it on the player's own field: `drain` (60% while draining)
  vs `stop` (1.5 s full stop for 50), switchable in game with `M` so the owner
  can compare by playing; tuned to buy similar field-time per energy. Energy
  rules live in Phaser-free `src/sim/energy.ts` with a per-spender meter, so
  "send" plugs in later and a server sim can share it. Lives stay a constant
  (`PLAYER.LIVES`) for 1-vs-3 tests; with 1 life the hit freeze is
  unreachable. The hit freeze became a pause-safe countdown.

- **2026-09-25 — Battle-royale direction (docs/MULTIPLAYER_DESIGN.md).** Kills
  charge an energy bar (no automatic attacks), spent on sending aliens or
  slowing your own field; kills cancel incoming aliens first. First matches
  8–16 players with bots; leaning to one life. Single-player fun comes first.
  Accidental ball overlap is a bug; hiding numbers is only allowed as a monster
  ability.

- **2026-09-25 — Project renamed MeticWeb → Metic99.** Repo, package and folder
  renamed to reflect the Tetris 99-style battle-royale goal. The GitHub repo is
  now `jjgp13/Metic99`, so the Pages URL moved to `jjgp13.github.io/Metic99`.

- **2026-09-24 — Player picks a ship; monsters spawn with random models.** All
  three ship styles are kept and chosen on the menu (saved in localStorage) so
  players can express a preference. The three monsters are cosmetic and random
  for now; per-monster behavior/character comes next, then more variations. The
  build now renders transparent icons (`public/assets/icons/`) for 2D menus.

- **2026-09-24 — Example monster and ship models for choosing an art direction.**
  Recipes built for `alien_darter` / `alien_lumberer` / `alien_drifter` and two
  alternative ships (`ship_dart` sleek, `ship_pod` chunky). They are not in the
  game yet (pending the owner's pick). Aliens face -Y with a per-model
  `socket_balls` at +Y. Kit gained `lathe`/`radial`; `contact_sheet.py` makes
  `art/previews/comparison.png`.

- **2026-09-24 — Number balls are glass spheres with the digit inside; first
  Blender model in game.** Balls moved from voxel chips to a tinted glass sphere
  (custom fresnel shader, unlit) around a camera-facing digit, color = operation.
  Future ideas to prototype: eyelid balls that hide the number, monsters built
  from balls. Blender pipeline (`art/blender`) builds `ship_player.glb`, loaded
  by BootScene/World3D with voxel fallback for missing models.
- **2026-09-24 — Art style adopted: script-built low-poly (docs/ART_SPEC.md).**
  Chunky, flat-shaded, palette-textured models generated by Python recipes run
  headless in Blender 5.2 → `.glb`, with previews rendered on the CPU (Cycles).
  Chosen because an agent can author a model in ~40–80 lines (a test ship took
  166 tris, a monster 648) with no texture painting. Ball colors are reserved
  for math operations, so monsters avoid them.

- **2026-09-24 — 3D playfield with Three.js; same top-down view.** Gameplay is
  drawn by Three.js under a transparent Phaser canvas (Phaser keeps menus, HUD,
  keypad, input, audio). Three.js chosen over Babylon.js/Unity WebGL for desktop
  + phone browsers (small bundle, fast mobile load, TS shareable with a future
  Node game server). Sprites are voxelized into 3D models so the art style is
  kept with no new assets. Alien/Bullet became plain state objects and arcade
  physics was dropped for a swept bullet hit test; the renderer only reads a
  per-frame snapshot. Long-term goal set: Tetris 99-style battle royale.

- **2026-06-02 — Locked target holds still; freeze-then-slow hit recovery.**
  Replaced the "flees upward" (`RETREAT_SPEED`) behavior — an answered target now
  simply STOPS (still can't cost a life, point-blank shot if at the muzzle),
  which reads cleaner and removed the off-top stale-lock special case. Replaced
  slow-mo recovery (`SLOWMO_MS`/`SLOW_FACTOR`) with a hard FREEZE of the field for
  `RECOVERY.FREEZE_MS` (3s) on a non-final hit, then a flat `POST_HIT_FACTOR`
  (80%) for the rest of the run while the difficulty curve keeps ramping. Gives a
  clear "catch your breath" beat and a lasting but non-crippling slowdown.

- **2026-06-02 — Server-gated score submission + 3–6 char names.** Players now
  choose 3–6 initials (DB `name` widened to `varchar(6)`, regex `{3,6}`). Score
  writes are no longer a direct anon INSERT: anon INSERT on `scores` is revoked
  and the only write path is two `SECURITY DEFINER` RPCs (`start_match` /
  `submit_run`, in `supabase/match-gate.sql`). A run opens a single-use,
  server-timestamped match at start; submission atomically consumes it,
  plausibility-checks score vs elapsed time, and inserts — all in one
  transaction. Chosen over Edge Functions (no service-role exposure, no CORS, no
  deploy tooling) for the same enforcement. Blocks REST/devtools forgery and
  flow-skipping bots; cannot stop a patient scripted "start→wait→submit" (no
  client-scored game can). Rate limiting still TODO.
- **2026-06-02 — Main menu screen.** Boot now opens `MenuScene` (PLAY / HOW TO
  PLAY / SCORES) instead of starting gameplay directly. `HowToPlayScene` explains
  the rules; `LeaderboardScene` gained a **browse** mode (fetches the board for the
  menu's SCORES button, BACK → menu). Game over now returns to the menu. Gives the
  arcade a proper front-end and a place to read the rules and the world board.
- **2026-06-02 — Score-led difficulty + "unsolved" spawn cap; double-bullet fix.**
  Difficulty is now `d = max(dScore, dTimeFloor)` (score earns difficulty; time
  is only a gentle floor). The primary spawn gate is the count of UNSOLVED aliens
  (`MAX_UNSOLVED` 1→3, driven by `dScore` alone) so the player starts with one sum
  at a time and the board opens up as they score — fixing "4 on screen is too
  much." A locked target that flees off the top is resolved as a kill to avoid a
  stale-lock softlock. Also fixed a double-bullet bug: the ship no longer fires a
  second shot while one is already in flight at the locked target (re-fires only
  if it misses).
- **2026-05-29 — Arcade global leaderboard on Supabase + GitHub Pages.** Game
  over → 5-char initials entry → submit → world rank + top-N board. Browser uses
  `supabase-js` with the public anon key (RLS + CHECK constraints protect the
  `scores` table; score capped at 1,000,000). Frontend degrades gracefully when
  creds are absent. Hosting via a Pages Action; `index.html` hardened for mobile.
- **2026-05-29 — Board-aware spawn pacing + hard-enemy cap.** Spawns are gated by
  a weighted cognitive-load budget (`THREAT_BY_BALLS`/`threatBudget`) instead of a
  blind timer, and at most one multi-number "hard" enemy appears until late game
  (`SECOND_HARD_AT`). Fixes difficulty spikes/flooding once 2- and 3-number
  enemies mixed; load now stays bounded and recoverable.
- **2026-05-29 — Lock the fired target until destroyed.** Clearing the typed
  answer on fire used to drop the target, so a committed alien stopped fleeing
  and advanced again mid-flight. A persistent `lockedTarget` keeps it retreating
  until the bullet actually hits it.

- **2026-05-29 — Enemy personality by ball count + skill-based scoring + mastery
  stats.** Speed scales inversely with ball count (easy 2-number sums dart in,
  hard 3+ lumber). Score = `BASE × ballCount × speed × difficulty × combo` so
  fast, hard, late, streak play pays more. Persistent mastery (best combo, kills,
  fastest solve) yields a rank on game over — progression feedback without
  altering difficulty. (Drifter bonus enemy + handwriting still to come.)

- **2026-05-29 — Keep only slow-mo recovery; refactor Alien for personalities.**
  Slow-mo was the chosen recovery feel, so the pushback/clear/slowmo_push modes
  and the M toggle were removed. `Alien` now takes an `AlienConfig` object and a
  `behavior` field (`descend` today) with a `ballCount` getter, so enemy
  personalities and new types can be added without reworking the scene.

- **2026-05-29 — Locked target flees upward instead of freezing.** A correctly
  answered alien now turns and runs from the player (`RETREAT_SPEED`) rather than
  stopping in place — reads as "running away" and still gives the ship time to
  line up the shot fairly.
- **2026-05-28 — Freeze the locked target + cap on-screen aliens.** A correct
  answer was unfairly punished because the target kept falling while the ship
  slid over; now the target freezes (and can't cost a life) once typed, the ship
  slides faster (`MOVE_LERP` 0.12→0.22), and the field is capped (4→8) so it
  can't over-populate into an unrecoverable state. Point-blank shot resolves a
  target frozen at the muzzle.

- **2026-05-28 — Pause hides the field.** A pause (P / button) freezes everything
  and hides aliens + numbers so the player can rest without solving sums on break.
- **2026-05-28 — Hit-recovery grace, mode-switchable for playtesting.** Losing a
  life on a crowded screen death-spirals; give breathing room. Four modes
  (slowmo / slowmo_push / pushback / clear) are cyclable at runtime via `M` so the
  best feel can be chosen by playing; default `slowmo`.

- **2026-05-28 — Add self-updating AGENTS.md.** Capture architecture, difficulty,
  asset layouts, and roadmap so context is portable across machines/sessions.
- **2026-05-28 — Aliens carry ≥2 balls and fall in fixed lanes.** A sum needs two
  numbers; lane-based falling (no homing) stops aliens/numbers from overlapping
  and becoming unreadable. Spawns skip if no clear lane.
- **2026-05-28 — Logistic difficulty ramp.** Sigmoid `d(t)` gives a warm-up, a
  smooth ramp, and a plateau; drives speed, spawn rate, ball count and digit size.
- **2026-05-28 — Static sprites, animations deferred.** Initial frame slicing was
  on the wrong axis; verified real layouts and show single frames for now.
- **2026-05-28 — Replace tiled background with sparse parallax starfield.** Tiling
  `star.png` looked like an ugly diamond grid.
- **2026-05-28 — Adopt Phaser 3 + Vite + TS; rewrite from Unity.** Better web load
  time, mobile support, native handwriting/WebSocket paths, fast iteration.
