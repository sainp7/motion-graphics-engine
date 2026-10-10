# ADR-0001: Visual direction — the system is a transit map

Status: accepted · 2026-10-10

## Context
The channel explains system design in 3–4 minute videos. The visuals must be clear first, look like
one studio across hundreds of videos, work in dark and light, and centre on diagrams. A POC that
animated every narrated word as on-screen text was distracting.

## Decision
- **Metaphor**: components are stations, connections are tracks, requests are packets riding coloured
  lines that stay painted behind them. Octilinear tracks (horizontal, vertical, 45°), rounded bends,
  station rings, line bullets for chapters, a line-wipe transition.
- **Colour carries meaning** (blue primary path, orange focus, green healthy/fix, red failure, violet
  async, yellow latency/cost, teal secondary path). Never decorative.
- **Themes**: dark "night map" (`#0E1626` ink) by default, light "paper map" (`#F3F5F9`), same meanings.
  Chosen per video; never switched mid-video.
- **Type**: Overpass (descended from US highway signage — wayfinding fits the metaphor) with Overpass
  Mono only for literal code. Bundled from npm, so renders are offline and reproducible. Ten families
  were rendered side by side on the night background before choosing.
- **Text is signage, not captions** (ADR-0003).
- **Icons**: Lucide (ISC), one per node kind, a small fixed vocabulary.

## Consequences
Diagrams are the hero and get the most engineering (camera, flows, failure states, continuity across
segments). Anything decorative needs a reason to exist. New colours or fonts require a token change and
a gallery check in both themes.
