# ADR-0002: The video spec is the contract

Status: accepted · 2026-10-10

## Context
Letting Claude write new React for every video produces inconsistent results and fragile code.
We want video #200 to look like video #2, and the studio to improve over time.

## Decision
- Claude writes `videos/<id>/spec.json`, validated by a zod schema (`src/spec/schema.ts`, JSON schema
  generated to `schema/`). One renderer (`SpecVideo`) plays any valid spec.
- The compiler (`src/spec/compile.ts`) is the only place where seconds become frames, cue references
  become numbers, line names become colours and sound effects are scheduled. Components get resolved data.
- **Audio-first timing**: durations are never authored. Each beat's length comes from its narration
  audio; visual actions reference cue words (`{words|cue}`) in the narration. Before audio exists the
  compiler estimates, so the preview always works.
- Diagram segments that share a diagram continue its state; the compiler replays earlier segments'
  events with negative frame offsets, so any frame is a pure function of the spec.
- When a spec cannot express an idea, the library is extended once, generally (`extend-studio` skill),
  with a gallery entry in both themes.

## Consequences
Rendering is deterministic and reviewable. Linting can enforce editorial rules on data instead of code.
The schema is the API: changes to it are versioned (`version: 1`).
