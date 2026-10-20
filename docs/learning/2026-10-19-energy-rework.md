# 2026-10-19 — Energy rework (playtest notes 2 + 3)

Two notes from the owner's story playtest: the energy bar under the keypad
went unseen, and it filled so fast that the first levels never needed the
power. Subgoals, in the order they were built:

1. Measure the problem with bots (a `--story` option for `npm run bots`).
2. Cut the power's income (owner's pick: every kill evenly, rate 0.4).
3. Carry energy over between story levels (owner's pick).
4. Move the meter to the top HUD.

### 1. Measure first: `npm run bots -- --story 1,7`
**What changed:** the bot report can play story stages and prints three new
columns: when the bar first fills, how much of the run it sits full, and how
much earned energy overflowed.
**Pattern:** tuning by simulation (CONCEPTS.md): change a number, re-run the
bots, compare.
**Why this way:** an ace bot reproduced the playtest (full at ~19 s, full
80–96% of a level), so every later number could be checked the same way.
**Alternatives considered:**
- A separate energy script: one more tool to learn; bot-report already
  plays fields and prints a table.
- Only replaying the owner's runs: exact, but they stop being exact at the
  first power press the new rules would refuse, and there are only 8.
**How to change it later:** columns are built in `rows.push` in
`scripts/bot-report.ts`.
**Verified by:** baseline vs after tables (Decision Log entry has the numbers).

### 2. The power meter gets `ENERGY.POWER_RATE` of a kill
**What changed:** `Field` charges the power meter with
`energyForKill(...) × POWER_RATE` (0.4). The drifter's burst went 40 → 16.
**Pattern:** a tuning knob (one named number in `config/tuning/powers.ts`)
instead of changing the formula.
**Why this way:** a kill's value also feeds the battle attack gauge
(`Field.solve` → `cancelIncoming` → `attack.charge`). Lowering `BASE` would
have made SEND 2.5× slower too and broken its balance; the rate only touches
the power.
**Alternatives considered:**
- Drop the combo bonus (aces sit at the 2× cap): bots showed rookies keep
  long streaks too, so it hurt them just as much. Owner picked the even cut.
- Charge only hard sums: a new formula and new bot rules; bigger change.
- Rate 0.5 / 0.3: owner picked 0.4 after seeing the pilot cost.
**How to change it later:** `ENERGY.POWER_RATE` and
`MONSTERS.drifter.ENERGY_BURST`; re-run `npm run bots -- --story 1,4,8`.
**Verified by:** tests, golden master updated (intended rule change), bots,
`npm run match` (ace win 95 → 85%), the owner's 8 runs replayed.

### 3. Energy carries over
**What changed:** `StoryRun.energy` → `FieldOptions.energy` (start value);
`Field.carriedEnergy()` is handed to the next level (an armed shield goes
back into the bar); saved runs and playtest logs record it.
**Pattern:** the run object carries state between levels, like lives and
score. Old saves without `energy` read as 0 (reading old saved data safely).
**Why this way:** level 8 started with 1 life and an empty bar at d 0.70.
Now a bar saved in an easy level pays off at the next level's start.
**Alternatives considered:**
- Reset to 0 each level (before): the hardest moment had no power.
- A floor (never start below the power's cost): owner picked plain carry-over.
**How to change it later:** `GameScene.nextRun()` decides what crosses levels.
**Verified by:** `story.test.ts` (start value, clamp, shield refund),
`storyProgress.test.ts` (old saves).

### 4. The meter in the top HUD
**What changed:** `METER` in `ui/hud/layout.ts` now sits under the progress
bar; `EnergyHud` puts each piece in the `Ducker`, so it fades under aliens.
The battle dock grew into the freed strip under the keypad.
**Pattern:** the Ducker ("the numbers win over the HUD"): HUD over the field
fades while an alien's box is under it.
**Why this way:** the eyes are on the field; the top HUD is already there.
**Alternatives considered:**
- A second bar beside the ship: always over the play area, and in the way
  of the ship's lane.
- Keep it under the keypad but bigger or flashing: still outside where the
  eyes are.
**How to change it later:** positions in `METER`, pieces in `EnergyHud`'s
constructor.
**Verified by:** checked in the browser at phone size (story + battle) and
desktop with the opponent board.
