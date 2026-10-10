---
name: script-writing
description: Narration rules for the channel — voice, structure, pacing, deliberate pauses, cue marks and the split between what is said and what is shown. Use when writing or editing script.md or the `say` text of beats.
---

# Script writing

## Voice
- American English, one male narrator (Qwen3-TTS speaker `Aiden` by default; Kokoro `am_michael` for
  drafts). Confident and plain, but alive: urgent in the hook, excited when the fix lands, slow and
  serious on the key claim. Never hype, never robotic.
- Talk to one engineer: "you", "your database". Short sentences. One idea per sentence.
- Concrete over abstract: "the home feed, read thousands of times a second" beats "a popular resource".
- Say numbers as words ("fifty thousand"), expand abbreviations TTS mangles: "for example" not
  "e.g.", "database" not "DB", "p ninety-nine" not "p99", "nine p.m." not "21:00".
- No parentheses, no slashes, no emoji. Code identifiers only when you would say them aloud.
- Tech terms the narrator mispronounces go in `library/pronunciation.json` once ("nginx" → "engine x"),
  not misspelled in the script. It applies to narration only; on-screen text keeps the real spelling.

## Structure (3–4 minutes, 450–600 spoken words)
| part | share | job |
|---|---|---|
| hook | 5–15 s | the promise and the stakes (see `opening-hooks`) |
| promise / myth | 5–10 s | what they will understand, or the belief you will correct |
| chapter 1 | ~25% | how the thing works (build the system on screen). Open with its question: "What is cache-aside?" |
| chapter 2 | ~25% | how it breaks, or where the trade-off bites: "Why does it collapse?" |
| chapter 3 | ~25% | how to fix it or choose; real tools, real names: "How do we stop it?" Each fix is named on screen |
| insight | 5–10 s | the one sentence to remember; answers the hook |
| recap | 10–15 s | three takeaways, one per beat |
| outro | 8–12 s | echo the hook line, then the call to action ("follow for more system design") |

## Pacing and delivery — the channel's signature
Evenly paced narration is monotonous. Vary it on purpose; the choreography sets a default per
segment (see `choreography`), and a beat can override it:
- `"pace"`: `"rush"` for the hook's impact line, `"brisk"` for setup and lists, `"slow"` for the key
  claim, `"normal"` elsewhere. Adjacent beats should not all share one pace.
- `"style"`: `urgent` (hook, failure), `excited` (the fix, a payoff), `serious` (the claim), `calm`,
  `warm`, `neutral`. Qwen3-TTS turns it into a delivery instruction; on Kokoro drafts it is ignored, so write for it anyway: short sentences and
  pauses carry urgency, a question carries curiosity.
- **The hook is short, punchy sentences**: "Nine p.m. [pause 0.2] One cache key expires." Then the
  impact, faster. Then a question that pulls the viewer in ("So what happened?").
- **Deliberate pauses** with `[pause]` (0.5 s) or `[pause 0.8]`: after the hook's first claim, before
  the key phrase of an insight, between steps of a mechanism, after a failure lands. The picture holds
  during a pause too (the compiler inserts the silence; nothing new appears unless you cue it).
- One beat = one breath, usually one or two sentences. Long beats make static pictures.

## Cues: where picture meets voice
Mark the words a visual should land on: `{words|cue-id}`. Cue ids are lowercase, unique within the
segment, and read well: `c-cache`, `c-expire`, `c-flood`. Put the cue on the word that names the
thing, not on "the" before it. Every visual action in the spec points at a cue, a beat, or `start`.

## Said vs shown
On-screen text is **signage, not captions**. It names the idea in two to six words while the voice
explains it. If a line of on-screen text appears word for word in the narration, the linter warns:
rephrase one of them. Good pair:
- said: "Nothing in the cache was broken. [pause 0.5] It simply expired, for everyone, at the same moment."
- shown: "The cache didn't break." / "It expired for {everyone|red}."

## script.md format
One block per segment, in order:

```
## hook — cold-open · statement
SAY (brisk, urgent): Nine p.m. [pause 0.2] One cache key expires. [pause 0.4]
SAY (rush, urgent): Thirty seconds later, your database is {down|c-down}. [pause 0.5]
SAY (normal, excited): Nothing was deployed. Nothing was misconfigured. [pause 0.3] So what happened?
SHOW: "One key expires." / "The {database|red} dies." — red underline
```
