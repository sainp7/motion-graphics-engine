# ADR-0003: Choreography changes per segment; text is signage

Status: accepted · 2026-10-10

## Context
The theme should never change inside a video, but a hook, a failure and an insight should not feel the
same. Motion, music, sound and the amount of text should follow what each part of the story is doing.

## Decision
- Every segment declares an intent: `choreo` (cold-open, big-number, myth, failure, chapter, build,
  flow, deep-dive, solution, compare, insight, recap, outro). A preset (`src/choreo/presets.ts`) sets the motion
  curve and timing, stage (grid, vignette, push-in), on-screen word budget and default text size and
  alignment, lead-in/gap/tail, music energy and ducking, a sting, and the sound for each event type.
- Music is a set of looping stems; each track's energy table maps energy 0–3 to stem levels, with
  changes on bar lines, ducked under narration. Failures and insights drop to silence on purpose,
  and the groove returns on the next beat.
- Sound effects are scheduled automatically from scene events through the preset's sound map.
- **On-screen text is signage**: two to six words that name the idea while the voice explains it.
  Plates (`{word}`) mark at most two words that carry the idea. The linter warns when on-screen text
  appears verbatim in the narration (a caption), when a segment exceeds its word budget, and when
  lines exceed the measured width.

## Consequences
Claude chooses intents, not animation parameters, so videos stay consistent while varying in feel.
The energy contour and scene variety are visible in `npm run check` and linted (repetitive videos
risk YouTube's inauthentic-content policy).
