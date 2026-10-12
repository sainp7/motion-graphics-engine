# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["numpy>=1.26", "soundfile>=0.12", "pyloudnorm>=0.1.1"]
# ///
"""
Narration synthesis — audio-first timing for the renderer.

Normally run through `npm run voice -- <video-id>`, which writes the narration manifest
(public/videos/<id>/narration.json) and calls this script with the right engine flags.

    uv run audio/tts.py public/videos/<id>/narration.json [--engine qwen3|kokoro|elevenlabs|say|espeak] [--voice Aiden] [--force]

For each beat it synthesises the text chunk by chunk, inserts the deliberate pauses marked
with [pause], finds the time of every word (engine timestamps when available, otherwise a
duration-scaled estimate), normalises loudness and writes:

    public/videos/<id>/narration/<beat-key>-<hash>.wav
    public/videos/<id>/timing.json        word and cue times the renderer syncs to

Each beat carries a speed (from its pace) and a delivery style (neutral, calm, serious, urgent,
excited, warm; from the segment's choreography unless the beat sets it). Engines that can act on
style do; the others ignore it and rely on pace and pauses.

Beats whose text, voice, speed and style are unchanged are reused (keyed by hash), so editing one
line only re-synthesises that line.

Engines
    qwen3       Qwen3-TTS 1.7B CustomVoice, local (Apple GPU via MPS, CUDA, or CPU), free, follows a
                natural-language delivery instruction per beat (STYLE_PROMPTS). Default speaker "Aiden".
                `--voice clone:<name>` clones your voice from library/voice/<name>/ (Base model,
                one reference recording per style; see `npm run voice-ref`).
                No timestamps of its own: words are timed by Whisper (faster-whisper) on the result.
                Needs `brew install sox`, ~8 GB free RAM; first run downloads ~4–5 GB of weights.
                Env: QWEN_TTS_MODEL, QWEN_TTS_DEVICE (mps|cuda:0|cpu), QWEN_TTS_SPEAKER, QWEN_TTS_SEED,
                QWEN_TTS_TEMPERATURE, WHISPER_MODEL (default small.en).
    kokoro      Kokoro-82M, local, free, fast, word timestamps. The reliable fallback. Needs: uv run --with
                "kokoro>=0.9.4" --with "misaki[en]" … and `brew install espeak-ng`. Voices: am_michael, am_adam …
                No emotion control: style is ignored, pace and pauses carry the delivery.
    elevenlabs  ElevenLabs API (paid for monetised use), expressive, character timestamps. Needs
                ELEVENLABS_API_KEY; voice id via voice.voice, --voice or ELEVENLABS_VOICE_ID; ELEVENLABS_MODEL.
    say         macOS built-in `say`. Zero install, fine for drafts.
    espeak      espeak-ng. Robotic; for CI and Linux drafts.

say and espeak have no timestamps; when faster-whisper is installed they are aligned by Whisper too,
otherwise word times are estimated from the chunk duration.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from difflib import SequenceMatcher
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf

TARGET_LUFS = -18.0
EDGE_SILENCE = 0.03  # seconds kept at chunk edges after trimming


# ---------------------------------------------------------------- shared helpers (mirror estimateBeat in src/spec/timing.ts)

def word_seconds(w: str) -> float:
    letters = len(re.sub(r"[^\w]", "", w))
    t = 0.11 + 0.056 * letters
    if re.search(r"[,;:]$", w):
        t += 0.17
    if re.search(r"[—–-]$", w):
        t += 0.2
    if re.search(r"[.?!][\"”’)]?$", w):
        t += 0.32
    if re.search(r"\d", w):
        t += 0.12 * letters
    return t


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


@dataclass
class Synth:
    audio: np.ndarray  # mono float32
    sr: int
    words: list[tuple[float, float]] | None  # per input word, seconds, or None if unknown


# ---------------------------------------------------------------- delivery styles

# Natural-language direction for instruction-following engines (Qwen3-TTS, ElevenLabs v3 tags).
STYLE_PROMPTS = {
    "neutral": "A clear, friendly explainer for a short educational video. Calm, confident and warm. Not dramatic.",
    "calm": "Calm and unhurried, like walking a colleague through a whiteboard. Clear and warm.",
    "serious": "Intrigued and leaning in, as if revealing a secret. A touch slower, weight on the key words. Not dramatic.",
    "urgent": "Energetic and punchy, like the first seconds of a viral explainer. Crisp, confident, a slight urgency.",
    "excited": "Excited and upbeat, like the moment something finally clicks. Bright and confident, never over the top.",
    "warm": "Friendly and warm, relaxed, talking to one person.",
}
# ElevenLabs v3 audio tags.
STYLE_TAGS = {"calm": "[calm]", "serious": "[serious]", "urgent": "[urgently]", "excited": "[excited]", "warm": "[warmly]"}
# ElevenLabs v2 voice settings: lower stability = more expressive; style = exaggeration.
STYLE_SETTINGS = {
    "neutral": {"stability": 0.5, "style": 0.15},
    "calm": {"stability": 0.65, "style": 0.05},
    "serious": {"stability": 0.6, "style": 0.12},
    "urgent": {"stability": 0.32, "style": 0.55},
    "excited": {"stability": 0.28, "style": 0.65},
    "warm": {"stability": 0.5, "style": 0.3},
}


# ---------------------------------------------------------------- engines

class Engine:
    name = "base"

    def synth(self, text: str, words: list[str], voice: str, speed: float, style: str = "neutral") -> Synth:  # pragma: no cover
        raise NotImplementedError


class KokoroEngine(Engine):
    name = "kokoro"

    def __init__(self) -> None:
        try:
            from kokoro import KPipeline  # type: ignore
        except ImportError:
            sys.exit(
                "Kokoro is not installed. Run through `npm run voice`, or:\n"
                '  uv run --with "kokoro>=0.9.4" --with "misaki[en]" audio/tts.py …\n'
                "and `brew install espeak-ng` for out-of-vocabulary words."
            )
        self.pipeline = KPipeline(lang_code="a")  # American English
        self.sr = 24_000

    def synth(self, text: str, words: list[str], voice: str, speed: float, style: str = "neutral") -> Synth:
        pieces: list[np.ndarray] = []
        tokens: list[tuple[str, float, float]] = []
        offset = 0.0
        if not voice.startswith(("am_", "af_", "bm_", "bf_")):
            voice = "am_michael"  # the spec names a voice for another engine
        for result in self.pipeline(text, voice=voice, speed=speed, split_pattern=r"\n+"):
            audio = result.audio
            if audio is None:
                continue
            a = audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio)
            for tok in getattr(result, "tokens", None) or []:
                s, e = getattr(tok, "start_ts", None), getattr(tok, "end_ts", None)
                if s is not None and e is not None:
                    tokens.append((tok.text, offset + float(s), offset + float(e)))
            pieces.append(a.astype(np.float32))
            offset += len(a) / self.sr
        audio = np.concatenate(pieces) if pieces else np.zeros(1, dtype=np.float32)
        return Synth(audio, self.sr, align(words, tokens) or align_fuzzy(words, tokens))


class SayEngine(Engine):
    name = "say"

    def synth(self, text: str, words: list[str], voice: str, speed: float, style: str = "neutral") -> Synth:
        if not shutil.which("say"):
            sys.exit("`say` is only available on macOS. Use --engine kokoro or espeak.")
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "o.wav"
            cmd = ["say", "-r", str(int(175 * speed)), "-o", str(out), "--file-format=WAVE", "--data-format=LEI16@24000"]
            if voice and not voice.startswith(("am_", "af_", "bm_", "bf_")):
                cmd += ["-v", voice]
            subprocess.run([*cmd, text], check=True)
            audio, sr = sf.read(out, dtype="float32")
        return Synth(mono(audio), sr, whisper_words(mono(audio), sr, words, text))


class EspeakEngine(Engine):
    name = "espeak"

    def synth(self, text: str, words: list[str], voice: str, speed: float, style: str = "neutral") -> Synth:
        exe = shutil.which("espeak-ng") or shutil.which("espeak")
        if not exe:
            sys.exit("espeak-ng not found (brew install espeak-ng / apt install espeak-ng).")
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "o.wav"
            v = "en-us" if voice.startswith(("am_", "af_")) else voice
            subprocess.run([exe, "-v", v, "-s", str(int(165 * speed)), "-w", str(out), text], check=True)
            audio, sr = sf.read(out, dtype="float32")
        return Synth(mono(audio), sr, whisper_words(mono(audio), sr, words, text))


class ElevenLabsEngine(Engine):
    """ElevenLabs text-to-speech with character timestamps (stdlib only, no SDK)."""

    name = "elevenlabs"
    DEFAULT_VOICE = "pNInz6obpgDQGcFmaJgB"  # "Adam", a premade voice; pick your own in the ElevenLabs voice library

    def __init__(self) -> None:
        self.key = os.environ.get("ELEVENLABS_API_KEY")
        if not self.key:
            sys.exit("Set ELEVENLABS_API_KEY to use the elevenlabs engine.")
        self.model = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
        self.sr = 24_000
        self.prev = ""  # previous chunk, sent as context so prosody flows across chunks

    def voice_id(self, voice: str) -> str:
        if voice and not voice.startswith(("am_", "af_", "bm_", "bf_")):
            return voice
        return os.environ.get("ELEVENLABS_VOICE_ID", self.DEFAULT_VOICE)

    def synth(self, text: str, words: list[str], voice: str, speed: float, style: str = "neutral") -> Synth:
        v3 = self.model.startswith("eleven_v3")
        prefix = f"{STYLE_TAGS[style]} " if v3 and style in STYLE_TAGS else ""
        body: dict = {"text": prefix + text, "model_id": self.model}
        if v3:
            # v3: delivery comes from the audio tag; stability 0 = "creative", 0.5 = "natural"
            body["voice_settings"] = {"stability": 0.0 if style in ("urgent", "excited") else 0.5,
                                      "speed": round(min(1.2, max(0.7, speed)), 2)}
        else:
            st = STYLE_SETTINGS.get(style, STYLE_SETTINGS["neutral"])
            body["voice_settings"] = {**st, "similarity_boost": 0.75, "use_speaker_boost": True,
                                      "speed": round(min(1.2, max(0.7, speed)), 2)}
            if self.prev:
                body["previous_text"] = self.prev
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id(voice)}/with-timestamps?output_format=pcm_24000"
        req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                     headers={"xi-api-key": self.key, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read())
        except urllib.error.HTTPError as e:
            sys.exit(f"ElevenLabs {e.code}: {e.read().decode(errors='replace')[:400]}")
        self.prev = text
        pcm = np.frombuffer(base64.b64decode(data["audio_base64"]), dtype="<i2").astype(np.float32) / 32768
        al = data.get("alignment") or data.get("normalized_alignment")
        tokens: list[tuple[str, float, float]] = []
        if al:
            chars, starts, ends = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
            cur, s0, e0 = "", 0.0, 0.0
            for i, (c, a, e) in enumerate(zip(chars, starts, ends)):
                if i < len(prefix):
                    continue  # the audio tag is not spoken
                if c.isspace():
                    if cur:
                        tokens.append((cur, s0, e0))
                    cur = ""
                    continue
                if not cur:
                    s0 = a
                cur += c
                e0 = e
            if cur:
                tokens.append((cur, s0, e0))
        return Synth(pcm, self.sr, (align(words, tokens) or align_fuzzy(words, tokens)) if tokens else None)


ROOT = Path(__file__).resolve().parent.parent
VOICE_LIB = ROOT / "library" / "voice"

# when a cloned voice has no reference for a style, the closest one stands in
CLONE_STYLE_FALLBACK = {
    "neutral": ["calm"],
    "warm": ["calm"],
    "serious": ["calm"],
    "calm": [],
    "urgent": ["excited"],
    "excited": ["urgent"],
}


def clone_name(voice: str) -> str | None:
    return voice[len("clone:"):] if voice.startswith("clone:") else None


def load_clone(name: str) -> dict:
    """library/voice/<name>/voice.json, with reference paths resolved and transcripts read."""
    folder = VOICE_LIB / name
    cfg_path = folder / "voice.json"
    if not cfg_path.exists():
        sys.exit(f"No cloned voice '{name}': create it with `npm run voice-ref -- {name}`.")
    cfg = json.loads(cfg_path.read_text())
    refs = {}
    for style, r in cfg.get("refs", {}).items():
        audio, text = folder / r["audio"], folder / r["text"]
        if audio.exists() and text.exists() and text.read_text().strip():
            refs[style] = {"audio": audio, "text": text.read_text().strip()}
    if not refs:
        sys.exit(f"Cloned voice '{name}' has no usable recordings yet. See {folder.relative_to(ROOT)}/README.md, then `npm run voice-ref -- {name}`.")
    cfg["_refs"] = refs
    return cfg


def voice_identity(voice: str) -> str:
    """What the cache compares: the voice name, plus a fingerprint of a cloned voice's recordings,
    so re-recording a reference re-voices the beats that used it."""
    name = clone_name(voice)
    if not name or not (VOICE_LIB / name / "voice.json").exists():
        return voice
    h = 0x811C9DC5
    folder = VOICE_LIB / name
    for f in sorted(folder.iterdir()):
        if f.suffix.lower() in (".json", ".txt", ".wav", ".flac"):
            for byte in f.name.encode() + f.read_bytes()[:: max(1, f.stat().st_size // 65536)]:
                h = ((h ^ byte) * 0x01000193) & 0xFFFFFFFF
    return f"{voice}#{h:08x}"


class Qwen3Engine(Engine):
    """Qwen3-TTS, two modes:
    - preset speaker (CustomVoice model, default "Aiden"): delivery from a natural-language
      instruction per beat (STYLE_PROMPTS). The 1.7B model follows it; 0.6B ignores it.
    - cloned voice (`voice: "clone:<name>"`, Base model): your timbre and delivery from your own
      reference recordings, one per style (library/voice/<name>/). The clone API takes no instruction,
      so each beat uses the recording made in its style."""

    name = "qwen3"
    DEFAULT_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
    DEFAULT_CLONE_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"

    def __init__(self) -> None:
        try:
            import torch  # type: ignore
            from qwen_tts import Qwen3TTSModel  # type: ignore
        except ImportError:
            sys.exit(
                "Qwen3-TTS is not installed. Run through `npm run voice -- <id> --engine qwen3`, or:\n"
                '  uv run --python 3.12 --with qwen-tts --with faster-whisper --with scipy audio/tts.py …\n'
                "and `brew install sox`."
            )
        self.torch = torch
        self.Model = Qwen3TTSModel
        self.device = os.environ.get("QWEN_TTS_DEVICE") or (
            "cuda:0" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        )
        self.dtype = torch.bfloat16 if self.device.startswith("cuda") else torch.float32
        self.models: dict = {}
        self.clones: dict = {}
        self.prompts: dict = {}
        self.language = os.environ.get("QWEN_TTS_LANGUAGE", "English")
        self.seed = int(os.environ.get("QWEN_TTS_SEED", "7"))
        self.temperature = float(os.environ.get("QWEN_TTS_TEMPERATURE", "0.7"))

    def model(self, name: str):
        if name not in self.models:
            print(f"qwen3: loading {name} on {self.device} ({str(self.dtype).replace('torch.', '')})")
            self.models[name] = self.Model.from_pretrained(name, device_map=self.device, dtype=self.dtype)
        return self.models[name]

    def speaker(self, voice: str) -> str:
        if voice and not voice.startswith(("am_", "af_", "bm_", "bf_")):
            return voice
        return os.environ.get("QWEN_TTS_SPEAKER", "Aiden")

    @staticmethod
    def instruction(style: str, speed: float) -> str:
        text = STYLE_PROMPTS.get(style, STYLE_PROMPTS["neutral"])
        # Qwen has no speed control; pace is part of the instruction
        if speed >= 1.18:
            text += " Fast pace, short and sharp."
        elif speed >= 1.08:
            text += " Speak a little faster than usual."
        elif speed <= 0.9:
            text += " Speak slower than usual, with a beat between phrases."
        return text

    def clone_prompt(self, name: str, style: str):
        """The reference recording for this style (or its stand-in), embedded once and reused."""
        if name not in self.clones:
            self.clones[name] = load_clone(name)
        cfg = self.clones[name]
        refs = cfg["_refs"]
        chosen = next(
            (s for s in [style, *CLONE_STYLE_FALLBACK.get(style, []), cfg.get("fallback", "calm"), *refs] if s in refs),
        )
        key = (name, chosen)
        if key not in self.prompts:
            model = self.model(cfg.get("model", os.environ.get("QWEN_TTS_CLONE_MODEL", self.DEFAULT_CLONE_MODEL)))
            print(f"  clone:{name} — embedding the '{chosen}' reference")
            self.prompts[key] = model.create_voice_clone_prompt(ref_audio=str(refs[chosen]["audio"]), ref_text=refs[chosen]["text"])
        return self.prompts[key], cfg

    def synth(self, text: str, words: list[str], voice: str, speed: float, style: str = "neutral") -> Synth:
        self.torch.manual_seed(self.seed)  # same text + style -> same take
        name = clone_name(voice)
        if name:
            prompt, cfg = self.clone_prompt(name, style)
            model = self.model(cfg.get("model", os.environ.get("QWEN_TTS_CLONE_MODEL", self.DEFAULT_CLONE_MODEL)))
            wavs, sr = model.generate_voice_clone(
                text=text,
                language=cfg.get("language", self.language),
                voice_clone_prompt=prompt,
                temperature=self.temperature,
            )
        else:
            wavs, sr = self.model(os.environ.get("QWEN_TTS_MODEL", self.DEFAULT_MODEL)).generate_custom_voice(
                text=text,
                speaker=self.speaker(voice),
                language=self.language,
                instruct=self.instruction(style, speed),
                temperature=self.temperature,
            )
        audio = np.asarray(wavs[0], dtype=np.float32).reshape(-1)
        return Synth(audio, int(sr), whisper_words(audio, int(sr), words, text))


ENGINES = {"qwen3": Qwen3Engine, "kokoro": KokoroEngine, "elevenlabs": ElevenLabsEngine, "say": SayEngine, "espeak": EspeakEngine}


# ---------------------------------------------------------------- alignment

def align(words: list[str], tokens: list[tuple[str, float, float]]) -> list[tuple[float, float]] | None:
    """Map whitespace words (with punctuation attached) onto engine tokens."""
    toks = [(norm(t), s, e) for t, s, e in tokens if norm(t)]
    if not toks:
        return None
    out: list[tuple[float, float]] = []
    j = 0
    for w in words:
        target = norm(w)
        if not target:
            prev = out[-1] if out else (0.0, 0.0)
            out.append((prev[1], prev[1]))
            continue
        acc, start, end = "", None, None
        while j < len(toks) and len(acc) < len(target):
            t, s, e = toks[j]
            if start is None:
                start = s
            acc += t
            end = e
            j += 1
        if start is None or not (acc.startswith(target) or target.startswith(acc) or acc == target):
            return None  # alignment drifted (numbers expanded, abbreviations…): fall back to estimates
        out.append((start, end))
    return out


def align_fuzzy(words: list[str], tokens: list[tuple[str, float, float]]) -> list[tuple[float, float]] | None:
    """Sequence-align script words with recognised tokens. Whisper writes "50,000" where the
    script says "fifty thousand" and splits or joins words differently, so unmatched runs share
    the time span of the tokens opposite them, weighted by word length."""
    A = [norm(w) for w in words]
    toks = [(norm(t), s, e) for t, s, e in tokens if norm(t)]
    if not toks or not any(A):
        return None
    B = [t for t, _, _ in toks]
    sm = SequenceMatcher(None, A, B, autojunk=False)
    if sm.ratio() < 0.45:
        return None  # the recording does not say what the script says
    out: list[tuple[float, float] | None] = [None] * len(words)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                out[i1 + k] = (toks[j1 + k][1], toks[j1 + k][2])
        elif op == "replace":
            span0, span1 = toks[j1][1], toks[j2 - 1][2]
            weights = [word_seconds(w) for w in words[i1:i2]]
            total = sum(weights) or 1.0
            t = span0
            for k, wgt in enumerate(weights):
                d = (span1 - span0) * wgt / total
                out[i1 + k] = (t, t + d * 0.92)
                t += d
    # words with no tokens at all ("delete"): squeeze them between their neighbours
    for i, v in enumerate(out):
        if v is not None:
            continue
        prev = next((out[k][1] for k in range(i - 1, -1, -1) if out[k] is not None), 0.0)
        nxt = next((out[k][0] for k in range(i + 1, len(out)) if out[k] is not None), prev)
        out[i] = (prev, max(prev, nxt))
    return [v for v in out if v is not None]


_WHISPER = None


def whisper_words(audio: np.ndarray, sr: int, words: list[str], text: str) -> list[tuple[float, float]] | None:
    """Word times for engines without timestamps, from faster-whisper (CPU, int8). None if unavailable."""
    global _WHISPER
    if _WHISPER is None:
        try:
            from faster_whisper import WhisperModel  # type: ignore
        except ImportError:
            _WHISPER = False
            print("  (faster-whisper not installed: word times are estimated)")
        else:
            name = os.environ.get("WHISPER_MODEL", "small.en")
            print(f"  aligning words with whisper {name}")
            _WHISPER = WhisperModel(name, device="cpu", compute_type="int8")
    if not _WHISPER:
        return None
    a16 = resample(mono(audio).astype(np.float32), sr, 16_000)
    segments, _ = _WHISPER.transcribe(
        a16, language="en", word_timestamps=True, initial_prompt=text, beam_size=5, condition_on_previous_text=False
    )
    tokens = [(w.word.strip(), float(w.start), float(w.end)) for seg in segments for w in (seg.words or [])]
    return align(words, tokens) or align_fuzzy(words, tokens)


def estimate(words: list[str], duration: float) -> list[tuple[float, float]]:
    weights = [word_seconds(w) for w in words]
    total = sum(weights) or 1.0
    k = duration / total
    out, t = [], 0.0
    for w in weights:
        d = w * k
        out.append((t, t + d * 0.92))
        t += d
    return out


# ---------------------------------------------------------------- audio utils

def mono(a: np.ndarray) -> np.ndarray:
    return a.mean(axis=1).astype(np.float32) if a.ndim == 2 else a.astype(np.float32)


def trim(a: np.ndarray, sr: int, thresh_db: float = -45) -> tuple[np.ndarray, float]:
    if not len(a):
        return a, 0.0
    env = np.abs(a)
    th = 10 ** (thresh_db / 20) * (env.max() + 1e-9)
    idx = np.where(env > th)[0]
    if not len(idx):
        return a, 0.0
    keep = int(EDGE_SILENCE * sr)
    s = max(0, idx[0] - keep)
    e = min(len(a), idx[-1] + keep)
    return a[s:e], s / sr


def resample(a: np.ndarray, sr: int, target: int) -> np.ndarray:
    if sr == target:
        return a
    n = int(round(len(a) * target / sr))
    x_old = np.linspace(0, 1, len(a), endpoint=False)
    x_new = np.linspace(0, 1, n, endpoint=False)
    return np.interp(x_new, x_old, a).astype(np.float32)


def loudnorm(a: np.ndarray, sr: int) -> np.ndarray:
    import warnings

    warnings.filterwarnings("ignore", message="Possible clipped samples")  # we peak-limit below
    try:
        import pyloudnorm as pyln  # type: ignore

        meter = pyln.Meter(sr)
        if len(a) / sr > 0.5:
            lufs = meter.integrated_loudness(a)
            if np.isfinite(lufs):
                a = pyln.normalize.loudness(a, lufs, TARGET_LUFS)
    except Exception:
        rms = np.sqrt(np.mean(a**2)) + 1e-9
        a = a * (10 ** (-20 / 20) / rms)
    peak = np.abs(a).max()
    if peak > 0.95:
        a = a * (0.95 / peak)
    return a.astype(np.float32)


# ---------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("manifest", type=Path)
    ap.add_argument("--engine", choices=list(ENGINES), help="overrides the spec's voice.engine")
    ap.add_argument("--voice", help="overrides the spec's voice.voice")
    ap.add_argument("--force", action="store_true", help="re-synthesise every beat")
    args = ap.parse_args()

    man = json.loads(args.manifest.read_text())
    out_dir = args.manifest.parent
    narr_dir = out_dir / "narration"
    narr_dir.mkdir(parents=True, exist_ok=True)
    timing_path = out_dir / "timing.json"
    old = json.loads(timing_path.read_text()) if timing_path.exists() and not args.force else {"beats": {}}

    engine_name = args.engine or man["engine"]
    if engine_name == "estimate":
        sys.exit("voice.engine is 'estimate' — nothing to synthesise. Set voice.engine in the spec or pass --engine.")
    voice = args.voice or man["voice"]
    if clone_name(voice) and engine_name not in ("qwen3", "kokoro", "say", "espeak"):
        sys.exit(f"{voice} is a cloned voice: use --engine qwen3 (or kokoro/say for a draft in a stock voice).")
    if clone_name(voice) and engine_name == "qwen3":
        load_clone(clone_name(voice))  # fail early, before loading any model
    voice_id = voice_identity(voice) if engine_name == "qwen3" else voice
    engine: Engine | None = None
    public_root = out_dir.parent.parent  # public/

    beats_out: dict[str, dict] = {}
    made = reused = 0
    for b in man["beats"]:
        key, h = b["key"], b["hash"]
        prev = old.get("beats", {}).get(key)
        same = prev and prev.get("hash") == h and prev.get("engine") == engine_name and prev.get("voice") == voice_id
        if same and prev.get("file") and (public_root / prev["file"]).exists():
            beats_out[key] = prev
            reused += 1
            continue
        if engine is None:
            engine = ENGINES[engine_name]()
        beats_out[key] = synth_beat(engine, b, voice, h, narr_dir, public_root)
        beats_out[key]["voice"] = voice_id
        made += 1
        print(f"  voiced {key:28s} {beats_out[key]['duration']:6.2f}s")

    timing = {"version": 1, "video": man["video"], "engine": engine_name, "voice": voice_id, "beats": beats_out}
    timing_path.write_text(json.dumps(timing, indent=2) + "\n")
    print(f"timing: {timing_path} ({made} synthesised, {reused} reused)")


def synth_beat(engine: Engine, b: dict, voice: str, h: str, narr_dir: Path, public_root: Path) -> dict:
    sr_out = 24_000
    parts: list[np.ndarray] = []
    word_times: list[dict] = []
    t = 0.0
    if b["pauseBefore"]:
        parts.append(np.zeros(int(b["pauseBefore"] * sr_out), dtype=np.float32))
        t += b["pauseBefore"]
    words = b["words"]
    for ci, chunk in enumerate(b["chunks"]):
        cw = [w["text"] for w in words if w["chunk"] == ci]
        s = engine.synth(chunk["text"], cw, voice, b["speed"], b.get("style", "neutral"))
        audio = resample(s.audio, s.sr, sr_out)
        audio, cut = trim(audio, sr_out)
        dur = len(audio) / sr_out
        times = s.words
        if times is not None:
            times = [(max(0.0, a - cut), max(0.0, e - cut)) for a, e in times]
        else:
            lead = EDGE_SILENCE
            times = [(lead + a, lead + e) for a, e in estimate(cw, max(0.05, dur - 2 * EDGE_SILENCE))]
        for w, (a, e) in zip(cw, times):
            word_times.append({"w": w, "s": round(t + a, 3), "e": round(t + min(e, dur), 3)})
        parts.append(audio)
        t += dur
        if chunk["pauseAfter"]:
            parts.append(np.zeros(int(chunk["pauseAfter"] * sr_out), dtype=np.float32))
            t += chunk["pauseAfter"]
    audio = loudnorm(np.concatenate(parts), sr_out)
    rel = f"videos/{narr_dir.parent.name}/narration/{b['key']}-{h}-{engine.name}.wav"
    sf.write(public_root / rel, audio, sr_out, subtype="PCM_16")
    cues = {}
    for cid, r in b["cues"].items():
        if r["from"] < len(word_times):
            cues[cid] = {"start": word_times[r["from"]]["s"], "end": word_times[min(r["to"], len(word_times) - 1)]["e"]}
    return {"hash": h, "duration": round(len(audio) / sr_out, 3), "words": word_times, "cues": cues, "file": rel, "engine": engine.name, "voice": voice}


if __name__ == "__main__":
    main()
