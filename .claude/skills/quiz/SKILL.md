---
name: quiz
description: Run a spaced-repetition quiz for the Metic99 owner on what they learned while building features — due concepts from docs/learning/REVIEWS.md plus what changed since the last quiz. Use when the owner types /quiz or asks to be quizzed or to review, when a scheduled quiz Routine fires in the quiz chat, and to set up or change the quiz schedule. Not for feature chats (they use learning-loop).
---

# Quiz (Metic99)

The owner keeps **one dedicated chat for quizzes**. Feature chats teach (the
`learning-loop` skill) and add what was learned to
`docs/learning/CONCEPTS.md`; this chat brings it back on a schedule, which
is what makes it stick. The science is in `docs/learning/HOW_WE_LEARN.md`
(section numbers in brackets).

**This chat is the only writer of `docs/learning/REVIEWS.md`.** Never edit
`CONCEPTS.md` here except to fix a typo; never edit code in a quiz.

## 1. Sync (silently, before the first question)

1. `git fetch origin master` and merge it into this chat's branch, so new
   concepts, learning notes and commits from feature chats are here.
2. Read `CONCEPTS.md` and `REVIEWS.md`. Any concept in the catalog without a
   row in REVIEWS.md is new: add it as `seen`, due today.
3. Read what changed since "Last quiz": `git log origin/master --since=<last
   quiz date>` (commit bodies carry the explanations) and any new
   `docs/learning/*.md` note. That is this week's material.

## 2. Plan the session (~10 minutes, 4–6 questions)

- **Due first:** concepts whose next review ≤ today, most overdue first.
  [1.5]
- **This week:** 1–2 questions about the features built since the last quiz
  ("why did the SEND button become its own class?").
- **Mix topics** (design, testing, game dev, code style); never two
  questions in a row on the same concept. [1.6]
- **At least one transfer question**: apply an idea somewhere new in
  Metic99 ("where else could an options object help?"). [1.4]
- If nothing is due and nothing changed, say so in one line and offer one
  stretch question on an "in the code, not studied yet" pattern.

## 3. Ask

- **One question per message** (the owner often answers by voice). Never
  more than two. [1.11]
- Ask for **confidence 1–5** with the answer. [1.3]
- Question types, varied:
  - *explain*: "in your words, why does X …?"
  - *predict*: "if we removed X, what would happen first?" [1.9]
  - *spot*: show ≤ 15 real lines from the repo: "which pattern is this, and
    what does it buy us?"
  - *choose*: a small design decision with 2–3 options, "which and why?"
  - *debug*: "after this change the golden master fails; what are the two
    possible reasons?"
  - *game design*: reasoning about feel or balance with the game's numbers.
- Ask about reasons, not names or numbers. No yes/no questions. [1.4]

## 4. Grade and give feedback (after each answer)

- Grade as **correct / partial / miss**. Say exactly what was right, what
  was missing, and the one idea to keep. Short (≤ ~100 words), about the
  answer, never the person. [1.10]
- **Confident miss** (confidence 4–5): explain why the wrong answer seemed
  right and what changes the picture, then ask a reworded version of the
  same question at the end of the session. [1.3]
- Partial or miss: re-explain with a *different* example than the feature
  chat used (or a tiny diagram). [1.4]

## 5. Record

Update `REVIEWS.md` for every concept asked:

| Result | Level | Next review |
| --- | --- | --- |
| correct | up one (seen → can explain; can explain → can apply only for a *choose* or transfer question; → solid when the last review was ≥ 7 days before) | next gap: 1 → 3 → 7 → 14 → 30 days |
| partial | unchanged | same gap again |
| miss | down one (not below seen) | 1 day |

Add a note on what was missed, set "Last quiz", add one Log line. Commit
(`Quiz <date>: n right, n partial, n missed`, with the AGENTS.md trailers)
and push this chat's branch.

## 6. Wrap up

Three short lines: what's solid now, the 1–2 weak spots, and (if a concept
reached "can explain") an offer of a **"your turn" task** for the next
feature chat ("next time, you write the pop for X; same pattern as
`Popups.points`"). [1.7, 1.12] Add that offer to the Log line so the
feature chat can pick it up.

## Schedule (set up once, from the quiz chat)

When the owner asks for a schedule, or at the first quiz if "Routine" in
REVIEWS.md says "not set up yet":
1. Ask the owner's time zone and preferred time, and confirm the days
   (default Monday, Wednesday, Friday: a 2–3 day gap).
2. Create a Routine that fires **into this chat** (`create_trigger` without
   `persistent_session_id` or `create_new_session_on_fire`;
   `initiation: "human_request"`), cron in the owner's time zone
   (`CRON_TZ=<zone> <min> <hour> * * 1,3,5`, with the minute moved a few
   minutes off the hour), prompt: `Scheduled quiz: run the quiz skill.`
3. Record its trigger id, days and time under "Schedule" in REVIEWS.md.
To pause or change it, use `update_trigger` with that id.

**When a scheduled quiz fires and the last quiz was never answered**, don't
pile up questions: send one short line ("Quiz time — still waiting on this
one:") with the open question, and stop.
