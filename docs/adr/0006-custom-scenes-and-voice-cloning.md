# ADR-0006: Custom scenes and voice cloning

Status: accepted · 2026-10-11

## Context
The fixed scene library made every video consistent, and also made every video look assembled.
Code-made motion design elsewhere gets its best moments from bespoke animation: a UI morphing into a
diagram, kinetic type, a ring, hundreds of particles. Separately, a channel narrated by a stock voice
sounds like every other channel.

## Decision
- **Custom scenes**: a scene `{ type: "custom", component, props, cues, signage, actions }` mounts
  `videos/<id>/scenes/<component>.tsx`. `npm run sync` registers the files; the compiler resolves
  `cues` to frames and schedules sound; the renderer passes `cues`, `props`, `durationInFrames` and
  the accent. Components import only `src/custom/kit.ts`, which re-exports the theme, tokens, motion,
  primitives, `useNarration()` and Remotion basics.
- **Bounds**: one to three custom components per video (lint warns above, or above 40% of segments).
  The guardrail hook applies the design-system rules to custom scenes; the linter requires the file
  and counts `signage` in the word budget and caption check. A custom scene wanted a second time is
  promoted to the library through `extend-studio`.
- **Voice cloning**: `"voice": "clone:<name>"` uses Qwen3-TTS's Base model with references in
  `library/voice/<name>/` (one recording and transcript per style, `voice.json`). Its clone API takes
  no style instruction, so each beat picks the recording made in its style, with fallbacks
  (urgent ↔ excited, otherwise calm). Prompts are built once per reference. A fingerprint of the
  recordings is part of the cache key. `npm run voice-ref` scaffolds the folder and checks
  recordings (length, sample rate, clipping, noise floor, loudness, transcript match via Whisper).
- **Privacy**: reference audio is git-ignored; config and transcripts are committed.

## Consequences
Videos keep their shared language for 80–90% of the runtime and get one or two moments of full
freedom. Custom code lives with the video, so it never breaks another video, and the promotion rule
keeps the library growing from proven ideas. Cloned narration cannot be sped up by `pace`; pauses and
sentence length carry pacing for it.
