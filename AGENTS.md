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
  is no longer used (hits are a swept test in `GameScene.moveBullets`).
- **Three.js** — renders the gameplay playfield in 3D (`src/render3d/`). Chosen
  over Babylon.js / Unity WebGL for desktop + phone browsers: small bundle
  (~150 kB gz), fast mobile load, and plain TS that a future Node game server can
  share with the client.
- **Vite** — dev server (HMR) + production bundler.
- **TypeScript** — strict mode.
- Node.js LTS required. `npm install` → `npm run dev` (port 5173) → `npm run build`.

## Project layout

```
public/assets/        Game art/audio/fonts (reused verbatim from the Unity repo)
  sprites/  sounds/  fonts/
src/
  main.ts             Phaser.Game config + scene registration
  config/
    constants.ts      All tunable gameplay/layout values
    difficulty.ts     Logistic difficulty curve
    ships.ts          Player's ship choice (menu picker, saved in localStorage)
  scenes/
    BootScene.ts      Preloads assets; defers animations (static frames for now)
    MenuScene.ts      Title screen: ship picker + PLAY / HOW TO PLAY / SCORES
    HowToPlayScene.ts Static rules screen reached from the menu
    GameScene.ts      The core loop: spawn, input, targeting, combat, HUD.
                      Owns plain game state (shipX, aliens[], bullets[]) and
                      hands World3D a snapshot every frame.
    NameEntryScene.ts Arcade 5-char initials entry shown at game over
    LeaderboardScene.ts Global top-N board; dual-mode (post-run / menu browse)
  services/
    leaderboard.ts    Supabase global high scores: startMatch + match-gated
                      submitScore, plus getTop/getRank reads
  sim/
    energy.ts         Phaser-free energy rules: energyForKill, EnergyMeter
                      (charge/spend/drain per spender), SlowTime (slow | freeze).
                      Kept pure so a future server sim can share it.
  objects/
    Alien.ts          Pure alien state (x/y, digits, result, `kind`) + per-kind
                      movement patterns and readability box; no rendering.
                      Built from one `AlienConfig`.
    Bullet.ts         Pure bullet state {x, y, active}.
  render3d/
    World3D.ts        Three.js view: camera, lights, starfield, ship/alien/bullet
                      meshes, voxel-debris explosions, shake. Page-wide singleton.
    voxelize.ts       Extrudes a Phaser sprite frame into a voxel mesh (fallback art).
    NumberBall.ts     Glass sphere with the digit inside (number balls).
art/                  3D art source (docs/ART_SPEC.md)
  palette/palette.json  Shared color swatches for all models
  blender/            metic_kit.py helpers, build.py, recipes/<model>.py
  previews/           Rendered top-down + 3/4 previews per model
public/assets/models/ Built .glb models loaded by World3D
public/assets/icons/  Transparent top-down model renders for 2D menus (build output)
docs/ART_SPEC.md      3D art style, budgets, axes, pipeline
docs/MULTIPLAYER_DESIGN.md  Battle-royale design: energy, attacks, backend plan
  env.d.ts            Types for Vite `import.meta.env` (Supabase env vars)
```

### Global leaderboard & publishing

- **Backend: Supabase** (hosted Postgres). Reads use `supabase-js` with the
  **anon public key** (public by design — top scores/rank are world-readable).
  No server to host.
- `scores(id, name varchar(6), score int 0..1_000_000, created_at)`; RLS allows
  anon `SELECT` of all rows. `name` is `^[A-Z0-9]{3,6}$` (the player picks 3–6
  initials at game over). `get_rank(s int)` RPC = `count(*)+1 WHERE score > s`
  (competition ranking; ties share a rank).
- **Score writes are server-gated (no anon INSERT).** Direct anon `INSERT` into
  `scores` is revoked, so a forged REST insert with the public key can't write a
  score. Two `SECURITY DEFINER` functions (anon-executable via RPC) are the only
  write path — schema in `supabase/match-gate.sql`:
  - `start_match()` → issues a single-use, server-timestamped `matches` row id;
    called by `GameScene` (via `startMatch()`) when a run begins.
  - `submit_run(p_match, p_name, p_score)` → in ONE transaction: atomically
    consumes the match (rejects missing/used, age <2s or >4h), plausibility-checks
    the score against elapsed time (cap `≈ elapsed·3000 + 5000`, far above real
    play), inserts the score, and returns `{row_id, rank}`. A rejected/failed
    submit rolls back, so a legit match is never burned.
  - `matches` has RLS on with NO policies (only the definer functions touch it).
  - **Honest limit:** this blocks devtools/REST forgery and bots that skip the
    flow, but — like any client-scored game — can't stop a scripted
    "start → wait → submit a plausible score". Per-IP rate limiting is not yet
    implemented (RPC has no easy IP access).
- Credentials come from Vite env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (baked in at build, public by design). `isLeaderboardEnabled()` is true only
  when both are present, so the game **builds and runs locally without them** —
  game over just returns to the menu instead of routing to name entry.
- **Navigation:** `BootScene` → `MenuScene` (ship picker ◀ ▶ / ←→, then PLAY /
  HOW TO PLAY / SCORES). PLAY →
  `GameScene`; HOW TO PLAY → `HowToPlayScene`; SCORES → `LeaderboardScene` in
  **browse** mode (fetches `getTop()` itself, BACK → menu).
- Game-over flow (when enabled): GAME OVER overlay → `NameEntryScene` (3–6 char
  length selector + initials) → `submitScore` (via the match gate) →
  `LeaderboardScene` (post-run mode, shows world rank) → `MenuScene`. All restart
  triggers route through one idempotent `proceedAfterGameOver()`; when the
  leaderboard is disabled it goes straight to `MenuScene`.
- **Hosting: GitHub Pages** via `.github/workflows/deploy.yml` (build on push to
  `main`, deploy `dist`). Supabase env injected from repo **secrets**. Vite
  `base: "./"` keeps asset paths relative so the project subpath works.
- **Mobile:** Phaser `Scale.FIT`+`CENTER_BOTH` (portrait), pointer-based keypad,
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
- **Motion polish:** aliens sway (yaw) and bank into sideways moves, the ship
  banks toward its target, the strafer shakes before it dives,
  explosions burst into voxel debris in the alien's colors with a flash from one
  reused point light (adding lights at runtime would trigger shader recompiles).
- **Models in play:** the player flies the ship picked on the menu
  (`RENDER3D.SHIPS`: FALCON `ship_player`, DART `ship_dart`, POD `ship_pod`; the
  pick is stored under `STORAGE.SHIP`). Each alien draws the model of its
  `kind` (`MONSTERS[kind].MODEL`: darter / lumberer / strafer / drifter), with
  its balls at the model's `socket_balls`. The kind lives in the `Alien` state
  (game logic picks it); `World3D` only draws it. Explosion debris uses the
  model's colors (`RENDER3D.ALIEN_MODELS`). The models' `anim_*` parts move
  with simple sine motion (`RENDER3D.ANIM`): darter tail wags, lumberer legs
  swing in step with its stomp (body lifts while stepping), drifter skirt spins
  and pulses, strafer wings flap (faster in windup/dive).
- One WebGL context for the whole page (singleton), hidden outside GameScene.
- Dev only: `window.__metic = { game, world }` for console inspection.
- **Art direction for new 3D models:** see [`docs/ART_SPEC.md`](docs/ART_SPEC.md)
  (script-built low-poly models from Blender, palette colors, reserved ball colors).

## Gameplay rules (current)

- Each alien carries **≥ 2 number balls** (a sum needs two numbers); `result` =
  sum of the balls. `enemiesInField: Map<result, Alien>` keeps results unique so
  a typed number maps to exactly one target.
- **Monster kinds** (`MONSTERS` in constants, movement in `Alien.advance`).
  3+ ball sums are always lumberers; 2-ball sums pick darter/strafer by
  `ENEMY.TWO_BALL_KINDS` weight:
  - **Darter** (2 balls): fast zig-zag dive (×1.25 speed, ±26 px around its lane).
  - **Lumberer** (3 balls): slow stop-and-go stomp: moves half of each
    `STOMP_MS` cycle and stands still for the other half (same ×0.85 average).
  - **Strafer** (2 balls, Galaga-style): flies into a band at the top, patrols
    sideways for `DIFFICULTY.STRAFER_PATROL_MS` (5 s → 2.8 s, time to read its
    sum), hovers and shakes for `WINDUP_MS` (telegraph), then dives fast.
  - **Drifter** (2 balls, bonus): crosses sideways through a mid band and
    leaves; **non-lethal**. Solving it gives `ENERGY_BURST` energy (plus normal
    score). It runs on its own spawn clock (first after 15 s, then every
    18–28 s, one at a time) and does **not** count toward any spawn cap. Stray
    bullets fly through it (it must be solved, not hit by accident).
- **Drifter energy:** a solved drifter charges its `ENERGY_BURST` on top of the
  normal kill energy (one `addEnergy()` call, capped by the meter) and pops
  "+N ENERGY" where it died.
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
     horizontal **sweep** (zig-zag width, patrol span) clears the sweep of every
     alien still above `ENEMY.ENTRY_ZONE_Y`, and its box clears everyone.
     No room → the spawn retries in `SPAWN_RETRY_MS`.
  2. **Runtime guard** (`GameScene.advanceReadable`): a move that would bring
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
- Input: on-screen keypad **and** physical keyboard (0–9, Backspace, Esc,
  Space = SLOW, M = slow mode, P = pause). Max 2 typed digits.
- **Energy** (`ENERGY`, `src/sim/energy.ts`): each kill charges a 0–100 meter by
  `BASE × ballBonus × digitBonus × speedBonus × comboBonus` (more balls, bigger
  average digit, faster solve, longer streak = more; ~8 for an easy early kill,
  30+ for a fast 3-ball streak kill). Overflow is lost. The meter only charges
  and spends; each use is a separate spender (`"slow"` now, `"send"` reserved
  for the battle royale). Per-run earned/spent totals show on game over.
- **Slow time** (`SLOW_TIME`): the player spends energy to slow their OWN field
  (alien movement + spawn clock); the ship, bullets and difficulty clock keep
  full speed. Two playtest modes, switched in game with `M` or by tapping the
  mode bar under the keypad (remembered in `STORAGE.SLOW_MODE`):
  - `slow` (default): field at 30% while energy drains 14/s (~7 s per bar).
  - `freeze`: field fully stopped while energy drains 20/s (~5 s per bar).
  Both are toggles: 10 energy to switch on, off when pressed again or when
  empty; switching mode while on keeps it running. Both buy the same
  field-time per energy (~5 s per full bar), so the playtest compares feel,
  not strength. Slow time **holds** (no drain) while the hit-recovery freeze
  already stops the field. The field is tinted while
  slow time runs.
- **Energy HUD** sits in the gutters beside the keypad (meter on the left with
  a mark at the current mode's activation cost, tall SLOW button on the right)
  plus a mode bar below it, so it never covers the field or keys in portrait.
- HUD (score, lives, difficulty bar, typed display) draws above gameplay
  (`depth 5`) so entering aliens never obscure it.
- High score persisted in `localStorage` (`metic-highscore`).
- **Pause** (`P` key or on-screen `II` button): freezes the field, difficulty
  timer, spawning and firing, and **hides all aliens + their number balls** (and
  the typed display) behind an overlay so the player can't solve sums on a break.
  Tap the overlay or press `P` to resume.
- **Lives** are a playtest constant, `PLAYER.LIVES` (3 by default; 1 = the
  battle-royale knockout rule). With 1 life the hit recovery below never runs:
  the only hit ends the game, so slow time is the sole safety tool.
- **Hit recovery**: on losing a life (but not the last) the whole field **freezes
  for `RECOVERY.FREEZE_MS` (3s)** so the player can read the board, then resumes
  at `RECOVERY.POST_HIT_FACTOR` (80%) speed for the rest of the run. The slowdown
  is flat (non-stacking) and the difficulty curve keeps ramping underneath, so
  absolute speed still climbs over time. The ship can still fire during the
  freeze (so a frozen board can be cleared). The freeze is a countdown that
  only runs while unpaused, so pausing doesn't eat it.

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

`MIN_BALLS` is fixed at 2. All knobs live in `src/config/constants.ts`; the
curve is in `src/config/difficulty.ts` (`difficultyAt(elapsedMs, score)`).

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
       readability boxes + sweep-aware spawner, animated `anim_*` parts.
       **Next:** monster abilities (docs/MULTIPLAYER_DESIGN.md §4).
7. [x] **Drifter bonus enemy** — non-lethal, crosses sideways; solving it
       gives an energy burst on top of the normal kill energy.
8. [ ] **Handwriting input** — draw a digit on a canvas overlay; recognize it as
       the typed number (alongside the keypad).
9. [ ] Other operations (subtraction/multiplication/division) via color-coded balls
10. [ ] Sprite animations + richer explosion/background VFX
10b. [x] **3D playfield (Three.js)** — same top-down view, voxel models built
       from the sprites, 3D starfield parallax, voxel-debris explosions.
11. [x] Leaderboard backend (Supabase) + world leaderboard — 5-char initials at
       game over, world rank, top-N board. **Needs Supabase creds + Pages setup.**
12. [ ] Publish on GitHub Pages (workflow added; enable Pages = "GitHub Actions"
       and add repo secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
13. [ ] **Battle-royale multiplayer (Tetris 99-style)** — see
       `docs/MULTIPLAYER_DESIGN.md`. Single player first: [x] energy bar + slow
       time (two modes under playtest; lives constant for 1 vs 3), [ ] alien
       movement patterns, [ ] monster abilities; then offline bots (and energy
       "send"), then the WebSocket match server (8–16 players to start).

## Conventions

- Keep all tunables in `config/constants.ts`; avoid magic numbers in scenes.
- Comment only non-obvious intent (per repo style).
- Verify changes: `npx tsc --noEmit` and `npm run build` must pass.
- **Git workflow:** feature branches are **local only** (never push them). Merge
  into `master` locally and push only `master` (pushing it deploys GitHub Pages).
- Commit trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

---

## Decision Log

Newest first. Format: `YYYY-MM-DD — decision — rationale`.

- **2026-09-25 — Stronger slow time: 30% slow vs full freeze.** The first
  playtest found 60% too weak. The modes are now `slow` (30%) and `freeze`
  (0%), both draining toggles tuned to ~5 s of saved field-time per full bar;
  the one-shot 1.5 s stop was dropped as the freeze toggle covers it.

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
