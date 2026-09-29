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
  - **Their power:** each player picks ONE power before the match (decided
    2026-09-29): FREEZE (field stopped), SLOW (field at 45%, cheap), BLAST
    (destroy every alien on your field) or SHIELD (the next alien that
    reaches you is destroyed instead of a life). The ship is only a look.
    **Powers never pay for themselves:** kills made while a time power runs
    and aliens a power destroys charge no energy. Why one pick instead of a
    power per ship: new ships stay free cosmetics, the power set stays small
    enough to balance, and bots learn a power by its effect, not its name.
    Replayed playtests showed why the rule is needed: kills made while
    frozen paid back 40–50% of FREEZE's cost, so FREEZE was on ~27% of the
    time and SLOW was almost never used.
  - Energy code (`src/sim/energy.ts`) is Phaser-free and the meter tracks
    spending per use (one spender per power, plus `"send"`), so sending only
    adds a new spender plus the "cancel incoming first" step before
    `charge()`. Open for M6: kills made during a time power charge nothing,
    so as written they would cancel nothing either.
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

Movement (gives the player time to spot and solve a sum). **All five are in
the single-player game** (2026-09-25; swooper 2026-09-28):
- **Darter:** fast zig-zag dive (2 balls).
- **Lumberer:** slow, stop-and-go stomp (3 balls).
- **Drifter:** crosses sideways, non-lethal bonus; solving it gives energy.
- **Strafer (Galaga-style):** patrols a band at the top for a few seconds,
  then dives.
- **Swooper:** flies in from a side edge below the HUD, then glides down
  (solo spawn; sendable later as a cheap 2-ball attack).

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

- **Send (tier button).** One SEND button lights up at 25 / 50 / 100 of the
  attack gauge (see "Two gauges" below).
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
  and online it also hides network lag. (M6: 3 s → 1.5 s as `dMatch` rises,
  aliens of one attack 0.6 s apart; the meter shows them as orange blocks
  eating the energy bar from its right end.)
- **What a tier buys (M6, content):** 25 = a darter, 50 = one ability alien
  (the sender's stream picks shielded / blinker / splitter, unlocked or not),
  100 = two ability aliens. Each alien's share of the cost is what the
  receiver's kills must pay to cancel it. Sums come from the receiver's own
  difficulty (so early attacks carry small digits).
- **A kill cancels incoming first**; only the rest of its energy charges the
  meter.
- **Sent aliens skip the unsolved-alien cap** (that is what makes them an
  attack) but obey the readability rule and the on-screen cap; the extra ones
  wait in the queue. They also don't count toward the field's own unsolved
  cap or threat budget, so an attack comes on top instead of replacing a
  normal spawn. They wear an orange ring (not red: red is subtraction).
- **KO credit** goes to the sender of the alien that knocked you out, else to
  your last attacker within ~10 s. The KO takes your badges + 1; 2/4/8/16
  badges = +25/50/75/100% attack.
- **Placement** = players alive + 1 at the moment of the KO (players who fall
  in the same step: higher score places better, then lower seat). A
  match-pressure term `dMatch` rises as players drop out and in overtime:
  `d = max(dScore, dTime, dMatch)`, and it also opens the unsolved cap.
  `dMatch = min(0.99, 0.6·out/(N−2) + max(0, t − 3:00)/2 min)`.
- **Sudden death (M5).** A perfect player survives the top of the curve
  forever, so from 5:00 the aliens also speed up without limit (+100% per
  minute). People are out long before; it bounds a match's length, which a
  server needs (a cheating script can't hold a match open).
- **Built (M7):** strategies are re-picked every 1.5 s (ties at random);
  "attackers" aims back at whoever last attacked you among those aiming at
  you; a hand-picked seat is kept until it's out. KO credit also covers the
  last attacker within 10 s. Bonus (badges + defense) turns into weight: the
  aliens cost more to cancel and each 25 above the cost adds a darter.
- **Two gauges (decided 2026-09-30, owner picked A).** M7 mirror matches
  showed that with one shared meter sending never paid: the sender pays
  alone and every opponent shares the damage, so non-senders won as often
  or more, even with attacks ×3. Now a kill charges the power meter in full,
  and its value pays off incoming first; the rest fills an **attack gauge**
  (max 100) that only SEND spends. Measured: senders win 61/39 (aces) and
  67/33 (pilots) in mirror matches. Kills during a time power charge
  neither gauge.
- **After your KO:** the results screen, with the option to fast-forward the
  rest of the match (the sim runs without drawing) or to watch.
- **What you see of the others:** small tiles (danger color, alien dots, your
  target marked, attackers edged in attack orange, since red is for
  subtraction balls), an incoming meter by the energy bar and a KO feed. On a
  wide screen the tiles stand in two columns beside the field (Tetris 99,
  built: `OpponentBoard`); phones get their own compact view. Full fields
  are never drawn. A tile shows exactly what the future server broadcasts
  per player.

## 7. Bots (phase 0)

- **A bot is a real player:** its own full field simulation (no rendering),
  playing through the same inputs a human uses (answer, clear, POWER, SEND,
  target). It sees only what a human sees (digits, positions, how
  covered the balls are), so it can't cheat and new monsters mostly just work.
  Rejected: "fake" bots that kill on a timer (can't use powers, react to
  attacks or be surprised by a Blinker, and nothing carries over to a server).
- **Solving model:** notice (reaction time) → pick a target (usually the most
  dangerous) → think (base + per addition + per carry, log-normal spread; an
  addition = balls − 1, fitted to the owner's playtests) → type
  → sometimes answer off by 1 or 10, then notice and clear. A bot enters the
  whole answer at once (like the drawing pad), so "2" on the way to "23"
  never locks onto another alien.
- **Skill levels** are tables of those numbers (Rookie / Pilot / Ace),
  calibrated against the owner's own solve times.
- **Energy policy:** simple rules per power EFFECT (built in M4). A time
  power (FREEZE, SLOW) follows the owner's 72 logged freezes: on when ≥ 2
  unanswered aliens are on screen and the nearest is within reach (ace
  ~170 px ≈ the owner), or one is about to land; keep answering; off once
  the board is clear. Each dangerous moment goes unnoticed with a per-level
  chance (`MISS_DANGER`), because people get hit with energy to spare.
  BLAST fires when several unanswered aliens are close or one is about to
  land; SHIELD is armed as soon as it's affordable. **SEND (built M6):** tap
  SEND once energy reaches `SEND_AT` (rookie 100, pilot 75, ace 60) while
  the board is calm, so enough stays for a power. Incoming aliens count as
  danger once they land (bots read the screen, not the queue).
- **What the power comparison showed (M4, 24 seeds, `npm run bots`):** every
  power beats none. Rookies and pilots survive within ~±10% across the four
  powers, with 3 lives and with 1. After merging with the fitted FREEZE rule
  (8 seeds, 3 lives): ace FREEZE 230 s, SHIELD 219 s, BLAST 490 s — BLAST is
  the open balance question for aces.
- **What M6's simulations showed** (`npm run match`, 100 matches, 8 mixed
  bots): ~25 attacks per match; they shorten matches (94 → 73 s median) but
  land only ~9% of KOs directly (the rest is added load). Aces win 84%
  whether they send or never send: with random targets, energy sent costs
  the sender about as much safety as it takes from one opponent, so SEND is
  neutral for the sender. In Tetris 99 the reward is KO credit → badges →
  stronger attacks, plus the KOs strategy aiming at players about to fall:
  that is M7. A tried lever (killing a sent alien gives no energy, so
  attacks don't refund the receiver) was also ≈ neutral in 30 matches.
- Each bot draws from its own seeded stream, so a match replays exactly.
- **Built (M3):** `src/sim/Bot.ts`, levels in `BOT` (constants). Beyond the
  table: a strafer about to dive counts as more dangerous, drifters come
  last, shut Blinker lids can't be read, and mid-thought the bot drops its
  sum for a newly seen alien ≥ `SWITCH_MARGIN_PX` more dangerous (chance
  `FOCUS`, once per newcomer). `npm run bots` prints survival, score, slips
  and solve times per level; `?bot=ace` (dev) plays your own field.
- **What the first simulations showed** (no powers yet): all levels die
  within ~2 min (~1 min with one life) once difficulty passes ~0.75, so
  SLOW/FREEZE timing is the survival skill, as intended. Skill shows as
  score (aces earn difficulty faster). Splitlings were half of ace deaths
  (two full-speed darters mid-field); slowing them to the splitter's 70%
  bought aces ~10 s.
- **First phone playtest (2026-09-28, 4 runs, logged + replayed):** the
  owner solves 2-ball sums like an ace (3.3 s) but 3-ball sums at 6.8 s,
  slower than every bot level (pilot 5.4 s, ace 3.5 s): the per-ball cost
  of the bot model is too low for the third number. The owner survives
  98–171 s using FREEZE in a steady rhythm, rarely SLOW. Splitlings were
  fixed (keep the parent's pace, hatch, stagger); bot 3-ball times are
  still to recalibrate.

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
- **The Match ↔ Field seam is the future protocol** (`Match` done in M5):
  match → field only as messages, `field.receive(MatchMessage)` (M5:
  `standing` = players left; M6 adds attacks), logged in the field's input
  log so a field still replays from seed + log alone; field → match only
  `field.knockedOut`, `score`, `summary()` (the tile) and, from M6,
  `takeOutgoing()`. Offline these are calls; in phase 1 they become
  WebSocket messages (the server owns the match, clients own their field).
  All fields in a match share one seed (same base aliens).
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
| Player inputs | answer (0–99), clear, POWER, SEND (tier), target (strategy or player) |
| Loadout | one power (a `POWER_KINDS` key) picked before the match and fixed for it; the ship is a look and never affects the rules. Tiles show each player's power |
| Attack | `{from, cost, aliens: [{kind, ability}]}` into the target's incoming queue (M6); attacks only ever arrive as aliens; the receiver rolls sums and columns |
| What others see | `PlayerTile` (`match.tiles()`, M7): alive/placement, score, kills, danger, incoming, energy, power + on, alien dots (sent marked), badges, aim, target, aimed-at count, bonus |
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
| M3 | Bot v1 (solving) + dev autopilot `?bot=ace` on your own field | Survival per skill level; calibrate vs your solve times | done 2026-09-27 |
| M4 | Bot energy policy (per power effect; time powers fitted to the owner) | Headless A/B: survival with vs without powers, and between powers | done 2026-09-29 |
| M5 | `Match` with N fields: KOs, placement, `dMatch`, sudden death, match end | 16 headless bots: the match always ends; `npm run match` | done 2026-09-29 |
| M6 | SEND + incoming queue + cancel; SEND button + incoming meter | Cancel math; sent aliens pass the readability soak | done 2026-09-29 |
| M7 | Targeting strategies, badges, defense bonus | Unit tests; bot tournaments | done 2026-09-30 |
| M8 | Battle UI: opponent strip, KO feed, results, fast-forward; menu entry. Split into two chats: desktop opponent board (Tetris 99-style tiles beside the field) and phone feedback; both read only `match.tiles()` and match events | Play it on desktop and phone | desktop board done 2026-09-30 (`src/ui/OpponentBoard.ts`); phone open |
| M9 | Playtest and tune; then phase 1 (move `Match` to a Node server) | | |

Sources: [TetrisWiki: Tetris 99](https://tetris.wiki/Tetris_99),
[TetrisWiki: Garbage](https://tetris.wiki/Garbage).
