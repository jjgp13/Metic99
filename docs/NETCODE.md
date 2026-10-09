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
| S0 | Determinism spike | 1. What "same inputs, same run" means. 2. Fingerprint: a hash of the field state. 3. Phone lab `?lab=determinism`: Node vs iPhone vs Android. 4. Fix what differs and pin it with a test | Event sourcing, replica checksums | in progress: steps 1–2 done |
| S1 | Protocol (`src/net/protocol.ts`) | 1. Envelope, versions, build-id handshake. 2. The messages each way + validation. 3. JSON vs binary, bytes per second | API contracts, schema validation | |
| S2 | Server skeleton | 1. WebSocket server. 2. Heartbeat and timeouts. 3. Lobby that fills seats with bots after a countdown. 4. One tick loop | Connection lifecycle, health checks | |
| S3 | Server runs the match | 1. Remote fields fed by inputs. 2. Late and "future" inputs. 3. A player who stops sending | Queues, ordering, idempotency | |
| S4 | Client network mode | 1. Same `BattleView`/tiles over the network. 2. Prediction of your own field. 3. Reconcile when the server's fingerprint disagrees | Optimistic updates, reconciliation | |
| S5 | Real network | 1. Two browsers. 2. Simulated latency, jitter, loss. 3. Reconnect and resume. 4. Load test with headless bot clients (fields per core, tick p50/p99) | Chaos testing, capacity planning | |
| S6 | Deploy | 1. Compare Fly.io, Render, a VM + Caddy. 2. TLS (`wss://`). 3. Connect the Pages build | Ops, TLS | |

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

_None yet. S0 step 3 adds the first ones (Node vs Chrome vs iPhone vs
Android)._

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

### Owner's summaries

_One per milestone, in the owner's words. Claude critiques it at the end of
the milestone._
