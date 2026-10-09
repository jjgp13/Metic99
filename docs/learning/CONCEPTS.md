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
| Hash / fingerprint (checksum) | A short number computed from all the data; any change gives a different one, so two copies compare cheaply | `sim/hash.ts` (FNV-1a), `sim/fingerprint.ts` | netcode | 2026-10-08 | NETCODE S0 step 2 |

## In the code, not studied yet

Patterns from `docs/ARCHITECTURE.md` the code already uses but that haven't
been walked through with the owner: model–view separation (§2.1), command
pattern (§2.2), event queue (§2.5), data-driven strategies (§2.6), hooks for
abilities (§2.7), small interfaces (§2.8), reconciliation (§2.10). Good
material for "your turn" tasks and quiz transfer questions.
