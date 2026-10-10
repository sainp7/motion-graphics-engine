/**
 * npm run qc -- <video-id> [--file out/<id>/<id>-dark.mp4]
 *
 * Delivery checks on a rendered file: resolution, frame rate, codecs, duration against the
 * spec, integrated loudness and true peak, and unexpected silences. Writes out/<id>/qc.md.
 */
import fs from "node:fs";
import path from "node:path";
import { compile } from "../src/spec/compile";
import { cli, ffmpeg, ffprobe, fmtTime, loadRawSpec, loadTiming, paths, rel, requireId } from "./lib/common";

export const qc = (id: string, file?: string) => {
  const P = paths(id);
  const c = compile(loadRawSpec(id) as never, loadTiming(id));
  const target = file ?? fs.readdirSync(P.out).filter((f) => f.endsWith(".mp4") && !f.includes(".raw.") && !f.includes("-draft")).map((f) => path.join(P.out, f))[0];
  if (!target || !fs.existsSync(target)) {
    console.error(`no rendered video in ${rel(P.out)}; run npm run render -- ${id}`);
    process.exit(1);
  }
  const checks: { ok: boolean; what: string; detail: string }[] = [];
  const probe = JSON.parse(ffprobe(["-v", "error", "-print_format", "json", "-show_streams", "-show_format", target]).stdout || "{}") as {
    streams?: { codec_type: string; codec_name: string; width?: number; height?: number; r_frame_rate?: string; pix_fmt?: string; sample_rate?: string }[];
    format?: { duration?: string };
  };
  const v = probe.streams?.find((s) => s.codec_type === "video");
  const a = probe.streams?.find((s) => s.codec_type === "audio");
  const dur = parseFloat(probe.format?.duration ?? "0");
  const expected = c.durationInFrames / c.fps;
  const [num, den] = (v?.r_frame_rate ?? "0/1").split("/").map(Number);
  checks.push({ ok: !!v && v.width === c.width && v.height === c.height, what: "resolution", detail: v ? `${v.width}×${v.height}` : "no video stream" });
  checks.push({ ok: Math.abs(num / den - c.fps) < 0.01, what: "frame rate", detail: `${(num / den).toFixed(2)} fps` });
  checks.push({ ok: v?.codec_name === "h264" && v?.pix_fmt === "yuv420p", what: "video codec", detail: `${v?.codec_name} ${v?.pix_fmt}` });
  checks.push({ ok: !!a && a.codec_name === "aac", what: "audio codec", detail: a ? `${a.codec_name} ${a.sample_rate} Hz` : "no audio stream" });
  checks.push({ ok: Math.abs(dur - expected) < 0.5, what: "duration", detail: `${fmtTime(dur)} (spec ${fmtTime(expected)})` });

  // Remotion's bundled ffmpeg has loudnorm (but not ebur128); its analysis pass reports the input loudness
  const loud = ffmpeg(["-hide_banner", "-i", target, "-vn", "-af", "loudnorm=print_format=json", "-f", "null", "-"]).stderr;
  const lj = /\{[\s\S]*?"input_i"[\s\S]*?\}/.exec(loud);
  const measured = lj ? (JSON.parse(lj[0]) as Record<string, string>) : {};
  const I = parseFloat(measured.input_i ?? "NaN");
  const TP = parseFloat(measured.input_tp ?? "NaN");
  checks.push({ ok: Math.abs(I + 14) <= 1, what: "loudness", detail: `${I} LUFS (target -14)` });
  checks.push({ ok: TP <= -0.9, what: "true peak", detail: `${TP} dBTP (max -1)` });

  const sil = ffmpeg(["-hide_banner", "-i", target, "-vn", "-af", "silencedetect=noise=-50dB:d=2.5", "-f", "null", "-"]).stderr;
  const gaps = [...sil.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => [+m[1], +m[2]]).filter(([s]) => s < dur - 4);
  checks.push({ ok: gaps.length === 0, what: "silences > 2.5s", detail: gaps.length ? gaps.map(([s, e]) => `${fmtTime(s)}–${fmtTime(e)}`).join(", ") : "none" });

  const md = [
    `# QC — ${c.spec.title}`,
    "",
    `File: \`${rel(target)}\``,
    "",
    "| check | result | detail |",
    "|---|---|---|",
    ...checks.map((k) => `| ${k.what} | ${k.ok ? "pass" : "**fail**"} | ${k.detail} |`),
    "",
    "Manual checks still worth doing: watch at phone size, listen on headphones and laptop speakers, and read the chapters against the video.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(P.out, "qc.md"), md);
  console.log("\nQC");
  for (const k of checks) console.log(`  ${k.ok ? "✓" : "✖"} ${k.what.padEnd(16)} ${k.detail}`);
  console.log(`\n${rel(path.join(P.out, "qc.md"))}`);
  return checks.every((k) => k.ok);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = cli({ file: { type: "string" } });
  const ok = qc(requireId(positionals), values.file);
  process.exit(ok ? 0 : 1);
}
