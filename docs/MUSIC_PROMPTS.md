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
