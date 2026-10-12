---
name: styles-and-channels
description: How channels and motion styles work — pick or create a channel (channels/<id>/channel.json), pick or build a motion style (src/styles/<id>/), the channel intro after the hook, and previewing a video in another style. Use when starting a new channel or account, changing a channel's look, adding one of the 10–20 styles to the library, or when a video needs a different channel.
---

# Styles and channels

The engine is flexible; a **channel** makes it consistent. Many channels (YouTube channels,
Instagram accounts) can live in one repo, each with its own look and sound, all sharing the scene
library, choreography, voice and render pipeline.

```
studio.json                 { "defaultChannel": "systems" }
channels/<id>/channel.json  name, tagline, handle, style, theme, voice, music, intro, outro CTA
src/styles/<id>/            a motion style: tokens.ts, index.tsx, Intro.tsx, optional scenes/
videos/<id>/spec.json       "channel": "<id>" (or the default) — inherits all of the above
```

## Channels
- A video inherits from its channel: `style`, `theme`, `voice`, `music`, the outro's `handle` and
  `cta`, and the **intro**. Anything the spec sets itself wins (`"theme": "light"` on one video).
- New channel: `npm run new-channel -- <id> "Name" --style editorial --handle @you --tagline "…"`.
  New video in it: `npm run new -- 001-topic "Title" --channel <id>`.
- One style per channel. Changing `style` in `channel.json` restyles every video of the channel on
  its next render; that is the point, so treat it as a brand change and re-check old videos' sheets.

## The channel intro
YouTube videos open with the hook, then a short channel intro (a bumper), then the video. The
compiler inserts it automatically after the first segment, from `channel.intro`:
```json
"intro": { "enabled": true, "seconds": 3.5, "line": "orange", "formats": ["landscape"], "after": "hook" }
```
- It is drawn by the style's `Intro` (name, tagline, handle), the music drops in at full energy
  with a sting, and it has no narration. It is not a chapter.
- Shorts and Reels (`portrait`) skip it by default (`formats`). A video can skip it with
  `"intro": false` or move it with `"intro": { "after": "myth" }`.
- Keep the hook tight before it (5–15 s): the intro is the reward for staying, not a wall.

## Styles
A style is everything that makes videos look like one family:

| part | file | what it sets |
|---|---|---|
| tokens | `tokens.ts` | palettes (dark and light, the seven line colours keep their meanings), fonts, type scale, easing curves, plate look (`badge` or `marker`), default theme and music |
| registration | `index.tsx` | the StyleDef: tokens, scene overrides, Background, Overlay (transitions), Intro |
| intro | `Intro.tsx` | the channel bumper |
| scenes | `scenes/*.tsx` | optional overrides of library scenes (statement, chapter, stat, list, outro, …) |

Anything not overridden falls back to the shared scene library, restyled by the tokens: diagrams,
sequences, compare and code usually stay shared (they carry the explanations), type-led scenes
(statement, chapter, stat, list, outro) are where styles differ most.

Library today:
- `transit`: the system is a transit map. Stations, painted lines, signage type, line-wipe.
  Diagram-first; system design.
- `editorial`: kinetic typography on paper. Fraunces serif, words arriving one at a time,
  highlighter plates, numbered sections, masthead intro, page-wipe. Essays and story-led videos.

### Building a new style
1. `npm run new-style -- <id> "Name" [--from transit|editorial]` scaffolds `src/styles/<id>/`.
2. Decide the idea in one sentence first ("blueprint: everything is drawn in white line on
   cyanotype", "neon arcade", "paper cut-out", "terminal"). Write it as the tokens' `description`.
3. Tokens: palettes for both themes (contrast ≥ 4.5 for text), fonts from Fontsource (bundle them in
   `fonts.ts` with `loadFont`, never fetch at render time), the type scale, the curves.
4. Override only the scenes whose shape must change; reuse `src/styles/editorial/Kinetic.tsx` or the
   transit scenes as starting points. Keep their props: the spec must render in every style.
5. Intro, Background, Overlay.
6. Review: `npm run sheet -- gallery --style <id>` and `--theme light`, then a real video:
   `npm run sheet -- 001-cache-stampede --style <id>`, and in `npm run studio` switch the style live.
7. Note the style in this skill's library list.

Rules: tokens only (raw colours are allowed in `src/styles/<id>/tokens.ts` and nowhere else), motion
from the frame, deterministic, same scene props as the library. A style may not change what a spec
means (colour meanings, cue timing, word budgets), only how it looks.
