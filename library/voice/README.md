# Cloned voices

Each folder here is a voice the narrator can speak in, cloned with Qwen3-TTS from your own short
recordings, one per delivery style (calm, urgent, excited, serious).

```bash
npm run voice-ref -- paras      # creates library/voice/paras/ with a recording guide and lines to read
# record calm.wav, urgent.wav, excited.wav, serious.wav into it (see its README.md)
npm run voice-ref -- paras      # checks length, level, noise, clipping and that the words match
```

Then in a spec: `"voice": { "engine": "qwen3", "voice": "clone:paras" }` and `npm run voice -- <id>`.

- **Delivery comes from the recordings.** The clone model takes no style instruction, so each beat
  uses the recording in its style. Missing styles fall back (urgent ↔ excited, the rest → calm).
- **Pace** still comes from `[pause]`s and sentence length; `pace` cannot speed a cloned voice up.
- **Commit** `voice.json` and the `.txt` transcripts. **Never commit the audio**: it is git-ignored
  because anyone with it can clone the voice.
- Re-recording a reference re-voices only the beats that used it.
- Only clone a voice you have the right to use, and consider YouTube's altered or synthetic content
  disclosure for cloned narration.
