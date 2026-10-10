# Motion Graphics Engine

A programmatic motion design studio for 3–4 minute system design explainer videos (YouTube 16:9
first, 9:16 later). Claude is the motion designer: it writes a JSON **video spec**; a fixed Remotion
renderer plays it. New videos never need new React code.

## Setup
`npm run setup` prepares a machine and is safe to re-run (tools, npm packages, Python 3.12, house
audio, `.claude/settings.json`, the studio plugin). `npm run setup -- --models` also pre-downloads
the voice models.

## The studio plugin
Skills, agents and guardrail hooks live in `plugin/` (Claude Code plugin `studio`, installed by
`npm run setup`). By hand:

    claude plugin marketplace add ./
    claude plugin install studio@motion-graphics-engine

Start a video with `/studio:new-video <idea or links>`. The skills: new-video, choreography,
opening-hooks, script-writing, design-system, spec-authoring, diagram-authoring, visual-qa,
publish-kit, extend-studio. Agents: researcher, script-writer, art-director, video-reviewer.

## Commands
| command | does |
|---|---|
| `npm run setup [-- --models]` | one-time local setup; skips what is already there |
| `npm run new -- <id> "title"` | scaffold `videos/<id>/` (brief.md, script.md, spec.json) |
| `npm run check -- <id>` | validate + lint the spec, print the timeline and music energy contour |
| `npm run sheet -- <id> [--theme light] [--at 1:23]` | key frames + text QA + contact sheets in `out/<id>/` |
| `npm run voice -- <id> [--engine kokoro]` | narration: Qwen3-TTS + Whisper word timing, local; Kokoro for fast drafts |
| `npm run studio` | Remotion Studio preview (`videos/<id>`, and `other-theme/<id>-light`) |
| `npm run render -- <id> [--theme light] [--draft]` | final render, mastered to −14 LUFS, QC report |
| `npm run publish-kit -- <id>` | chapters, thumbnail, upload kit |
| `npm run house-audio` | regenerate the house sound kit and music stems (deterministic, CC0) |
| `npm run sheet -- gallery` | the design-system gallery (every scene type), dark or light |
| `npm run typecheck` | sync generated files + TypeScript |

## Defaults (decided; change only when the user asks)
- Theme: `dark`. Light ("clean") is `"theme": "light"` in the spec, or `--theme light` per command.
- Voice: Qwen3-TTS 1.7B CustomVoice, speaker `Aiden`, American English, male. Delivery comes from
  each beat's `pace` and `style` (choreography defaults). Kokoro `am_michael` is the draft fallback.
- Music: `transit-drive` (112.5 BPM house groove, stems bass/kick/groove/top). `house-night-transit`
  is the calm alternative. Failures and insights cut the music; the fixes (`solution`) bring it back full.
- Everything runs locally and free. No paid services; ElevenLabs is optional and off by default.
- Publishing is manual: Claude prepares the render and `publish.md`; the user uploads.
- Outro handle `@sainp7`, call to action "Follow for more system design".

## Rules
- Edit specs, not components, to make a video. Extend components only through the `extend-studio` skill.
- Facts on screen or in narration must be backed by the video's `brief.md`.
- On-screen text is signage, never captions. The linter enforces it. Headings (`heading`) and chapter
  titles may echo the voice.
- Chapter titles are questions ("Why does it collapse?"); each fix is named on screen ("Fix 1: …").
- The hook looks and sounds unlike the rest; problem and fix are visual and sonic opposites.
- Colours, type, spacing and curves come from `src/design/tokens.ts`. No raw hex, no CSS animation,
  no `Math.random` in `src/` outside `src/design/` (the hook rejects them).
- Before calling a video done: `npm run check` clean, contact sheets reviewed, `out/<id>/qc.md` all pass.

## Working with the user
- The user is a software engineer. Hand over code changes with typecheck and lint run; no need to
  play-test every path first. Voicing (Qwen downloads, minutes per video) and full renders are long
  jobs: run them when asked, or tell the user the command.
- Generated files stay out of git: `out/`, `public/videos/`, `public/sfx/`, `public/music/`,
  `src/registry.generated.ts`.

## Map
`src/spec` schema + compiler · `src/choreo` choreography presets · `src/design` tokens, theme, fonts,
motion · `src/scenes` scene components (diagram engine in `src/scenes/diagram`) · `src/primitives`
shared pieces (RichText, Heading, Station) · `src/video` top-level composition, QA probe, thumbnail ·
`src/audio` mix · `audio/` Python TTS (`tts.py`) and house sound (`house_sfx.py`, `house_drive.py`,
`house_music.py`) · `scripts/` CLI (`setup.sh` and the TypeScript commands) · `library/` music, sfx,
pronunciation, references · `videos/` one folder per video · `docs/adr` decisions.
