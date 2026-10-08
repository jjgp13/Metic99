# Learning progress

What the owner has learned while building Metic99, and when to review it.
Claude updates this file (the `learning-loop` skill, step 7). Levels and
review intervals are explained in `.claude/skills/learning-loop/SKILL.md`;
the reasons behind them in [`HOW_WE_LEARN.md`](HOW_WE_LEARN.md).

**Levels:** seen → can explain → can apply → solid.
**Next review:** 1 → 3 → 7 → 14 → 30 days after each correct answer; a
miss goes back to 1 day.

## Concepts

| Concept | In one line | Where in Metic99 | Topic | Level | Last reviewed | Next review |
| --- | --- | --- | --- | --- | --- | --- |
| Refactor | Change the structure without changing the behavior | the 2026-10-08 commits | engineering | seen | — | 2026-10-09 |
| Golden master | Snapshot today's results so a refactor can prove nothing changed | `src/sim/golden.test.ts` | testing | seen | — | 2026-10-09 |
| Deterministic simulation | Same seed + same inputs = same run | `sim/rng.ts`, `Field.inputLog` | game dev | seen | — | 2026-10-09 |
| Composition root | One place builds and connects the parts; parts don't build each other | `scenes/GameScene.ts` | design | seen | — | 2026-10-09 |
| Single responsibility | One job per class/file | `ui/hud/*` | design | seen | — | 2026-10-09 |
| Fixed timestep | Rules advance in equal steps; the view draws in between | `sim/SimClock.ts` | game dev | seen | — | 2026-10-09 |
| Functional core, imperative shell | Pure logic inside, storage/IO in a thin outer layer | `services/masteryStats.ts` | design | seen | — | 2026-10-09 |
| Options object | Many parameters → one object with named fields | `Swarm.makeAlien(rng, spec)` | code style | seen | — | 2026-10-09 |
| Barrel module | A file that only re-exports others | `config/constants.ts` | code style | seen | — | 2026-10-09 |
| Design tokens | Named colors/sizes used instead of raw values | `config/palette.ts` | code style | seen | — | 2026-10-09 |

## Next up (in the code, not studied yet)

Patterns from `docs/ARCHITECTURE.md` that the code already uses but that
haven't been walked through with the owner: model–view separation (§2.1),
command pattern (§2.2), event queue (§2.5), data-driven strategies (§2.6),
hooks for abilities (§2.7), small interfaces (§2.8), reconciliation (§2.10).
Pick from here for "your turn" tasks and review questions.

## Log

One line per session: date, what was worked on, what was learned or missed.

- 2026-10-08 — Readability refactor and engineering practices; the
  learning loop starts. Concepts above walked through in
  `docs/learning/2026-10-08-readability-refactor.md`.
