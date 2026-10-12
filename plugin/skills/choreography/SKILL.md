---
name: choreography
description: How to choose a choreography (segment intent) for each part of a video, and how choreography changes motion, music, sound effects and on-screen text while the theme stays fixed. Use when planning segments or setting `choreo` in a spec.
---

# Choreography

The theme never changes inside a video. **What changes from segment to segment is the choreography**:
how things move, how much the stage shows, what the music does, which sounds punctuate events,
and how many words may be on screen. Every segment picks one with `"choreo"`. The presets live in
`src/choreo/presets.ts` — read it; each has a `purpose` line. Sounds and music follow automatically;
you never place them by hand unless you want an extra accent (`{"do": "sfx"}`).

| choreo | use it for | feels like | voice (pace · style) | music energy |
|---|---|---|---|---|
| `cold-open` | the first 5–20 s: question, stake, surprising claim | centred slam-in, rings pulse out, flash on the first hit; music drops in on it | rush → brisk · urgent | 2 |
| `big-number` | a number that carries the stakes | count-up, comparison bars | brisk · excited | 2 |
| `myth` | "everyone does X, but…" | state, strike out, replace | normal · serious | 1 |
| `failure` | something breaks | red, music drops out, glitch, hold | brisk · urgent | 0 |
| `chapter` | section marker = YouTube chapter | line bullet, title as a question, route map of all chapters | normal · warm | 2 |
| `build` | introduce components one by one | calm, one new thing at a time | normal · calm | 1 |
| `flow` | requests moving through the system | packets on coloured lines | brisk · neutral | 1 |
| `deep-dive` | zoom into one part, code, sequence | slow camera, dims the rest | slow · serious | 1 |
| `solution` | the fix, after a failure | green, bright stage, crisp snaps, full music with percussion, heading names the fix | normal · excited | 3 |
| `compare` | two approaches and their trade-offs | symmetric, verdict lights one line | normal · neutral | 1 |
| `insight` | the one sentence to remember | stage empties, music steps back, long hold | slow · serious | 0 |
| `recap` | takeaways | rhythmic stops along a line | brisk · warm | 2 |
| `outro` | close the loop, call to action | calm, music fades | normal · warm | 1 |

Voice defaults fill each beat's `pace` and `style` unless the beat sets them. `pace` changes speed
(slow 0.84×, brisk 1.12×, rush 1.22×); `style` becomes Qwen3-TTS's delivery instruction (and
ElevenLabs' settings). Kokoro drafts ignore style; pace, pauses and short sentences still carry them.

## Rhythm rules
- **Open with a hook choreo** (`cold-open`, `big-number`, `myth` or `failure`), on screen within a second.
- **Energy is a contour, not a constant.** A good video breathes: 2 2 1 2 · 1 1 1 2 · 0 1 0 · 2 1 1 · 2 1.
  The `npm run check` summary prints it ("music energy by segment"). Avoid five equal segments in a row.
- **Problem and fix must feel opposite.** After a `failure`, the fixes use `solution`: red becomes
  green, silence becomes full music, glitches become clean snaps. Name each fix on screen with a
  `heading` ("Fix 1: coalesce the misses") or the compare column titles ("Fix 2: serve stale").
- **Chapters answer "of what?"** Chapter titles are questions the chapter answers ("What is
  cache-aside?", "Why does it collapse?", "How do we stop it?"), with a `short` name for the route map.
- **Silence is a tool.** `failure` and `insight` drop the music on purpose. Put the video's best line in an `insight`.
- **A chapter every 45–70 s.** Three or more chapters, so YouTube shows them. Each `chapter` segment
  sets `"chapter": "<title>"` (the YouTube chapter name) and uses a different `line` colour.
- **Match the choreo to the scene.** Each preset lists the scene types it fits; the linter warns otherwise.
  A `custom` scene takes any choreography: pick by intent, and the voice, music and stage follow.
- **The same scene type four times in a row is a warning.** Diagrams are the exception: a sequence of
  `build` → `flow` → `failure` on the same diagram is the backbone of most videos.

## Transitions
Exits come from the choreography: `cold-open` leaves with the **line wipe** (a band in the next
segment's accent sweeps across, like a train passing), most others dip through a short fade, and
`chapter` cuts into the content. Override per segment with `"transition"` only when you have a reason
(for example `cut` between two `flow` segments on the same diagram, which is the default anyway
because diagram segments continue each other).

## What the choreography sets for you
- motion curve and duration for reveals, stagger between siblings, camera curve
- stage grid and vignette strength, slow push-in for hooks and insights
- word budget on screen (`text.maxWords`) and default statement size and alignment
- lead-in before the first word, gap between beats, hold after the last word
- music energy 0–3 (each track's `energy` table sets its stems: for `transit-drive` bass, kick, groove,
  top), ducking under the voice, a sting (riser, whoosh)
- sound effects per event: reveal, station appears, packet departs, failure, strike, camera move.
  The compiler thins repeats (each sound has a minimum gap), so a sound stays an accent, not a metronome.
- voice pace and delivery style per beat (see the table)
- music enters on the hook's first impact and energy changes land on bar lines
