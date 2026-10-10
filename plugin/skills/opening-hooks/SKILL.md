---
name: opening-hooks
description: Catalogue of opening hooks for 3–4 minute system design videos, with narration templates, visual treatments and payoff rules. Use when proposing hooks at the brief gate or writing the first segment.
---

# Opening hooks

A hook is a promise. The first 15 seconds decide whether a viewer stays; the rest of the video must
pay the promise off, and the outro closes the loop. YouTube viewers chose the video from its title and
thumbnail, so **the hook confirms that choice and raises the stakes** — it does not repeat the title.

Rules
- On screen within the first second. First spoken words within ~0.6 s.
- One idea, one image. Two short lines of signage at most.
- Concrete beats abstract: a time, a number, a failure, a named situation.
- No clickbait the video does not pay off. Illustrative numbers are framed as "your system", never as a real incident unless the brief cites one.
- Vary the pattern across videos. Check the last two videos' hooks before choosing.
- The `insight` segment answers the hook. The `outro` line echoes it.
- **The hook must look and sound unlike the rest.** A `cold-open` statement is centred and slams in
  with pulsing rings and a flash; the music drops in on its first impact. Do not follow it with
  another statement slide: the next segment is a `stat`, a diagram, or a `myth` (strike-through).
- **Deliver it with urgency, not monotone.** Short sentences, a `rush` on the impact line, a pause after
  it, then a question that opens a loop. Qwen3-TTS (the default) delivers `urgent` and `excited`;
  Kokoro drafts can only do it with pace and pauses.

| pattern | narration template | visual | choreo / scene |
|---|---|---|---|
| **The outage** | "Nine p.m. One {thing} {happens}. Thirty seconds later, {consequence}. Nothing was deployed. So what happened?" | two lines; consequence on a red plate; red underline | `cold-open` / statement |
| **The impossible number** | "{Company or 'your system'} handles {huge number} {unit} a second. A single server does {small number}." | number counts up, bars compare | `big-number` / stat |
| **The interview trap** | "'Design {system}.' Most candidates start with {obvious}. [pause] That's the wrong place to start." | strike the obvious, plate the right answer | `myth` / statement |
| **The myth** | "Everyone says {common advice}. [pause] It's half right, and the other half is how {systems} fall over." | struck line → replacement line | `myth` / statement |
| **The everyday mystery** | "{Everyday thing} just works. [pause] Behind it, {surprising machinery}." | the system in one silhouette diagram, a single flow | `cold-open` / diagram |
| **The trade-off** | "{A} and {B} both {do the job}. They were built for opposite worlds." | two lines in two colours, verdict later | `cold-open` / statement or compare |
| **The cost** | "This one {setting/line} decides whether {outcome}." | code scene, one highlighted line | `cold-open` / code |
| **The failure first** | "This is what {failure} looks like." (then show it on the diagram) | the diagram already built, one node dies | `failure` / diagram |

After the hook, give the promise in one beat (often the `myth` or a short statement):
"By the end, you'll know {what they will be able to explain}."

When proposing hooks at Gate 1, give three, each as: the narration line, the two lines of on-screen
signage, and the scene + choreo. Recommend one and say why it fits this topic.
