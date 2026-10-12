---
name: custom-scenes
description: Hand-code a signature moment for one video (a ring, a morph, kinetic type, many particles, any shape the scene library cannot draw) as a custom scene in videos/<id>/scenes/, on the studio's tokens, motion curves and audio timing. Use when a segment's idea cannot be shown well with statement, stat, diagram, sequence, compare, list, chapter or code.
---

# Custom scenes

The scene library keeps every video consistent and fast to make. A custom scene is the escape
hatch for the one or two moments per video that make it feel made, not assembled. It is free in
what it draws and how it moves, and bound to the studio in look, time and sound.

Reference: `videos/002-consistent-hashing` (React: `ModuloScatter` for the hook, `HashRing` for three
segments, and its `brief.md` table "What the custom scenes do") and `videos/003-tail-latency`
(pure JS + GSAP: `FanOut.js`).

## When
- The idea has a shape the library cannot draw: circular or radial geometry, dozens of moving
  particles, a formula whose parts move, one object morphing into another, a UI that transforms, a
  chart type that does not exist yet.
- The moment carries the video: the hook, the core mechanism, the payoff. Not a list, not a recap.
- **One to three custom components per video**, reused across segments when the story continues
  (`HashRing` with `mode: add | uneven | vnodes`). The linter warns above three, or when more than
  40% of segments are custom.
- If you build the same kind of scene a second time in another video, promote it to a library
  scene with `extend-studio`.

## The spec side
```json
{ "id": "ring", "choreo": "build",
  "beats": [{ "say": "…bend that line into a {circle|c-ring}…" }, …],
  "scene": {
    "type": "custom",
    "component": "HashRing",                       // videos/<id>/scenes/HashRing.tsx, default export
    "props": { "mode": "add", "keys": 48 },        // free data for the component
    "cues": { "ring": "c-ring", "add": "c-add" },   // named moments → cue refs; arrive as frames
    "signage": ["Keys per server", "6 of 48 keys moved"],  // the words it shows, for the linter
    "actions": [{ "at": "c-add", "do": "sfx", "sound": "pop" }]  // optional; else each cue gets the reveal sound
  } }
```
- Any choreography works; it still sets voice pace and style, music energy, ducking, stage, transitions.
- Keep the scene's moments in `cues`, keyed to narration words, so the picture moves with the voice
  and re-voicing re-times it. Never hard-code seconds that should follow a word.
- `signage` must list every word the scene puts on screen: the word budget and caption check apply.

## The component side
```tsx
import React from "react";
import { AbsoluteFill, CustomSceneProps, cue, prog, lerp, typeStyle, useCurrentFrame, useLayout, useTheme } from "../../../src/custom/kit";

type Props = { mode: "add" | "uneven" };

const HashRing: React.FC<CustomSceneProps<Props>> = ({ cues, props, accent, durationInFrames }) => {
  const frame = useCurrentFrame();             // segment-relative
  const { p, line } = useTheme();               // palette and line colours, both themes
  const { safe, scale } = useLayout();          // safe area; multiply every size by scale
  const tAdd = cue(cues, "add", 60);            // fallback keeps Studio previews working
  const s = prog(frame, tAdd, 14, "snap");      // token curves: snap, glide, drift, exit
  …
};
export default HashRing;
```
Import only from `src/custom/kit.ts`. It re-exports what a scene may use: Remotion basics
(`AbsoluteFill`, `interpolate`, `spring`, `random`, `Sequence`), `@remotion/paths`, the theme
(`useTheme`, `useLayout`, `typeStyle`), tokens (`LAYOUT`, `TYPE`, `alpha`, `mix`, `LINE_COLORS`),
motion (`prog`, `lerp`, `ease`, `shake`), primitives (`RichText` for `{plates}`, `Heading`,
`StationDot`, `KindIcon`), `useSegment`/`useVideo`, `useNarration()` (every spoken word with its
frames, for type that moves with the voice) and `cue()`.

Files: `videos/<id>/scenes/<PascalCase>.tsx` (React) or `.js`/`.ts` (seekable script, below), default export. Helpers may live in the same folder and
be imported between scene files. `npm run sync` (run by studio, sheet, render) registers them; the
linter errors if a spec names a component that does not exist.

## Pure JavaScript scenes (GSAP, canvas, three.js)
When the animation is easier to write imperatively (a GSAP timeline, a canvas or WebGL loop,
three.js, a particle system, anime.js, Lottie), write the scene as plain JS or TS instead of React:
`videos/<id>/scenes/<Name>.js` (or `.ts`). Same spec, same `cues`, same registration; the
extension decides. The contract is HyperFrames' frame adapter: build once, then seek.

```js
import gsap from "gsap";
import { defineScene } from "../../../src/custom/script-kit";

export default defineScene({
  setup(ctx) {                                 // once; may be async (load an image, a model)
    const title = document.createElement("div");
    title.textContent = "Fan out";
    Object.assign(title.style, ctx.type("display"), { color: ctx.palette.text, position: "absolute",
      left: `${ctx.safe.x}px`, top: `${ctx.safe.y}px` });
    ctx.root.append(title);
    const tl = gsap.timeline({ paused: true })
      .from(title, { y: 80 * ctx.scale, opacity: 0, duration: 0.6, ease: "power3.out" }, ctx.cues.hit ?? 0);
    return { seek: (t) => tl.seek(t, false), destroy: () => tl.kill() };
  },
});
```
`ctx` gives `root` (draw here), `width`/`height`/`fps`/`duration`, `scale` and `safe`, the style's
`palette`, `line(color)`, `on(color)` and `type(role)`, `accent`, `cues` and `words` **in seconds**,
`props`, and `random(seed)`. Rules on top of the ones below:
- **`seek(t)` must be a pure function of t.** Frames render out of order and in parallel tabs. A
  paused GSAP timeline + `tl.seek(t, false)` is ideal; for canvas, redraw the whole frame from t.
  Never accumulate state per call, read the clock, or start rAF loops.
- Colours from `ctx.palette` / `ctx.line()`, sizes × `ctx.scale`, type from `ctx.type()`.
- `gsap` is installed; for three.js run `npm install three` first and import it in the scene.
- Reference: `videos/003-tail-latency/scenes/FanOut.js` (a GSAP fan-out with a live probability meter).

## Rules (the guardrail hook enforces the first three on save)
- **Colours from the theme**: `p.*` and `line(color)`; never hex or rgb. Colour keeps its meaning
  (red = failure, green = the fix, orange = the focus).
- **Motion from the frame**: everything is a function of `useCurrentFrame()`; no CSS
  transitions or animations.
- **Deterministic**: no `Math.random()`; use `random(seed)` or a hash. The same frame always renders the same.
- **Type from the scale**: `typeStyle(role, scale)`; sizes × `scale`; content inside `safe`.
  Signage, not captions: a few words that name the idea.
- **Show real mechanics**: when the scene illustrates a computation (hashing, sharding, a queue),
  compute it in the component and show the true result ("97 of 120"), and put the numbers in `brief.md`.
- **Both themes**: check `npm run sheet -- <id> --theme light` too.
- **Continuity**: when consecutive segments use the same component, start each where the last
  ended (same positions, same colours) so the cut reads as one continuous shot.

## Review
`npm run check -- <id>`, then `npm run sheet -- <id>`. The sheet samples cue frames; add
`--at m:ss` for the in-between moments of a custom animation (mid-flight, mid-morph). The text
probe checks custom scenes too: clipped, unsafe, overlapping.
