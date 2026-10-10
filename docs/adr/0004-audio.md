# ADR-0004: Audio pipeline

Status: accepted · 2026-10-10

## Decision
- **Narration**: Qwen3-TTS 1.7B CustomVoice locally (American English, male, speaker `Aiden`), via
  `audio/tts.py` run with `uv`. Each beat's pace and style become a natural-language delivery
  instruction; Whisper (faster-whisper, CPU) times the words, and a sequence aligner maps them onto
  the script ("50,000" ↔ "fifty thousand"). Per beat: synthesise each chunk between `[pause]` marks,
  trim edges, insert exact pauses, normalise to −18 LUFS. Beats are cached by a hash of text, speed
  and style plus engine and voice. Kokoro-82M is the fast fallback (own timestamps, no style control);
  say/espeak for drafts; ElevenLabs optional and paid.
- **House sound**: original procedural SFX (`audio/house_sfx.py`) and music, CC0, safe for
  monetisation. Default track `transit-drive` (`audio/house_drive.py`, 112.5 BPM, four stems: pumped
  bass, kick, groove, top) with a per-track energy table; `house-night-transit` is the calm
  alternative. FLAC stems loop gaplessly.
- **Licensed audio** goes in `library/*/manifest.json` with licence, source and monetisation status.
- **Mix** in Remotion (narration clips, stems with energy/duck envelopes, scheduled SFX), then
  **master** with two-pass `loudnorm` to −14 LUFS integrated and a −1.5 dBTP ceiling (AAC adds a little overshoot; the delivered file must stay under −1 dBTP), AAC 320 kbps; `qc.md` verifies. Remotion's bundled ffmpeg is used, so no ffmpeg install is needed.

## Consequences
No paid voice or music services are needed. The first house bed (night-transit) was too
understated: no kick in most segments, so nothing pumped. The motion-reels POC proved that a driving
groove (four-on-the-floor, 8th-note bass, drop-outs that slam back) carries a short explainer, so that
became the default. Qwen3-TTS needs a Mac with ~8 GB free RAM; Kokoro keeps drafts fast anywhere.
