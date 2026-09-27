# Metic99 — Battle Royale Design

> **Status:** Direction agreed 2026-09-25; details get tuned by playtesting.
> Update this file and the AGENTS.md Decision Log when a rule here changes.

Metic99 becomes a Tetris 99-style battle royale: every player solves sums on
their own field, and kills let them attack the others. The multiplayer backend
is also a learning project, so every backend choice is written down with its
reason.

## 1. What we take from Tetris 99

| Tetris 99 | Metic99 |
| --- | --- |
| Clearing lines sends garbage (single 0, double 1, triple 2, Tetris 4; combos +1..+5) | Kills charge **energy**; harder sums, fast solves and streaks charge more |
| Pending garbage meter (max 12), lands after a delay; clearing lines cancels it first | **Incoming meter** of sent aliens with a delay; kills cancel incoming first |
| Targeting: Random / Attackers / KOs / Badges | Same four strategies |
| Being targeted by 2..6+ players adds +1..+9 to your attacks | Same idea (defense bonus) |
| KO a player → badges; 2/4/8/16 badges = +25/50/75/100% attack | Same |
| Gravity rises from 50 players left; garbage delay shrinks | Difficulty gets a match term: `d = max(dScore, dTime, dMatch)` |

## 2. Decisions

- **Energy only (no automatic attacks).** A kill first cancels incoming aliens;
  the rest fills the energy bar. The player chooses to spend it on:
  - **Send:** drop aliens on the current target (more energy = harder monster).
  - **Slow / Freeze:** two powers on the player's own field, each with its
    own button. SLOW (30% speed) is the economical one; FREEZE (full stop) is
    the emergency one and drains twice as fast. Both drain energy while on
    and pause while the hit-recovery freeze already stops the field. (The
    first playtest found 60% slow too weak.)
  - Energy code (`src/sim/energy.ts`) is Phaser-free and the meter tracks
    spending per use (`"slow"`, `"freeze"`, `"send"`), so sending only adds a new spender
    plus the "cancel incoming first" step before `charge()`.
- **First matches: 8 players** (you + 7 bots), then 16, then 99. Bots fill
  empty seats online too.
- **Knockout: one life in battle matches** (decided 2026-09-27), like topping
  out in Tetris: energy timing is the survival skill. Solo keeps
  `PLAYER.LIVES` (3), so the hit-recovery freeze stays a solo-only rule.
- **Single player first.** Prove the solo loop is fun (energy, slow time, alien
  movement patterns, monster abilities) before any server work.

## 3. Readability rule (fairness)

The sum must always be readable unless a monster's *ability* hides it on
purpose. Accidental overlap of two aliens' balls is a bug (it feels random and
unfair); deliberate, telegraphed hiding (eyelid balls, balls tucked behind the
body, orbiting balls) is fair because the player can learn its timing.
Movement patterns must keep ball rows apart.

**How it's enforced (2026-09-25):** every alien owns a box around its ball row
and body. The spawner only lets an alien enter where its whole sideways sweep
clears the aliens near the top, and a runtime guard never lets a move enter
another alien's box: the mover holds that axis (sideways movers turn around),
so aliens queue instead of overlapping. Sent aliens in the battle royale must
go through the same guard. Details: AGENTS.md → Gameplay rules.

## 4. Monster ideas

Movement (gives the player time to spot and solve a sum). **All four are in
the single-player game** (2026-09-25):
- **Darter:** fast zig-zag dive (2 balls).
- **Lumberer:** slow, stop-and-go stomp (3 balls).
- **Drifter:** crosses sideways, non-lethal bonus; solving it gives energy.
- **Strafer (Galaga-style):** patrols a band at the top for a few seconds,
  then dives.

Abilities (mainly for sent aliens). **Built (2026-09-25): Shielded, Blinker,
Splitter** on a hook-based ability system (see AGENTS.md → Gameplay rules); in
solo play they unlock as difficulty rises. The others reuse the same hooks.
- **Blinker:** balls open and close like eyelids.
- **Hider:** tucks its balls behind its body at intervals.
- **Orbiter:** balls circle the body.
- **Worm:** the body is a chain of number balls.
- **Splitter:** becomes two 2-ball aliens when hit.
- **Shielded:** needs two answers.
- **Harder operations:** sent aliens may carry subtraction (red balls).

## 5. Backend plan (each step says why)

| Phase | Build | Why this way |
| --- | --- | --- |
| 0 | Offline match vs bots in the browser | Tests the fun cheaply; no infrastructure to maintain while the rules change |
| 1 | Node + plain WebSocket (`ws`/uWebSockets.js) match server, one room | Plain sockets expose the protocol, rooms and state ownership that a framework like Colyseus would hide; one process keeps it debuggable |
| 1 | Each client runs its own field; the server owns shared state (targets, attacks, incoming queues, KOs, badges, placement) | Fields need instant input response, so they stay on the client; anything two players must agree on lives on the server |
| 2 | Shared TypeScript sim + seeded spawns | The server can replay a field and check claimed kills (anti-cheat); everyone gets the same base aliens, so only attacks differ |
| 3 | Matchmaking, many match servers, Redis queue | Teaches horizontal scaling and server allocation once one room works |
| 4 | Headless bot load tests, metrics, reconnects | Proves the servers hold up; bots double as lobby fillers |

Supabase stays for accounts and leaderboards; match results are written there
when a match ends.

## 6. Battle rules (decided 2026-09-27)

Numbers are first guesses to tune by playtesting against bots; the rules are
the agreed shape.

- **Send (tier button).** One SEND button lights up at 25 / 50 / 100 energy.
  A tap sends the strongest monster the energy buys; holding it lets the
  player pick a smaller tier. Harder monsters cost more (e.g. 25 = a 2-ball
  darter, 50 = an ability alien, 100 = two aliens); the table of what each
  tier sends is content and grows with new monsters.
- **Targeting: both.** Four Tetris 99 strategies pick the target
  automatically (Random / KOs = most in danger / Attackers = whoever targets
  you / Badges = most badges), and tapping an opponent's tile picks them by
  hand. Being targeted by 2+ players adds a defense bonus to your sends.
- **Incoming queue.** Sent aliens wait in a visible incoming meter for a delay
  (~3 s, shorter late in the match) before landing. The delay is the warning,
  and online it also hides network lag.
- **A kill cancels incoming first**; only the rest of its energy charges the
  meter.
- **Sent aliens skip the unsolved-alien cap** (that is what makes them an
  attack) but obey the readability rule and the on-screen cap; the extra ones
  wait in the queue.
- **KO credit** goes to the sender of the alien that knocked you out, else to
  your last attacker within ~10 s. The KO takes your badges + 1; 2/4/8/16
  badges = +25/50/75/100% attack.
- **Placement** = players alive + 1 at the moment of the KO. A match-pressure
  term `dMatch` rises as players drop out, so matches end:
  `d = max(dScore, dTime, dMatch)`.
- **After your KO:** the results screen, with the option to fast-forward the
  rest of the match (the sim runs without drawing) or to watch.
- **What you see of the others:** a thin strip of small tiles above the field
  (danger color, alien dots, your target marked, attackers edged red), an
  incoming meter by the energy bar and a KO feed. Full fields are never drawn.
  A tile shows exactly what the future server broadcasts per player.

## 7. Bots (phase 0)

- **A bot is a real player:** its own full field simulation (no rendering),
  playing through the same inputs a human uses (answer, clear, SLOW, FREEZE,
  SEND, target). It sees only what a human sees (digits, positions, how
  covered the balls are), so it can't cheat and new monsters mostly just work.
  Rejected: "fake" bots that kill on a timer (can't use powers, react to
  attacks or be surprised by a Blinker, and nothing carries over to a server).
- **Solving model:** notice (reaction time) → pick a target (usually the most
  dangerous) → think (base + per ball + per carry, log-normal spread) → type
  → sometimes answer off by 1 or 10, then notice and clear. A bot enters the
  whole answer at once (like the drawing pad), so "2" on the way to "23"
  never locks onto another alien.
- **Skill levels** are tables of those numbers (Rookie / Pilot / Ace),
  calibrated against the owner's own solve times.
- **Energy policy:** simple utility rules. Danger (how close the lowest
  unsolved alien is + unsolved count + incoming) → FREEZE when very high, SLOW
  when high, off when it passes; otherwise bank energy and SEND above a
  personality threshold (aggressive vs turtle).
- Each bot draws from its own seeded stream, so a match replays exactly.

## 8. Shared sim (what makes it server-ready)

- **Phaser-free `Field`** (done in M2a/M2b: one player's ship, bullets,
  typed answer, score, lives, energy and powers, with the aliens in a
  `Swarm`) and **`Match`** (N fields, incoming queues, targeting, KOs,
  badges, placement) in `src/sim/`. `GameScene` is an adapter: input →
  field, field → screen, and the field's events (spawned, fired, solved,
  hit, knockedOut) → sounds and effects.
- **Seeded random numbers** (`src/sim/rng.ts`, done in M1): same seed + same
  inputs → same run. Spawner streams are keyed by spawn number
  (`SpawnStreams`), so the Nth alien's first try draws the same numbers for
  every player with that seed; this is the base of "everyone gets the same
  base aliens" (phase 2).
- **Game clock** (done in M1): rule timings (solve time, fire cooldown) read
  the run's game time, which stops while paused, never the wall clock.
- **Fixed timestep** (done in M2a): the rules step at exactly 60 Hz; the
  scene runs 0–N steps per frame and the renderer interpolates between the
  last two steps. Changing frame times would otherwise make runs differ
  between a 120 Hz phone and a laptop.
- **Inputs, not state** (done in M2b): a field changes only through
  `apply(FieldInput)` (digits, back, clear, power; send/target come with the
  match) and `step(dt)`. Each input is logged with its step; seed + input log
  = an exact replay (`replayField`: debugging now, server checks in phase 2).
- **The Match ↔ Field seam is the future protocol:**
  `field.receiveAttack()`, `field.takeOutgoing()`, `field.summary()`,
  `field.knockedOut`. Offline these are calls; in phase 1 they become
  WebSocket messages (the server owns the match, clients own their field).
- **Float caveat:** `Math.sin`/`Math.exp` may differ in the last bit between
  Safari and Node, so a cross-engine replay can drift. Keep them out of
  decisions or let the server check with a tolerance.

## 9. Contracts vs content

The design is not frozen. **Content and tuning** (new monsters, abilities,
movement, models, numbers) can change any time. **Contracts** are what the
fields and the match (later the server) agree on; changing one is cheap in
phase 0 and gets expensive once a server exists (client + server + protocol
change together, with a version bump). Lock them before phase 1.

| Contract | Rule |
| --- | --- |
| Player inputs | answer (0–99), clear, SLOW, FREEZE, SEND (tier), target (strategy or player) |
| Attack | `{kind, level, from}` into the target's incoming queue; attacks only ever arrive as aliens |
| What others see | the tile summary in §6 |
| Time | fixed steps, seeded streams, game clock |
| KO and placement | §6 |

Sorting a new idea: *does it change how players affect each other, or only
one field?* One field → do it any time. Between players → write it here and
in the Decision Log first. Solo-only ideas (pause, the hit freeze) are fine
but marked as such.

**New content checklist** (monster or ability):

1. Its logic is in the game rules (no Phaser), using seeded streams and the
   game clock.
2. It obeys the readability rule; any hiding is deliberate and telegraphed.
3. The answer stays in 0–99.
4. A bot can play it with the normal inputs (or it needs one line of bot
   knowledge).
5. It declares its role: solo spawn, sendable (one row in the send table), or
   both.
6. Its numbers live in `config/constants.ts`.

## 10. Phase 0 milestones

| # | Build | Test | Status |
| --- | --- | --- | --- |
| M0 | Battle rules, bots and contracts written down (§6–§9) | — | done 2026-09-27 |
| M1 | Game clock + seeded random numbers in solo play | Rng unit tests; same `?seed` → same aliens in the browser | done 2026-09-27 |
| M2a | Extract `Field` (spawning, movement, readability) + fixed timestep | Solo unchanged; headless soak: no box overlaps | done 2026-09-27 |
| M2b | Combat, energy, abilities, input into `Field`; events out | Same seed + inputs → same state hash | done 2026-09-27 |
| M3 | Bot v1 (solving) + dev autopilot `?bot=ace` on your own field | Survival per skill level; calibrate vs your solve times | |
| M4 | Bot energy policy (SLOW/FREEZE) | Headless A/B: survival with vs without powers | |
| M5 | `Match` with N fields: KOs, placement, `dMatch`, match end | 16 headless bots: the match always ends | |
| M6 | SEND + incoming queue + cancel; SEND button + incoming meter | Cancel math; sent aliens pass the readability soak | |
| M7 | Targeting strategies, badges, defense bonus | Unit tests; bot tournaments | |
| M8 | Battle UI: opponent strip, KO feed, results, fast-forward; menu entry | Play it | |
| M9 | Playtest and tune; then phase 1 (move `Match` to a Node server) | | |

Sources: [TetrisWiki: Tetris 99](https://tetris.wiki/Tetris_99),
[TetrisWiki: Garbage](https://tetris.wiki/Garbage).
