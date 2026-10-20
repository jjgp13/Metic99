# Story mode music: chiptune prompts

Prompts for a text-to-music model, one track per level plus a boss track.
Paste the **shared style** first, then the level's prompt. Each level is a
kid's imagined world doodled in a notebook (docs/SOLO_MODES_DESIGN.md §3),
so the music is playful 8-bit, never dark or epic.

**Files:** the game plays `public/assets/music/level01-path.mp3`,
`level01-boss.mp3`, … `level10-boss.mp3` (96 kbps MP3, loaded per level by
`scenes/levelMusic.ts`). The menu, map and jingle files are listed in their
own section below.

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

1. **The Backyard** (dirt): bouncy and curious, 120 BPM, C major. A
   hopping square-wave melody like a beetle scuttling, plucky staccato
   bass, light shaker on the noise channel. Sunny afternoon, a little
   mischievous.
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

## Menu, map and jingles

Same shared style, except where a prompt says it is not a loop.

**Files:** `menu.mp3` (the loop), `level-clear.mp3` and `ending.mp3`
(jingles), in `public/assets/music/`, exported at 96 kbps like the rest.
`menu.mp3` and `level-clear.mp3` are wired up (`scenes/extraMusic.ts`),
and `ending.mp3` too (`scenes/EndingScene.ts`, played once): drop the
files in and they play. Until then the menu and the ending are silent and
the clear plays a blip fanfare.

### Menu and story map (a loop)

> The game's main theme, played on the title screen and the story map:
> warm, hopeful and a little dreamy, 108 BPM, G major. A simple
> whistleable square-wave melody that sounds like a kid humming while
> doodling, answered by a softer second voice; a bouncy triangle bass and
> a light noise-channel brush beat. It should feel like opening a notebook
> full of adventures: inviting, not busy. Hint at the bedroom finale's
> toy-box march so the game starts and ends on the same idea. Seamless
> loop, about 60–90 seconds.

### Level clear (a jingle, not a loop)

> A short victory fanfare, about 6–8 seconds, then silence (no loop, a
> clean final note). 140 BPM, C major: a quick rising square-wave run,
> three bright triumphant chords, a little trill on top and a final held
> chord with a noise-channel cymbal hit. It plays while the ship
> accelerates off the top of the screen and the level's score counts
> up: joyful, proud, a bit cheeky, like "did it!".

### Ending (a jingle, not a loop)

> A gentle "thank you for playing" piece, about 30–40 seconds, then a soft
> final chord (no loop). 92 BPM, F major. The main theme's melody played
> slowly and tenderly on a single square-wave voice with a light triangle
> bass, then joined by the second voice for the last phrase. It plays over
> a drawing of a kid coloring the game's monsters with crayons: cozy,
> grateful, a little nostalgic, like the end of a long happy day.
