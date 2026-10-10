---
name: visual-qa
description: How to review a video before it ships — contact sheets, automated text QA, the design checklist, audio and delivery checks. Use after writing or changing a spec, after voicing, and before the final render.
---

# Visual QA

A successful render only proves a video was produced. Review proves it is good.

## 1. Automated
- `npm run check -- <id>` — schema, references, editorial rules, timeline.
- `npm run sheet -- <id> [--theme light]` — key frames after every visual event, with a text probe
  that flags `clipped` (text leaves the frame), `unsafe` (outside safe margins) and `overlap`
  (two visible text runs collide). Results: `out/<id>/sheet.md` (QA column) and `out/<id>/sheet-*.jpg`
  (4×4 tiles, labelled with time, segment and choreography).
- One moment at full resolution: `npm run sheet -- <id> --at 1:23` → `out/<id>/frames/<frame>.jpg`.
- After the final render: `out/<id>/qc.md` (resolution, fps, codecs, duration, −14 LUFS, true peak, silences).

## 2. Look at every tile
Read the sheets in order and ask, per frame:
1. **One focal point?** Can you tell in half a second what to look at?
2. **Legible at phone size?** Imagine the tile 4 cm wide. Station labels and plates must still read.
3. **Signage, not captions?** Two to six words that name the idea.
4. **Colour means the same thing it meant a minute ago?** Red only for failure, green for health.
5. **Composition**: balanced in the frame, nothing jammed into a corner, legend not colliding.
6. **Continuity**: diagrams keep their layout across segments; nothing jumps.
7. **Rhythm** across the sheet: does the energy rise and fall, or is it the same picture for a minute?

## 3. Fix with the smallest change
Prefer spec changes (cues, layout, words, choreography) over code changes. When the spec cannot
express the fix, note it and use `extend-studio`.

## 4. Fresh eyes
For a new video's first full draft, ask the **video-reviewer** agent. It reads the sheets, the spec
and the script without having built them, and returns prioritised fixes.

## 5. Ears (the user's job, but prompt for it)
Ask the user to listen once on headphones: narration level vs music, harsh sound effects, any
mispronunciation (fix with spelling in `say`, e.g. "Postgres" → "post-gress" if needed), awkward pauses.
