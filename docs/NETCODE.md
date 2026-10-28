# Netcode — phase 1 plan and learning journal

Phase 1 of the battle royale: an online match server. It is a **learning
project** for the owner (a backend engineer), so this file is both the plan
and the journal: what we decided, what we measured, and what each idea is
called in the industry.

Design background: [`MULTIPLAYER_DESIGN.md`](MULTIPLAYER_DESIGN.md) §5
(backend plan), §8 (Match/Field seam), §9 (contracts), §10 (phase 0).

## Architecture we chose (option A)

- The **server re-runs every field** from its player's inputs. It decides
  KOs, attacks, placement and results.
- The **client plays its own field at once** (prediction). It sends each
  input tagged with the step it applies at.
- **Match messages** (attacks, standing) are scheduled for a future step.
  The ~3 s incoming delay hides the network lag, so the client's prediction
  is almost never wrong.
- **Desyncs** are caught by comparing state fingerprints (hashes) every N
  steps.
- **Bots run on the server** and fill empty seats.
- **Stack:** Node LTS + plain `ws`, no framework, so the mechanics stay
  visible. A `server/` folder imports `src/sim` directly.
- **The UI doesn't change:** network mode feeds the same `match.tiles()` and
  `BattleView`.

## How we work

- **One chat per milestone.** Each one starts from this file (see "Starting
  a milestone chat" below).
- **Inside a chat, small steps.** Each step is one round of the
  [`learning-loop`](../.claude/skills/learning-loop/SKILL.md) skill: the
  owner designs or predicts first, then Claude builds, walks through it, and
  asks 1–2 questions.
- **Extras for every netcode milestone:**
  - a Mermaid sequence diagram of one real flow, with numbered steps;
  - a tour of the ~50 lines that matter most;
  - one "break it" experiment behind a flag (URL param or env var), and
    what to look for;
  - one **intent-level task** for the owner (not low-level code): write
    test cases in plain English, find a smell or a planted bug in the
    code, design the "break it" experiment, or read a file by its intent
    comment and explain it. Claude writes the code;
  - the owner's own summary below, which Claude critiques.
- **Concepts** go into [`learning/CONCEPTS.md`](learning/CONCEPTS.md); the
  quiz chat reviews them on a schedule.
- **Rules:**
  - `npx tsc --noEmit`, `npm test` and `npm run build` pass before every
    push.
  - Push only the `claude/*` branch; the owner merges to `master`.
  - Every architecture decision gets a dated AGENTS.md Decision Log entry
    and an update to MULTIPLAYER_DESIGN.md.
  - Game rules never use `Math.random()` or the wall clock.
  - Ask the owner before anything that changes game rules or costs money.

## Milestones

| # | Milestone | Steps (one learning loop each) | Backend idea it maps to | Status |
| --- | --- | --- | --- | --- |
| S0 | Determinism spike | 1. What "same inputs, same run" means. 2. Fingerprint: a hash of the field state. 3. Phone lab `?lab=determinism`: Node vs iPhone vs Android. 4. Fix what differs and pin it with a test | Event sourcing, replica checksums | done 2026-10-15 |
| S1 | Protocol (`src/net/protocol.ts`) | 1. Envelope, versions, build-id handshake. 2. The messages each way + validation. 3. JSON vs binary, bytes per second | API contracts, schema validation | done 2026-10-18 |
| S2 | Server skeleton | 1. WebSocket server. 2. Heartbeat and timeouts. 3. Lobby that fills seats with bots after a countdown. 4. One tick loop | Connection lifecycle, health checks | done 2026-10-18 |
| S3 | Server runs the match | 1. Remote fields fed by inputs. 2. Late and "future" inputs. 3. A player who stops sending | Queues, ordering, idempotency | done 2026-10-18 |
| S4 | Client network mode | 1. Same `BattleView`/tiles over the network. 2. Prediction of your own field. 3. Reconcile when the server's fingerprint disagrees | Optimistic updates, reconciliation | done 2026-10-18 (no rollback needed: see decisions) |
| S5 | Real network | 1. Two browsers. 2. Simulated latency, jitter, loss. 3. Reconnect and resume. 4. Load test with headless bot clients (fields per core, tick p50/p99) | Chaos testing, capacity planning | done 2026-10-18 (no reconnect yet) |
| S6 | Deploy | 1. Compare Fly.io, Render, a VM + Caddy. 2. TLS (`wss://`). 3. Connect the Pages build | Ops, TLS | Dockerfile ready; the host is the owner's pick (an account) |

### S0 brief (from the owner)

Fingerprint the exact field state every N steps for a seed + input log.
Compare Node, Chrome, Safari/iOS and Android with a hidden
`?lab=determinism` page the owner can open on their phones.

Known risk: math functions like `Math.exp` and `Math.sin` aren't guaranteed
to give identical results on every JS engine (V8 vs JavaScriptCore). Where
the rules use them:

- `difficulty.ts`: `Math.exp` (the logistic curve)
- `Alien.ts`: `Math.sin` (gait and bob)
- `abilities.ts`: `Math.sin` (Blinker cover)

`+ - * /` and `sqrt` are exact IEEE. Bot.ts noise uses `exp`/`log`/`cos`,
but bots run only on the server and are replayed as inputs; confirm whether
that matters.

Measure first, then fix (our own deterministic `sin`/`exp`, or keep them
out of rule decisions), and add a test that pins the fingerprints.

A first draft of a fix exists but is set aside so the owner designs first:
`git stash list` → "S0 draft: detmath.ts". Open it only after step 4's
design.

## Playing online (the demo)

- **On your Wi-Fi:** `npm run build && npm run build:server && npm start`,
  then friends on the same Wi-Fi open `http://<this PC's IP>:8787` →
  ONLINE. (Dev instead: `npm run server` + `npm run dev`; Vite proxies
  `/ws`.) Empty seats are bots; START NOW or wait 30 s.
- **Over the internet:** deploy the `Dockerfile` to a container host
  (Fly.io, Render, Railway…): one URL, TLS from the host (`wss://`). Or a
  quick tunnel from this PC (e.g. Cloudflare's `cloudflared tunnel --url
  http://localhost:8787`) for an evening with friends.
- **Test without friends:** `npm run net:bots -- --clients 7` joins 7 bot
  clients; add `--lag 120 --jitter 80` for a bad network, `--go` to start.
- Client and server must be the same build (the hello checks it): restart
  `npm run server` after pulling or committing.

## Starting a milestone chat

Open a new chat in this repo and paste (change the milestone):

```text
We're starting netcode milestone S0 (Determinism spike).
Read docs/NETCODE.md first, then AGENTS.md and the parts of
docs/MULTIPLAYER_DESIGN.md it points to. Use the learning-loop skill and
the netcode extras in NETCODE.md "How we work". Work on branch
claude/netcode-s0-determinism. Start with step 1: restate the goal and ask
me to design or predict before you write any code.
```

At the end of a milestone: update this file (status, decisions,
measurements, glossary), and leave the owner's summary section ready.

## Journal

### Decisions

- **2026-10-18 — Launch hardening for a public post (owner: free tiers
  only, an experiment: cap, don't grow).** Details and the why of each:
  `docs/learning/2026-10-18-launch-hardening.md`.
  - **Rules id, not git id, in the hello:** a hash of the rule files, so a
    page built on GitHub Pages and a server built on Render match.
  - **Rooms with a hard cap** (MAX_ROOMS 3): lobby with a seat → new room
    → queue → "server busy". A crashing room closes alone.
  - **Locks:** 4 sockets per IP (X-Forwarded-For's first entry: fakeable,
    but never locks real players out), a total cap, a token bucket per
    socket, Origin check, hello timeout, per-message crash guard.
  - **Compression** (permessage-deflate): tiles 3.8 KB → ~1 KB.
  - **Slow-motion guard** (the owner's open task): a field more than 3 s
    behind real time is handed to a bot; honest clients catch up after a
    stall instead of dropping time.
  - **Left for separate chats:** fast-solve detection, name filter +
    privacy note, reconnect (only if people ask), Pages + Render launch.

- **2026-10-18 — S1–S5: how online play works (built in one push, owner's
  "continue until playable").**
  - **The client never sends state, only inputs** tagged with their step,
    plus how far it has played (`upTo`) and a fingerprint every second.
    The server's copy of each person's field (`server/RemoteSeat.ts`)
    advances only from those, so it knows the field without trusting it.
  - **Messages to a field take a round trip:** the server numbers them
    (seq); the device applies each at its next step and reports "seq N at
    step S"; the copy applies the server's own copy at S. The device picks
    the step, so prediction is never wrong and nothing ever rolls back
    (S4's "reconcile" isn't needed; a fingerprint mismatch is reported as
    a desync, a bug). Rejected: the server picking a future step (the
    device may already be past it → rollback machinery).
  - **What the server refuses** (and then hands the seat to a bot): steps
    backwards, steps ahead of real time (speed hack), message reports out
    of order or later than 180 of the device's steps (dodging attacks),
    5 s of silence (closed tab, dead phone). Inputs are rebuilt by
    `parseClient`; a SEND without energy does nothing in the copy.
  - **JSON, 10 Hz tiles:** ~3.7 KB per tiles message → ~36 KB/s down per
    player, ~1 KB/s up. Fine for phones; binary or deltas later if needed.
  - **One Node process serves the game and the socket** (same origin: no
    CORS, one TLS certificate). Plain `ws`, one room; matchmaking and many
    rooms are phase 3.
  - **Online, no pause** (your field would stop while attacks wait), and a
    hidden tab stops your field: after 5 s a bot takes over.
  - **Not built:** reconnect/resume (a dropped player is replaced by a
    bot), several rooms, accounts.

- **2026-10-15 — S0 step 4: the rules use our own sin/cos/exp (owner
  picked A).** fdlibm ports written with exact operations only
  (`src/math/detmath.ts`, a new bottom layer since `config/difficulty.ts`
  needs `exp`). Rejected: B, removing sin/exp (changes how the lumberer
  moves: a game-feel call) and C, rounding results (two engines can land
  on either side of a rounding edge, so it only makes mismatches rarer).
  Cost measured: ~18 ns per call, 1–3 calls per step, i.e. ~0.0001 ms per
  step. A guard test scans the rule files for engine sin/cos/exp/pow/`**`
  (bots excepted: server-only, they act through logged inputs).

- **2026-10-14 — S0 step 3: the lab replays a recording, not a live bot.**
  The bot's own `exp`/`log`/`cos` could make it type at a different step
  on another engine; a recording keeps the engine the only variable. Bots
  run only on the server, so their math never has to agree across engines.
  The lab is a plain DOM page loaded only with `?lab=determinism` (its
  ~160 KB gz recording stays out of the game bundle). Break-it flags:
  `&break=sin` (one bit) and `&break=sin1` (1%).

- **2026-10-08 — The owner practices at the intent level, not by writing
  low-level functions.** After the `hashNumber` task (DataView, byte
  order) proved to be syntax work, not design: the owner's pieces are now
  plain-English test cases, spotting smells or planted bugs, designing
  break-it experiments, and reading files by their intent comments. Why:
  writing code is cheap now; specifying, judging and debugging it is not
  (S0's real stumbles were design ones: inputs vs state, what goes in the
  hash).

- **2026-10-08 — S0: copies must be bit-identical, checked by a fingerprint
  of the whole state.** Inputs-only replication can't tolerate "close
  enough": a last-bit difference eventually flips a comparison (butterfly
  effect), so A (bit-identical) is the only way to guarantee the same
  events. The fingerprint (`src/sim/fingerprint.ts`) walks every value
  reachable from the field instead of a hand-picked list (a forgotten field
  would be a hole in the smoke detector), hashes it with FNV-1a (tiny,
  synchronous everywhere; SHA-256 is async in browsers and security isn't
  needed), and the lab takes one every 60 steps (`NET.FINGERPRINT_EVERY`):
  a mismatch lands within 1 s of its cause, and `stateDump` shows which
  number differs. Measured: ~0.15 ms per fingerprint in Node.
- **2026-10-08 — One chat per milestone, small steps inside.** Owner picked
  it over continuing one long chat (the learning-loop skill loads cleanly in
  a fresh chat, and each chat stays focused) and over one chat per step
  (every chat would re-read the code).

### Measurements

How: `npm run determinism:record` (3 recorded ace-bot runs: normal mix,
lumberers, Blinkers; 2–2.5 min each) and the lab `?lab=determinism`, which
replays them and re-asks every `Math.sin`/`Math.exp` input the rules used.

- **2026-10-14 — Node 24.16 (V8 13.6) vs the Claude desktop app's Chromium
  152 (V8 15.2), Windows.** Two versions of the *same* engine disagree:
  `Math.sin` differs in the last bit on 154 of 5000 inputs, `Math.exp` on
  476 of 5000. Fingerprints drift in all 3 runs (lumberers at 1 s, Blinkers
  at 17 s, mix at 103 s), but score, kills and lives still match after
  2–2.5 min. Most `exp` differences never reach the state (`dTime` is
  capped and `d` usually comes from the score).
- **Break it (Node, Math.sin made wrong):** one last bit, and even a 1e-4
  relative error: fingerprints drift at once, no event changes. 0.1%: one
  run's score is off by 1. 1%: the Blinker run's player is knocked out
  (0 lives, 37 kills vs 3 lives, 63 kills).
- **Reading:** a last-bit difference rarely changes what players see in a
  few minutes, but it does change the state, so the copies can't be
  *checked* (every fingerprint mismatches) and nothing guarantees the next
  match stays lucky. The server's Node version and every player's browser
  will differ, so step 4 has to take `sin`/`exp` out of engine hands.
- **2026-10-15 — Android 10 phone, Chrome 155 (ARM).** Bit-identical to the
  desktop Chromium 152 (x86): the same keys at every checkpoint, the same
  `sin` answers. So it still differs from Node at the same steps (mix
  103 s, lumberers 1 s, Blinkers 17 s); outcomes match. The state dump at
  the mix run's first mismatch differs in one number: a Shielded alien
  moving as a lumberer, `y` = 53.674691355859224 (Node) vs
  53.67469135585922 (Android), the gait's `Math.sin`.
- **2026-10-15 — After step 4 (rules on `math/detmath.ts`):** desktop
  Chromium 152 matches Node in every fingerprint of every run, and all
  10,000 sin/exp answers are bit-identical; the "before" column (engine
  Math) still drifts as above. The fdlibm port reproduces Node 24's
  `Math.sin`/`exp` exactly on all recorded inputs, so the switch changed no
  run on Node. The guard test then found `** 3` in the glide easing (pow):
  replaced by multiplications, a last-bit rule change on Node (recording
  re-made; golden master unchanged at 3 decimals).
- **2026-10-18 — Online, 8 bot clients on one PC:** first match 324
  desyncs, all from the fingerprint covering the `outgoing` outbox (the
  server's match empties a copy's outbox, the device never does): now
  skipped like `events`, 0 desyncs since. Server step p50 0.12–0.19 ms,
  p99 0.9–1.6 ms (budget 16.7 ms). Break-it with `--lag 80 --jitter 40`:
  5 of 8 kicked ("step went backwards", "didn't apply a message in time")
  because the fake-lag helper reordered messages (one setTimeout each);
  with one ordered queue, `--lag 120 --jitter 80` (RTT 300–380 ms): 0
  kicked, 0 desyncs, places 1–8.
- **2026-10-18 — Browser + 3 bot clients + 4 server bots:** the lobby,
  START NOW, the dock and the game run online in the dev build.
- **2026-10-18 — Hardening checks (local):** 500-message flood cut off;
  foreign Origin → 403; 12 clients over two rooms and 8 clients at ~400 ms
  RTT: 0 kicked, 0 desyncs; `--slowmo 0.5` cheaters replaced after 3 s.
- _Not measured: iPhone (JavaScriptCore). No faithful way on Windows; with
  the rules on exact operations only it should match by construction —
  open the lab on an iPhone when one is around._

### Glossary

_Terms are added as they come up: the term, what it means here, and the
backend idea it maps to._

| Term | Meaning in Metic99 | Backend equivalent |
| --- | --- | --- |
| Input replication | Clients send only inputs; the server re-runs the same `Field` code from the seed | Event sourcing (the log is the truth, state is a projection) |
| Step | One fixed 1/60 s rule tick; `Field.steps` counts them and inputs are tagged with it | Sequence number / logical clock |
| Bit-identical | Every 64-bit number in the state is the same on both copies | Byte-for-byte replica consistency |
| Fingerprint | 8-hex hash of the whole field state (`fingerprint(field)`) | Replica checksum, ETag |
| Checkpoint | A fingerprint taken every 60 steps during a replay | Periodic consistency check |
| Recording | Inputs + Node's fingerprints + Node's Math answers, replayed by the lab | Golden dataset / contract test fixture |
| Prediction | Your field runs on your device at once; the server checks it later | Optimistic update |
| Authoritative server | The server's copy decides KOs, attacks and places | Source of truth / system of record |
| Remote seat | The server's copy of one person's field, fed by their inputs | Replica fed by a change stream |
| seq / message report | Numbered server→field messages, applied by the device and reported back | Acknowledged delivery, idempotency key |
| Heartbeat | ws ping every 10 s; a socket that misses one is closed | Health check / liveness probe |
| Takeover | A bot plays on for a person who left or misbehaved | Failover |
| Outbox | A list a component fills for someone else to empty (`events`, `outgoing`) | Transactional outbox |
| Guard test | A test that scans the rule files for engine math (`math/detmath.test.ts`) | Architecture fitness function / lint rule |
| fdlibm | Sun's portable math library; our `sin`/`exp` are ports of it using exact ops only | A pinned, vendored dependency instead of the platform's |
| Last bit (ulp) | The smallest step between two floats; engines may round `sin`/`exp` one ulp apart | Floating-point non-determinism across platforms |

### Owner's summaries

_One per milestone, in the owner's words. Claude critiques it at the end of
the milestone._
