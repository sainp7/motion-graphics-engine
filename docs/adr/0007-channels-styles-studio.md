# ADR-0007: Channels, the style library, script scenes and the review studio

Status: accepted · 2026-10-12

## Context
The engine will run 4–5 channels and accounts, each with its own look, while 10–20 motion styles
accumulate in one library. Long-form YouTube videos also want a channel intro after the hook. Some
animations are easier to write imperatively (GSAP, canvas, three.js) than as React, and Remotion
Studio was hard to use for review. HyperFrames (HTML + seekable adapters, agent-first) was the model
for the last two.

## Decision
- **Channels** (`channels/<id>/channel.json`, default in `studio.json`) carry style, theme, voice,
  music, handle, outro CTA and intro settings. `resolveSpec` applies them before the schema, so a spec
  inherits everything it does not set itself. One style per channel.
- **Styles** (`src/styles/<id>/`, auto-registered by `npm run sync`): `tokens.ts` (pure data:
  palettes, fonts, type, curves, plate look) and `index.tsx` (scene overrides, Background, Overlay,
  Intro). The active style's tokens are set per composition by `ThemeProvider`, so `typeStyle()` and
  `ease()` work unchanged in every scene. Unoverridden scenes fall back to the shared library. Every
  spec must render in every style; styles change how things look, never what a spec means.
- **Intro**: a silent `intro` segment inserted after the first segment (configurable), drawn by the
  style, at full music energy, landscape only by default.
- **Script scenes**: `videos/<id>/scenes/*.js|.ts` export `defineScene({ setup(ctx) → { seek(t) } })`,
  HyperFrames' frame-adapter contract, mounted by a host that calls `seek(frame / fps)` in a layout
  effect and blocks rendering until setup resolves. GSAP is a dependency.
- **Studio**: `npm run studio` is a Vite app around `@remotion/player` with a local API (lint, jobs,
  auto-sync). Remotion stays the renderer (hybrid): the scene library, compiler and mix are kept, and
  HyperFrames' ideas are adopted where they help instead of porting everything to HTML.

## Consequences
New channels and styles are scaffolds, not engine changes. A style only needs tokens and an intro to
work; overrides are opt-in. The active-tokens module is a deliberate global, safe because Remotion
renders one composition per page; it must not be used to render two styles in one React tree.
