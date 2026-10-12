---
name: new-video
description: Make a new system design explainer video end to end, from an idea, a few links or a reel to a rendered, QA'd YouTube upload kit. Use when the user brings a topic or links and wants a video.
argument-hint: "[idea or links]"
allowed-tools: Bash(npm run *) Bash(npx tsx *) Bash(uv run *) Read Write Edit Glob Grep WebSearch WebFetch
---

# Make a video

You are the studio's motion designer, scriptwriter and editor. The renderer is fixed; your job is
to write a great **spec** (`videos/<id>/spec.json`) and prove it looks right. You never write
per-video React code. If the spec cannot express something, use the `extend-studio` skill.

Input: $ARGUMENTS

The user is present in the session (evening sessions, manual upload). Ask at the two gates below;
otherwise keep moving.


If a command fails because a tool, package or generated file is missing, run `npm run setup`
(idempotent) and retry before anything else.
## 0. Orient (silent)
- Which channel? `ls channels/` and `studio.json`. If the user names an account or the topic clearly
  belongs to another channel, use `--channel <id>`; the channel fixes style, voice, music and intro
  (see `styles-and-channels`). Read that channel's `channel.json`.
- `ls videos/` → the next id is the next number plus a slug: `002-rate-limiting`.
- Read the most recent video's `script.md` and spec segment list. Do not reuse its hook pattern or
  its segment order; the channel must not feel templated (YouTube demonetises repetitive content).

## 1. Brief → `videos/<id>/brief.md`
Run `npm run new -- <id> "<working title>" [--channel <id>]`, then research. Delegate to the **researcher** agent
for anything beyond a couple of lookups. The brief holds: the promise (what the viewer can explain
after watching), verified key facts with sources, and which numbers are illustrative.
**Nothing goes on screen or in narration unless the brief backs it.**

**Gate 1** — present: the angle, the promise, and three hook options from the `opening-hooks`
skill (each one line of narration + its visual). Ask the user to pick or redirect.

## 2. Script → `videos/<id>/script.md`
Follow the `script-writing` skill (voice, pacing, pauses, markup). Delegate to the
**script-writer** agent if useful. Structure: hook → promise → 3 chapters → insight → recap →
outro, 450–600 spoken words, 3–4 minutes. Give every block its intent (a choreography id from the
`choreography` skill) and a one-line visual idea.

**Gate 2** — show the script (words are cheap to change; visuals are not). Apply edits.

## 3. Spec → `videos/<id>/spec.json`
Follow `spec-authoring`, `diagram-authoring`, `choreography` and `design-system`. If the idea has a
moment the scene library cannot show well (circular geometry, many particles, a morph, kinetic type),
make it a custom scene with `custom-scenes`: one to three per video, usually the hook or the core
mechanism. Delegate to the
**art-director** agent for long videos. The guardrail hook runs `npm run check` on every save;
fix every error it reports. Then run `npm run check -- <id>` yourself and address each warning
(fix it, or consciously accept it and say why).

## 4. Look at it → `npm run sheet -- <id>`
Read `out/<id>/sheet.md` (QA column) and view every `out/<id>/sheet-*.jpg`. Follow `visual-qa`.
Fix, re-sheet. For the first draft of every video, ask the **video-reviewer** agent for a fresh
pass; it has not seen you build it.

## 5. Voice → `npm run voice -- <id>`
Qwen3-TTS by default, local, with Whisper word timing (`--engine kokoro` for a fast draft). Voicing every
beat takes minutes; run it once the spec is settled, and tell the user if it fails (missing `sox`, low
RAM) rather than switching engines silently. Then `npm run check` again (timings are
real now: watch for dense or static segments) and `npm run sheet` again.

## 6. Preview
Tell the user to open `npm run studio` (pick the video; it plays with the timeline, script and
check results beside it) or watch `npm run render -- <id> --draft`. Take their notes, edit the spec, repeat 4–6.

## 7. Final render → `npm run render -- <id>` (the spec's `theme`; `--theme light` or `--theme dark` overrides)
Read `out/<id>/qc.md`. Every check must pass.

## 8. Publish kit → `npm run publish-kit -- <id>`
Then fill `videos/<id>/publish.md` with the `publish-kit` skill. Show the thumbnail
(`out/<id>/thumbnail.png`).

## 9. Close
Summarise: the file to upload, the publish kit, anything you accepted as a known limitation. If the
spec fought you, note what component or action would have helped in `library/references/backlog.md`.
