# Launch hardening: getting a free server ready for strangers

The online battle worked for friends. A public post on X and LinkedIn is
different: strangers, bots and the occasional troll arrive at once, all on
a free server with a tenth of a CPU. The owner's rule for this round: **an
experiment, free tiers only, cap instead of grow**; expand only if traffic
shows up. Five changes, each with the decision, what lost, and how to try it.

## 1. A rules id instead of a git id

**Problem.** The hello compared the git commit of client and server. The
page will be built by GitHub Pages and the server by Render's Docker build,
which has no `.git`: their ids would never match, so the server would turn
everyone away.

**Decision.** `__RULES_ID__` in `vite.config.ts` hashes the files that
decide what a field computes (`src/sim`, `objects`, `config`, `math`, the
protocol). Same rules → same id, wherever they were built. Line endings
are normalized (Windows checks files out with CRLF, Linux with LF, which
would change the hash) and tests are left out (they don't change rules).

**Lost:** passing the commit into both builds (two pipelines to keep in
sync); no check at all (a client with old rules would desync silently).

**Idea:** *a content hash as a version*: the same trick as cache-busting
file names (`index-DSfhPv5I.js`) and git's own object ids.

## 2. Rooms with a hard cap ("load shedding")

**Problem.** One room of 8. A post can bring 50 people; 42 would wait.

**Decision.** `server/Rooms.ts` places a newcomer: a lobby with a free
seat → a new room (up to `MAX_ROOMS` = 3) → the queue of a running room →
"server busy, try again in a few minutes". A room that throws is closed
alone; the others keep playing.

**Lost:** unlimited rooms (on 0.1 CPU every match would slow down
together, then all would fall behind real time); auto-scaling (costs money,
and the owner wants to see traffic first).

**Try:** `npm run net:bots -- --clients 12` → the log shows room 1 (8
people) and room 2 (4 people + 4 bots). Read the `step p50/p99` lines
before raising `MAX_ROOMS`: p99 must stay far below 16.7 ms.

## 3. The locks on the door

| Lock | What it stops | Where |
| --- | --- | --- |
| 4 sockets per IP | one person opening 50 tabs or a script filling rooms | `main.ts` upgrade |
| total socket cap | memory and CPU running out | `main.ts` upgrade |
| token bucket, 60/s (burst 120) | a flood of messages | `RateLimit.ts` |
| Origin check | other websites' pages using our server | `originAllowed` |
| 10 s to say hello | idle sockets holding slots | `connect` |
| try/catch per message, per room | one bug taking down every match | `connect`, `Rooms.tick` |

**Why a token bucket?** "At most N per second" counted per clock second
lets 2N through around the boundary. A bucket that refills smoothly can't
be gamed that way, and still allows short bursts (fast tapping).

**Honest limits.** A script can fake its Origin, so the Origin check only
stops *browsers* on other sites; that's why the other locks exist. Behind
Render's proxy the player's address is the first `X-Forwarded-For` entry,
which a client can also fake. Taking a later entry would be harder to fake
but, if the host adds internal hops, would make *everyone* look like one
address and lock real players out. For an experiment we **fail open**:
the cheaper mistake is letting a faker through (the total cap and rate
limit still hold), not blocking real people.

**Try:** the 500-message flood in the commit log, or open 5 tabs from one
phone on the deployed server (the 5th is refused with 429).

## 4. Compression

The server sends every player everyone's tiles 10 times a second: ~3.8 KB
of JSON each time, about 36 KB/s per player. Free plans have a monthly
bandwidth limit. `ws` supports **permessage-deflate**, which every browser
speaks: each tiles message shrinks to ~1 KB (3.9x on its own, better with
the context zlib keeps between messages). It costs some CPU and memory
per socket, which is fine at our cap. Broadcasts are also encoded once
per room instead of once per player.

**Lost:** a binary protocol (smaller still, but a big change to learn and
debug; JSON + compression gets most of the win for one option).

## 5. The slow-motion cheat (your open task, answered)

The server checked that a phone is never *ahead* of real time (a speed
hack). It didn't check the other direction: a modified client could run
its field at **half speed**. Aliens fall half as fast, so the player gets
double the thinking time, and every report is still perfectly valid.

**Fix, two halves:**
- **Server** (`RemoteSeat.receive`): a field more than 3 s (180 steps)
  behind real time is handed to a bot, unless it's already knocked out.
- **Client** (`GameScene.catchUp`, `NetBattle.stepsDue`): an honest phone
  also falls behind sometimes (a hiccup, a backgrounded tab). Offline, the
  game drops that time; online it now runs the missing steps quickly, up
  to 120 per frame, so honest players are never mistaken for cheaters.

**Try:** `npm run net:bots -- --clients 2 --go --slowmo 0.5` → both are
replaced after 3 s: `too far behind real time (slow motion?)`.

## What is still open (each in its own chat)

- **Fast-solve detection:** a script can read the sums and answer in 20 ms.
  Inputs alone can't prove a human typed them, but the server sees every
  answer's timing on its copy and can flag impossible speed.
- **Name filter + privacy note:** names show on everyone's screen.
- **Reconnect:** only if people complain that switching apps loses a match.
- **Launch:** the page on GitHub Pages, the server on Render, soft launch.

## Questions

1. Why does the hello compare a hash of the rule files and not the git
   commit, now that the page and the server are built in different places?
2. Two ways to read the player's IP behind a proxy: the first or the last
   `X-Forwarded-For` entry. Which mistake does each one risk, and why did
   we pick the first?
3. What happens to an honest player whose phone freezes for 2 seconds?
   For 6 seconds?
