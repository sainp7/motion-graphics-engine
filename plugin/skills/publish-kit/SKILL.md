---
name: publish-kit
description: Write the YouTube upload kit for a finished video — titles, description with chapters and sources, tags, pinned comment and thumbnail check. Use after the final render, or when the user asks for titles or a description.
---

# Publish kit

Run `npm run publish-kit -- <id>`. It regenerates the chapter block in `videos/<id>/publish.md` from
the real timeline and renders `out/<id>/thumbnail.png`. Then fill in the rest:

## Title (three options, ≤ 60 characters)
- Promise + curiosity, in the viewer's words: "Why one expiring key can take down your database".
- The title, thumbnail and hook tell one story at three zoom levels; none repeats another verbatim.
- No claim the video does not pay off. No ALL CAPS, no emoji walls.

## Description
1. Two or three lines: what the viewer will understand.
2. Chapters (generated; first at 0:00, at least three — YouTube's rule for showing them).
3. Sources from `brief.md`, as plain links.
4. One line about the channel: system design, explained in a few minutes.

## Tags
8–12: the topic, its synonyms (cache stampede, thundering herd, dogpile), the tools named, "system design".

## Pinned comment
A question that invites real answers: "Have you hit a stampede in production? What fixed it?"

## Thumbnail
`spec.thumbnail.lines` (1–3 lines, ≤ 5 words total, one plate). Check `out/<id>/thumbnail.png` at
small size: readable at 160 px wide? Same story as the title?

## Upload checklist (in publish.md)
Watched once at phone size · title/thumbnail agree · chapters pasted · end screen and cards added ·
YouTube's "altered or synthetic content" setting reviewed (it targets realistic depictions of real
people, places or events; check the current policy wording for an AI narrator).
