/**
 * npm run render -- <video-id> [--theme light] [--style editorial] [--draft]
 *
 * Full render, then audio mastering and a QC report:
 *   out/<id>/<id>-<theme>.mp4     YouTube-ready: H.264, AAC 320k, loudness -14 LUFS, true peak below -1 dBTP
 *   out/<id>/qc.md                format, loudness and silence checks
 * --draft renders at half resolution without mastering, for a quick watch-through.
 * --remaster re-runs mastering and QC on the existing raw render (out/<id>/<id>-<theme>.raw.mp4).
 */
import fs from "node:fs";
import path from "node:path";
import { compile } from "../src/spec/compile";
import { cli, ffmpeg, fail, fmtTime, loadRawSpec, loadTiming, paths, rel, remotionBrowserArgs, requireId, run } from "./lib/common";
import { lint } from "./lib/lint";
import { qc } from "./qc";
import { sync } from "./sync";

const { values, positionals } = cli({ theme: { type: "string" }, style: { type: "string" }, draft: { type: "boolean" }, remaster: { type: "boolean" } });
const id = requireId(positionals);
const raw = loadRawSpec(id);
const timing = loadTiming(id);
const { findings } = lint(raw, timing);
const errors = findings.filter((f) => f.level === "error");
if (errors.length) {
  for (const e of errors) console.error(`  ✖ ${e.where}: ${e.msg}`);
  fail("spec has errors; run npm run check");
}
const c = compile(raw as never, timing, { theme: values.theme as "dark" | "light" | undefined, style: values.style });
if (c.draft && !values.draft) fail(`narration timing is estimated. Run \`npm run voice -- ${id}\` first, or pass --draft for a silent preview.`);

const P = paths(id);
fs.mkdirSync(P.out, { recursive: true });
sync(true);
const base = `${id}-${values.style ? `${c.style}-` : ""}${c.theme}${values.draft ? "-draft" : ""}`;
const rawOut = path.join(P.out, `${base}.raw.mp4`);
const final = path.join(P.out, `${base}.mp4`);
const props = JSON.stringify({ ...(values.theme ? { theme: values.theme } : {}), ...(values.style ? { style: values.style } : {}) });
if (values.remaster && !fs.existsSync(rawOut)) fail(`no raw render at ${rel(rawOut)}; render first`);
if (!values.remaster) {
console.log(`rendering ${fmtTime(c.durationInFrames / c.fps)} (${c.durationInFrames} frames)…`);
run("npx", [
  "remotion",
  "render",
  "src/index.ts",
  id,
  values.draft ? final : rawOut,
  `--props=${props}`,
  ...(values.draft ? ["--scale=0.5", "--jpeg-quality=70", "--crf=26"] : []),
  ...remotionBrowserArgs(),
]);
}
if (values.draft) {
  console.log(`\ndraft: ${rel(final)}`);
  process.exit(0);
}

console.log("mastering audio (loudnorm, two pass)…");
// TP -1.5 before AAC: the encoder adds a few tenths of overshoot, and the delivered file must stay under -1 dBTP
const target = "I=-14:TP=-1.5:LRA=11";
const pass1 = ffmpeg(["-hide_banner", "-i", rawOut, "-vn", "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"]);
const m = /\{[\s\S]*?"input_i"[\s\S]*?\}/.exec(pass1.stderr);
if (!m) fail(`loudness analysis failed:\n${pass1.stderr.slice(-800)}`);
const j = JSON.parse(m![0]) as Record<string, string>;
const measured = `measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
const pass2 = ffmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", rawOut, "-af", `loudnorm=${target}:${measured}`, "-ar", "48000", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", final]);
if (pass2.status !== 0) fail(`mastering failed:\n${pass2.stderr}`);
console.log(`\nvideo: ${rel(final)}`);
qc(id, final);
