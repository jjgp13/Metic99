# Metic99 — Project State

Journal of what is integrated on `master`, what is in progress, what is
next, and what has actually been verified. Seeded 2026-11-08 from `AGENTS.md`
(Roadmap, Decision Log), `README.md`, `docs/ENGINEERING.md`,
`docs/ARCHITECTURE.md`, `docs/MULTIPLAYER_DESIGN.md`, `docs/NETCODE.md`,
`docs/SOLO_MODES_DESIGN.md`, `docs/ART_SPEC.md`, `docs/learning/*.md`,
`.github/workflows/deploy.yml` and `git log` on `master`.

This file summarizes and points. The source docs and commit messages stay
the evidence. The rule for this file: **a result is listed only if a doc or
commit message records it**. Code that exists is not proof that it works.

---

## 1. Snapshot

- **Baseline:** `master` at `c775211` ("Merge online play (netcode S0–S6)
  into master"), dated 2026-10-27. No later commits were on `master` when
  this file was seeded.
- **Where it stands:** solo play (Story + Endless) and offline battles vs
  bots are integrated. Online play is merged into the code but **not
  deployed**: there is no server host yet (Decision Log 2026-10-27).

## 2. Integrated on master

This is what the docs say is built and merged. It is not a claim that it
was verified; see §5 for that.

**Core game and Endless**
- The core loop: sums on numbered balls, typed via keypad, keyboard or an
  opt-in handwriting pad. Also: score-led difficulty, answer feedback,
  pause, hit recovery (freeze + pushback), and mastery ranks.
  (`AGENTS.md` → Gameplay rules; Roadmap 1–8)
- Monster movement kinds: darter, lumberer, strafer, swooper and the
  drifter bonus. Abilities: Shielded, Blinker and Splitter.
  (`AGENTS.md` Roadmap 6c, 6d, 7)
- Energy plus one picked power (FREEZE / SLOW / BLAST / SHIELD), with the
  2026-10-19 energy cut and power rebalance. A power-ready cue was added
  2026-10-20. (Decision Log)
- Endless world themes: the page and song of a beaten story world.
  Endless scores carry ship, power, world and survival time.
  (Decision Log 2026-10-20, 2026-10-21)

**Story mode**
- All 10 levels are built, sums only, each with a boss and its signature
  trick. (`docs/SOLO_MODES_DESIGN.md` §7 Level status, §8 L1–L7; Decision
  Log 2026-10-18 to 2026-10-20)
- Escalating waves and ~2-minute levels. (Decision Log 2026-10-19/20)
- The story map and save-and-continue. (Decision Log 2026-10-18/19)
- The level-clear sequence, the ending with credits and run time, and
  ship unlocks with the crayon ship and crown for finishers.
  (Decision Log 2026-10-20)

**Look and sound**
- Art: pencil doodles on notebook paper are the default; the 3D view is
  behind a URL flag. Story pages are animated. (Decision Log 2026-10-18,
  2026-10-19; `docs/ART_SPEC.md` header)
- Soundtrack: one shared music player for every screen, and wave-timed
  level songs. Battles are silent. (Decision Log 2026-10-20;
  `docs/MUSIC_PROMPTS.md`)
- iPhone sound plays with the silent switch on. (Decision Log 2026-10-21)

**Battles**
- Offline battle vs 7 bots ("BATTLE (beta)"), phase 0 milestones M0–M7
  done. M8: the desktop opponent board and the phone dock (edge glow,
  haptics) are done; results + fast-forward are open.
  (`docs/MULTIPLAYER_DESIGN.md` §10; `AGENTS.md` Roadmap 13)
- Online play, phase 1:
  - S0 determinism, S1 protocol, S2 server, S3 the server runs the match,
    S4 client network mode, S5 lag and load testing, plus launch hardening
    (room caps, rate limits, Origin check, compression, slow-motion guard).
    (`docs/NETCODE.md` Milestones and Journal)
  - Merged into master 2026-10-27, with the newer story rule code moved
    onto the deterministic math helpers. (Decision Log 2026-10-27)

**Leaderboards**
- Supabase world boards, server-gated through a single-use match ticket.
  There are boards per story stage and per run, and the Endless detail
  table.
- The game runs without credentials; the boards then show "offline".
- (`AGENTS.md` → "Global leaderboard & publishing")

**Tooling**
- Headless bot reports (`npm run bots`, `bots:story`, `match`, `bots:fit`,
  `waves`), playtest replay (`npm run playtest`), the determinism lab and
  its recording, and network bot clients (`npm run net:bots`).
  (`AGENTS.md` → Tech stack)

**Ways of working**
- `docs/ENGINEERING.md`, `docs/ARCHITECTURE.md` (pattern catalog §2.1–2.21),
  the `learning-loop`, `quiz` and `explain-change` skills, and the
  `docs/learning/` notes. See `LEARNING_LOG.md`.

## 3. Work in progress (not integrated)

Only what the docs record is listed here.

- **The netcode milestone branch.** `docs/NETCODE.md` ("Starting a
  milestone chat") names `claude/netcode-s0-determinism` as the S0 chat's
  branch. Its work reached master in the 2026-10-27 merge, and a git
  ancestry check on 2026-11-08 shows the branch is contained in `master`.
  No open netcode work is recorded beyond S6 and the items in §4.
- **Doodle "Prototype A".** This is the 3D view through a pencil shader.
  It "stays on its local branch, unmerged" (Decision Log 2026-10-18). No
  further plan is recorded.
- **The quiz chat's branch.** `docs/learning/REVIEWS.md` says the quiz chat
  pushes that file "to its own branch". Whether that branch has newer
  review data than `master` is not recorded here.
- **An S0 draft stash.** `docs/NETCODE.md` (S0 brief) mentions a stash, "S0
  draft: detmath.ts". The final deterministic math is on master; the
  stash's status is not recorded.
- **Other branches.** Many other local `claude/*` branches exist. No doc
  on master describes them, so they are not summarized here.

## 4. Outstanding work and next actions

Each item is taken from the docs.

**Online launch (S6)**
- Pick a host (an account is the owner's call). A Render blueprint and a
  `Dockerfile` exist.
- Set the Pages build's network-server variable; without it ONLINE says
  "can't reach the server".
- (`docs/NETCODE.md` S6; Decision Log 2026-10-27)

**Online, still to do**
- Fast-solve detection.
- A name filter and privacy note.
- Reconnect, only if players ask for it.
- (`docs/NETCODE.md` Journal 2026-10-18; `AGENTS.md` Roadmap 13)

**Battle UI**
- M8 results screen and fast-forward after a KO.
  (`docs/MULTIPLAYER_DESIGN.md` §6, §10)
- M9: playtest and tune. (§10)

**Story**
- The "pick your power" card before each level: decided, not built.
  (`docs/SOLO_MODES_DESIGN.md` §6, §8; `AGENTS.md` Roadmap 14)
- Other operations (subtraction, multiplication, division).
  (`AGENTS.md` Roadmap 9; `docs/SOLO_MODES_DESIGN.md` §3)
- The Bouncer and Heart balloon monsters. (`docs/SOLO_MODES_DESIGN.md` §5,
  §8 L6)
- L8: a story balance pass. Waves are not yet tuned per level.
  (`docs/SOLO_MODES_DESIGN.md` §8; Decision Log 2026-10-19)
- Still open: story panels between levels. (`docs/SOLO_MODES_DESIGN.md` §9)

**Monsters and input**
- More abilities: Hider, Orbiter and Worm. (`AGENTS.md` Roadmap 6d)
- Handwriting: tune on more real samples; per-player templates.
  (`AGENTS.md` Roadmap 8)

**Owner playtests not yet done**
- Power-ready cues and boss tricks are "Not yet playtested by the owner".
- Waves are not yet "tuned per level … or playtested".
- Rookie bots need a beginner playtest.
- (Decision Log 2026-10-20, 2026-10-19, 2026-09-29)

**Real-device checks**
- iPhone sound fix: "Not checked on a real iPhone yet" (commit `dd58910`).
- Determinism on iPhone (JavaScriptCore): not measured
  (`docs/NETCODE.md` Measurements).

**Power balance**
- Open questions such as a BLAST limit and rookie power use.
  (Decision Log 2026-09-30, 2026-10-19)

**Engineering**
- Formatter + linter proposal. (`docs/ENGINEERING.md` §8)
- Refactors left for later: World3D, Field, OpponentBoard, and the stored
  choice helper. (`docs/learning/2026-10-08-readability-refactor.md`
  "Left for later")
- Per-IP rate limiting on score writes is still TODO. (`AGENTS.md` →
  Global leaderboard)

**Docs that disagree with each other** (fixing them needs an edit outside
these journals)
- `README.md` → Roadmap is stale. It shows handwriting, the leaderboard and
  PvP as not done.
- `AGENTS.md` Roadmap 14:
  - its text is duplicated and partly garbled;
  - it says the story-boards SQL is "not applied yet", while the Decision
    Log 2026-10-19 says it was applied.
- `docs/SOLO_MODES_DESIGN.md` still opens with "Nothing here is built yet",
  while its §8 marks L1–L6 done.
- `AGENTS.md` → Hosting says Pages builds "on push to `main`". The
  workflow triggers on `master` and `main`.

## 5. Verification evidence

Only recorded results are listed. "Not recorded" means no doc or commit
message on master states a result.

### How to verify (from `docs/ENGINEERING.md` §4)

- **Before every commit:** `npx tsc --noEmit`, `npm test` (Vitest unit tests
  plus the golden master) and `npm run build`.
- **Golden master:** `src/sim/golden.test.ts` plays fixed-seed bot games and
  a bot match against a saved snapshot. A refactor must keep it green; a
  rule change updates it on purpose, and the commit says why.
- **After a balance change:** compare with `npm run bots` / `npm run match`.
- **The server build:** `npm run build:server` (`AGENTS.md` → Tech stack).

This file makes **no claim that these pass today**. Nothing was run when it
was seeded.

### Recorded results

**Types, tests and build**
- 2026-10-27, `c775211` (merge commit message): "tsc, 324 tests, the game
  and server builds pass". An online match against 7 server bots "was
  played in the browser" (which build is not stated).
- Earlier test counts, also from commit messages:

  | Date | Commit | Recorded result |
  | --- | --- | --- |
  | 2026-10-20 | `dd58910` | 200 tests (with tsc and build) |
  | 2026-10-20 | `c5f8c39` | 200 tests (with tsc) |
  | 2026-10-20 | `dd88ee2` | 195 tests (with tsc) |
  | 2026-10-20 | `d97299e` | 176 tests |
  | 2026-10-20 | `c7c9759` | 165 tests |
  | 2026-10-19 | `c02c051` | 97 tests |

**Golden master**
- Recorded "unchanged" for the netcode merge (Decision Log 2026-10-27).
- Updated on purpose for the 2026-10-19 rule changes: pushback and the
  energy cut (Decision Log).
- Created 2026-10-08 (`fd678f8`); the readability refactor kept it green
  (`docs/learning/2026-10-08-readability-refactor.md`).

**Determinism (`docs/NETCODE.md` → Measurements)**
- 2026-10-14: Node 24 vs Chromium 152 differ in the last bit of `sin` and
  `exp`, so fingerprints drift.
- 2026-10-15: an Android 10 phone (Chrome 155) is bit-identical to desktop
  Chromium. After the fix, desktop Chromium matches Node at every
  checkpoint.
- iPhone: not measured.

**Online, measured locally (2026-10-18, `docs/NETCODE.md`)**
- 8 bot clients on one PC: 0 desyncs after the outbox fix; server step p99
  0.9–1.6 ms.
- 300–380 ms RTT: 0 kicked, 0 desyncs.
- Hardening checks passed locally: a message flood is cut off, a foreign
  Origin gets a 403, and slow-motion cheaters are replaced.
- Over the internet: not recorded.

**Supabase migrations**
- story-boards and run-logs: applied 2026-10-19 (Decision Log).
- Endless details: applied and "tested live inside a rolled-back
  transaction" 2026-10-21 (Decision Log; docs commit `534a682`).
- The retry on an unknown id was "tested live with a `ufo` ship"
  (`e8803dc`).

**Browser checks recorded in commits**
- Phone and desktop sizes were checked for several 2026-10-19/20 features,
  e.g. `9ecd707`, `d97299e`, `c8946bc` and the energy rework note.
- The built game was checked with `vite preview` for `d97299e`, `c8946bc`
  and `c7c9759`.

**Bot simulations**
- Clear rates and survival per level and per power are recorded throughout
  the Decision Log, `docs/SOLO_MODES_DESIGN.md` §7–§8 and the dated notes.
  These are simulation results, not human playtests.

**Owner playtests recorded (Decision Log)**

| Date | Playtest |
| --- | --- |
| 2026-09-25 | First playtest (SLOW/FREEZE) |
| 2026-09-27 | Handwriting lab sessions |
| 2026-09-28 | First phone playtest (4 runs) |
| 2026-09-29 | Second playtest (3 runs) |
| 2026-09-30 | Battles: 6 runs (M6), 2 runs on Android (M7), 4 on the dock build |
| 2026-10-19 | First story playtest; playtest notes 1–7 |
| 2026-10-20 | Playtest 3 notes and a phone playtest |

No owner playtest of the merged online build is recorded.

**Deploy**
- `.github/workflows/deploy.yml` builds and deploys GitHub Pages on a push
  to `master`/`main`. It does not run the tests.
- No successful deploy run is recorded.
- Recorded: the live Pages site showed a blank page after the
  escalating-waves merge; it was fixed in `f251dc5`, 2026-10-20. Whether
  the next deploy succeeded is not recorded.
- `AGENTS.md` Roadmap 12 ("Publish on GitHub Pages") is still unchecked.
- The online server is not deployed (Decision Log 2026-10-27).

**Not recorded**
- Lint or format checks: none adopted.
- Test runs after 2026-10-27.
- Any CI test run.

## 6. Changes

Newest first. Commits are on `master`; sources are commit subjects and the
Decision Log.

- **2026-11-08** — Journals introduced: `GAME_VISION.md`,
  `PROJECT_STATE.md` and `LEARNING_LOG.md`, on branch
  `claude/journals-sync`. No other file changed.
- **2026-10-27** — `c775211`: online play (netcode S0–S6 work, lobby,
  server, client network mode) merged into master. Not deployed.
- **2026-10-21** — Endless scores carry ship, power, world and survival
  time (`cab36a6`). The migration is live (`534a682`). A score still counts
  when the database refuses its details (`e8803dc`).
- **2026-10-20**
  - iPhone sound with the silent switch on (`dd58910`).
  - Endless world themes (`c5f8c39`).
  - Playtest round 2 merged: energy rework, power balance, boss tricks,
    level-clear sequence, ending, credits, ship unlocks (`dd88ee2`).
  - New soundtrack with one shared music player (`74c30a9`).
  - Load-crash fix for an import cycle (`f251dc5`).
  - Levels 7–10 and escalating waves (`0bdb6a3`).
- **2026-10-19**
  - Story levels 2–6 merged and the story map merged.
  - Hit pushback; levels 1–2 shortened after the owner's playtest.
  - Story music per level; save and continue a run.
  - Public run log; a fix for songs still fading when a scene ends.
- **2026-10-18**
  - Doodle art becomes the default.
  - Story slice L1–L4: modes, spawn director, level engine, Giant Mole.
  - Backyard creatures with personality, one file per level.
- **2026-10-08** — Readability refactor with a golden master; engineering
  practices; the learning loop and quiz skills.
- **2026-09-24 to 2026-09-30**
  - Three.js playfield and Blender pipeline.
  - Rename to Metic99.
  - Energy and powers; monster patterns and abilities.
  - Answer feedback and handwriting.
  - Battle royale phase 0, M0–M8 (partial).
- **2026-05-28 to 2026-06-02** — Phaser + Vite rewrite from Unity, the
  difficulty ramp, the Supabase leaderboard with a server-gated submit, and
  the main menu.
