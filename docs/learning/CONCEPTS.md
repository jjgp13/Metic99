# Concepts learned while building Metic99

The catalog of ideas the owner has met in feature work. **Feature chats add
rows here** (the `learning-loop` skill, step 7) and never edit review
dates. The quiz chat reads this file to know what's new, and keeps the
review schedule in its own file, [`REVIEWS.md`](REVIEWS.md).

Why two files: each file has **one writer**, so feature branches and the
quiz chat never edit the same lines and never conflict when merged.

## Catalog

One row per concept. Add new rows at the bottom.

| Concept | In one line | Where in Metic99 | Topic | Added | From (change / note) |
| --- | --- | --- | --- | --- | --- |
| Refactor | Change the structure without changing the behavior | the 2026-10-08 commits | engineering | 2026-10-08 | readability refactor |
| Golden master | Snapshot today's results so a refactor can prove nothing changed | `src/sim/golden.test.ts` | testing | 2026-10-08 | readability refactor |
| Deterministic simulation | Same seed + same inputs = same run | `sim/rng.ts`, `Field.inputLog` | game dev | 2026-10-08 | readability refactor |
| Composition root | One place builds and connects the parts; parts don't build each other | `scenes/GameScene.ts` | design | 2026-10-08 | readability refactor |
| Single responsibility | One job per class/file | `ui/hud/*` | design | 2026-10-08 | readability refactor |
| Fixed timestep | Rules advance in equal steps; the view draws in between | `sim/SimClock.ts` | game dev | 2026-10-08 | readability refactor |
| Functional core, imperative shell | Pure logic inside, storage/IO in a thin outer layer | `services/masteryStats.ts` | design | 2026-10-08 | readability refactor |
| Options object | Many parameters → one object with named fields | `Swarm.makeAlien(rng, spec)` | code style | 2026-10-08 | readability refactor |
| Barrel module | A file that only re-exports others | `config/constants.ts` | code style | 2026-10-08 | readability refactor |
| Design tokens | Named colors/sizes used instead of raw values | `config/palette.ts` | code style | 2026-10-08 | readability refactor |
| Single writer | Each piece of shared state has exactly one owner that changes it | `CONCEPTS.md` vs `REVIEWS.md`; `Field.apply` is the only way to change a field | design | 2026-10-08 | quiz setup |
| Input replication (event sourcing) | Send only inputs tagged with their step; every copy re-runs the same code to get the same state | `replayField` in `sim/Field.ts`; the server plan in `docs/NETCODE.md` | netcode | 2026-10-08 | NETCODE S0 step 1 |
| Logical clock (step number) | Tag events with a shared counter, not a wall-clock time, so every copy orders them the same | `Field.steps`, `inputLog` entries `{ step, input }` | netcode | 2026-10-08 | NETCODE S0 step 1 |
| Bit-identical state / butterfly effect | Copies must match in every bit, because a last-bit difference eventually flips a comparison and the runs split | `0.1 + 0.2` vs `0.3`; `Swarm.ts` readability guard | netcode | 2026-10-08 | NETCODE S0 step 1 |
| Hash collision (pigeonhole) | More possible inputs than keys, so two different inputs must sometimes share a key; make it rare, and check again | `sim/fingerprint.ts` header (32-bit key) | netcode | 2026-10-14 | NETCODE S0 step 2 |
| Controlled experiment | Change one variable at a time, so a difference has one cause (a recorded input log, not a live bot) | `src/lab/determinismLab.ts`, `scripts/determinism-record.ts` | testing | 2026-10-14 | NETCODE S0 step 3 |
| Implementation-approximated math | The JS spec lets each engine compute `sin`/`exp` its own way, so results can differ in the last bit; `+ - * /` and `sqrt` are exact | `Alien.ts` gait, `difficulty.ts`; measured in `docs/NETCODE.md` | netcode | 2026-10-14 | NETCODE S0 step 3 |
| Fitness function (guard test) | A test that checks a rule about the code itself, so a convention can't be forgotten | `src/math/detmath.test.ts` (no engine sin/exp in rules) | testing | 2026-10-15 | NETCODE S0 step 4 |
| Client-side prediction | Your device plays your field at once; the server checks it a moment later from your inputs | `src/net/NetBattle.ts` | netcode | 2026-10-18 | NETCODE S4 |
| Authoritative server | One side's copy decides what counts (KOs, places); the client's view is a prediction | `server/RemoteSeat.ts`, `server/Room.ts` | netcode | 2026-10-18 | NETCODE S3 |
| Never trust the client (validation) | Rebuild every incoming message field by field; refuse what a player can't do | `parseClient` in `src/net/protocol.ts`, `RemoteSeat.receive` | security | 2026-10-18 | NETCODE S1/S3 |
| Acknowledged delivery (seq) | Number each message; the receiver reports which one it applied and when | `NetBattle.poll`, `RemoteSeat.receive` | netcode | 2026-10-18 | NETCODE S3 |
| Heartbeat / liveness | Ping every connection; close the ones that stop answering | `server/main.ts` heartbeat, `NET.SILENT_TAKEOVER_MS` | backend | 2026-10-18 | NETCODE S2 |
| Message ordering (TCP) | A socket delivers in order; a fake network must too, or bugs appear that aren't real | `src/net/Lag.ts` | netcode | 2026-10-18 | NETCODE S5 |
| Outbox | A list one part fills and another empties; not state, so not in the fingerprint | `Field.events`, `Field.outgoing`, `SKIP_KEYS` | design | 2026-10-18 | NETCODE S5 |
| Token bucket (rate limiting) | A bucket of N tokens refilled at R/s; each message takes one; empty = refuse | `server/RateLimit.ts` | backend | 2026-10-18 | launch hardening |
| Capacity cap (load shedding) | Past a fixed limit, refuse new work politely instead of slowing everyone down | `server/Rooms.ts` ("server busy") | backend | 2026-10-18 | launch hardening |
| Content hash as a version | Identify code by a hash of what matters, not by where or when it was built | `rulesId()` in `vite.config.ts` | engineering | 2026-10-18 | launch hardening |
| Fail open vs fail closed | When a check can't be sure, choose which mistake is cheaper (here: let a faker through rather than lock real players out) | `clientIp()` in `server/main.ts` | security | 2026-10-18 | launch hardening |
| Hash / fingerprint (checksum) | A short number computed from all the data; any change gives a different one, so two copies compare cheaply | `sim/hash.ts` (FNV-1a), `sim/fingerprint.ts` | netcode | 2026-10-08 | NETCODE S0 step 2 |
| Interface with two implementations | Callers depend on what a part can do, so another part can stand in for it | `FieldView` (`scenes/fieldView.ts`): World3D or DoodleWorld | design | 2026-10-18 | doodle art prototype |
| Pre-rendering (cache) | Draw an expensive picture once, then copy it every frame | `drawFrames` (`renderDoodle/pencil.ts`), the boil frames | game dev | 2026-10-18 | doodle art prototype |
| Edge detection (state change) | Notice the moment something happens by comparing a value with last frame's, so the view needs no new event | `DoodleWorld.drawShip`: `shipHurt` jumps up = a hit | game dev | 2026-10-18 | ship doodles + hit animation |
| Position-triggered behavior | Trigger an action when a thing reaches a place, not after a time, so pausing the world pauses it too | `Leap.steer` (`objects/treetopsTraits.ts`): a squirrel leaps at each branch line | game dev | 2026-10-18 | level 3 treetops |
| Template method (protected hook) | The base class runs the steps and calls a small `protected` method a subclass may override; the subclass changes one step only | `Boss.surfaceAt`, overridden by `MudHalf` (`objects/swamp.ts`) | design | 2026-10-18 | level 4, the mud swamp |
| Goal as a question, not a flag | "Is any boss left?" instead of "the boss died", so a boss that splits needs no special case | `Field.onBulletHit` (`bossLeft`) | design | 2026-10-18 | level 4, the mud swamp |
| Hook with a default (template method) | The base class calls a method that does nothing special by default; a subclass overrides just that step | `Ability.pace(alien, delta)` returns `delta`; the cave's `Roost` / `CaveTroll` override it | design | 2026-10-18 | level 5, the dark cave |
| One class, many configs | A general class takes its numbers as data, so two creatures share one rule | `Hops` with `DRIP` and `SPARK` (`objects/volcanoTraits.ts`) | design | 2026-10-18 | level 6 volcano |
| Subclass that extends a hook (super) | Override a method, add your part, and call the parent's version for the rest | `Dragon.update/onHit` → `Boss` (`objects/dragon.ts`) | design | 2026-10-18 | level 6 volcano |
| Strategy pattern | One interface, several interchangeable classes; the caller asks the interface and never checks which one it has | `SpawnDirector` (`sim/director.ts`): `EndlessDirector` or `LevelDirector`, asked by `Swarm` | design | 2026-10-18 | story slice L2 |
| Content as data | New levels are table entries, not new code, so tuning one never touches the rules | `LEVELS` in `config/tuning/story.ts` | design | 2026-10-18 | story slice L3 |
| Registry | A table from a name to the code that makes it, so new kinds are added with one line instead of a new `if` | `TRAITS` (`objects/traits.ts`), `BOSS_MECHANICS` (`objects/bosses.ts`), `LEVELS`, `PAGES` | design | 2026-10-18 | creatures with personality |
| Presentation delay | Let an animation play before the next screen, without slowing the rules | `RECOVERY.GAME_OVER_DELAY_MS` + `time.delayedCall` in `GameScene` | game dev | 2026-10-18 | ship doodles + hit animation |
| Functional core, imperative shell | Decide in pure functions (easy to test), and keep reading/writing storage in a thin outer layer | `mergeLevel` / `recordLevel` in `services/storyProgress.ts` (like `masteryStats.ts`) | design | 2026-10-18 | story map (L5) |
| Don't trust stored data | Data read back from storage (or the network) is checked and cleaned before use, so a bad value can't break the screen | `parseProgress` in `services/storyProgress.ts` | engineering | 2026-10-18 | story map (L5) |
| Backward-compatible migration | Change the database so the old client still works (new column with a default, new parameters with defaults), then deploy the new client | `supabase/story-boards.sql` (`level` default 0, `p_level default 0`) | backend | 2026-10-18 | story map (L5) |

## In the code, not studied yet

Patterns from `docs/ARCHITECTURE.md` the code already uses but that haven't
been walked through with the owner: model–view separation (§2.1), command
pattern (§2.2), event queue (§2.5), data-driven strategies (§2.6), hooks for
abilities (§2.7), small interfaces (§2.8), reconciliation (§2.10). Good
material for "your turn" tasks and quiz transfer questions.
| Template method (hook) | A base class calls an empty method at a fixed moment; a subclass fills it in to change one step | `Ability.steer` (called by `Swarm.step`), filled by `Dart`, `Dive`, `Hop`, `BigFrog` | design | 2026-10-18 | level 2, the pond |
| Real time vs game (field) time | Timers that must stop with FREEZE/SLOW run on the field's clock, not the wall clock | `steer(alien, fieldDelta)` vs `update(delta)` in `objects/abilities.ts` | game dev | 2026-10-18 | level 2, the pond |
| Tuning by simulation | Pick numbers by running bots many times and measuring, not by guessing | 20-seed bot runs per level (like `src/sim/pond.test.ts`): pond d range 0.2→0.35 = rookies 0/20, 0.1→0.28 = 11/20 | game dev | 2026-10-18 | level 2, the pond |
| Cleanup on shutdown (owned resources) | Whatever an object starts (sounds, timers, tweens) it must also stop when its owner goes away, including things still "on their way out" | `LevelMusic.fading`: songs fading out are destroyed when the scene shuts down | game dev | 2026-10-19 | music fade fix |
