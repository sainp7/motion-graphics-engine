# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy>=1.26"]
# ///
"""
House sound kit — procedural, original, CC0. Safe for monetised YouTube use.

    uv run audio/house_sfx.py            # writes public/sfx/*.wav and library/sfx/manifest.json

Every sound is synthesised from first principles (sines, filtered noise, envelopes and a
small synthetic room) so the channel has one consistent "house sound". Change a recipe
here, re-run, and every future render uses it. Deterministic: same code, same files.
"""
from __future__ import annotations

import json
import wave
from pathlib import Path

import numpy as np

SR = 48_000
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "sfx"
MANIFEST = ROOT / "library" / "sfx" / "manifest.json"
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- building blocks

def t(seconds: float) -> np.ndarray:
    return np.arange(int(SR * seconds)) / SR


def env_exp(n: int, decay: float, attack: float = 0.002) -> np.ndarray:
    x = np.arange(n) / SR
    a = np.clip(x / max(attack, 1e-4), 0, 1)
    return a * np.exp(-x / decay)


def sine_sweep(f0: float, f1: float, seconds: float, curve: float = 1.0) -> np.ndarray:
    x = t(seconds)
    k = (x / seconds) ** curve
    f = f0 * (f1 / f0) ** k
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase)


def noise(seconds: float) -> np.ndarray:
    return rng.standard_normal(int(SR * seconds))


def one_pole_lp(x: np.ndarray, cutoff: float | np.ndarray) -> np.ndarray:
    """Low-pass with a (possibly time-varying) cutoff in Hz."""
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def band(x: np.ndarray, lo: float | np.ndarray, hi: float | np.ndarray) -> np.ndarray:
    return one_pole_lp(x, hi) - one_pole_lp(x, lo)


def room(x: np.ndarray, seconds: float = 0.5, mix: float = 0.18, tone: float = 5000) -> np.ndarray:
    """A small synthetic room: convolution with exponentially decaying filtered noise."""
    x = fade_out(x, min(0.025, len(x) / SR / 4))
    n = int(SR * seconds)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * seconds / 5))
    ir = one_pole_lp(ir, tone)
    ir /= np.sqrt(np.sum(ir**2)) + 1e-9
    wet = np.convolve(x, ir)
    wet = np.concatenate([wet, np.zeros(len(x) + n - len(wet))])[: len(x) + n]
    dry = np.concatenate([x, np.zeros(n)])
    return dry + mix * wet


def fade_out(x: np.ndarray, seconds: float = 0.01) -> np.ndarray:
    n = min(len(x), int(SR * seconds))
    x = x.copy()
    x[-n:] *= np.linspace(1, 0, n)
    return x


def trim_tail(x: np.ndarray, thresh_db: float = -60) -> np.ndarray:
    a = np.abs(x)
    th = 10 ** (thresh_db / 20) * a.max()
    idx = np.where(a > th)[0]
    end = idx[-1] + int(0.01 * SR) if len(idx) else len(x)
    return fade_out(x[:end], 0.01)


def normalise(x: np.ndarray, peak_db: float = -3.0) -> np.ndarray:
    return x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)


# ---------------------------------------------------------------- recipes

def tick() -> np.ndarray:
    """A station appears: a small dry wooden click."""
    n = int(0.09 * SR)
    click = band(noise(0.09), 1800, 7000) * env_exp(n, 0.004, 0.0005)
    body = np.sin(2 * np.pi * 1750 * t(0.09)) * env_exp(n, 0.018)
    return room(0.7 * click + 0.5 * body, 0.25, 0.08)


def tock() -> np.ndarray:
    """An item lands on a line: a lower, rounder knock."""
    n = int(0.16 * SR)
    f = sine_sweep(720, 560, 0.16, 0.3)
    body = (f + 0.25 * sine_sweep(1440, 1120, 0.16, 0.3)) * env_exp(n, 0.045, 0.001)
    click = band(noise(0.16), 1500, 5000) * env_exp(n, 0.003, 0.0005)
    return room(body + 0.4 * click, 0.3, 0.1)


def pop() -> np.ndarray:
    """A plate or badge stamps in: a soft, bubbly pop."""
    n = int(0.12 * SR)
    body = sine_sweep(1100, 420, 0.12, 0.6) * env_exp(n, 0.035, 0.002)
    air = band(noise(0.12), 2000, 9000) * env_exp(n, 0.006, 0.001) * 0.3
    return room(body + air, 0.3, 0.12)


def blip() -> np.ndarray:
    """A packet departs: a clean, short digital blip."""
    n = int(0.11 * SR)
    x = t(0.11)
    body = (np.sin(2 * np.pi * 1320 * x) + 0.3 * np.sin(2 * np.pi * 2640 * x)) * env_exp(n, 0.028, 0.003)
    return room(body, 0.25, 0.1, 7000)


def whoosh() -> np.ndarray:
    """A line wipes across the screen."""
    secs = 0.5
    n = int(secs * SR)
    x = np.linspace(0, 1, n)
    centre = 350 + 3200 * np.sin(np.pi * x) ** 1.6
    shaped = band(noise(secs), centre * 0.5, centre * 1.6)
    amp = np.sin(np.pi * np.clip(x * 1.1, 0, 1)) ** 2
    return room(shaped * amp, 0.4, 0.15)


def swish() -> np.ndarray:
    """The camera glides: a soft, low swish."""
    secs = 0.36
    n = int(secs * SR)
    x = np.linspace(0, 1, n)
    centre = 260 + 1300 * np.sin(np.pi * x)
    shaped = band(noise(secs), centre * 0.6, centre * 1.4)
    amp = np.sin(np.pi * x) ** 2
    return room(shaped * amp, 0.35, 0.12, 3500)


def hit() -> np.ndarray:
    """The hook lands: a deep, short impact."""
    secs = 0.9
    n = int(secs * SR)
    sub = sine_sweep(92, 41, secs, 0.35) * env_exp(n, 0.22, 0.001)
    knock = band(noise(secs), 80, 1800) * env_exp(n, 0.03, 0.0008) * 0.6
    click = band(noise(secs), 2500, 9000) * env_exp(n, 0.004, 0.0003) * 0.35
    x = np.tanh(1.6 * (sub + knock + click))
    return room(x, 0.9, 0.22, 3000)


def riser() -> np.ndarray:
    """Tension before the hook. Ends abruptly so the hit can land on its tail."""
    secs = 0.9
    n = int(secs * SR)
    x = np.linspace(0, 1, n)
    centre = 300 + 4200 * x**2.2
    air = band(noise(secs), centre * 0.6, centre * 1.5)
    tone = sine_sweep(180, 1400, secs, 2.0) * 0.18
    amp = x**2.4
    y = (air + tone) * amp
    y[-int(0.006 * SR):] *= np.linspace(1, 0, int(0.006 * SR))
    return y


def glitch() -> np.ndarray:
    """Something breaks: gated digital bursts over a low thud."""
    secs = 0.42
    n = int(secs * SR)
    x = t(secs)
    out = np.zeros(n)
    pos = 0
    freqs = [220, 1760, 110, 880, 3520, 330]
    for i, f in enumerate(freqs):
        ln = int(SR * (0.03 + 0.02 * (i % 3)))
        if pos + ln > n:
            break
        seg = np.sign(np.sin(2 * np.pi * f * x[:ln]))  # square
        seg = np.round(seg * 4) / 4  # crush
        out[pos : pos + ln] += seg * (0.9 - 0.1 * i)
        pos += ln + int(SR * 0.012)
    out = one_pole_lp(out, 6000) * env_exp(n, 0.25, 0.001)
    thud = sine_sweep(70, 40, secs, 0.4) * env_exp(n, 0.12, 0.001)
    return room(0.55 * out + 0.8 * thud, 0.35, 0.1)


def chime() -> np.ndarray:
    """A new chapter, a fix that works: a gentle two-note bell."""
    secs = 2.8
    n = int(secs * SR)
    x = t(secs)
    def bell(f: float, delay: float, amp: float) -> np.ndarray:
        d = int(delay * SR)
        y = np.zeros(n)
        xx = x[: n - d]
        partials = [(1.0, 1.0, 0.9), (2.0, 0.35, 0.5), (2.76, 0.22, 0.35), (5.4, 0.08, 0.2)]
        tone = sum(a * np.sin(2 * np.pi * f * r * xx) * np.exp(-xx / (dec * 1.0)) for r, a, dec in partials)
        y[d:] = tone * np.clip(xx / 0.003, 0, 1)
        return amp * y
    y = bell(784, 0.0, 0.8) + bell(1175, 0.11, 0.6)
    return room(y, 1.2, 0.25, 6000)


def snap() -> np.ndarray:
    """A myth is struck out: a sharp, bright snap."""
    secs = 0.14
    n = int(secs * SR)
    crack = band(noise(secs), 2500, 12000) * env_exp(n, 0.012, 0.0004)
    body = sine_sweep(2600, 900, secs, 0.5) * env_exp(n, 0.02, 0.0005) * 0.4
    return room(crack + body, 0.25, 0.1)


RECIPES = {
    "tick": (tick, "A station appears"),
    "tock": (tock, "An item lands on a line"),
    "pop": (pop, "A plate or badge stamps in"),
    "blip": (blip, "A packet departs"),
    "whoosh": (whoosh, "A line wipes across the screen"),
    "swish": (swish, "The camera glides"),
    "hit": (hit, "The hook lands"),
    "riser": (riser, "Tension before the hook"),
    "glitch": (glitch, "Something breaks"),
    "chime": (chime, "A new chapter; a fix that works"),
    "snap": (snap, "A myth is struck out"),
}


def write_wav(path: Path, x: np.ndarray) -> None:
    pcm = np.clip(x, -1, 1)
    pcm = (pcm * 32767).astype("<i2")
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main() -> None:
    sounds = {}
    for name, (fn, desc) in RECIPES.items():
        x = fn()
        x = normalise(x if name == "riser" else trim_tail(x))
        write_wav(OUT / f"{name}.wav", x)
        sounds[name] = {
            "file": f"sfx/{name}.wav",
            "seconds": round(len(x) / SR, 3),
            "description": desc,
            "license": "Original, CC0. Generated by audio/house_sfx.py",
        }
        print(f"  {name:7s} {len(x) / SR:5.2f}s  {desc}")
    MANIFEST.write_text(
        json.dumps(
            {
                "$comment": "House sound kit. Original procedural sounds generated by audio/house_sfx.py (CC0, safe for monetised use). Add licensed sounds here with their licence and source.",
                "sounds": sounds,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"wrote {len(sounds)} sounds to {OUT.relative_to(ROOT)} and {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
