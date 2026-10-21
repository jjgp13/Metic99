# 2026-10-19 — Power balance after the energy cut

The energy rework made the power meter scarce (`ENERGY.POWER_RATE` 0.4).
That hit FREEZE and BLAST much harder than SLOW, whose drain was already
cheap. Goal: ace bots (≈ the owner) survive within ~±10% with any of the
four powers. Subgoals, in the order they were done:

1. Measure the gap (baseline tables).
2. Sweep one knob per power to see how each number moves survival.
3. Build three complete sets and test each everywhere; the owner picks.
4. Apply the pick; fix the tests that pinned the old numbers.

### 1. Baseline
Ace bots, Endless, 3 lives, 12 seeds (`npm run bots -- --seeds 12`):
FREEZE 160 s, SLOW 190, BLAST 144, SHIELD 150, **no power 120**. So SLOW
added ~70 s over no power and BLAST only ~24 s. In an 8-ace mirror battle
(`npm run match -- --powers freeze,slow,blast,shield --seats ace,…`), SLOW
won 28% of seats (fair share 12.5%) and BLAST 4%. Aces clear story stages
1, 4 and 8 with any power, so the story can't tell the powers apart for an
ace; pilots in the story were used as a second check.

### 2. One knob at a time (24 seeds, ace, Endless, median survival)
| FREEZE PER_SEC | 25 | 22 | 20 | 18 | 17 | 16 | 15 | 14 | 12 |
|---|---|---|---|---|---|---|---|---|---|
| survived (s) | 153 | 156 | 151 | 171 | 166 | 181 | 183 | 197 | 217 |

| BLAST COST | 60 | 55 | 50 | 45 | 44 | 43 | 42 | 40 | 38 | 35 |
|---|---|---|---|---|---|---|---|---|---|---|
| survived (s) | 148 | 149 | 158 | 159 | 169 | 172 | 181 | 180 | 191 | 198 |

| SHIELD COST | 50 | 45 | 40 | 38 | 36 | 35 | 34 | 33 | 32 | 30 | 25 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| survived (s) | 150 | 151 | 145 | 150 | 170 | 175 | 176 | 175 | 183 | 201 | 213 |

| SLOW PER_SEC | 6 | 7 | 8 | 9 | 10 | 12 |
|---|---|---|---|---|---|---|
| survived (s) | 184 | 173 | 161 | 155 | 155 | 155 |

A cost only starts to matter once it drops below a certain point (BLAST
around 50, SHIELD around 38). Above that, a different cost gives about the
same result.

### 3. Three sets, tested everywhere (12 seeds; owner picked **C**)
- **A**: SLOW 9/s only (weaken the strong one).
- **B**: SLOW 7/s, FREEZE 18/s, BLAST 44, SHIELD 36 (meet in the middle).
- **C**: FREEZE 15/s, BLAST 40, SHIELD 33, SLOW unchanged (strengthen
  the weak three).

Endless, survived (median s), FREEZE / SLOW / BLAST / SHIELD:
| set | ace | pilot | rookie | ace, flawless ("sharp") |
|---|---|---|---|---|
| before | 160 / 190 / 144 / 150 | 144 / 158 / 127 / 140 | 125 / 113 / 122 / 128 | 156 / 204 / 180 / 150 |
| A | 160 / 158 / 144 / 150 | 144 / 139 / 127 / 140 | 125 / 112 / 122 / 128 | 156 / 173 / 180 / 150 |
| B | 171 / 180 / 173 / 177 | 148 / 151 / 156 / 161 | 125 / 112 / 133 / 147 | 174 / 201 / 231 / 177 |
| **C (after)** | **185 / 190 / 197 / 171** | 150 / 158 / 153 / 165 | 126 / 113 / 136 / 135 | 208 / 204 / 230 / 171 |
No power: ace 120, pilot 113, rookie 93. The bar sits full 16–21% of the time
in every set, so energy stays scarce.

Story, pilots, stages cleared out of 12 (stage 1: 12/12 for all; aces
clear all three stages with any power):
| set | stage 4 | stage 8 |
|---|---|---|
| before | 1 / 7 / 5 / 8 | 2 / 3 / 2 / 6 |
| A | 1 / 6 / 5 / 8 | 2 / 0 / 2 / 6 |
| B | 4 / 4 / 10 / 11 | 0 / 1 / 5 / 8 |
| **C** | 6 / 7 / 8 / 11 | 1 / 3 / 6 / 9 |

Battles, 80 matches, powers rotated, wins per seat:
| set | 8-ace mirror (fair 12.5%) | mixed lineup, ace seats |
|---|---|---|
| before | 7 / 28 / 4 / 12 | 45 / 50 / 30 / 50 |
| A | 9 / 19 / 4 / 18 | 38 / 50 / 35 / 53 |
| B | 8 / 18 / 8 / 16 | 35 / 33 / 48 / 45 |
| **C** | 9 / 14 / 15 / 12 | 48 / 35 / 40 / 35 |

**Why C:** C is the most even in battle, it is within ±7% in Endless, and
every power ends up stronger (they each add 50–77 s over no power instead
of 24–70 s). B was more even in Endless (±3%) but left BLAST weak in battle.
A changed only one number, but it made the game harder for SLOW players and
left BLAST useless in battle.

### 4. Apply, and a test that read the state too early
The numbers went into `POWERS` (`config/tuning/powers.ts`). The golden
master was updated (an intended rule change). Two tests had pinned the old
numbers:
- `story.test.ts` expected 20 energy left after arming a shield from 70
  (70 − 50). It now computes `70 − field.power.cost`.
- `Field.test.ts`, "kills made while a time power runs charge no energy",
  failed: a kill charged 9.8 energy while FREEZE looked on. FREEZE runs dry
  at the **start** of a step (`Power.update`), and a kill later in the same
  step correctly charges, because the power is already off. The test read
  "on" *before* the step. FREEZE now drains slower, so a run happened to hit
  that edge. The rule was right; the test now reads the state after the
  step, which is what the power was during the kill.

**How to change it later:** retune one power at a time with
`npm run bots -- --level ace --seeds 12 --power <name>` and the mirror
match. Each number moves only its own power's row.
