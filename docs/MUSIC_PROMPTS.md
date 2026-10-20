# Story mode music: chiptune prompts

Prompts for a text-to-music model, one track per level plus a boss track.
Paste the **shared style** first, then the level's prompt. Each level is a
kid's imagined world doodled in a notebook (docs/SOLO_MODES_DESIGN.md §3),
so the music is playful 8-bit, never dark or epic.

**Files:** export each as `.ogg` (or `.mp3`) and name it
`level01-path.ogg`, `level01-boss.ogg`, … `level10-boss.ogg`. Put them in
`public/assets/music/` and the game can play them per level (not wired up
yet: tell Claude when the first files exist).

## Shared style (paste before every prompt)

> Instrumental chiptune in the style of an 8-bit handheld/NES game:
> two square-wave lead and harmony voices, a triangle-wave bass, and a
> noise-channel drum kit. Bright, catchy, playful, like a kid's notebook
> doodles come to life. No vocals, no realistic instruments, no reverb wash.
> It plays under a fast math game, so the melody must stay light and leave
> room for sound effects: no harsh high squeals, keep the mid-range clear.
> Make it a **seamless loop**: about 90–120 seconds, the last bar flows
> straight back into the first, with no intro fade and no ending.

## Level tracks (the path)

1. **The Backyard** (dirt): see "Level 1, timed to the waves" below
   (its song follows the level's waves bar by bar).
2. **The Pond** (water): gentle and bubbly, 112 BPM, F major. Rippling
   arpeggios that rise and fall like water, a lazy swinging bass, soft
   "plop" noise hits. Frogs croaking on the off-beat.
3. **The Treetops** (trees): airy and adventurous, 126 BPM, G major.
   Climbing scales, quick ornaments like birdsong, the bass jumps like
   squirrels between branches. Wind in the leaves on the noise channel.
4. **The Mud Swamp** (mud): squelchy and goofy, 104 BPM, D minor but
   funny, not scary. Wobbling pitch bends, a heavy stomping bass, sloppy
   "splat" snares. Blobs that keep splitting in two.
5. **The Dark Cave**: mysterious but cozy, 100 BPM, A minor. Echoing
   single notes like drips, a pulsing bass like a flashlight beam, sparse
   noise ticks. Glowworms twinkling, a sense of exploring.
6. **The Volcano** (fire): energetic and hot, 138 BPM, E minor. Driving
   eighth-note bass, fast fiery lead runs, rumbling noise-channel toms.
   Lava bubbling, exciting rather than menacing.
7. **The Windy Sky** (air): soaring and free, 132 BPM, D major. Long
   gliding lead notes with vibrato like kites, quick swirling arpeggios,
   whooshing noise sweeps. Birds and paper planes.
8. **The Snowy Mountain**: crisp and bright, 118 BPM, B-flat major. Icy
   high bell-like square tones, a steady marching bass, crunchy
   footstep snares. Penguins sliding, snowballs rolling.
9. **The Night Sky** (stars): dreamy space adventure, 124 BPM, E-flat
   major. Twinkling arpeggios, a warm pulsing bass, a hint of classic
   arcade space shooter. Comets streaking by; a nod to old alien
   invaders games.
10. **The Kid's Bedroom** (the finale): toy-box march, 140 BPM, C major
    with surprising key changes. Callbacks to earlier levels' melodies,
    wind-up toy rhythms, triumphant but still silly. Everything the kid
    imagined comes together.

## Level 1, timed to the waves

Level 1's path is 88 s of escalating waves (`OWNER_WAVE` ×
`BACKYARD.WAVES` in the code): three pushes, each bigger than the one
before, with a rest back to one sum at a time after each. At 120 BPM a bar
is 2 s, so the path is exactly 44 bars, and each stretch is a whole
number of 4-bar phrases:

| Bars | Seconds | Stretch | Intensity | On screen (base 1, peak 2) | Chords |
| --- | --- | --- | --- | --- | --- |
| 1–4 | 0–8 | rest (warm-up) | 0 | 1 sum, slow spawns | C – Am – F – G |
| 5–8 | 8–16 | wave 1: spike | 0.35 | 1 sum, quicker spawns | C – F – G – C |
| 9–12 | 16–24 | rest | 0 | 1 sum, slow | C – Am – F – G |
| 13–20 | 24–40 | wave 2: spike | 0.7 | 2 sums, fast spawns | Am – F – C – G ×2, bar 20 = D7 (lift) |
| 21–24 | 40–48 | rest | 0 | 1 sum, slow | C – Am – F – G |
| 25–32 | 48–64 | wave 3: ramp | 0 → 1.0 | 1 → 2 sums (2 from ~56 s), spawns speed up | C – F – G – C, then Am – F – C – G with D7 on bar 32 |
| 33–40 | 64–80 | wave 3: burst (the peak) | 1.0 | 2 sums, fastest spawns | C – B♭ – F – G ×2 |
| 41–44 | 80–88 | rest (a breath before the boss) | 0 | 1 sum, slow | C – Am – F – G |

Then the boss comes in once the field is clear and the game crossfades to
`level01-boss`. **Honest limits:** the path runs on field time, so SLOW
(and the 3 s freeze after a hit) stretches it by up to 25% (path ≤ 110 s
of real time), and the music starts a moment after the level does (the
track loads then). The song drifts a few bars late in a long run; the
calm opening that the loop returns to covers it.

**Prompt** (after the shared style; it replaces "about 90–120 seconds"
with exactly 88 s):

> **The Backyard** (dirt): bouncy and curious, 120 BPM, C major, exactly
> 44 bars (88 seconds) in 4/4, looping seamlessly from bar 44 back to bar
> 1. A hopping square-wave melody like a beetle scuttling, plucky staccato
> triangle bass, a light shaker on the noise channel. Sunny afternoon, a
> little mischievous. The energy rises and falls in three waves, each
> bigger than the one before, and always settles back to the same calm
> groove between them:
> - Bars 1–4, calm: C – Am – F – G. Sparse melody, bass on the beat, shaker
>   only.
> - Bars 5–8, wave 1 (small): C – F – G – C. Add a second square voice in
>   thirds and a light kick on 1 and 3.
> - Bars 9–12, calm again: C – Am – F – G, back to the bars 1–4 groove.
> - Bars 13–20, wave 2 (bigger, twice as long): Am – F – C – G twice, with
>   bar 20 on D7 as a lift. Eighth-note bass, snare on 2 and 4, the melody
>   climbs higher.
> - Bars 21–24, calm again: C – Am – F – G, the same calm groove.
> - Bars 25–32, wave 3 builds: C – F – G – C, then Am – F – C – G with bar
>   32 on D7. Start from the calm groove and add a layer every two bars
>   (harmony voice, eighth-note bass, snare, then a rising arpeggio).
> - Bars 33–40, the peak: C – B♭ – F – G twice. Full drums with
>   noise-channel fills, fast arpeggios, the melody at its highest and
>   busiest: the most exciting part of the song.
> - Bars 41–44, calm: C – Am – F – G, drop straight back to the calm groove
>   of bars 1–4 (a breath before the boss), ending so it flows into bar 1.

## Boss tracks

Same shared style; the level's own melody turned into a boss fight:

> A boss-battle version of the level's theme: faster (+20 BPM), the same
> key moved to its minor (or a half step up), an urgent repeating bass
> ostinato, a punchier noise-channel beat, and a short 4-bar phrase that
> repeats so it loops well. Tense but still fun and cartoonish, like a
> kid's drawing of a monster.

Then add one line for the boss:

1. **Giant Mole:** digging rhythm on the bass, a "thump" each beat like
   shoveling dirt.
2. **Big Frog:** big croaking low notes and springy jumps.
3. **Owl:** a hooting two-note motif that blinks on and off.
4. **Mud Monster:** sloppy, splitting into two voices that chase each other.
5. **Cave Troll:** heavy slow stomps that speed up.
6. **Dragon:** fast fiery runs and a roaring noise sweep.
7. **Storm Cloud:** thunder crashes on the noise channel, rain arpeggios.
8. **Yeti:** a big clumsy waltz-like stomp.
9. **The Moon:** a spooky-silly theremin-like square-wave wobble.
10. **Under-the-Bed Monster:** a creeping bass line that bursts into the
    loudest, happiest chase of the game.
