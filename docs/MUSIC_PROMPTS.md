# Story mode music: chiptune prompts

Prompts for a text-to-music model: a path and a boss track per level,
plus the menu, the story map, the story ending and Endless (last section).
Each level is a kid's imagined world doodled in a notebook
(docs/SOLO_MODES_DESIGN.md §3), so the music is playful 8-bit, never dark
or epic.

**To make a level's path track, paste three things in order:** the shared
style, the shared form, then the level's block. If the tool has a short
style box and a separate box for structure or lyrics, put the style plus
the level's first line in the style box, and the form plus the chord chart
in the other.

**Files:** export as `.mp3` (mono is fine), named `level01-path.mp3`,
`level01-boss.mp3`, … `level10-boss.mp3`, into `public/assets/music/`. The
game already plays them (`scenes/levelMusic.ts`): the path track loops
from the start of the level, then crossfades to the boss track when the
boss comes in.

## Why the songs follow the waves

Every level's path comes in the same escalating waves (AGENTS.md → Story
mode; `npm run waves` prints each level's timeline): rest, a small push,
rest, a bigger push, rest, a climb, the full burst, a last rest before the
boss. The shape is 44 equal units long. Each song below is **44 bars**,
one bar per unit, with its tempo set so the 44 bars last exactly as long
as the level's path (BPM = 10 560 ÷ path seconds). So each musical section
plays while its wave does, and the chords climb with the difficulty:

| Bars | Wave (intensity) | Music |
| --- | --- | --- |
| 1–4 | rest (0) | **Calm:** the theme, simple and sparse |
| 5–8 | small push (0.35) | **Wave 1:** a little drum and harmony |
| 9–12 | rest (0) | **Breath:** drums out |
| 13–20 | bigger push (0.7) | **Wave 2:** full beat, a chord that lifts |
| 21–24 | rest (0) | **Breath:** drums out again |
| 25–32 | climb (0 → 1) | **Climb:** layers added bar by bar, rising bass |
| 33–40 | burst (1) | **Peak:** key change up, everything playing |
| 41–44 | rest (0) | **Settle:** home key, sparse, leads back to bar 1 |

**Chords follow intensity too.** Rests sit on the home chords. Each push
moves further from home (Wave 2 borrows a secondary dominant, II7 or V7).
The Climb walks the bass up a step at a time, with two chords per bar at
the end, and lands on the dominant of the Peak's key. The Peak modulates up a whole step in major keys, or to the
relative major in minor keys, so it sounds brighter, not scarier. The
Settle comes back home and ends on the dominant, so bar 44 pulls straight
into bar 1.

**It won't stay in sync exactly.** The waves run on the level's path
clock: the freeze after a hit and SLOW/FREEZE stretch it (up to 1.25× in
real time), and the song starts a moment late while it loads. Bars 41–44
and 1–4 are both calm, so when the song loops before the boss arrives it
lands in the right mood. (The boss comes 0–20 s after the path ends, by
`npm run bots:story`.)

## Shared style (paste first)

> Instrumental chiptune in the style of an 8-bit handheld/NES game:
> two square-wave lead and harmony voices, a triangle-wave bass, and a
> noise-channel drum kit. Bright, catchy, playful, like a kid's notebook
> doodles come to life. No vocals, no realistic instruments, no reverb wash.
> It plays under a fast math game, so the melody must stay light and leave
> room for sound effects: no harsh high squeals, keep the mid-range clear.
> One short hook (2 bars) is the theme of the whole track: it comes back in
> every section, changed by the section's energy, so the track never feels
> like a short loop repeating.

## Shared form (paste second)

> Exactly 44 bars of 4/4 at the given tempo, through-composed, no intro
> silence, no fade-in or fade-out; bar 44 flows straight back into bar 1
> so the track can loop. Energy rises and falls in eight sections:
>
> 1. Bars 1–4, **Calm:** lead plays the hook over the bass; soft hi-hat
>    or shaker only. One chord per bar.
> 2. Bars 5–8, **Wave 1 (small):** add the harmony voice and a light kick.
>    A little busier, still friendly.
> 3. Bars 9–12, **Breath:** drums drop out; the hook played slower or an
>    octave lower.
> 4. Bars 13–20, **Wave 2 (bigger):** full beat (kick, snare on 2 and 4),
>    bass in eighth notes, an arpeggio under the lead; the hook climbs
>    higher. Stronger than Wave 1.
> 5. Bars 21–24, **Breath:** drums out again, a held bass note.
> 6. Bars 25–32, **Climb:** start quiet and add one layer every two bars;
>    the bass walks upward; the last two bars have two chords each and a
>    noise-channel riser.
> 7. Bars 33–40, **Peak:** the key changes (see the chart), every voice
>    plays, fastest rhythms, the hook at its boldest. The loudest part of
>    the track.
> 8. Bars 41–44, **Settle:** back to the home key, drums thin out to a
>    hi-hat, end on the dominant chord leading into bar 1.

## Level tracks (paste third)

Each block gives the tempo, key and character, then the chords per
section (one chord per bar; `x2` = play the four bars twice; two chords in
one bar are written `F G`).

### 1. The Backyard: path 88 s

> **120 BPM, C major.** Bouncy and curious: a hopping square-wave hook like
> a beetle scuttling, plucky staccato bass, a light shaker. Sunny
> afternoon, a little mischievous; in the Climb a low thump every bar, like
> something digging underground (the Giant Mole is coming).
>
> Calm: C – Am – F – G · Wave 1: C – F – G – C · Breath: F – C – Dm – G ·
> Wave 2: Am – F – C – G | Am – F – D7 – G · Breath: F – C – Dm – Gsus4 ·
> Climb: C – Dm – Em – F | G – Am – F G – Am A7 ·
> Peak (D major): D – C – G – A x2 · Settle (C major): Am – F – C – G

### 2. The Pond: path 80 s

> **132 BPM, F major.** Gentle and bubbly: rippling arpeggios that rise and
> fall like water, a lazy swinging bass, soft "plop" noise hits, frogs
> croaking on the off-beat. In the Peak the arpeggios splash fastest.
>
> Calm: F – Dm – B♭ – C · Wave 1: F – B♭ – C – F · Breath: B♭ – F – Gm – C ·
> Wave 2: Dm – B♭ – F – C | Dm – B♭ – G7 – C · Breath: B♭ – F – Gm – Csus4 ·
> Climb: F – Gm – Am – B♭ | C – Dm – B♭ C – Dm D7 ·
> Peak (G major): G – F – C – D x2 · Settle (F major): Dm – B♭ – F – C

### 3. The Treetops: path 88 s

> **120 BPM, G major.** Airy and adventurous: climbing scales, quick
> ornaments like birdsong, a bass that jumps like squirrels between
> branches, wind in the leaves on the noise channel. The Climb literally
> climbs: each phrase starts higher up the tree.
>
> Calm: G – Em – C – D · Wave 1: G – C – D – G · Breath: C – G – Am – D ·
> Wave 2: Em – C – G – D | Em – C – A7 – D · Breath: C – G – Am – Dsus4 ·
> Climb: G – Am – Bm – C | D – Em – C D – Em E7 ·
> Peak (A major): A – G – D – E x2 · Settle (G major): Em – C – G – D

### 4. The Mud Swamp: path 88 s

> **120 BPM, D minor, funny not scary.** Squelchy and goofy: wobbling pitch
> bends, a heavy stomping bass, sloppy "splat" snares, blobs that keep
> splitting in two (the harmony voice copies the lead a beat late). The
> Peak turns to F major: the swamp throws a party.
>
> Calm: Dm – B♭ – F – C · Wave 1: Dm – Gm – C – F · Breath: B♭ – F – Gm – A ·
> Wave 2: B♭ – C – Dm – Am | B♭ – C – A7 – A7 · Breath: Gm – Dm – B♭ – A ·
> Climb: B♭ – C – Dm – Dm | Gm – Am – B♭ C – Gm C7 ·
> Peak (F major): F – C – Dm – B♭ x2 · Settle (D minor): Gm – B♭ – C – A

### 5. The Dark Cave: path 70 s

> **151 BPM with a half-time feel (it feels like 75), A minor.** Mysterious
> but cozy: echoing single notes like drips, a pulsing bass like a
> flashlight beam, sparse noise ticks, glowworms twinkling. Rests are very
> sparse; the Peak turns to C major, like finding a glowing crystal cavern.
>
> Calm: Am – F – C – G · Wave 1: Am – Dm – G – C · Breath: F – C – Dm – E ·
> Wave 2: F – G – Am – Em | F – G – E7 – E7 · Breath: Dm – Am – F – E ·
> Climb: F – G – Am – Am | Dm – Em – F G – Dm G7 ·
> Peak (C major): C – G – Am – F x2 · Settle (A minor): Dm – F – G – E

### 6. The Volcano: path 78 s

> **135 BPM, E minor.** Energetic and hot: driving eighth-note bass,
> fast fiery lead runs, rumbling noise-channel toms, lava bubbling.
> Exciting rather than menacing; the Peak turns to G major, an eruption of
> sparks.
>
> Calm: Em – C – G – D · Wave 1: Em – Am – D – G · Breath: C – G – Am – B ·
> Wave 2: C – D – Em – Bm | C – D – B7 – B7 · Breath: Am – Em – C – B ·
> Climb: C – D – Em – Em | Am – Bm – C D – Am D7 ·
> Peak (G major): G – D – Em – C x2 · Settle (E minor): Am – C – D – B

### 7. The Windy Sky: path 78 s

> **135 BPM, D major.** Soaring and free: long gliding lead notes with
> vibrato like kites, quick swirling arpeggios, whooshing noise sweeps,
> birds and paper planes. The Breaths are a gust dying down; the Climb is
> the wind picking up (a long rising sweep).
>
> Calm: D – Bm – G – A · Wave 1: D – G – A – D · Breath: G – D – Em – A ·
> Wave 2: Bm – G – D – A | Bm – G – E7 – A · Breath: G – D – Em – Asus4 ·
> Climb: D – Em – F♯m – G | A – Bm – G A – Bm B7 ·
> Peak (E major): E – D – A – B x2 · Settle (D major): Bm – G – D – A

### 8. The Snowy Mountain: path 68 s

> **155 BPM, B♭ major, brisk.** Crisp and bright: icy high bell-like
> square tones (not shrill), a steady marching bass, crunchy footstep
> snares, penguins sliding, snowballs rolling. The Climb is a snowball
> rolling downhill and growing.
>
> Calm: B♭ – Gm – E♭ – F · Wave 1: B♭ – E♭ – F – B♭ · Breath: E♭ – B♭ – Cm – F ·
> Wave 2: Gm – E♭ – B♭ – F | Gm – E♭ – C7 – F · Breath: E♭ – B♭ – Cm – Fsus4 ·
> Climb: B♭ – Cm – Dm – E♭ | F – Gm – E♭ F – Gm G7 ·
> Peak (C major): C – B♭ – F – G x2 · Settle (B♭ major): Gm – E♭ – B♭ – F

### 9. The Night Sky: path 80 s

> **132 BPM, E♭ major.** Dreamy space adventure: twinkling arpeggios, a
> warm pulsing bass, a hint of a classic arcade space shooter, comets
> streaking by, a nod to old alien-invader games (a four-note marching
> bass in Wave 2). The Peak is a meteor shower.
>
> Calm: E♭ – Cm – A♭ – B♭ · Wave 1: E♭ – A♭ – B♭ – E♭ · Breath: A♭ – E♭ – Fm – B♭ ·
> Wave 2: Cm – A♭ – E♭ – B♭ | Cm – A♭ – F7 – B♭ · Breath: A♭ – E♭ – Fm – B♭sus4 ·
> Climb: E♭ – Fm – Gm – A♭ | B♭ – Cm – A♭ B♭ – Cm C7 ·
> Peak (F major): F – E♭ – B♭ – C x2 · Settle (E♭ major): Cm – A♭ – E♭ – B♭

### 10. The Kid's Bedroom (the finale): path 65 s

> **162 BPM, C major with surprise key changes.** A toy-box march:
> wind-up toy rhythms, triumphant but still silly. Each section quotes an
> earlier level's hook (Wave 1 the beetle hop, Wave 2 the pond's ripples,
> the Climb the treetops' scales), so everything the kid imagined comes
> together. The Peak changes key twice, the biggest lift of the game.
>
> Calm: C – Am – F – G · Wave 1: C – F – G – C · Breath: F – C – Dm – G ·
> Wave 2: Am – F – C – G | Am – F – D7 – G · Breath: F – C – Dm – Gsus4 ·
> Climb: C – Dm – Em – F | G – Am – F G – Am A7 ·
> Peak: D – C – G – A (D major), then E – D – A – B (E major) ·
> Settle (back to C, a half step up from the B): C – D – G – G7

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

## Menu, story map, ending and Endless

Four tracks outside the levels. They share one **main theme**, so the
game has a musical identity and the ending can bring it back as a memory
(a leitmotif). Paste the shared style first, then the track's block.

**The main theme** (named in every block below): a 2-bar hopping tune,
four notes stepping up (do – mi – sol – la), then three notes falling
back home (sol – mi – re – do), like a pencil drawing a loop.

**Files** (in `public/assets/music/`, played by `scenes/music.ts`):
`menu.mp3` (menu, HOW TO PLAY, SCORES), `map.mp3` (story map),
`ending.mp3` (once, from the last boss's fall), `endless.mp3` (Endless).

**Endless and world themes** (owner's pick, 2026-10-20): Endless keeps
one set of rules (all monsters, the score-led curve, one leaderboard);
the player may pick a world they unlocked in story mode as a cosmetic
theme (its page and its path song). `endless.mp3` is the default theme's
song.

### Main menu: about 69 s, loops

> **112 BPM, C major, 32 bars, loops (bar 32 flows into bar 1).**
> Catchy and welcoming, the game's signature tune: it states the main
> theme clearly, the one a player hums after closing the game. Mid-energy:
> a menu, not a level, so no big build-ups.
>
> 1. Bars 1–8, **Theme:** the lead plays the main theme twice over a
>    bouncy bass and a light beat. C – G – Am – F | C – G – F – G.
> 2. Bars 9–16, **Theme with harmony:** the second square voice joins in
>    thirds, a little arpeggio underneath. Same chords.
> 3. Bars 17–24, **Contrast:** a new answering tune, gentler, the drums
>    thinner. F – G – Em – Am | Dm – G – C – C.
> 4. Bars 25–32, **Theme, full:** everything playing, the theme an octave
>    up for the first 4 bars. C – G – Am – F | Dm – G – F – G.

### Story map: about 69 s, loops

> **84 BPM, F major, 24 bars, loops.** Calm and wandering: planning the
> next adventure over a notebook map. The main theme played slower and
> softer, as if someone is humming it while drawing the trail between
> islands. A soft square lead with gentle vibrato, a quiet triangle bass,
> a soft tick on the noise channel like footsteps, no snare.
>
> 1. Bars 1–8, **Hummed theme:** F – Dm – B♭ – C | F – Dm – Gm – C.
> 2. Bars 9–16, **Looking around:** a slow arpeggio answers the theme.
>    B♭ – C – Am – Dm | Gm – C – F – F.
> 3. Bars 17–24, **Back to the theme**, a little warmer, the harmony voice
>    joins. F – Am – B♭ – Gm | F – C – B♭ – C.

### Story ending: about 2 min 15 s, plays once

> **72 BPM, C major, 40 bars, plays once and ends on a long held chord (no
> loop).** Nostalgic and warm: the kid closes the notebook after the whole
> adventure. It starts like a music box, remembers every world, swells
> into one big happy chorus, and fades back to the music box.
>
> 1. Bars 1–8, **Music box:** the main theme, very slow, one high soft
>    square voice with a gentle echo, a quiet bass on the first beat only.
>    C – Am – F – G | C – Em – F – G.
> 2. Bars 9–28, **Memories:** two bars per world, in story order, each a
>    soft short quote of that world's tune: the backyard's hop, the pond's
>    ripples, the treetops' climbing scale, the swamp's wobble, the cave's
>    drips, the volcano's runs, the windy sky's gliding notes, the snowy
>    mountain's bells, the night sky's twinkles, the bedroom's toy march.
>    A light beat comes in slowly. Two chords per memory: C – Am, F – G,
>    Em – Am, Dm – G, C – Am, F – G, Em – Am, Dm – G, F – Fm, Gsus4 – G7
>    (the F to F minor is the bittersweet moment).
> 3. Bars 29–36, **Chorus:** the key lifts to D major, every voice plays
>    the main theme together, warm and happy, the biggest moment of the
>    track but never loud or harsh. D – A – Bm – G | D – A – G – A.
> 4. Bars 37–40, **Music box again:** back to C, drums out, the theme's
>    last notes on the music box, ending on a long held C chord.
>    F – Fm – C – C.

### Endless (default theme): about 1 min 50 s, loops

> **140 BPM, A minor, 64 bars, loops.** The most challenging track of the
> game: fast, dense and driving, for a mode that only gets harder. It
> remixes every world: all the monsters are on the field at once. No full
> rests: the energy dips a little once, then climbs to the end of the
> loop.
>
> 1. Bars 1–8, **Main theme, in minor:** the theme over a driving
>    eighth-note bass and a full beat. Am – F – C – G | Am – F – G – E7.
> 2. Bars 9–48, **World remix:** four bars per world, in story order, each
>    world's tune in a fast remix (the backyard's hop through the
>    bedroom's toy march), on alternating chord rows: Am – F – C – G, then
>    F – G – Em – Am.
> 3. Bars 49–56, **Short dip:** the drums thin to kick and hi-hat, the bass
>    pulses, a riser builds. Dm – Em – F – G | Dm – Em – F – E7.
> 4. Bars 57–64, **Climax:** double-time drums, the main theme in octaves,
>    the loudest part, leading straight back into bar 1.
>    F – G – Am – Am | F – G – E7 – E7.

### Level clear (a jingle, not a loop)

**File:** `level-clear.mp3` (optional, not made yet; `scenes/extraMusic.ts`
plays it after each boss, and a rising blip fanfare stands in until it
exists).

> A short victory fanfare, about 6–8 seconds, then silence (no loop, a
> clean final note). 140 BPM, C major: a quick rising square-wave run,
> three bright triumphant chords, a little trill on top and a final held
> chord with a noise-channel cymbal hit. It plays while the ship
> accelerates off the top of the screen and the level's score counts
> up: joyful, proud, a bit cheeky, like "did it!". Use the main theme's
> first four notes (do – mi – sol – la) for the rising run.
