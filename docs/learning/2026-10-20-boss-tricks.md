# Boss signature tricks (2026-10-20)

The owner, after a phone playtest: the storm cloud dropping a raindrop and
the troll's lamp "make each boss memorable". An audit found 7 of 10 bosses
with a trick; the Giant Mole, Big Frog and Great Owl were only "answer it,
it moves away". The owner picked one of two ideas for each. Rule: a trick
changes how the fight *feels*, not how long it is.

Subgoals (also the commit names):

1. Seams: four small hooks, no behavior change
2. Mole: whack-a-mole out of three molehills
3. Frog: a hungry frog
4. Owl: "WHO?" riddles
5. Balance: the mole takes 4 answers

---

### 1. Seams (refactor)
**What changed:** `Boss.onHit` picks its next sum through a protected
`newSum` method; an `Ability` can say what a ball shows (`ballText`); a
boss look can draw over the numbers (`BossLook.over`); bots answer
`alien.result` instead of re-adding the digits.
**Pattern:** template method / hook with a default
([ARCHITECTURE.md](../ARCHITECTURE.md) §2.7, CONCEPTS "Hook with a
default"): the base class calls a method that does the usual thing; a
subclass overrides just that step.
**Why this way:** each default does exactly what the code did before, so
the golden master stayed green. That proves the refactor changed nothing
before any rule changed.
**Alternatives considered:**
- An `if (owl)` inside `Boss.onHit` and `DoodleWorld.drawBalls`: the base
  class would know every boss, so every new boss means editing shared code.
- Doing the refactor in the same commit as the owl: if the golden master
  moved, you couldn't tell which part moved it.
**How to change it later:** a boss with a different kind of sum overrides
`newSum`; a ball that shows a symbol overrides `ballText`.
**Verified by:** `npx tsc --noEmit`, `npm test` (golden master unchanged).

### 2. Mole: whack-a-mole
**What changed:** the mole walks in, then peeks out of one of three
molehills (numbers readable, still), ducks, and digs to another hill. That
hill shakes and spits dirt while the mole comes, which is the telegraph.
Each new hill is 30 px closer. After an answer it digs to a hill higher up.
**Pattern:** finite state machine (§2.19): `MolePhase` = walk / peek /
duck / dig, one `switch` in `GiantMole.steer`.
**Why this way:** every phase is one glide or one hold, and `steer` runs on
field time. FREEZE and SLOW therefore hold the rhythm, and it stops while
the mole is your held target. Which hill comes next follows from its sum,
which was rolled from a seed: hard to learn by heart, but every replay is
exact.
**Alternatives considered:**
- Use the base Boss's burrow after an answer (first try): its surfacing
  had no shaking hill, and nothing retried when a creature was in the way.
- Run the rhythm in `update` (real time, like the Blinker's eyes): the mole
  would hop on during a FREEZE, so a frozen board would change under you.
**How to change it later:** timings are in `MOLE_HILLS`
(`config/levels/backyard.ts`); hill spots in `MOLE_HILLS.X`.
**A bug worth remembering:** an answer mid-peek started a dig, but the
peek's hold was still running, so the mole sat underground for up to 2.4 s
after its glide. A new phase must cancel what the old one left running
(`alien.hold(0)` in `digTo`). The bot trace found it: one dig lasted 2.9 s
instead of 0.8 s.
**Verified by:** `story.test.ts` "Giant Mole" (every hill used, at least
80% of peeks at a hill, numbers never readable while digging, every dig
telegraphed), bots below.

### 3. Frog: hungry
**What changed:** while the frog croaks, its tongue aims (a dotted line) at
the nearest creature within 190 px. When the croak ends, it eats it (no
points) and its sum gets one more number (it starts at 3, max 4). A fatter
frog sits 300 ms longer. Answering that creature first saves it, and the
one you typed or fired at is never eaten.
**Pattern:** edge detection (CONCEPTS): `update` compares "croaking now"
with "croaking last step" to find the moment the croak starts or ends.
Plus two optional `AbilityHost` methods (`preyNear`, `swallow`), like
`spawnMinion`.
**Why this way:** the croak lives in `steer` (field time, no host), but
eating needs the host. `update` gets the host, so it watches the croak's
edges. The rule "never eat the player's target" lives in `Swarm.swallow`,
the only place that knows the held and locked aliens.
**Alternatives considered:**
- Pass the host to `steer` too: it changes a hook every trait and boss
  overrides, for one boss.
- Let the frog eat anything in reach: it could eat the alien you just
  typed, which takes a committed answer away (unfair).
**How to change it later:** `TONGUE_REACH_PX`, `MAX_BALLS`,
`SIT_PER_BALL_MS` in `BIG_FROG` (`config/levels/pond.ts`).
**Verified by:** `pond.test.ts` (it aims, never in the air, eats, grows to
4), bots below.

### 4. Owl: "WHO?"
**What changed:** the owl's eyes show "3" and "?", its belly "= 8", and you
type the missing number (5). It no longer blinks: a riddle plus blinking
would be harder, not different. It moves at 0.35 (was 0.4) because a
riddle is harder than a sum.
**Pattern:** shown vs checked (CONCEPTS): what the owl shows (its digits,
one drawn as "?") and what the rules check (`result` = the second digit)
are two fields. Every reader (the field, the bots) uses `result`.
**Why this way:** the field already matches typed numbers by `result` and
keeps results unique. A riddle only needed a different roll
(`Swarm.rerollMissing`) and a different picture (`ballText`, `over`).
**Alternatives considered:**
- A real subtraction ball (red): the "operations" piece isn't built, and it
  would touch every renderer and the HUD.
- Keep `result` = sum and check the riddle separately: two answers for one
  alien, and the bots would still type the sum.
**How to change it later:** `OWL_RIDDLE.MIN_ANSWER`; the total and the
"who?" bubble are `drawRiddle` / `drawAsk` in
`renderDoodle/levels/treetops.ts`.
**Known limit:** the old 3D view (`?art=3d`) still shows the second digit.
**Verified by:** `treetops.test.ts` (every answer is the second eye's
number, "?" shown, `result` = that number), bots below, and typed in the
running game (4 + ? = 7, typing 3 took one answer off).

### 5. Balance: the mole takes 4 answers
**What changed:** `HP` 5 → 4.
**Why:** the hiding between peeks made each answer about 1 s slower for
bots (the pace bots are fitted to), so 5 answers made the fight ~5 s
longer. The brief was "don't make bosses longer".
**Alternatives considered:** longer peeks and shorter digs (tried: 2.4 s /
0.45 s, still +4 s); keeping 5 and accepting longer fights.

---

## Bots before → after (24 seeds, clears rookie / pilot / ace)

| Boss | SLOW | FREEZE | Rookie fight (SLOW) |
| --- | --- | --- | --- |
| Mole | 6/24/24 → 6/24/24 | 11/24/24 → 15/24/24 | 38 → 37 s |
| Frog | 4/22/24 → 8/21/24 | 9/23/24 → 13/24/24 | 47 → 49 s |
| Owl | 17/24/24 → 17/24/24 | 19/24/24 → 18/24/24 | 40 → 41 s |

Levels 4–10 (12 seeds, both powers): byte-identical to before. The two
one-seed drops (frog pilot SLOW, owl rookie FREEZE) are within the noise
of 24 seeds; the other direction moved by more.
