# Metic99 — Learning Log

Journal of the owner's lessons, exercises, recorded answers, feedback and
demonstrated understanding. Seeded 2026-11-08 from
`docs/learning/HOW_WE_LEARN.md`, `docs/learning/CONCEPTS.md`,
`docs/learning/REVIEWS.md`, the dated notes in `docs/learning/`, the
`learning-loop`, `quiz` and `explain-change` skills under `.claude/skills/`,
`docs/NETCODE.md`, the `AGENTS.md` Decision Log and commit messages on
`master`.

## Ownership rule (read first)

- **The quiz chat is the only writer of `docs/learning/REVIEWS.md`.** It
  owns every review level, review date, status and quiz-log line.
- This log **summarizes and links** to that record. It does **not** copy
  due dates or restate review levels and statuses as its own data.
- It claims no understanding beyond what `REVIEWS.md` and the cited
  evidence record.
- For "what does the owner know, and what is due", read `REVIEWS.md`
  itself. Its newest version may be on the quiz chat's own branch, not on
  `master`.
- `CONCEPTS.md` is written by the feature chats. This log only points to
  it.

---

## 1. How learning works in this project

- **The goal.** Every change is also a lesson. The owner learns by doing
  the thinking: predicting, choosing and explaining. Claude explains
  afterwards. (`docs/learning/HOW_WE_LEARN.md` intro and §2; `AGENTS.md`
  working agreement)
- **Feature chats** follow the `learning-loop` skill:
  1. The owner thinks first: approach, pick and confidence.
  2. Owner and Claude reason together.
  3. Claude builds.
  4. Claude walks through the change, with "predict" moments.
  5. Claude checks with 1–2 questions.
  6. "Your turn" practice, offered.
  7. New concepts are recorded in `CONCEPTS.md`.
- **The explanation of a change** follows the `explain-change` skill:
  - the pattern, why it was chosen, the alternatives that lost, how to
    change it later, and how it was verified;
  - large changes get a dated note in `docs/learning/`.
  (Also `docs/ENGINEERING.md` §6.)
- **Spaced review** happens in one dedicated quiz chat, through the `quiz`
  skill (`/quiz`, planned on a Mon/Wed/Fri routine). The quiz chat syncs
  `master`, asks due concepts plus the week's features, grades each answer
  correct, partial or miss, and writes `REVIEWS.md`.
- **The science** is in `docs/learning/HOW_WE_LEARN.md` §1: retrieval
  practice, pretesting, hypercorrection, spacing, worked examples that
  fade, and PRIMM.

**Key dated decisions about learning**
- 2026-10-08: every change is a tutoring session (Decision Log; `b288560`).
- 2026-10-08: reviews move to a dedicated quiz chat, with progress split
  by writer: `CONCEPTS.md` vs `REVIEWS.md` (Decision Log; `58423e9`).
- 2026-10-08: owner practice becomes **intent-level** (Decision Log;
  `docs/NETCODE.md` Journal; `62aedca`):
  - plain-English test cases;
  - spotting smells or planted bugs;
  - designing break-it experiments;
  - reading files by their intent comment.
  Claude writes the low-level code.
- 2026-10-08: netcode is taught as one chat per milestone. Each milestone
  includes:
  - a sequence diagram;
  - a ~50-line tour;
  - a break-it experiment;
  - an intent-level task;
  - the owner's own summary, which Claude critiques.
  (`docs/NETCODE.md` → "How we work")

## 2. Lessons (worked examples in `docs/learning/`)

Each note is a walkthrough of one change, with its patterns and the
alternatives that lost.

| Date | Note | What it teaches |
| --- | --- | --- |
| 2026-10-08 | `2026-10-08-readability-refactor.md` | Refactor vs rewrite, golden master first, design tokens, composition root plus HUD components, options object, barrel module |
| 2026-10-18 | `2026-10-18-online-server.md` | Netcode S1–S5 end to end: inputs only, seq@step, the authoritative server; includes a task and a quiz |
| 2026-10-18 | `2026-10-18-launch-hardening.md` | Rules id, room caps (load shedding), rate limiting, Origin check, compression, the slow-motion cheat; includes questions |
| 2026-10-18 | `2026-10-18-level2-pond.md` | The `steer` hook, field time vs real time, tuning by simulation |
| 2026-10-18 | `2026-10-18-level3-treetops.md` | Position-triggered behavior, a Boss subclass, balance from bots |
| 2026-10-18 | `2026-10-18-level5-cave.md` | A hook with a default (`pace`), traits, a boss read by lamplight |
| 2026-10-18 | `2026-10-18-story-map.md` | Functional core for progress, don't trust stored data, backward-compatible migration |
| 2026-10-19 | `2026-10-19-energy-rework.md` | Measure first, resource economy, reading old saves safely |
| 2026-10-19 | `2026-10-19-power-balance.md` | One knob at a time, balancing options to one target, the order of events in a step |
| 2026-10-19 | `2026-10-19-level8-snow.md` | An invariant fixed at construction, optional interface methods |
| 2026-10-19 | `2026-10-19-level9-night.md` | Marches side by side, a default implementation (`ballCover`) |
| 2026-10-19 | `2026-10-19-level10-bedroom.md` | Phases as data, an optional interface member |
| 2026-10-20 | `2026-10-20-boss-tricks.md` | Seams before behavior, the state machine, shown vs checked |
| 2026-10-20 | `2026-10-20-level-clear-sequence.md` | Look-only state stays out of the rules, easing, optional assets |
| 2026-10-21 | `2026-10-21-endless-score-details.md` | Detail table, table CHECK vs function check, atomic transaction, fallback for an older server |

`docs/NETCODE.md` → Glossary pairs each netcode term with its backend
equivalent (event sourcing, replica checksum, optimistic update, and
others).

## 3. The concept catalog (summary only)

`docs/learning/CONCEPTS.md` lists the concepts met in feature work. Each
row gives the concept, a one-line meaning, where it is in the code, its
topic, the date added and its source.

- **By topic:** design, game dev, netcode, engineering, testing, backend,
  security, code style, web, debugging.
- **By date:**
  - 2026-10-08 brought the refactor set and the first netcode set.
  - 2026-10-14/15 brought the S0 determinism concepts.
  - 2026-10-18 to 2026-10-21 brought most of the rest, from the story
    levels, the server, the soundtrack and the Endless backend.
- **"In the code, not studied yet."** The catalog has this section for
  `ARCHITECTURE.md` patterns not yet walked through with the owner:
  model–view separation, the command pattern, the event queue, data-driven
  strategies, ability hooks, small interfaces and reconciliation.
- **What the catalog is not.** It records that a concept was *met*. It is
  not evidence that the owner can explain or apply it; only `REVIEWS.md`
  and the items in §5 speak to that.

## 4. Exercises and tasks set

| Date | Task | Where | Recorded outcome |
| --- | --- | --- | --- |
| 2026-10-08 | "Owner's piece": write `hashNumber`, hashing a float's 8 bytes, against pre-written skipped tests | commit `0d8f4c2`; `docs/NETCODE.md` Journal 2026-10-08 | The function was then filled in (`62aedca`). The task "proved to be syntax work, not design", which led to intent-level practice. Who wrote the final version is not stated. |
| 2026-10-18 | "Your piece (intent level)": in plain English, write one cheat the server does not catch | `docs/learning/2026-10-18-online-server.md` | Owner's answer: not recorded. |
| 2026-10-18 | Five quiz questions on the online server | same note, "Quiz" | Answers: not recorded. |
| 2026-10-18 | The slow-motion cheat, "your open task" | `docs/learning/2026-10-18-launch-hardening.md` §5; Decision Log 2026-10-18 | The note gives the answer and the fix. Whether the owner found it or Claude answered it is unclear. |
| 2026-10-18 | Three questions on launch hardening | `docs/learning/2026-10-18-launch-hardening.md` "Questions" | Answers: not recorded. |
| ongoing | The owner's summary per netcode milestone | `docs/NETCODE.md` → "Owner's summaries" | The section is empty. |
| ongoing | Scheduled quizzes | `.claude/skills/quiz/SKILL.md`; `REVIEWS.md` | See `REVIEWS.md`. Its "Schedule" and "Log" sections are the record; this log does not restate them. |

## 5. Recorded answers and feedback

These are the owner's answers that a doc or commit message records, with
what changed after discussion. Design picks made purely as product
decisions (most "owner's pick" entries in the Decision Log) are not counted
as learning evidence.

**Correct answers**
- **2026-10-08 — Hash contents.** "Owner explained correctly why an
  alien's y must be in the hash." (commit `0d8f4c2`, netcode S0 step 2)
- **2026-10-20 — Optional music.** "Owner answered the pretest right":
  play the ending music only if it reached the audio cache. (commit
  `c7c9759`)

**Stumbles noted by the docs**
- **2026-10-08 — Design, not syntax.** S0's real stumbles "were design
  ones: inputs vs state, what goes in the hash". (`docs/NETCODE.md`
  Journal 2026-10-08)

**First picks that changed after discussion**
- **2026-10-18 — No copied code.** The owner's first pick was a copied
  story spawner. The final design was a strategy interface (the spawn
  director), because a copy would duplicate ~550 lines, "against the
  owner's own 'no duplicated code'". (Decision Log 2026-10-18 "Story slice
  L1–L4")
- **2026-10-20 — Animation in the rules.** The owner's first pick put the
  ship launch animation in the rules. The final design keeps it in the
  view snapshot. (Decision Log 2026-10-20; commit `c8946bc`;
  `docs/learning/2026-10-20-level-clear-sequence.md` §1)
- **2026-10-20 — A cue as a rule event.** The owner's first pick made the
  power-ready cue a rule event. The final design derives it in the HUD.
  (Decision Log 2026-10-20; commit `d97299e`)
- **2026-10-20 — A stored list.** The owner first picked a saved list of
  unlocked ships. After "weighing the two-copies problem", the owner chose
  to derive unlocks from progress. (commit `2d932a2`; Decision Log
  2026-10-20)
- **2026-10-20 — A theme in the rules.** The owner's first guess put the
  Endless theme on the field. "We talked through why a look belongs
  outside the sim." (commit `688bc66`; Decision Log 2026-10-20)

**Open question in `REVIEWS.md`**
- `REVIEWS.md` carries a note against the golden-master concept about a
  question the owner had not answered yet. Read it there.

## 6. Demonstrated understanding (what the evidence supports)

- **Two explicit correct answers are recorded:** why the state hash must
  include an alien's position, and guarding optional music on the cache.
  (§5)
- **One recurring theme across first picks:** in three 2026-10-20 changes,
  look-only things were first put in the rules (the theme, the launch, the
  cue), and twice in the same period a stored copy was weighed against a
  derived fact. The final designs are recorded; that the owner now applies
  the idea unprompted is **not recorded**.
- **Nothing here claims a review level.** Levels and their history live
  only in `REVIEWS.md`, written by the quiz chat.

## 7. Evidence gaps

- **No quiz is logged in `REVIEWS.md` on `master`.** The quiz chat may
  hold newer state on its own branch; that state is not visible here and
  is not inferred.
- **`REVIEWS.md` on `master` tracks only the first 2026-10-08 concepts.**
  Later `CONCEPTS.md` rows are, per the quiz skill, added at the quiz
  chat's next sync.
- **Answers to the note quizzes are not recorded** (online server, launch
  hardening), and the owner's milestone summaries in `docs/NETCODE.md` are
  empty.
- **Who did the work is unclear in two places:** who wrote the final
  `hashNumber`, and who answered the slow-motion "open task".
- **`CONCEPTS.md` has problems:**
  - near-duplicate rows: functional core; pre-rendering; optional
    asset/fallback; optional interface method/member; several template
    method / hook rows;
  - some rows sit below the "In the code, not studied yet" section instead
    of in the catalog table.
  Fixing either needs an edit by a feature chat; this log does not edit
  it.
- **The Decision Log 2026-10-08 still mentions `docs/learning/PROGRESS.md`.**
  That file was split into `CONCEPTS.md` and `REVIEWS.md` the same day
  (`58423e9`).
