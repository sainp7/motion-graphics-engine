/**
 * npm run voice -- <video-id> [--engine qwen3|kokoro|elevenlabs|say|espeak] [--voice Aiden] [--force]
 *
 * Writes the narration manifest from the spec and runs audio/tts.py, which synthesises
 * changed beats and writes public/videos/<id>/timing.json. The renderer then syncs every
 * cue to the real voice. Unchanged beats are reused.
 *
 * qwen3 (default) runs Qwen3-TTS on this machine (Apple GPU via MPS) and times words with Whisper.
 * kokoro is the fast fallback: `npm run voice -- <id> --engine kokoro`.
 * A cloned voice (`"voice": "clone:<name>"`, see `npm run voice-ref`) uses the qwen3 engine.
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { buildNarrationManifest } from "../src/spec/timing";
import { cli, fail, loadSpec, paths, rel, requireId, run } from "./lib/common";
import { sync } from "./sync";

const { values, positionals } = cli({ engine: { type: "string" }, voice: { type: "string" }, force: { type: "boolean" } });
const id = requireId(positionals);
const spec = loadSpec(id);
const P = paths(id);
const manifest = buildNarrationManifest(spec);
const engine = values.engine ?? spec.voice.engine;
if (engine === "estimate") fail(`voice.engine is "estimate" in ${rel(P.spec)}. Set it to qwen3 or kokoro (or pass --engine say for a quick macOS draft).`);
if (engine === "elevenlabs" && !process.env.ELEVENLABS_API_KEY)
  fail("ELEVENLABS_API_KEY is not set. export ELEVENLABS_API_KEY=… (and optionally ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL).");
const voiceName = values.voice ?? spec.voice.voice;
if (voiceName.startsWith("clone:")) {
  const name = voiceName.slice("clone:".length);
  if (!fs.existsSync(`library/voice/${name}/voice.json`)) fail(`No cloned voice "${name}". Create it: npm run voice-ref -- ${name}`);
  if (engine === "elevenlabs") fail(`${voiceName} is a Qwen3 cloned voice; use --engine qwen3`);
}
fs.mkdirSync(P.build, { recursive: true });
fs.writeFileSync(P.narration, JSON.stringify(manifest, null, 2) + "\n");

const has = (cmd: string) => spawnSync("sh", ["-c", `command -v ${cmd}`]).status === 0;
const uvArgs = ["run"];
const env: NodeJS.ProcessEnv = { ...process.env };
// pip lets misaki fetch its spaCy English model on first run
if (engine === "kokoro") uvArgs.push("--with", "kokoro>=0.9.4", "--with", "misaki[en]>=0.9.4", "--with", "pip");
if (engine === "qwen3") {
  if (!has("sox")) fail("Qwen3-TTS needs the sox CLI: brew install sox");
  uvArgs.push("--python", "3.12", "--with", "qwen-tts", "--with", "faster-whisper>=1.0", "--with", "scipy");
  // lets the few ops Apple's GPU lacks fall back to CPU instead of failing
  env.PYTORCH_ENABLE_MPS_FALLBACK = "1";
  console.log("qwen3: first run downloads the model (~4–5 GB) and Whisper small.en (~0.5 GB); needs ~8 GB free RAM");
}
// say/espeak get Whisper word timing when it is available
if (engine === "say" || engine === "espeak") uvArgs.push("--with", "faster-whisper>=1.0");
uvArgs.push("audio/tts.py", P.narration, "--engine", engine);
if (values.voice) uvArgs.push("--voice", values.voice);
if (values.force) uvArgs.push("--force");
console.log(`voicing ${manifest.beats.length} beats with ${engine}…`);
run("uv", uvArgs, { env });
sync(true);
console.log(`\nnext: npm run check -- ${id}   (timings are now real)`);
