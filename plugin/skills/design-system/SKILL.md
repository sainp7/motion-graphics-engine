---
name: design-system
description: The studio's visual language — "the system is a transit map" — with colour meanings, type roles, layout, plates and what never to do. Use when choosing colours, sizes, text treatments or themes in a spec, or when changing components.
---

# Design system

**Direction (ADR-0001): the system is a transit map.** Components are stations, connections are
tracks, requests ride coloured lines and leave them painted behind them. Text is signage. The
source of truth is `src/design/tokens.ts`; components never hard-code colours, sizes or curves
(the guardrail hook rejects raw hex, rgb, CSS animations and `Math.random`).

## Themes
`"theme": "dark"` (night map, the default) or `"light"` (paper map). Same palette meanings in both.
Render the other one with `npm run render -- <id> --theme light`. A video never switches theme midway.

## Colour means something
| line | meaning | typical use |
|---|---|---|
| blue | the primary request path, reads, the happy path | `read` line, normal traffic |
| orange | the focus: the thing we're talking about now | plates by default, chapter 1, misses |
| green | healthy, success, cache hit, the fix | HIT badges, the fix line, recovered |
| red | failure, overload, the bug | stampede line, DOWN/TIMEOUT badges, failure plates |
| violet | asynchronous work: queues, events, background jobs | dashed async edges, workers |
| yellow | latency, cost, warnings | "STALE", "SLOW" badges, budgets |
| teal | secondary path: writes, replication, another region | write-back, replicas |

Define named lines in `spec.lines` (`"read": {"color": "blue", "label": "Read path"}`) and use the
names in flows; the legend shows them. Keep one meaning per colour for the whole video.

## Type (Overpass + Overpass Mono, bundled, offline)
Roles at 1080p: display 132, headline 96, title 64, body 44, label 32–35 (stations), caption 25,
micro 21 (badges), code 34–36, numeral 240 (stats). Statements pick `xl | lg | md` = display | headline | title.
Approximate line capacity at 1920 px: xl ≈ 22 characters, lg ≈ 31, md ≈ 47. The linter errors beyond that.
Mono is only for literal code, keys and requests (`GET /feed`, `feed:home`), never for generic labels.

## Plates
`{word}` puts a word on a filled badge in the segment accent; `{word|green}` picks the colour.
A plate marks **the one or two words that carry the idea** (≤ 2 per statement). Punctuation right after
a plate rides on it. `~~words~~` can be struck through with a `strike` action (myths).

## Layout
1920×1080, safe margins 120 px sides, 96 px top and bottom (the QA probe flags text outside them).
Statements and stats are left-aligned by default; `insight` centres. One focal point per frame:
when something new matters, the rest dims or holds still.

## Never
- captions (narration duplicated on screen), paragraphs, bullet lists of sentences
- decorative colour, gradients, glows, drop shadows
- more than one moving idea at a time
- all-caps labels other than short state badges (HIT, MISS, DOWN)
- new fonts, icon sets or colours without updating tokens and the gallery
