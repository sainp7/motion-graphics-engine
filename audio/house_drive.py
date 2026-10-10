# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy>=1.26", "scipy>=1.11"]
# ///
"""
House music track — "Transit Drive". Procedural, original, CC0, safe for monetised use.

    uv run audio/house_drive.py        # writes public/music/transit-drive/{bass,kick,groove,top}.flac

The channel's default bed: a driving, pumping groove in the spirit of the motion-reels POC
(four-on-the-floor kick, 8th-note bass, claps and hats, minor pop progression), built as
loopable stems so each segment's choreography energy can bring layers in and out.

    112.5 BPM: one beat is exactly 16 frames at 30 fps, one bar 64, the 16-bar loop 1024.
    A minor, one chord per bar: Am – F – C – G (bars 13–16 lift to F – G – Am – G).

Stems
    bass    8th-note bass + warm pad, sidechain-pumped on every beat (the pump is baked in,
            so it breathes even when the kick is down)
    kick    four-on-the-floor kick; drops out on the last beat of bars 8 and 16 for the fill
    groove  offbeat open hat, 16th closed hats, clap on 2 and 4, snare fills into bars 9 and 1
    top     plucked arpeggio with dotted-8th echo, a swell into the loop start

The `energy` table in the manifest says how loud each stem is at choreography energy 0–3.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48_000
BPM = 112.5
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 16
LOOP = BARS * BAR
TAIL = 2.5
N = int(SR * (LOOP + TAIL))
TIME = np.arange(N) / SR
ROOT = Path(__file__).resolve().parent.parent
NAME = "transit-drive"
OUT = ROOT / "public" / "music" / NAME
MANIFEST = ROOT / "library" / "music" / "manifest.json"
rng = np.random.default_rng(7)


def midi(n: int) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


# bass root, arpeggio tones (midi)
AM = (45, [69, 72, 76, 81])
F = (41, [65, 69, 72, 77])
C = (48, [67, 72, 76, 79])
G = (43, [67, 71, 74, 79])
PROGRESSION = [AM, F, C, G] * 3 + [F, G, AM, G]


# ---------------------------------------------------------------- dsp helpers

def t_axis(dur: float) -> np.ndarray:
    return np.arange(int(dur * SR)) / SR


def env_exp(dur: float, decay: float) -> np.ndarray:
    return np.exp(-t_axis(dur) / decay)


def filt(x: np.ndarray, kind: str, f) -> np.ndarray:
    return sosfilt(butter(2, f, btype=kind, fs=SR, output="sos"), x, axis=0)


def noise(dur: float) -> np.ndarray:
    return rng.uniform(-1, 1, int(dur * SR))


def chirp(f0: float, f1: float, dur: float, curve: float = 1.0) -> np.ndarray:
    t = t_axis(dur)
    f = f0 + (f1 - f0) * (t / dur) ** curve
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def place(buf: np.ndarray, sig: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0) -> None:
    """Add mono `sig` into stereo `buf` at `at` seconds, equal-power pan -1..1."""
    i = int(round(at * SR))
    if i >= len(buf):
        return
    s = sig[: len(buf) - i] * gain
    buf[i : i + len(s), 0] += s * np.cos((pan + 1) * np.pi / 4)
    buf[i : i + len(s), 1] += s * np.sin((pan + 1) * np.pi / 4)


def stereo_zeros() -> np.ndarray:
    return np.zeros((N, 2))


def pump(depth: float, release: float = 0.11) -> np.ndarray:
    """Sidechain envelope keyed to every beat: dips by `depth` on the kick, recovers over `release`."""
    since = np.mod(TIME, BEAT)
    attack = np.clip(since / 0.004, 0, 1)  # 4 ms duck-in so the dip itself does not click
    return (1 - depth * attack * np.exp(-since / release))[:, None]


def wrap_loop(x: np.ndarray) -> np.ndarray:
    """Fold the tail back onto the start so the stem loops without a seam."""
    n = int(round(SR * LOOP))
    out = x[:n].copy()
    tail = x[n:]
    out[: len(tail)] += tail
    return out


# ---------------------------------------------------------------- instruments

def kick_hit(level: float = 1.0) -> np.ndarray:
    body = chirp(150, 46, 0.42, curve=0.25) * env_exp(0.42, 0.13)
    click = filt(noise(0.012), "high", 2000) * env_exp(0.012, 0.003) * 0.4
    return (body + np.pad(click, (0, len(body) - len(click)))) * level


def hat(dur: float, decay: float, cutoff: float = 7000) -> np.ndarray:
    return filt(noise(dur), "high", cutoff) * env_exp(dur, decay)


def clap_hit() -> np.ndarray:
    out = np.zeros(int(0.22 * SR))
    for k, d in enumerate([0.0, 0.011, 0.022]):
        b = filt(noise(0.2), "band", [900, 2600]) * env_exp(0.2, 0.06 if k == 2 else 0.008)
        i = int(d * SR)
        out[i : i + len(b)] += b[: len(out) - i]
    return out


def snare_hit() -> np.ndarray:
    t = t_axis(0.16)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.03) * 0.5
    return tone + filt(noise(0.16), "band", [1500, 6000]) * np.exp(-t / 0.05)


def bass_note(freq: float, dur: float) -> np.ndarray:
    t = t_axis(dur)
    x = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)
    a = np.minimum(1, t / 0.006) * np.exp(-t / (dur * 0.9))
    return np.tanh(1.6 * x) * a


def pluck(freq: float, dur: float = 0.3) -> np.ndarray:
    t = t_axis(dur)
    saw = 2 * ((freq * t) % 1) - 1
    return filt(saw, "low", 2600) * np.exp(-t / 0.085) * np.minimum(1, t / 0.002)


def pad_chord(notes: list[int], dur: float) -> np.ndarray:
    t = t_axis(dur)
    x = np.zeros_like(t)
    for n in notes:
        f = midi(n - 12)
        for detune in (-6, 6):
            ff = f * 2 ** (detune / 1200)
            x += sum(np.sin(2 * np.pi * ff * k * t) / k**1.5 for k in range(1, 6))
    env = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.15).clip(0, 1)
    return filt(x * env, "low", 1600) * 0.06


# ---------------------------------------------------------------- stems

def bass_stem() -> np.ndarray:
    bass = stereo_zeros()
    pad = stereo_zeros()
    for bar, (root, arp) in enumerate(PROGRESSION):
        t0 = bar * BAR
        place(pad, pad_chord(arp, BAR + 0.2), t0, 1.0)
        for e in range(8):
            note = root + (12 if e == 7 and bar % 2 == 1 else 0)  # octave pop on the last 8th of every other bar
            place(bass, bass_note(midi(note), BEAT * 0.45), t0 + e * BEAT / 2, 0.9 if e % 2 == 0 else 0.7)
    return bass * pump(0.38) + pad * pump(0.75, 0.16)


def kick_stem() -> np.ndarray:
    x = stereo_zeros()
    for bar in range(BARS):
        for beat in range(4):
            if beat == 3 and bar in (7, 15):
                continue  # room for the fill
            place(x, kick_hit(1.0 if beat == 0 else 0.92), bar * BAR + beat * BEAT)
    return x


def groove_stem() -> np.ndarray:
    x = stereo_zeros()
    open_hat = hat(0.12, 0.045, 6000)
    closed = hat(0.04, 0.009)
    clap = clap_hit()
    snare = snare_hit()
    for bar in range(BARS):
        for beat in range(4):
            t = bar * BAR + beat * BEAT
            fill = beat == 3 and bar in (7, 15)
            place(x, open_hat, t + BEAT / 2, 0.30, pan=0.3)
            for s in (1, 3):  # 16ths between, lightly swung
                place(x, closed, t + s * BEAT / 4 + (0.008 if s == 3 else 0), 0.10, pan=-0.25)
            if beat in (1, 3) and not fill:
                place(x, clap, t, 0.55, pan=0.05)
            if fill:  # 16th snare roll, rising, into the next phrase
                for k in range(4):
                    place(x, snare, t + k * BEAT / 4, 0.25 + 0.12 * k, pan=-0.1 + 0.07 * k)
    return x


def top_stem() -> np.ndarray:
    x = stereo_zeros()
    patterns = ([0, 1, 2, 3, 2, 1, 2, 3], [0, 2, 1, 3, 2, 3, 1, 2])
    for bar, (_, arp) in enumerate(PROGRESSION):
        pat = patterns[0 if bar < 8 else 1]
        for s in range(8):
            tone = arp[pat[s] % len(arp)] + (12 if bar >= 8 and s in (3, 7) else 0)
            place(x, pluck(midi(tone)), bar * BAR + s * BEAT / 2, 0.16 if s % 2 == 0 else 0.11, pan=-0.35 + 0.1 * s)
    # dotted-8th ping-pong echo
    d = int(SR * BEAT * 0.75)
    out = x.copy()
    for k in range(1, 4):
        shifted = np.zeros_like(x)
        shifted[d * k :] = x[: -d * k]
        out += (shifted[:, ::-1] if k % 2 else shifted) * 0.33**k
    # noise swell into the loop start (lands on bar 1 every time the loop comes round)
    sw = 2 * BAR
    t = t_axis(sw)
    swell = filt(noise(sw), "high", 2500) * (t / sw) ** 3 * 0.25
    place(out, swell, LOOP - sw)
    return filt(out, "high", 160)


# ---------------------------------------------------------------- output

def write(name: str, x: np.ndarray, peak_db: float) -> str:
    x = wrap_loop(x)
    x = x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)
    OUT.mkdir(parents=True, exist_ok=True)
    wav = OUT / f"{name}.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
    # FLAC: lossless and gapless, so stems loop without a seam (MP3/AAC add encoder padding).
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        flac = OUT / f"{name}.flac"
        subprocess.run([ffmpeg, "-loglevel", "error", "-y", "-i", str(wav), "-compression_level", "8", str(flac)], check=True)
        wav.unlink()
        return f"music/{NAME}/{name}.flac"
    print("  ffmpeg not found; keeping WAV")
    return f"music/{NAME}/{name}.wav"


def main() -> None:
    stems = {
        "bass": write("bass", bass_stem(), -6),
        "kick": write("kick", kick_stem(), -7),
        "groove": write("groove", groove_stem(), -12),
        "top": write("top", top_stem(), -11),
    }
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"tracks": {}}
    manifest.setdefault("tracks", {})[NAME] = {
        "title": "Transit Drive (house groove)",
        "bpm": BPM,
        "key": "A minor",
        "loopSeconds": round(LOOP, 3),
        "stems": stems,
        "gain": {"bass": 1.0, "kick": 0.9, "groove": 0.8, "top": 0.7},
        "energy": {
            "0": {"bass": 0, "kick": 0, "groove": 0, "top": 0},
            "1": {"bass": 1, "kick": 0.55, "groove": 0.7, "top": 0.4},
            "2": {"bass": 1, "kick": 1, "groove": 1, "top": 0.75},
            "3": {"bass": 1, "kick": 1, "groove": 1, "top": 1},
        },
        "license": {"type": "original", "notes": "Procedurally generated by audio/house_drive.py. CC0."},
        "monetization": "safe",
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote stems {list(stems)} ({LOOP:.2f}s loop) and updated {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
