# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["numpy>=1.26", "soundfile>=0.12", "pyloudnorm>=0.1.1"]
# ///
"""
Cloned-voice references: scaffold and check.

    npm run voice-ref -- <name>          # first run: creates library/voice/<name>/ with a recording guide
    npm run voice-ref -- <name>          # after recording: checks every reference, prints what to fix

A cloned voice is one short recording per delivery style. Qwen3-TTS's clone mode copies timbre AND
delivery from the reference (it takes no style instruction), so a beat marked `urgent` is cloned
from your urgent take, `excited` from your excited take, and so on.

    library/voice/<name>/
      voice.json      model, language, consent, which recording serves which style   (commit it)
      calm.txt        the exact words of calm.wav; it starts as a line for you to read (commit it)
      calm.wav        your recording                                                  (git-ignored)
      urgent.* excited.* serious.*  likewise
      README.md       how to record

Use it in a spec with  "voice": { "engine": "qwen3", "voice": "clone:<name>" }.
"""
from __future__ import annotations

import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "library" / "voice"

LINES = {
    "calm": "Let's slow down and look at what actually happens. A request arrives, the server checks its cache, "
    "and only then does it go to the database. Simple, and it works most of the time.",
    "urgent": "Nine p.m. One key expires. Thirty seconds later, your database is down, "
    "and every second it stays down, the queue gets longer.",
    "excited": "And here's the fix. One request goes to the database, everyone else waits for that answer, "
    "and the whole stampede becomes a single query.",
    "serious": "Nothing in the cache was broken. It simply expired, for everyone, at the same moment. "
    "That is the part nobody plans for.",
}

GUIDE = """# Cloned voice: {name}

Record one take per style below. Each take is the voice the narrator will use for beats in that style.

## How to record
- Quiet room, soft furnishings, no music or fan. Phone voice memo is fine; a USB mic is better.
- 15–20 cm from the mic, slightly off-axis. Same mic and room for every take.
- Read the line in the matching `.txt` file, in that style, at your natural pace. 8–20 seconds.
- If you change the words, change the `.txt` to match exactly: the clone aligns audio to text.
- Export WAV (or FLAC), 24 kHz or higher, and save it next to the `.txt` (`calm.wav`, `urgent.wav`, …).
- Run `npm run voice-ref -- {name}` and fix anything it flags.

## Styles
| file | deliver it | used for |
|---|---|---|
| calm.wav | relaxed, explaining to a colleague | build, flow, calm, neutral and warm beats (and the fallback) |
| urgent.wav | leaning forward, a slight urgency, crisp | hooks, failures |
| excited.wav | bright, a smile in the voice, "this is the good part" | fixes, payoffs |
| serious.wav | slower, weight on the key words | insights, deep dives, myths |

Only `calm` is required; missing styles fall back (urgent ↔ excited, everything else → calm).

## Privacy and consent
The recordings are git-ignored: anyone with them could clone this voice. Only clone a voice you have
the right to use. Consider YouTube's "altered or synthetic content" disclosure for cloned narration.
"""


def scaffold(name: str) -> None:
    folder = LIB / name
    folder.mkdir(parents=True, exist_ok=True)
    cfg = {
        "name": name,
        "model": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        "language": "English",
        "consent": "My own voice, recorded by me for this channel.",
        "fallback": "calm",
        "refs": {style: {"audio": f"{style}.wav", "text": f"{style}.txt"} for style in LINES},
    }
    (folder / "voice.json").write_text(json.dumps(cfg, indent=2) + "\n")
    for style, line in LINES.items():
        (folder / f"{style}.txt").write_text(line + "\n")
    (folder / "README.md").write_text(GUIDE.format(name=name))
    rel = folder.relative_to(ROOT)
    print(f"created {rel}/ (voice.json, README.md, a line to read per style)")
    print(f"next: record {', '.join(f'{s}.wav' for s in LINES)} into {rel}/ (see README.md), then run this again")


def words(s: str) -> list[str]:
    return [w for w in re.sub(r"[^a-z0-9' ]", " ", s.lower()).split() if w]


def transcribe(path: Path) -> str | None:
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError:
        return None
    global _W
    try:
        _W  # noqa: B018
    except NameError:
        _W = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, _ = _W.transcribe(str(path), language="en", beam_size=5)
    return " ".join(s.text for s in segs)


def check(name: str) -> int:
    folder = LIB / name
    cfg = json.loads((folder / "voice.json").read_text())
    problems = 0
    usable = []
    print(f"clone:{name}  ({cfg.get('model')})\n")
    for style, ref in cfg.get("refs", {}).items():
        audio, text = folder / ref["audio"], folder / ref["text"]
        notes: list[str] = []
        level = "ok"

        def bad(msg: str) -> None:
            nonlocal level
            level = "FIX"
            notes.append(msg)

        def meh(msg: str) -> None:
            nonlocal level
            if level == "ok":
                level = "warn"
            notes.append(msg)

        if not audio.exists():
            others = [p.name for p in folder.glob(f"{style}.*") if p.suffix.lower() in (".m4a", ".mp3", ".aiff", ".ogg")]
            msg = f"not recorded ({ref['audio']})" + (f"; found {others[0]}: export it as WAV" if others else "")
            print(f"  {style:8s} —     {msg}")
            continue
        if not text.exists() or not text.read_text().strip():
            bad(f"{ref['text']} is missing or empty")
        try:
            x, sr = sf.read(audio, dtype="float32", always_2d=True)
        except Exception as e:  # noqa: BLE001
            print(f"  {style:8s} FIX   cannot read {audio.name}: {e}")
            problems += 1
            continue
        x = x.mean(axis=1)
        dur = len(x) / sr
        if dur < 3 or dur > 30:
            bad(f"{dur:.1f}s long; keep it 8–20 s")
        elif dur < 8 or dur > 20:
            meh(f"{dur:.1f}s; 8–20 s clones best")
        if sr < 16_000:
            bad(f"{sr} Hz; record at 24 kHz or higher")
        clipped = float(np.mean(np.abs(x) > 0.99))
        if clipped > 0.001:
            bad(f"clipping ({clipped:.2%} of samples); lower the input gain")
        frame = int(0.05 * sr)
        rms = np.sqrt(np.mean(x[: len(x) // frame * frame].reshape(-1, frame) ** 2, axis=1) + 1e-12)
        floor_db = 20 * np.log10(np.percentile(rms, 10))
        if floor_db > -45:
            meh(f"noise floor {floor_db:.0f} dBFS; a quieter room helps")
        try:
            import pyloudnorm as pyln

            lufs = pyln.Meter(sr).integrated_loudness(x)
            if lufs < -30 or lufs > -12:
                meh(f"{lufs:.0f} LUFS; aim for −24 to −16")
        except Exception:  # noqa: BLE001
            lufs = float("nan")
        heard = transcribe(audio) if text.exists() else None
        if heard is not None:
            ratio = SequenceMatcher(None, words(text.read_text()), words(heard)).ratio()
            if ratio < 0.85:
                bad(f"words differ from {ref['text']} ({ratio:.0%} match); heard: \"{heard.strip()[:80]}…\"")
        if level == "FIX":
            problems += 1
        else:
            usable.append(style)
        print(f"  {style:8s} {level:5s} {dur:5.1f}s {sr // 1000:>3d} kHz  {'; '.join(notes) or 'good'}")

    print()
    if "calm" not in usable and cfg.get("fallback", "calm") not in usable:
        print("The fallback style (calm) is not usable yet; it is required.")
        problems += 1
    if usable and not problems:
        print(f'Ready. In a spec: "voice": {{ "engine": "qwen3", "voice": "clone:{name}" }}, then npm run voice -- <id>')
    return 1 if problems else 0


def main() -> None:
    if len(sys.argv) < 2 or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", sys.argv[1]):
        sys.exit("usage: npm run voice-ref -- <name>   (lowercase, e.g. paras)")
    name = sys.argv[1]
    if not (LIB / name / "voice.json").exists():
        scaffold(name)
        return
    sys.exit(check(name))


if __name__ == "__main__":
    main()
