# Level 9, THE NIGHT SKY (2026-10-19)

Story level 9 built as its own level, like levels 1–6: rules in
`src/config/levels/night.ts`, creature rules in `src/objects/nightTraits.ts`,
the boss in `src/objects/moon.ts`, looks in `src/renderDoodle/levels/night.ts`,
a test in `src/sim/night.test.ts`. Design and bot numbers:
`docs/SOLO_MODES_DESIGN.md` ("Level 9, THE NIGHT SKY").

Subgoals, in the order the change was built:
1. let a march come side by side (`MARCH.ROW`);
2. let an ability hide each ball on its own (`Ability.ballCover`);
3. the creatures as traits (invaders, comets, UFOs, shooting star);
4. the Moon as a Boss subclass, and its light painted under its face;
5. tune with bots.

### 1. Marches side by side
**What changed:** `SpeciesDef.MARCH` got an optional `ROW`. With it,
`Swarm.marchInRow` puts the followers beside the leader at its height
(right, left, two right, two left… whichever slots fit and are clear)
instead of in a line behind it. The checks every follower needs (threat
budget, on-screen cap, a free sum) moved into `followerSpec`, used by both.
**Pattern:** data-driven option (ARCHITECTURE.md §2.6): the level says
*what* it wants (`ROW: true`), Swarm knows *how*.
**Why this way:** a row of invaders is the Space Invaders picture, and the
spawner already knew how to bring a "march" as one event that skips the
unsolved cap; only the placement differs.
**Alternatives considered:**
- Let the invader trait spawn its own row mates — lost: an ability only
  sees its own alien and the `AbilityHost`; spawning creatures of the field
  belongs to Swarm.
- A new "formation" spawner for the night only — lost: it would copy the
  march's caps and checks.
**How to change it later:** row spacing is `2·halfW + READ_GAP +
MARCH_GAP`; the slot order is the array in `marchInRow`.

### 2. `Ability.ballCover(i, n)`: hide balls one by one
**What changed:** a new method on `Ability`, returning `cover` by default.
DoodleWorld draws each ball's cover with it. The Moon overrides it to say
how much of each ball is inside its shadow.
**Pattern:** default implementation (a hook with a default, §2.7): every
ability answers "the same for every ball", only the Moon answers otherwise,
and the caller (DoodleWorld) doesn't care which.
**Why this way:** "its numbers show only on the lit part" needs a cover per
ball; one scalar `cover` can't say "left dark, right lit". Bots still read
the scalar (`Moon` sets it to the average), so the bot code is unchanged.
**Alternatives considered:**
- Draw the shadow on top of the balls from the Moon's look — lost: balls
  are drawn last on purpose ("nothing ever covers a sum"); a look drawing
  over them would break that rule for everyone.
- A cover array on every ability — lost: every ability would have to fill
  it; the default method costs the others nothing.

### 3. The creatures: four traits
**What changed:** `March` (invaders, big invaders) moves only in steps:
each step is a short `glideTo` plus a `hold` until the next beat, so the
rhythm runs in field time and a row that came in together steps together;
the hold gets shorter the lower it is. `Bounce` (comets) uses `pace` to
add a sideways slant and flips at the edges, or when the readability rule
refused its last slant step (it bumped into a creature). `Warp` (UFOs) uses
`steer` (field time): after 1.3 s of patrol its lights spin, then it glides
120 px with `cover = 1`. `Wish` (shooting star) uses `pace` to cross 1.7×
faster and `update` to burn out by how far across it is.
**Why this way:** each one is a plain Ability plugged in by name
(`TRAITS`), with its numbers in the level file, so no shared file changed.
Each uses the hook that fits: scripted moves (glide/hold), pattern scaling
(`pace`), field-time timers (`steer`), real-time looks (`update`).
**Alternatives considered:** reuse the volcano's `Hops` for invaders — lost:
hops repeat one jump; an invader's step changes (down, side, side, down,
back, back) and its beat quickens.

### 4. THE MOON
**What changed:** `Moon extends Boss` and overrides `update` (move a shadow
band across its face on a full → wane → new → wax rhythm, reset to full
after each cloud) and `ballCover` (how much of each ball the band covers,
measured at the balls' row, where the half-ellipse terminator is
narrower). Each answer shortens the full moon and lengthens the dark. The
look paints the halo, the lit face and the shadow in `BossLook.under`, and
the pencil face (craters, sleepy eyes, nightcap) is drawn on top.
**Alternatives considered:** gravity pulling other creatures — lost: an
ability can't see other aliens without a bigger `AbilityHost`; phases that
add balls — lost: the readability box follows the ball count.
**How to change it later:** `MOON_PHASES` in `config/levels/night.ts`.

### 5. Tuning by bots
First try: pilots cleared 12/12 with lives to spare. Faster invader beat,
rows on 60% of invader spawns, comets ×0.9, UFOs ×0.95, Moon ×0.3: rookie
0/20, pilot 8/20, ace 20/20 (20 seeds, 3 fresh lives). Comets cause about
half of the hits; the Moon never reaches the ship in bot runs (it's a
reading fight).

**Verified by:** `npx tsc --noEmit`, `npm test` (131 tests, golden master
unchanged), `npm run build`; the level played in headless Edge with
`?bot=ace` / `rookie` / `pilot` (screenshots of the path and the Moon).
