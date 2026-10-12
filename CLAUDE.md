# Motion Graphics Engine

A programmatic motion design studio for explainer channels (YouTube 16:9 first, Shorts and Reels
later). One repo runs several **channels** (`channels/<id>/channel.json`); each channel fixes a
**motion style** from the library (`src/styles/<id>/`), a narrator, music and a channel intro.
Claude is the motion designer: it writes a JSON **video spec**; a fixed Remotion renderer plays it
from the shared scene library, in the channel's style. One to three signature moments per video
may be **custom scenes** in `videos/<id>/scenes/` (React `.tsx`, or pure JS/TS with GSAP, canvas,
three.js), on the same tokens and timing.

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
opening-hooks, script-writing, design-system, styles-and-channels, spec-authoring,
diagram-authoring, custom-scenes, visual-qa, publish-kit, extend-studio. Agents: researcher,
script-writer, art-director, video-reviewer.

## Commands
| command | does |
|---|---|
| `npm run setup [-- --models]` | one-time local setup; skips what is already there |
| `npm run new -- <id> "title" [--channel <id>]` | scaffold `videos/<id>/` (brief.md, script.md, spec.json) |
| `npm run new-channel -- <id> "Name" [--style editorial] [--handle @you]` | a new channel or account |
| `npm run new-style -- <id> "Name" [--from transit]` | scaffold a new motion style in `src/styles/<id>/` |
| `npm run check -- <id>` | validate + lint the spec, print the timeline and music energy contour |
| `npm run sheet -- <id> [--style s] [--theme light] [--at 1:23]` | key frames + text QA + contact sheets in `out/<id>/` |
| `npm run voice -- <id> [--engine kokoro]` | narration: Qwen3-TTS + Whisper word timing, local; Kokoro for fast drafts |
| `npm run voice-ref -- <name>` | cloned voice: scaffold `library/voice/<name>/` (first run), then check the recordings |
| `npm run studio` | the review studio (player, timeline, script, check, render buttons; any style/theme) |
| `npm run render -- <id> [--style s] [--theme light] [--draft]` | final render, mastered to −14 LUFS, QC report |
| `npm run publish-kit -- <id>` | chapters, thumbnail, upload kit |
| `npm run house-audio` | regenerate the house sound kit and music stems (deterministic, CC0) |
| `npm run sheet -- gallery [--style s]` | the design-system gallery (every scene type), dark or light |
| `npm run remotion-studio` | Remotion's own Studio, if needed |
| `npm run typecheck` | sync generated files + TypeScript |

## Channels (decided; change only when the user asks)
- `systems` (default, `studio.json`): "Systems in Motion" (placeholder name and tagline, the user
  will set them), style `transit`, dark, Qwen3 `Aiden`, `transit-drive`, intro after the hook,
  handle `@sainp7`, CTA "Follow for more system design". System design videos.
- `essays`: a sample channel ("Field Notes", placeholder) in the `editorial` style, light, calm music.
- The user plans 4–5 channels/accounts. Each fixes one style; the library stays open to all.
- Voice: Qwen3-TTS 1.7B CustomVoice, speaker `Aiden`, American English, male, delivery from each
  beat's `pace` and `style`. Kokoro `am_michael` is the draft fallback. Optional: a cloned voice,
  `"voice": "clone:<name>"` (audio is git-ignored; never commit it).
- Music: `transit-drive` (112.5 BPM house groove). `house-night-transit` is the calm alternative.
  Failures and insights cut the music; the intro and the fixes (`solution`) bring it back full.
- Everything runs locally and free. No paid services; ElevenLabs is optional and off by default.
- Publishing is manual: Claude prepares the render and `publish.md`; the user uploads.

## Rules
- Build a video from the spec and the scene library, in its channel's style. Custom scenes
  (`custom-scenes` skill) are for one to three moments the library cannot show; React scenes import
  only `src/custom/kit.ts`, script scenes only `src/custom/script-kit.ts` (plus libraries like gsap).
  Change shared components only through `extend-studio`; a custom scene wanted twice gets promoted.
- Every spec must render in every style. A style changes how things look, never what a spec means.
- Facts on screen or in narration must be backed by the video's `brief.md`.
- On-screen text is signage, never captions. The linter enforces it. Headings (`heading`) and chapter
  titles may echo the voice.
- Chapter titles are questions ("Why does it collapse?"); each fix is named on screen ("Fix 1: …").
- The hook looks and sounds unlike the rest; the channel intro follows it; problem and fix are
  visual and sonic opposites.
- Colours, type, spacing and curves come from the style's tokens (`src/design/`, `src/styles/<id>/tokens.ts`).
  No raw hex, no CSS animation, no `Math.random` anywhere else, custom scenes included (the hook rejects them).
- Script scenes: `seek(t)` is a pure function of t (paused GSAP timeline, or redraw from t).
- Custom scenes compute what they illustrate (hashes, counts, probabilities) and show the true result.
- Before calling a video done: `npm run check` clean, contact sheets reviewed, `out/<id>/qc.md` all pass.

## Working with the user
- The user is a software engineer. Hand over code changes with typecheck and lint run; no need to
  play-test every path first. Voicing (Qwen downloads, minutes per video) and full renders are long
  jobs: run them when asked, or tell the user the command.
- Generated files stay out of git: `out/`, `public/videos/`, `public/sfx/`, `public/music/`,
  `src/*.generated.ts`.

## Map
`channels/` channel configs (+ `studio.json`) · `src/styles` the style library (tokens, overrides,
intros) · `src/spec` spec and channel schemas, compiler · `src/choreo` choreography presets ·
`src/design` shared tokens, theme and style plumbing, motion · `src/scenes` the shared scene library
(diagram engine in `src/scenes/diagram`) · `src/custom` custom-scene APIs (React kit, script kit) ·
`src/primitives` shared pieces · `src/video` top-level composition, QA probe, thumbnail · `src/audio`
mix · `studio/` the review studio · `audio/` Python TTS and house sound · `scripts/` CLI ·
`library/` music, sfx, pronunciation, cloned voices, references · `videos/` one folder per video ·
`docs/adr` decisions.
