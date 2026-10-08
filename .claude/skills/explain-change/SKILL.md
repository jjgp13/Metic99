---
name: explain-change
description: Explain a code change in Metic99 so the owner can learn from it — the pattern used, why it was chosen, the alternatives that lost, and how to change it later. Use at the end of EVERY task that changes code in this repo (before the final reply), when writing a commit body for a non-trivial change, and whenever the owner asks "why", "which pattern", or "explain this change/file".
---

# Explain a change (Metic99)

Metic99 is a learning project. The owner reads every change to learn the
patterns, so a change is not finished until it is explained. The rules for
writing the code itself are in `docs/ENGINEERING.md`; the patterns already in
the codebase are in `docs/ARCHITECTURE.md`.

This skill is *what* to write. *How* to teach it (owner thinks first, ≤ 2
questions at a time, predict moments, spaced review) is the `learning-loop`
skill, which uses this template in its walkthrough step: order the blocks
by the change's named subgoals, and end with questions, not with "does that
make sense?".

## Before writing code

(When the owner is there, the `learning-loop` skill's steps 1–2 come first:
the owner proposes or picks an option before you do.)

1. Read the code you will touch and say, in one or two sentences, what it
   does today.
2. List **at least two** ways to make the change. Pick the simplest one that
   respects the layers in `docs/ENGINEERING.md` §2. Keep the losers and the
   reason each lost: you will need them for the explanation.
3. If the choice is really a game-design or product decision (it changes
   how the game plays or looks), ask the owner instead of picking.

## While writing code

- Never mix a refactor and a behavior change in one commit.
- Keep the golden master (`src/sim/golden.test.ts`) green for refactors;
  update it (`npx vitest run -u`) only for intended rule changes, and say so.
- Run `npx tsc --noEmit`, `npm test`, `npm run build` before committing.

## The explanation

Write one block per logical change, in plain English, short sentences, no
unexplained jargon. The first time a pattern name appears, define it in a
sentence. Link to `docs/ARCHITECTURE.md` when the pattern is listed there; if
it is a pattern the codebase didn't use before, **add it to the catalog**
there in the same commit.

```markdown
### <Change title>
**What changed:** one or two sentences, in terms of behavior or structure.
**Pattern:** <name> — what it is in two lines. (ARCHITECTURE.md §x.y)
**Why this way:** the concrete problem it solves in this code. Point to the
  file and function.
**Alternatives considered:**
- <option> — why it lost (cost, risk, readability, fit with the layers).
- <option> — why it lost.
**How to change it later:** where to look and what to edit for the most
  likely next change.
**Verified by:** commands run and their result (tests passed, golden master
  unchanged, bots/match numbers if balance could move).
```

## Where it goes

| Size of change | Explanation goes in |
| --- | --- |
| Small (one file, obvious) | the final reply only, 3–6 lines |
| Medium (a feature, a refactor of one module) | final reply + commit body (short form) |
| Large (several modules, a new pattern, an architecture decision) | `docs/learning/YYYY-MM-DD-<topic>.md` (full blocks), linked from the final reply and the commit; plus a Decision Log entry in `AGENTS.md` |

## Checklist before the final reply

- [ ] Every logical change has an explanation block (or a short form).
- [ ] Each block names at least one real alternative and why it lost.
- [ ] New patterns are added to `docs/ARCHITECTURE.md`.
- [ ] Architecture/design decisions are in the `AGENTS.md` Decision Log.
- [ ] The reply says honestly what was verified and what was not (e.g. "not
      run in a browser").
