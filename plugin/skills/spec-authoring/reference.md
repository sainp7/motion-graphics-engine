# Spec reference

Authoritative definitions: `src/spec/schema.ts`. Defaults shown are applied by the compiler.

## Video
| field | type | default | notes |
|---|---|---|---|
| `version` | `1` | — | required |
| `id` | id | — | matches the folder name |
| `title` | string | — | working title |
| `format` | `landscape` \| `portrait` | `landscape` | 1920×1080 now; portrait principles in ADR-0005 |
| `theme` | `dark` \| `light` | `dark` | |
| `fps` | `30` \| `60` | `30` | |
| `voice` | `{engine, voice, speed}` | qwen3, Aiden, 1 | engines: qwen3, kokoro, elevenlabs, say, espeak, estimate; `voice` is a Qwen speaker or Kokoro voice |
| `music` | `{track, volume}` | transit-drive, 0.22 | `track: null` for none; `house-night-transit` for a calm bed; tracks in `library/music/manifest.json` |
| `lines` | `{name: {color, label}}` | `{}` | named flows, shown in diagram legends |
| `diagrams` | `{name: {nodes, edges, groups}}` | `{}` | see diagram-authoring |
| `thumbnail` | `{lines[1–3], line}` | — | 1280×720 still `thumb-<id>` |
| `segments` | Segment[] | — | |

## Segment
```json
{ "id": "stampede", "choreo": "failure", "chapter": "The stampede",
  "beats": [{ "id": "expire", "say": "At nine p.m., its TTL {runs out|c-expire}. [pause 0.4]", "pace": "slow", "style": "serious", "pauseAfter": 0.6 }],
  "scene": { "type": "diagram", "diagram": "cache", "actions": [] },
  "hold": 0.5, "transition": "fade", "sfx": true }
```
Beat `pace` is `slow | normal | brisk | rush`; `style` is `neutral | calm | serious | urgent | excited | warm`.
Both default from the choreography (the first beat of a `cold-open` rushes). Changing either re-voices the beat.
`chapter` (optional) starts a YouTube chapter. `hold` adds seconds after the choreography's tail.
`transition` overrides the choreography's exit (`cut | fade | line-wipe`). `sfx: false` silences
automatic sound effects for the segment.

## statement
```json
{ "type": "statement",
  "lines": ["A cache keeps you ~~safe~~.", "It keeps you {fast|green}."],
  "reveal": ["b1", "c-speed"], "size": "lg", "align": "left",
  "underline": "red", "note": "Source: Nishtala et al., NSDI 2013",
  "actions": [{ "at": "c-not", "do": "strike" }, { "at": "c-x", "do": "dim-line", "index": 0 }] }
```

## stat
```json
{ "type": "stat", "value": 50000, "from": 0, "decimals": 0, "prefix": "$", "suffix": "reads/s",
  "label": "absorbed by {the cache|blue}", "at": "b1", "countSeconds": 1.2, "line": "orange",
  "bars": [{ "label": "Database capacity", "value": 5000, "line": "green", "at": "c-cap" }],
  "note": "Illustrative numbers" }
```

## diagram
```json
{ "type": "diagram", "diagram": "cache", "title": "Cache-aside", "legend": true, "fresh": false,
  "actions": [
    { "at": "c-api", "do": "show", "targets": ["api"] },
    { "at": "start+0.2", "do": "flow", "path": ["users", "api", "cache"], "line": "read", "label": "GET /feed" },
    { "at": "c-hit", "do": "badge", "target": "cache", "text": "HIT", "line": "green", "until": "end" },
    { "at": "c-never", "do": "dim", "targets": ["db", "api-db"] },
    { "at": "c-flood", "do": "flow", "path": ["api", "db"], "line": "herd", "stream": true, "speed": 1.6 },
    { "at": "c-dead", "do": "fail", "targets": ["db"] },
    { "at": "c-zoom", "do": "focus", "targets": ["cache"], "zoom": 1.6 },
    { "at": "c-back", "do": "fit" },
    { "at": "c-x", "do": "sfx", "sound": "chime" }
  ] }
```
Edge ids default to `"<from>-<to>"` (e.g. `api-db`) and can be targets of show/hide/dim/highlight.

## sequence
```json
{ "type": "sequence", "title": "Thousands of misses, one row",
  "actors": [{ "id": "a", "label": "Request A", "kind": "client" }, { "id": "db", "label": "Database", "kind": "db" }],
  "messages": [
    { "from": "a", "to": "db", "label": "SELECT feed", "code": true, "line": "orange", "at": "c-a" },
    { "from": "db", "to": "a", "label": "rows", "style": "dashed", "line": "green", "at": "c-a+0.8", "badge": { "text": "200ms", "line": "yellow" } }
  ] }
```

## compare
```json
{ "type": "compare",
  "left":  { "title": "Serve stale", "line": "yellow", "at": "start", "items": [{ "text": "Instant answer", "verdict": "pro", "at": "c-1" }] },
  "right": { "title": "Add jitter",  "line": "violet", "at": "c-jit", "items": [{ "text": "TTL = 60s ± random", "verdict": "neutral" }] },
  "verdict": { "side": "right", "text": "Use both", "at": "c-v" } }
```
`verdict` per item: `pro` (green check), `con` (red cross), `neutral` (dash).

## list
```json
{ "type": "list", "title": "The short version", "numbered": false, "line": "green",
  "items": [{ "text": "Hot keys expire {all at once|red}", "detail": "Optional second line", "at": "b2" }] }
```

## chapter
```json
{ "type": "chapter", "number": 2, "title": "Why does it collapse?", "short": "The stampede", "subtitle": "When one key expires for everyone", "line": "red" }
```
The title asks the chapter's question (≤ 32 chars). Every chapter scene appears on a route map at the
bottom (past travelled, this one lit, the rest ahead) labelled with `short` (≤ 22 chars, defaults to
the title), plus a "Part 2 of 3" kicker.

## code
```json
{ "type": "code", "heading": "Fix 1: {coalesce|green} the misses", "title": "feed.go", "lines": ["var feeds singleflight.Group"],
  "actions": [{ "at": "c-sf", "do": "highlight", "lines": [1, 1], "line": "violet" }, { "at": "c-x", "do": "reset" }] }
```
`heading` (≤ 40 chars, plates allowed) is large signage above the panel naming what the code does; `title`
is the small file name inside it. Diagrams take `heading` too: it sits top-left and the camera frames the
diagram below it.

## outro
```json
{ "type": "outro", "text": "One key. {One query.} No stampede.", "handle": "@sainp7",
  "cta": "Follow for more system design", "next": "Rate limiting, with a token bucket" }
```
The handle and CTA appear on the second beat.

## Sounds (for `sfx` actions)
tick, tock, pop, blip, whoosh, swish, hit, riser, glitch, chime, snap — see `library/sfx/manifest.json`.
