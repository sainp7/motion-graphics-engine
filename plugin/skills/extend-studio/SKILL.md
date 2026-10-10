---
name: extend-studio
description: How to grow the studio when a spec cannot express an idea — add a scene type, a diagram action, a choreography, a node kind, a sound or a music track — without breaking consistency. Use when a video needs something the components do not do.
---

# Extending the studio

The library should grow from real needs: when a video needs something new, build it once, generally,
and every later video can use it. Never write one-off code for a single video.

## Before you build
- Can existing pieces do it? (A focus + dim + badge often beats a new component.)
- Write down the need in one line in `library/references/backlog.md`, with the video that needed it.

## Add a scene type (e.g. `chart`)
1. **Schema** — `src/spec/schema.ts`: a strict zod object with `type: z.literal("chart")`, cue fields
   named `at` (or `until`, `reveal`), colours as `line` (LineRef). Add it to the `Scene` union. Describe
   every field (`.describe`) — it becomes the JSON schema Claude reads.
2. **Compiler** — `src/spec/compile.ts`: defaults in `fillDefaults`, sound events in `scheduleSfx`.
   Cue strings and line names resolve automatically for fields named `at`/`until`/`reveal`/`line`.
3. **Component** — `src/scenes/Chart.tsx`: animate only from `useCurrentFrame()` with `prog()`/`ease()`
   from `src/design/motion.ts`; sizes from `typeStyle()` and `useLayout()`; colours from `useTheme()`.
   Read timing from `useSegment().choreo.motion` so choreography still drives it.
4. **Wire it** — `SceneSwitch` in `src/video/SpecVideo.tsx`; add the scene to the right presets'
   `scenes` lists in `src/choreo/presets.ts`.
5. **Lint** — `scripts/lib/lint.ts`: references, word counts, and `sceneEvents` for the new scene.
6. **Gallery** — add a segment to `src/gallery/gallery-spec.ts`, then
   `npm run sheet -- gallery` and `npm run sheet -- gallery --theme light`. It must look right in both.
7. **Docs** — the table in `spec-authoring/SKILL.md` and an example in `spec-authoring/reference.md`.
8. `npm run typecheck`.

## Add a diagram action
Schema (`DiagramAction` union) → fold it in `src/scenes/diagram/state.ts` → render in `Diagram.tsx`
→ sound in `scheduleSfx` → lint references → gallery → `diagram-authoring` table.

## Add a choreography
A new entry in `src/choreo/presets.ts` with a clear `purpose`, then the table in the `choreography`
skill. Prefer tuning an existing preset over adding a near-duplicate.

## Add a sound or music
- House sounds: a recipe in `audio/house_sfx.py`, then `npm run house-audio` (writes the manifest).
- Licensed sounds or tracks: add the file under `public/`, and an entry with **licence, source and
  monetisation status** in `library/sfx/manifest.json` or `library/music/manifest.json`. A track with
  `stems` needs an `energy` table (`"0"`–`"3"` → level per stem) and its `bpm`, so changes land on the
  beat; a single `file` follows the first stem's curve. Stems must loop gaplessly (FLAC or WAV, a
  whole number of bars).
- House music: a generator like `audio/house_drive.py`, added to the `house-audio` script.

## Rules
Tokens only (the guardrail hook rejects raw colours, CSS animation and `Math.random`). Deterministic
frames. Every new piece appears in the gallery in both themes.
