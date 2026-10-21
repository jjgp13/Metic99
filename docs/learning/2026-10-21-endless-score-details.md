# Endless scores with their context

An Endless score on the world board now shows what it was played with: a
small picture of the ship, the power, the world (theme) and how long the
run lasted. Owner's answers: "the ability" means the power, and "how many
times did they stay" means the survival time of that run (not a count of
runs: initials aren't an identity, so we can't count one player's runs).

Built in four subgoals, explained in that order.

### 1. The database: a detail table
**What changed:** `supabase/endless-details.sql` adds `endless_runs(score_id,
ship, power, theme, survival_ms)`: one row per Endless score, keyed by that
score's id. `submit_run` takes four more parameters (default null) and writes
the detail row in the same transaction as the score.
**Pattern:** detail table, one-to-one (ARCHITECTURE.md §2.21), plus
backward-compatible migration (§2.16): the old game sends no details and
still works.
**Why this way:** owner's pick (B). Each mode keeps its own context in its
own table. `scores` stays the one ranking table, so `get_rank` and the top-N
reads didn't change.
**Alternatives considered:**
- New columns on `scores` (A): one read, no join, but story and battle rows
  would carry four empty columns, and every new mode adds more.
- A JSON `details` column (C): no migration per new fact, but the database
  can't check the ids, and the board would read whatever was sent.
**Where each check lives:**
- *On the table* (CHECK constraints): rules about a value alone, like a
  known ship id or a survival time under 4 hours. No writer can break them,
  not even a future function.
- *In `submit_run`*: rules that need context. Details come all together or
  not at all, and only for Endless. Survival can't be longer than the
  ticket's age (+5 s for the trip to the server). The score must fit the
  survival time at the same 3000 points/s cap as before.
**How to change it later:** a new ship, power or world → update its CHECK
in a new migration (drop + add the constraint). A new fact (e.g. kills) →
a column on `endless_runs` (nullable or with a default), a new defaulted
parameter on `submit_run`, `detailArgs` and `parseDetails`.
**Verified by:** applied to MeticWeb on 2026-10-21. Then, on the live
database, one `do` block called `submit_run` seven ways and ended by
raising an error on purpose, so Postgres undid every row it wrote: a valid
submit (score + detail row), the old call shape (score only), a forged
ship (refused; the ticket stayed unused, no score left), survival longer
than the ticket, a score too high for its survival, partial details, and
details on a story board (all refused). With the public key: the board read
returns the details as an object (null for older scores), a direct insert
into `endless_runs` is refused, and both call shapes reach the function.

### 2. The pure core: `services/endlessDetails.ts`
**What changed:** `detailArgs` (details → RPC arguments, none without
details), `parseDetails` (the embedded row → details or null) and
`formatSurvival` (ms → "4:12").
**Pattern:** functional core, imperative shell (§2.14).
**Why this way:** these are the parts that can be wrong (a renamed
parameter, an object vs array embed), and now they're tested without
Supabase (`endlessDetails.test.ts`).

### 3. The client path: game over → name entry → submit
**What changed:** `GameScene.endlessDetails()` collects ship, power, theme
and `field.elapsedMs` (the game clock, pauses excluded) at the Endless game
over. NameEntry passes `BoardScore.details` to `submitScore`. Story and
battle pass none.
**Fallbacks for an older database:** `getTop` tries the read with details
first, then without them, then without `level`. `submitScore` retries
without details when the server answers PGRST202 ("no such function"). The
call never ran, so the ticket is still unused. So deploying the game before
the migration loses no scores.
The theme is the Endless theme picked on the menu (`GameScene.theme`,
config/themes.ts), "plain" when none.

**Unknown ids don't lose a score:** if the database refuses the details
because an id isn't in its list (code 23514, e.g. a new ship added in the
game before its migration), `submitScore` also sends the score again
alone. Tested live: a `ufo` ship returned 23514 and left the ticket
unused. Refusals that point at a forged run (survival longer than the
match, a score too high for its time) are not retried
(`retryWithoutDetails`, unit-tested).

### 4. The board
**What changed:** Endless rows show rank + name, ship icon, power, world,
time and score, with a small column header. Older scores show only name and
score. Story boards are unchanged.
**Verified by:** tsc, 160 tests, build. In the browser at 375 px phone
width: SCORES from the menu shows "World scores are offline" (no
credentials here); the board with 20 sample rows (via the dev console) fits
and reads.
