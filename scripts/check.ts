/**
 * npm run check -- <video-id> [--json] [--quiet]
 *
 * Validates a spec and prints the timeline: schema errors, broken cues and references,
 * editorial warnings (captions, monotony, static stretches, missing pauses) and a
 * segment-by-segment summary with timings. Exits 1 when there are errors.
 */
import { CHOREO } from "../src/choreo/presets";
import { cli, fmtTime, loadRawSpec, loadTiming, requireId } from "./lib/common";
import { lint } from "./lib/lint";

const { values, positionals } = cli({ json: { type: "boolean" }, quiet: { type: "boolean" } });
const id = requireId(positionals);
const { findings, compiled } = lint(loadRawSpec(id), loadTiming(id));
const errors = findings.filter((f) => f.level === "error");

if (values.json) {
  console.log(JSON.stringify({ id, findings, durationSeconds: compiled ? compiled.durationInFrames / compiled.fps : null }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

const icon = { error: "✖", warn: "▲", info: "·" } as const;
if (!values.quiet && compiled) {
  const fps = compiled.fps;
  console.log(`\n${compiled.spec.title}  (${id} · channel ${compiled.spec.channel ?? "none"} · style ${compiled.style} · ${compiled.theme} · ${compiled.draft ? "draft timing" : "voiced"})\n`);
  console.log("  start  len   choreo        scene       segment");
  for (const s of compiled.segments) {
    const ch = compiled.chapters.find((c) => c.frame === s.from);
    console.log(
      `  ${fmtTime(s.from / fps).padStart(5)}  ${(s.durationInFrames / fps).toFixed(1).padStart(4)}s ${s.choreo.id.padEnd(13)} ${s.scene.type.padEnd(11)} ${s.id}${ch ? `   ← chapter "${ch.title}"` : ""}`,
    );
  }
  console.log(`\n  total ${fmtTime(compiled.durationInFrames / fps)} · ${compiled.segments.length} segments · ${compiled.chapters.length} chapters · ${compiled.sfx.length} sfx cues`);
  const energies = compiled.segments.map((s) => CHOREO[s.choreo.id].sound.energy).join("");
  console.log(`  music energy by segment: ${energies}\n`);
}
const shown = values.quiet ? findings.filter((f) => f.level === "error") : findings;
for (const f of shown) (f.level === "error" ? console.error : console.log)(`  ${icon[f.level]} ${f.where}: ${f.msg}`);
if (!values.quiet) console.log(`\n${errors.length} error(s), ${findings.filter((f) => f.level === "warn").length} warning(s)\n`);
process.exit(errors.length ? 1 : 0);
