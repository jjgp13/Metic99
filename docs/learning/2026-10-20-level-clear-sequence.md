# Level clear sequence (2026-10-20)

The owner's ask: "Small animation of the ship accelerating going out of the
screen, winner music, with result, then the map again showing going into
the other stage." Owner's picks: one beat after another, and the results
show kills, best combo, the level's time and a NEW BEST stamp.

Subgoals: **1. the ship launch** (a reusable component + a pure pose curve),
**2. the views draw it**, **3. optional music**, **4. the results card**,
**5. the sequence in `clearLevel`**.

### 1. The ship launch is a look, timed by the scene
**What changed:** `scenes/shipLaunch.ts` has `ShipLaunch` (start it, it calls
you back when the ship is gone) and `shipLaunchPose(ms)`, a pure function:
squash for 300 ms, then a climb that speeds up until the ship is above the
top edge.
**Pattern:** Model–View separation (ARCHITECTURE.md §2.1): the rules (Field)
never hear about it; GameScene puts the pose in the snapshot
(`WorldSnapshot.shipLaunch`), like `shipDown` for the crash.
**Why this way:** by the time the ship leaves, the rules have ended
(`Field.cleared`, GameScene stops stepping). The owner's first pick was the
Field; it lost because bots, replays, the golden master and the future
server would all carry an animation no one sees, and the sim would have to
keep stepping after the level is over.
**Alternatives considered:**
- In `Field` (a "launching" state, `shipY` in the sim) — see above.
- A Phaser tween of a ship image over the field — the ship is drawn by the
  field view (pencil doodle or 3D model), so a Phaser copy wouldn't match
  either art, and the real ship would have to be hidden.
**How to change it later:** timing and feel are numbers in `LEVEL_CLEAR`
(`config/tuning/story.ts`): `SQUASH`, `FLY_MS`, `FLY_EASE` (higher = slower
start, bigger whoosh). The story ending can reuse `ShipLaunch` as is.
**Verified by:** `scenes/shipLaunch.test.ts` (squashes first, climbs faster
and faster, above the top when it reports "gone").

### 2. Each view draws the pose its own way
**What changed:** `DoodleWorld.drawLaunch` squashes the doodle from its
bottom edge (pressed into the ground, not shrunk), then stretches it, with a
flame and pencil speed lines that never reach below the take-off point, and
writes "zoom!"/"whoosh!". `World3D` just moves and scales the model.
**Pattern:** the `FieldView` seam (§2.8): one snapshot, two views.
**Alternatives considered:** drawing speed lines with Rough.js — pretty but
milliseconds per shape every frame; plain canvas lines re-jittered each frame
give the same scribble for almost nothing.
**How to change it later:** `DOODLE.SPEED_LINES` (offsets, lengths, widths),
`LAUNCH_FLAME_PX`, `LAUNCH_WORDS` in `config/tuning/doodle.ts`.

### 3. Music that may not exist yet
**What changed:** `scenes/extraMusic.ts`: `loadOptionalMusic` loads a file
and reports null when it's missing (remembered for the visit). The menu theme
plays on the menu and the map and keeps going between them; a run fades it
out. The level-clear jingle is loaded with the level's tracks and falls back
to a C–E–G–C blip arpeggio (the playback *rate* is the pitch: 1.5 = a fifth up).
**Pattern:** optional asset with a fallback (new, ARCHITECTURE.md §2.19).
**Alternatives considered:**
- Load at boot — every visitor would wait for music before the menu.
- Check with a `fetch` HEAD request first — avoids the console error but
  adds a second request and code for a problem that disappears once the
  files exist.
**How to change it later:** drop `menu.mp3` / `level-clear.mp3` into
`public/assets/music/`; volumes and the fallback notes are in `MUSIC`.

### 4. The results card counts up
**What changed:** `LevelClearCard` counts the level score from 0 (with the
total rising alongside), ticks a blip that rises in pitch, then shows the
NEW BEST stamp and the hint. A tap mid-count jumps to the end
(`finishCount`), the next one leaves.
**Why:** a number that counts up is felt; a number that's just there is read.
Easing out (`Cubic.easeOut`) makes the last points tick in slowly.
**Alternatives considered:** monospace + spaces for the stats table (the old
card) — the handwriting font isn't monospace, so columns drifted; now labels
are left-aligned and values right-aligned in two text columns.

### 5. The sequence
`GameScene.clearLevel` records the result at once (so leaving early loses
nothing), then: pops the leftover minions one by one (`popped`, filtered out
of the snapshot), starts the launch at 0.5 s with the jingle, and shows the
card 0.4 s after the ship is gone. `leaveAllowedAt = Infinity` keeps taps
from skipping the launch. One line in `leaveGameOver` lets the first tap
finish the count.
**Verified by:** tsc, `npm test` (golden master unchanged: no rule changed),
`npm run build`, the dev game at phone (375×812) and desktop size (each
beat screenshotted, then tap → map → ship flies to island 2), the 3D view,
and the built game (`vite preview`) starting and playing a level. Not heard:
the sounds (no audio in the test browser).
