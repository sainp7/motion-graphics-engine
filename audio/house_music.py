# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy>=1.26", "scipy>=1.11"]
# ///
"""
House music bed — "Night Transit". Procedural, original, CC0, safe for monetised use.

    uv run audio/house_music.py          # writes public/music/house-night-transit/{bed,pulse,perc}.flac

Three loopable stems, so choreography can bring layers in and out:
    bed    warm pad + sub bass       (energy >= 1)
    pulse  plucked arpeggio + echo   (energy >= 2)
    perc   soft kick, rim and hats   (energy >= 3)

It is deliberately understated: a bed under narration, not a song. For a richer sound,
add licensed tracks to library/music/manifest.json (with their licence) and pick them per video.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, lfilter

SR = 48_000
BPM = 90
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 16
LOOP = BARS * BAR
TAIL = 3.0
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "music" / "house-night-transit"
MANIFEST = ROOT / "library" / "music" / "manifest.json"
rng = np.random.default_rng(11)

NOTE = {"C": 0, "C#": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}


def hz(name: str) -> float:
    n, octave = name[:-1], int(name[-1])
    midi = 12 * (octave + 1) + NOTE[n]
    return 440.0 * 2 ** ((midi - 69) / 12)


# two bars per chord; voicings chosen for smooth voice leading
CHORDS = [
    ("D2", ["D3", "F3", "A3", "C4", "E4"]),  # Dm9
    ("Bb1", ["D3", "F3", "A3", "Bb3", "D4"]),  # Bbmaj7
    ("F2", ["C3", "F3", "A3", "C4", "E4"]),  # Fmaj7
    ("C2", ["C3", "E3", "G3", "A3", "D4"]),  # C6/9
    ("D2", ["D3", "F3", "A3", "C4", "E4"]),  # Dm9
    ("G1", ["D3", "F3", "Bb3", "C4", "A4"]),  # Gm9
    ("Bb1", ["D3", "F3", "A3", "Bb3", "F4"]),  # Bbmaj7
    ("A1", ["D3", "E3", "G3", "C#4", "E4"]),  # A7sus4 -> A7 colour
]

N = int(SR * (LOOP + TAIL))
time = np.arange(N) / SR


def lowpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    b, a = butter(order, cutoff / (SR / 2), btype="low")
    return lfilter(b, a, x, axis=0)


def highpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    b, a = butter(order, cutoff / (SR / 2), btype="high")
    return lfilter(b, a, x, axis=0)


def bandpass(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    b, a = butter(2, [lo / (SR / 2), hi / (SR / 2)], btype="band")
    return lfilter(b, a, x, axis=0)


def soft_saw(f: float, t: np.ndarray, harmonics: int = 7) -> np.ndarray:
    return sum(np.sin(2 * np.pi * f * k * t) / (k**1.6) for k in range(1, harmonics + 1))


def place(buf: np.ndarray, start: float, sig: np.ndarray) -> None:
    i = int(start * SR)
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i]


def stereo(l: np.ndarray, r: np.ndarray) -> np.ndarray:
    return np.stack([l, r], axis=1)


def wrap_loop(x: np.ndarray) -> np.ndarray:
    """Fold the tail back onto the start so the stem loops seamlessly."""
    n = int(SR * LOOP)
    out = x[:n].copy()
    tail = x[n:]
    out[: len(tail)] += tail
    return out


# ---------------------------------------------------------------- stems

def bed() -> np.ndarray:
    left = np.zeros(N)
    right = np.zeros(N)
    chord_len = 2 * BAR
    for ci, (bass, notes) in enumerate(CHORDS):
        start = ci * chord_len
        dur = chord_len + 1.2
        t = np.arange(int(SR * dur)) / SR
        env = np.clip(t / 0.9, 0, 1) * np.clip((dur - t) / 1.2, 0, 1)
        for vi, n in enumerate(notes):
            f = hz(n)
            amp = 0.16 / (1 + 0.15 * vi)
            left_v = soft_saw(f * 2 ** (-4 / 1200), t) * amp * env
            right_v = soft_saw(f * 2 ** (5 / 1200), t + 0.003 * vi) * amp * env
            place(left, start, left_v)
            place(right, start, right_v)
        sub = np.sin(2 * np.pi * hz(bass) * t) * 0.32 * np.clip(t / 0.25, 0, 1) * np.clip((dur - t) / 1.0, 0, 1)
        place(left, start, sub)
        place(right, start, sub)
    # slow movement: gentle swell every two bars
    lfo = 0.9 + 0.1 * np.sin(2 * np.pi * time / (2 * BAR))
    x = stereo(left * lfo, right * lfo)
    x = lowpass(x, 2400)
    return x


def pulse() -> np.ndarray:
    left = np.zeros(N)
    right = np.zeros(N)
    eighth = BEAT / 2
    pattern = [0, 2, 1, 3, 2, 4, 3, 1]
    for ci, (_, notes) in enumerate(CHORDS):
        tones = [hz(n) * 2 for n in notes[1:]]
        for step in range(16):
            start = ci * 2 * BAR + step * eighth
            f = tones[pattern[step % 8] % len(tones)]
            t = np.arange(int(SR * 0.5)) / SR
            vel = 0.75 if step % 4 == 0 else 0.5 if step % 2 == 0 else 0.4
            pluck = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * np.exp(-t / 0.14) * np.clip(t / 0.003, 0, 1)
            place(left, start, pluck * vel * 0.35)
            place(right, start, pluck * vel * 0.3)
    x = stereo(left, right)
    # dotted-eighth ping-pong echo
    d = int(SR * BEAT * 0.75)
    out = x.copy()
    fb = 0.38
    for k in range(1, 4):
        shifted = np.zeros_like(x)
        shifted[d * k :] = x[: -d * k]
        if k % 2:
            shifted = shifted[:, ::-1]
        out += shifted * fb**k
    out = lowpass(out, 3800)
    out = highpass(out, 180)
    return out


def perc() -> np.ndarray:
    mono = np.zeros(N)
    hats = np.zeros(N)
    for bar in range(BARS):
        for beat in range(4):
            start = bar * BAR + beat * BEAT
            if beat in (0, 2):
                t = np.arange(int(SR * 0.35)) / SR
                f = 45 + 70 * np.exp(-t / 0.03)
                kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)
                place(mono, start, kick * 0.7)
            else:
                t = np.arange(int(SR * 0.12)) / SR
                rim = rng.standard_normal(len(t)) * np.exp(-t / 0.025)
                place(mono, start, bandpass(rim, 900, 3800) * 0.25)
            for half in (0, 1):
                t = np.arange(int(SR * 0.05)) / SR
                hat = rng.standard_normal(len(t)) * np.exp(-t / 0.012)
                place(hats, start + half * BEAT / 2 + (0.02 if half else 0), hat * (0.12 if half else 0.08))
    hats = highpass(hats, 7000)
    return stereo(mono + hats * 0.9, mono + hats * 1.1)


# ---------------------------------------------------------------- output

def write(name: str, x: np.ndarray, peak_db: float) -> str:
    x = wrap_loop(x)
    x = x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)
    OUT.mkdir(parents=True, exist_ok=True)
    wav = OUT / f"{name}.wav"
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    # FLAC: lossless and gapless, so stems loop without a seam (MP3/AAC add encoder padding).
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        flac = OUT / f"{name}.flac"
        subprocess.run([ffmpeg, "-loglevel", "error", "-y", "-i", str(wav), "-compression_level", "8", str(flac)], check=True)
        wav.unlink()
        return f"music/house-night-transit/{name}.flac"
    print("  ffmpeg not found; keeping WAV")
    return f"music/house-night-transit/{name}.wav"


def main() -> None:
    stems = {
        "bed": write("bed", bed(), -6),
        "pulse": write("pulse", pulse(), -9),
        "perc": write("perc", perc(), -10),
    }
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"tracks": {}}
    manifest.setdefault("tracks", {})["house-night-transit"] = {
        "title": "Night Transit (house bed)",
        "bpm": BPM,
        "key": "D minor",
        "loopSeconds": round(LOOP, 3),
        "stems": stems,
        "gain": {"bed": 1.0, "pulse": 0.75, "perc": 0.6},
        "license": {"type": "original", "notes": "Procedurally generated by audio/house_music.py. CC0."},
        "monetization": "safe",
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote stems {list(stems)} ({LOOP:.1f}s loop) and updated {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
