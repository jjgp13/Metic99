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
- **First matches: 8–16 players**, with bots filling empty seats. Grow to 99
  later.
- **Knockout:** leaning to **one life** (like topping out in Tetris), so energy
  timing is the survival skill. Confirm by playtesting against 3 lives
  (`PLAYER.LIVES`). With one life the 3 s hit-recovery freeze never runs (the
  only hit ends the game); if one life wins, the recovery rules can go.
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

Sources: [TetrisWiki: Tetris 99](https://tetris.wiki/Tetris_99),
[TetrisWiki: Garbage](https://tetris.wiki/Garbage).
