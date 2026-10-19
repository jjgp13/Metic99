# Level 3, THE TREETOPS: how it was built

Built in its own chat at the same time as levels 2, 4, 5 and 6, so it touches
only its own files plus one line in each registry (and two tiny shared
hooks copied from sibling branches). Commits: `340d16e`, `27db290`, `c6b90ac`.

### 1. `Ability.steer`: a creature moves itself
**What changed:** abilities got a fourth hook, `steer(alien, fieldDelta)`,
called just before each alien moves (not for the held target).
**Pattern:** hooks for abilities (ARCHITECTURE.md §2.7). The base class
does nothing; a subclass overrides only the hook it needs.
**Why this way:** a squirrel's leap must move its alien, but `update(delta)`
gets no alien and runs on *real* time. `steer` runs on *field* time, so
FREEZE, SLOW and the hit freeze stop it too. It moves the alien only with
`glideTo`/`hold`, which `Alien.advance` runs under the readability guard.
**Alternatives considered:**
- Pass the alien to `update(dt, alien)` (my first version, and the cave
  branch's). It lost because update runs on real time, so a leap would
  fire during a freeze.
- Setting `alien.x` from the trait. It lost because that skips the
  readability guard: two sets of balls could overlap.
**How to change it later:** a new moving creature is a class in its level's
traits file with a `steer` method; see `Leap` and `Hover` in
`src/objects/treetopsTraits.ts`.
**Verified by:** golden master unchanged (refactor commit).

### 2. Triggers on position, not on a clock
**What changed:** the squirrel leaps when it reaches the next branch line
(`nextBranchY`). The hummingbird darts each time it has come another
`EVERY_PX` across.
**Pattern:** position-triggered behavior: you act when a thing reaches a
place, not after a set time.
**Why this way:** a field that doesn't move never reaches the next branch,
so pausing and freezing need no special code. Same seed, same leaps: replays
stay exact.
**Alternatives considered:** a timer per creature, which would need to know
about freezes and the held target.

### 3. The Great Owl: a subclass of Boss
**What changed:** `OwlBoss` (in `src/objects/owlBoss.ts`) keeps everything
`Boss` does (HP, flying away after an answer, retreating). It adds blinking:
its cover comes from `blinkCover`, and the open phase shrinks with every
answer. The registry line is `blink` in `BOSS_MECHANICS`.
**Alternatives considered:** a flag in `Boss` (`if (def.MECHANIC === "blink")`),
which would make every boss's code harder to read as levels add bosses.

### 4. Balance from bots, `SpeciesDef.SPEED`
Flocks of three darters at full speed knocked out every rookie (0/20). With
birds only, rookies cleared 0/20 at 1.0× speed, 4/20 at 0.7× and 19/20 at
0.55×. The final speeds follow the owner's rule (harder to beat, slower):
birds 0.6×, owls 0.9×. Result over 20 seeds: rookie 10/20, pilot 19/20,
ace 20/20 (level 1: 16/20, 20, 20).
