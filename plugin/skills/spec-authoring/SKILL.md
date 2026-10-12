---
name: spec-authoring
description: How to write videos/<id>/spec.json — the JSON contract the renderer plays — including segments, beats, cues, every scene type and the check loop. Use whenever creating or editing a video spec.
---

# Writing the spec

The renderer plays any valid spec; new videos never need new code. The schema is
`src/spec/schema.ts` (JSON schema in `schema/video-spec.schema.json`; every field has a description).
Full field reference with examples: [reference.md](reference.md). Two complete examples to copy from:
`videos/001-cache-stampede/spec.json` (a real episode) and `src/gallery/gallery-spec.ts` (every scene type).

## Shape
```jsonc
{
  "$schema": "../../schema/video-spec.schema.json",
  "version": 1, "id": "002-rate-limiting", "title": "…",
  "theme": "dark",
  "voice": { "engine": "qwen3", "voice": "Aiden", "speed": 1 },
  "music": { "track": "transit-drive", "volume": 0.22 },
  "lines": { "read": { "color": "blue", "label": "Read path" } },     // named flows for the legend
  "diagrams": { "main": { "nodes": [], "edges": [], "groups": [] } },  // see diagram-authoring
  "thumbnail": { "lines": ["Two short", "{lines}"], "line": "orange" },
  "segments": [ { "id": "hook", "choreo": "cold-open", "chapter": "…optional…", "beats": [], "scene": {} } ]
}
```

## Audio-first timing
You never write durations. Each segment lasts: choreography lead-in + its beats (real narration
length after `npm run voice`, estimated before) + gaps + tail + optional `"hold"`. Visuals hang off
**cue references**:
- `"start"`, `"end"` — segment start, and the moment its exit begins
- `"c-cache"` / `"c-cache.end"` — a `{words|c-cache}` mark in this segment's narration
- `"b2"` / `"b2.end"` — the second beat (or a beat's own `"id"`)
- any of those `+/-` seconds: `"c-flood+1.2"`, `"end-0.5"`

Defaults when you omit timing: statement lines and list items with as many beats as items appear one
per beat; otherwise they spread across the narration. Prefer explicit cues for anything that matters.

## Scene types — pick by what the viewer must see
| scene | use for | key fields |
|---|---|---|
| `statement` | hook lines, myths, insights | `lines[]` (1–4, signage), `reveal[]`, `underline`, `actions: strike` |
| `stat` | a number with stakes | `value`, `suffix`, `label`, `at`, `bars[]` |
| `diagram` | architecture, flows, failures | `diagram`, `title` or `heading`, `actions[]` (show, flow, highlight, dim, fail, badge, focus…) |
| `sequence` | a request's life over time | `actors[]` (2–5), `messages[]` (≤ 9, each with `at`) |
| `compare` | two approaches, trade-offs | `left`/`right` {title, line, items[{text, verdict}]}, `verdict` |
| `list` | recap, steps | `title`, `items[]` (≤ 6), `numbered` only for real sequences |
| `chapter` | section marker | `number`, `title` (a question), `short` (route-map label), `subtitle`, `line`; set segment `chapter` |
| `code` | literal code or config | `heading` ("Fix 1: …"), `title` (file name), `lines[]` (≤ 14, ≤ 64 chars), `actions: highlight [from,to]` |
| `outro` | close the loop + CTA | `text`, `handle` (`@sainp7`), `cta`, `next` |
| `custom` | a signature moment the library cannot draw (see `custom-scenes`) | `component`, `props`, `cues`, `signage`, `actions: sfx` |

## The loop
1. Write or edit the spec. The guardrail hook runs `npm run check` on save and blocks on errors.
2. `npm run check -- <id>`: read the timeline table and every ▲ warning. Fix, or accept with a reason.
3. `npm run sheet -- <id>`: look at the frames (`visual-qa`).
4. After `npm run voice`, repeat 2–3: real timing changes density and gaps.

## Common warnings and the fix
- *"… is read out word for word — that is a caption"* → rephrase the narration or the signage.
- *"nothing changes on screen for Xs"* → add a cued action, or split the segment.
- *"the screen is empty for the first Xs"* → reveal the first element at `"start"`.
- *"N words on screen"* → cut words; move detail into narration.
- *"line N has X characters"* → break the line or use a smaller `size`.
- *"four … scenes in a row"* / *"only N scene types"* → vary the visual form (monetisation risk).
