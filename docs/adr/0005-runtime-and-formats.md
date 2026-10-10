# ADR-0005: Runtime and formats

Status: accepted · 2026-10-10

## Context
3–4 videos a week, uploaded manually. A server, Telegram bot and auto-publishing would add moving
parts before the pipeline is proven.

## Decision
- **Runtime**: evening sessions in Claude Code on the Mac, in this repo, with the `studio` plugin.
  Rendering, TTS (Qwen3-TTS) and preview run locally. No server, no paid services. `npm run setup`
  prepares a machine.
- **Publishing**: manual upload; `npm run publish-kit` prepares chapters, thumbnail and copy.
- **Automation later**: the same plugin loads in the Claude Agent SDK from a local path, so a headless
  worker can reuse it unchanged if automation becomes worth it.
- **Formats**: 16:9 1920×1080 at 30 fps first. 9:16 (1080×1920) follows the same spec with these principles:
  - same tokens and choreography; layout derives from `useLayout()` (portrait safe margins are wider at
    the top and bottom for platform UI)
  - diagrams stack top to bottom instead of left to right; ≤ 5 stations visible; the camera focuses more
  - statements at most three words per line; plates stay
  - compare becomes stacked (top/bottom); sequences limit to three actors
  - segments shorter, cut to 45–60 s; a Short is a focused excerpt, not the whole episode squeezed
  A future `portrait` adapter in the compiler will rewrite layouts; until then `format: "portrait"` is reserved.
