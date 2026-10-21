# Concepts learned while building Metic99

The catalog of ideas the owner has met in feature work. **Feature chats add
rows here** (the `learning-loop` skill, step 7) and never edit review
dates. The quiz chat reads this file to know what's new, and keeps the
review schedule in its own file, [`REVIEWS.md`](REVIEWS.md).

Why two files: each file has **one writer**, so feature branches and the
quiz chat never edit the same lines and never conflict when merged.

## Catalog

One row per concept. Add new rows at the bottom.

| Concept | In one line | Where in Metic99 | Topic | Added | From (change / note) |
| --- | --- | --- | --- | --- | --- |
| Refactor | Change the structure without changing the behavior | the 2026-10-08 commits | engineering | 2026-10-08 | readability refactor |
| Golden master | Snapshot today's results so a refactor can prove nothing changed | `src/sim/golden.test.ts` | testing | 2026-10-08 | readability refactor |
| Deterministic simulation | Same seed + same inputs = same run | `sim/rng.ts`, `Field.inputLog` | game dev | 2026-10-08 | readability refactor |
| Composition root | One place builds and connects the parts; parts don't build each other | `scenes/GameScene.ts` | design | 2026-10-08 | readability refactor |
| Single responsibility | One job per class/file | `ui/hud/*` | design | 2026-10-08 | readability refactor |
| Fixed timestep | Rules advance in equal steps; the view draws in between | `sim/SimClock.ts` | game dev | 2026-10-08 | readability refactor |
| Functional core, imperative shell | Pure logic inside, storage/IO in a thin outer layer | `services/masteryStats.ts` | design | 2026-10-08 | readability refactor |
| Options object | Many parameters → one object with named fields | `Swarm.makeAlien(rng, spec)` | code style | 2026-10-08 | readability refactor |
| Barrel module | A file that only re-exports others | `config/constants.ts` | code style | 2026-10-08 | readability refactor |
| Design tokens | Named colors/sizes used instead of raw values | `config/palette.ts` | code style | 2026-10-08 | readability refactor |
| Single writer | Each piece of shared state has exactly one owner that changes it | `CONCEPTS.md` vs `REVIEWS.md`; `Field.apply` is the only way to change a field | design | 2026-10-08 | quiz setup |
| Interface with two implementations | Callers depend on what a part can do, so another part can stand in for it | `FieldView` (`scenes/fieldView.ts`): World3D or DoodleWorld | design | 2026-10-18 | doodle art prototype |
| Pre-rendering (cache) | Draw an expensive picture once, then copy it every frame | `drawFrames` (`renderDoodle/pencil.ts`), the boil frames | game dev | 2026-10-18 | doodle art prototype |
| Edge detection (state change) | Notice the moment something happens by comparing a value with last frame's, so the view needs no new event | `DoodleWorld.drawShip`: `shipHurt` jumps up = a hit | game dev | 2026-10-18 | ship doodles + hit animation |
| Position-triggered behavior | Trigger an action when a thing reaches a place, not after a time, so pausing the world pauses it too | `Leap.steer` (`objects/treetopsTraits.ts`): a squirrel leaps at each branch line | game dev | 2026-10-18 | level 3 treetops |
| Template method (protected hook) | The base class runs the steps and calls a small `protected` method a subclass may override; the subclass changes one step only | `Boss.surfaceAt`, overridden by `MudHalf` (`objects/swamp.ts`) | design | 2026-10-18 | level 4, the mud swamp |
| Goal as a question, not a flag | "Is any boss left?" instead of "the boss died", so a boss that splits needs no special case | `Field.onBulletHit` (`bossLeft`) | design | 2026-10-18 | level 4, the mud swamp |
| Hook with a default (template method) | The base class calls a method that does nothing special by default; a subclass overrides just that step | `Ability.pace(alien, delta)` returns `delta`; the cave's `Roost` / `CaveTroll` override it | design | 2026-10-18 | level 5, the dark cave |
| One class, many configs | A general class takes its numbers as data, so two creatures share one rule | `Hops` with `DRIP` and `SPARK` (`objects/volcanoTraits.ts`) | design | 2026-10-18 | level 6 volcano |
| Subclass that extends a hook (super) | Override a method, add your part, and call the parent's version for the rest | `Dragon.update/onHit` → `Boss` (`objects/dragon.ts`) | design | 2026-10-18 | level 6 volcano |
| Strategy pattern | One interface, several interchangeable classes; the caller asks the interface and never checks which one it has | `SpawnDirector` (`sim/director.ts`): `EndlessDirector` or `LevelDirector`, asked by `Swarm` | design | 2026-10-18 | story slice L2 |
| Content as data | New levels are table entries, not new code, so tuning one never touches the rules | `LEVELS` in `config/tuning/story.ts` | design | 2026-10-18 | story slice L3 |
| Registry | A table from a name to the code that makes it, so new kinds are added with one line instead of a new `if` | `TRAITS` (`objects/traits.ts`), `BOSS_MECHANICS` (`objects/bosses.ts`), `LEVELS`, `PAGES` | design | 2026-10-18 | creatures with personality |
| Presentation delay | Let an animation play before the next screen, without slowing the rules | `RECOVERY.GAME_OVER_DELAY_MS` + `time.delayedCall` in `GameScene` | game dev | 2026-10-18 | ship doodles + hit animation |
| Functional core, imperative shell | Decide in pure functions (easy to test), and keep reading/writing storage in a thin outer layer | `mergeLevel` / `recordLevel` in `services/storyProgress.ts` (like `masteryStats.ts`) | design | 2026-10-18 | story map (L5) |
| Don't trust stored data | Data read back from storage (or the network) is checked and cleaned before use, so a bad value can't break the screen | `parseProgress` in `services/storyProgress.ts` | engineering | 2026-10-18 | story map (L5) |
| Backward-compatible migration | Change the database so the old client still works (new column with a default, new parameters with defaults), then deploy the new client | `supabase/story-boards.sql` (`level` default 0, `p_level default 0`) | backend | 2026-10-18 | story map (L5) |
| Optional interface method | Add a method to an interface as optional (`addBall?(…)`, called with `?.`) so every existing implementation and stand-in still compiles | `AbilityHost.addBall` / `spawnMinion` (`objects/abilities.ts`) | design | 2026-10-19 | level 8, snowy mountain |
| Invariant fixed at construction | A value computed once in the constructor (the readability box) can't follow later changes, so plan for the biggest case up front | `SpeciesDef.BOX` for the snowball that grows from 2 to 3 balls | design | 2026-10-19 | level 8, snowy mountain |
| Default implementation | A base class method returns the usual answer, so only the one subclass that needs another answer overrides it, and every caller stays the same | `Ability.ballCover(i, n)` returns `cover`; only `Moon` lights its balls one by one | design | 2026-10-19 | level 9, the night sky |

## In the code, not studied yet

Patterns from `docs/ARCHITECTURE.md` the code already uses but that haven't
been walked through with the owner: model–view separation (§2.1), command
pattern (§2.2), event queue (§2.5), data-driven strategies (§2.6), hooks for
abilities (§2.7), small interfaces (§2.8), reconciliation (§2.10). Good
material for "your turn" tasks and quiz transfer questions.
| Template method (hook) | A base class calls an empty method at a fixed moment; a subclass fills it in to change one step | `Ability.steer` (called by `Swarm.step`), filled by `Dart`, `Dive`, `Hop`, `BigFrog` | design | 2026-10-18 | level 2, the pond |
| Real time vs game (field) time | Timers that must stop with FREEZE/SLOW run on the field's clock, not the wall clock | `steer(alien, fieldDelta)` vs `update(delta)` in `objects/abilities.ts` | game dev | 2026-10-18 | level 2, the pond |
| Tuning by simulation | Pick numbers by running bots many times and measuring, not by guessing | 20-seed bot runs per level (like `src/sim/pond.test.ts`): pond d range 0.2→0.35 = rookies 0/20, 0.1→0.28 = 11/20 | game dev | 2026-10-18 | level 2, the pond |
| Cleanup on shutdown (owned resources) | Whatever an object starts (sounds, timers, tweens) it must also stop when its owner goes away, including things still "on their way out" | `MusicPlayer.fadeOutCurrent` (`scenes/music.ts`): a song fading out is destroyed when its scene shuts down | game dev | 2026-10-19 | music fade fix |
| Event-driven vs timer-driven rule | A rule tied to a timer can starve when the timer stops; tie it to an event (the player's answer) as well | `StormCloud.onHit` thunders on each answer: the held cloud runs no timer (`objects/stormCloud.ts`) | game dev | 2026-10-19 | level 7, the windy sky |
| Optional interface member | Add a method with `?` so every old implementer still compiles; callers use `?.()` and skip it where it is missing | `AbilityHost.spawnCreature?` in `objects/abilities.ts`, called as `host.spawnCreature?.(…)` in `objects/bedroom.ts` | design | 2026-10-19 | level 10, the bedroom |
| Phases as data | A thing that changes form in a fight is two definitions chained together (`PART`), not one object with an `if (phase)` inside | `UNDER_THE_BED.PART = MONSTER_OUT` in `config/levels/bedroom.ts` | design | 2026-10-19 | level 10, the bedroom |
| Pacing curve as data (rest / spike / burst) | Tension that rises and falls (rests between pushes) feels better than a straight ramp; describe the shape as a list of stretches the code reads | `OWNER_WAVE` in `config/tuning/story.ts`, read by `waveAt` in `sim/waves.ts` | game dev | 2026-10-19 | story waves + 2-min levels |
| Clamping one clock to another | `max(fieldTime, 0.8 × realTime)`: follow the fair clock, but never fall too far behind the real one | `LevelDirector.progress` in `sim/director.ts` | game dev | 2026-10-19 | story waves + 2-min levels |
| Shape × scale (separating a pattern from its size) | One shared shape (the wave profile: when to push, how high relative to the top) times a per-level scale (how many sums the top and the base are), so levels feel alike in rhythm but grow in size; tune the shape once, tune each level with two numbers | `OWNER_WAVE` (shape) × `WAVES.BASE`/`PEAK` per level, combined in `LevelDirector.difficulty` (`sim/director.ts`) | design | 2026-10-20 | escalating story waves |
| Attributing an effect to its cause, not its moment | A hit lands seconds after the monster came in, so "hits during rests" blamed the rests; counting where each hitter *came in* shows the pushes cause them | "hitters came in" in `scripts/story-report.ts` | testing | 2026-10-20 | escalating story waves |
| Singleton (one shared instance) | One object for the whole page that every part asks for, when a thing must outlive any one owner; it hides who depends on it, so use it rarely | `music` (`scenes/music.ts`), `getWorld3D()` | design | 2026-10-20 | new soundtrack |
| Idempotent request | Asking for what is already happening changes nothing, so callers can ask freely | `music.play(scene, file)`: the song already playing goes on instead of restarting | design | 2026-10-20 | new soundtrack |
| Hidden carried-over state | A framework call can keep values from last time unless you pass them explicitly | Phaser `scene.start(key)` reuses the last data: ENDLESS replayed a battle until `startEndless()` passed `{}` | debugging | 2026-10-20 | new soundtrack |
