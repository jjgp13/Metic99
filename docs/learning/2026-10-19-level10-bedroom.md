# Level 10, THE KID'S BEDROOM: the finale (2026-10-19)

Story level 10 built as its own level, like levels 1–6: rules in
`src/config/levels/bedroom.ts`, the toys' rules and the boss in
`src/objects/bedroom.ts`, looks in `src/renderDoodle/levels/bedroom.ts`, a
test in `src/sim/bedroom.test.ts`. Design and bot numbers:
`docs/SOLO_MODES_DESIGN.md` "Level 10".

Subgoals, in the order the change was built:
1. five toys, each a trait on an existing hook;
2. the boss in two phases;
3. a way for the boss to throw a toy (`AbilityHost.spawnCreature`);
4. the doodles;
5. tune with bots.

### 1. Five toys on the existing hooks
**What changed:** five new Ability classes, one per toy. The soldier and
the teddy change *how fast their kind's own pattern runs* (`pace`: 1 →
slower → 0 for the soldier's spring, 0 for the teddy's nap). The jack and
the ball *script every move themselves* with `glideTo`/`hold` in `update`
(the jack: crank → pop → open → duck; the ball: one glide per bounce). The
plane adds a loop on top of its crossing (`pace` nudges x/y on a circle).
**Pattern:** hooks / template method (ARCHITECTURE.md §2.7): the base
`Ability` calls `update`, `pace`, `onHit`… at fixed moments; a trait fills
in only the step it needs.
**Why this way:** no new movement kinds, no edits to `Alien` or `Swarm`;
each toy is ~30 lines and the readability rule still checks every step.
**Alternatives considered:**
- New `AlienKind`s ("soldier", "ball") — lost: `AlienKind` drives spawning,
  boxes, bots and the 3D view; five new kinds touch all of them, and the
  levels being built in parallel would all conflict there.
- Real-time timers for the jack (like the Blinker) — lost: the box moves
  only when it pops, so its hiding and its moving must share one clock;
  in field time FREEZE holds both (a shut jack under FREEZE isn't coming
  closer either).
**How to change it later:** the numbers are in `config/levels/bedroom.ts`
(`WINDUP`, `JACK`, `BOUNCE`, `NAP`, `LOOP`). Jacks never hit a bot: raise
`JACK.POP_PX` to make them matter.

### 2. The boss in two phases: two BossDefs, chained
**What changed:** `UNDER_THE_BED` (4 answers, eyes peeking, throws toys)
has `PART: MONSTER_OUT` (3 answers, plain "burrow"). `UnderTheBed.onKilled`
spawns the part where the bed was.
**Pattern:** phases as data: a form change is the next definition in a
chain, not an `if (phase)` inside one class.
**Why this way:** the view picks a boss's doodle by its model
(`boss:<model>:up|dig`), so a new form needs a new model anyway; and Field
already clears the level only when no boss is left (the swamp's split).
Both phases share one box, so the monster always fits where the bed was.
**Alternatives considered:**
- One Boss with a `phase` field — lost: the doodle cache keys on the
  model, so the view would need a new "phase" hook (a shared change), and
  HP, speed and banner would all need phase switches.
- Ending phase 1 by changing `alien.model` — lost: `model` is readonly on
  purpose (the box follows it).
**How to change it later:** answers and speed per phase are `HP`/`SPEED`
in each BossDef (owner's rule: more answers, slower).

### 3. `AbilityHost.spawnCreature?`: an optional interface member
**What changed:** `AbilityHost` gained `spawnCreature?(kind, x, y)`;
`Swarm` implements it (roll a sum, build the level's creature, place it
only if its box is clear). The bed calls `host.spawnCreature?.(…)`.
**Pattern:** dependency inversion through a small interface (§2.8),
extended with an *optional* member: old implementers (the swamp test's
fake host) still compile, callers skip it where it is missing.
**Why this way:** the boss needs one new power over the field and nothing
else; the pond chat had wanted the same call for tadpole minions.
**Alternatives considered:**
- A required member — lost: every fake host in other levels' tests (and
  the branches being built now) would break.
- Reuse `spawnSplitling` — lost: it spawns a splitter's child (its model,
  its glide), not one of the level's creatures.
**How to change it later:** to call a 3-ball creature pass `"lumberer"`;
minion pacing (caps) lives in `Swarm.spawnCreature`.

### 4–5. Doodles and tuning
Each toy draws one cached doodle per state (`variant`), e.g. the jack
shut/shaking/out, the ball's bounce height (its shadow drops away). Bots:
soldiers at full speed in lines of 3 gave pilots 0/12 and aces 7/12; after
soldiers ×0.6 (lines on 25%), teddies ×0.8, 44 px bounces: ace 20/20 (2.5
lives left), pilot 1/20 (67% of the path), rookie 0/20.
**Verified by:** `npx tsc --noEmit`, `npm test` (133 passed, golden master
unchanged), `npm run build`; played in the browser with `?bot=ace` to the
"to be continued…" card.
