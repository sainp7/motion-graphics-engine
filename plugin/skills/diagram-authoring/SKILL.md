---
name: diagram-authoring
description: How to lay out and choreograph architecture diagrams (stations, tracks, coloured flows, failures, camera) in a video spec. Use when writing `diagrams` or `diagram` scene actions.
---

# Diagrams: the system as a transit map

## Grid and layout
- Positions are **grid units**; the frame shows 16 × 9 units at zoom 1 (1 unit = 120 px). `at` is the
  station's centre. The camera auto-fits everything that will be visible in the segment, up to 1.45×,
  so a compact layout reads bigger.
- Flow reads **left to right**: clients on the left, data stores on the right, middle tiers between.
  Put alternatives (cache vs database, replicas) above and below each other.
- Spacing: ≥ 4 units between centres horizontally, ≥ 2.2 vertically. The linter errors on stations
  that touch. Labels ≤ 18 chars, `sub` ≤ 26 (e.g. "Redis", "Postgres, primary").
- ≤ 9 stations visible at once. Bigger systems: split into two diagrams, or `focus` on a region.
- Tracks route octilinearly (horizontal, vertical, 45°). A diagonal appears when the horizontal gap
  between stations is at least the vertical offset; otherwise you get a rounded elbow. Use
  `"lane": 1 / -1` for parallel request/response tracks, `"style": "dashed"` for async edges.
- `kind` picks the icon: client, mobile, browser, user, users, dns, cdn, lb, gateway, service, server,
  worker, cache, db, replica, queue, stream, storage, search, auth, cron, metrics, cloud, generic.

## Choreographing a diagram across segments
Segments that use the same `diagram` **continue it**: stations stay where they were, failures stay
failed, painted lines settle into a faint residue, and highlights/dims/badges reset at the boundary.
Use `"fresh": true` to start empty. A typical arc: `build` (show stations one by one, on cues) →
`flow` (the happy path) → `flow` (the other path) → `failure` → `flow` (the fix).

| action | does | notes |
|---|---|---|
| `show` / `hide` | stations, edges, groups appear | edges and groups appear with their stations unless you show them explicitly |
| `flow` | packets ride a line along `path` (node ids), painting it | consecutive nodes must share an edge; `line` names a flow; `packets` 1–12; `stream` until the segment ends; `persist: false` fades it; `label` rides the first packet (`"GET /feed"`) |
| `highlight` | ring + accent on targets | implies not dimmed |
| `dim` | fade everything except `except` (or just `targets`) | the focus device |
| `reset` | clears highlight, dim, badges | |
| `clear-lines` | erase painted lines (optionally one colour) | start a new story on the same map |
| `fail` / `recover` | red, shake, glitch / green ping | |
| `badge` | a short state plate on a station: HIT, MISS, TTL 60s, ×1000 | ≤ 14 chars; `until` to remove |
| `pulse` | a ping ring | attention without changing state |
| `focus` / `fit` | camera to targets / back to everything | `zoom` 0.7–2.2 for focus |

## Good practice
- One new thing per cue. Let the narration name it as it appears.
- Flows carry the story; badges name the state; colour names the path. Do not label what a colour already says.
- Name lines in `spec.lines` so the legend explains them.
- Failures: `clear-lines` at start, stream the normal traffic, then stream the overload in red and `fail` the victim. Hold after it (`failure` choreo does).
