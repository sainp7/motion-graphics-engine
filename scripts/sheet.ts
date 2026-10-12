/**
 * npm run sheet -- <video-id> [--theme light] [--style editorial] [--at 1:23] [--max 32]
 *
 * Renders key frames (each segment's moments after its visual events settle), runs the
 * automated text QA on every frame (clipped / unsafe / overlap), and tiles the frames into
 * contact sheets for review:
 *
 *   out/<id>/frames/<frame>.jpg      full-resolution frames
 *   out/<id>/sheet-<n>.jpg           4×4 contact sheets
 *   out/<id>/sheet.md                index: sheet tile → time, segment, choreography, QA issues
 *
 * --at renders one moment (m:ss, seconds, or "f123" for a frame) instead.
 */
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { compile } from "../src/spec/compile";
import { GALLERY_SPEC } from "../src/gallery/gallery-spec";
import { webpackOverride } from "../src/webpack-override";
import sharp from "sharp";
import { ROOT, cli, fmtTime, loadRawSpec, loadTiming, paths, rel, requireId } from "./lib/common";
import { lint } from "./lib/lint";
import { sync } from "./sync";

const { values, positionals } = cli({ theme: { type: "string" }, style: { type: "string" }, at: { type: "string" }, max: { type: "string" } });
const id = requireId(positionals);
const theme = values.theme as "dark" | "light" | undefined;
const style = values.style;
// "gallery" is the design-system specimen (src/gallery/gallery-spec.ts), not a video in videos/
const isGallery = id === "gallery";
const raw = isGallery ? GALLERY_SPEC : loadRawSpec(id);
const timing = isGallery ? null : loadTiming(id);
const compositionId = isGallery ? `gallery-${theme ?? "dark"}` : id;
const { findings } = lint(raw, timing);
const errors = findings.filter((f) => f.level === "error");
if (errors.length) {
  for (const e of errors) console.error(`  ✖ ${e.where}: ${e.msg}`);
  console.error("\nFix spec errors first (npm run check).\n");
  process.exit(1);
}
const c = compile(raw as never, timing, { theme, style });
const fps = c.fps;

// ---- choose frames
type Pick = { frame: number; seg: string; choreo: string; note: string };
let picks: Pick[] = [];
const parseAt = (s: string) => (s.startsWith("f") ? parseInt(s.slice(1), 10) : s.includes(":") ? Math.round((+s.split(":")[0] * 60 + +s.split(":")[1]) * fps) : Math.round(parseFloat(s) * fps));
if (values.at) {
  const f = Math.min(c.durationInFrames - 1, parseAt(values.at));
  const s = c.segments.find((x) => f >= x.from && f < x.from + x.durationInFrames)!;
  picks = [{ frame: f, seg: s.id, choreo: s.choreo.id, note: "requested" }];
} else {
  const max = parseInt(values.max ?? "32", 10);
  for (const s of c.segments) {
    const local = eventsOf(s).map((f) => Math.min(s.durationInFrames - s.exitFrames - 3, f + Math.round(0.75 * fps)));
    const chosen: number[] = [];
    for (const f of local.sort((a, b) => a - b)) if (!chosen.length || f - chosen[chosen.length - 1] > fps * 1.2) chosen.push(f);
    const last = s.durationInFrames - s.exitFrames - Math.round(0.2 * fps);
    if (!chosen.length || last - chosen[chosen.length - 1] > fps) chosen.push(last);
    const keep = chosen.length > 4 ? [chosen[0], chosen[Math.floor(chosen.length / 3)], chosen[Math.floor((2 * chosen.length) / 3)], chosen[chosen.length - 1]] : chosen;
    keep.forEach((f, k) => picks.push({ frame: s.from + f, seg: s.id, choreo: s.choreo.id, note: k === keep.length - 1 ? "settled" : "after event" }));
  }
  if (picks.length > max) {
    const step = picks.length / max;
    picks = Array.from({ length: max }, (_, i) => picks[Math.floor(i * step)]);
  }
}

function eventsOf(s: (typeof c.segments)[number]): number[] {
  const sc = s.scene;
  const out: number[] = [];
  if (sc.type === "statement") out.push(...(sc.reveal ?? []), ...sc.actions.map((a) => a.at));
  if (sc.type === "stat") out.push(sc.at + Math.round(sc.countSeconds * fps), ...sc.bars.map((b) => b.at ?? 0));
  if (sc.type === "diagram") out.push(...(s.diagramEvents ?? []).filter((e) => e.f >= 0).map((e) => e.f + (e.do === "flow" ? Math.round(0.9 * fps) : 0)));
  if (sc.type === "sequence") out.push(...sc.messages.map((m) => m.at));
  if (sc.type === "compare") out.push(...[...sc.left.items, ...sc.right.items].map((x) => x.at ?? 0), ...(sc.verdict ? [sc.verdict.at] : []));
  if (sc.type === "list") out.push(...sc.items.map((x) => x.at ?? 0));
  if (sc.type === "code") out.push(...sc.actions.map((a) => a.at));
  return out;
}

// ---- render
const variant = [style, isGallery ? (theme ?? "dark") : theme].filter(Boolean).join("-");
const P = variant ? { ...paths(id), out: path.join(paths(id).out, variant) } : paths(id);
const framesDir = path.join(P.out, "frames");
fs.mkdirSync(framesDir, { recursive: true });
sync(true);
console.log(`bundling…`);
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), publicDir: path.join(ROOT, "public"), webpackOverride });
const browser = await openBrowser("chrome", { browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE ?? null });
const inputProps = { ...(theme ? { theme } : {}), ...(style ? { style } : {}), qa: true, muteMusic: true, muteSfx: true };
const composition = await selectComposition({ serveUrl, id: compositionId, inputProps, puppeteerInstance: browser });
const issues = new Map<number, string[]>();
const files: string[] = [];
for (const [i, p] of picks.entries()) {
  const out = path.join(framesDir, `${String(p.frame).padStart(5, "0")}.jpg`);
  await renderStill({
    composition,
    serveUrl,
    output: out,
    frame: p.frame,
    inputProps,
    imageFormat: "jpeg",
    jpegQuality: 88,
    puppeteerInstance: browser,
    onBrowserLog: (log) => {
      if (!log.text.startsWith("QA_ISSUE ")) return;
      const q = JSON.parse(log.text.slice(9)) as { kind: string; text: string; other?: string };
      const list = issues.get(p.frame) ?? [];
      const msg = q.kind === "overlap" ? `overlap: "${q.text}" × "${q.other}"` : `${q.kind}: "${q.text}"`;
      if (!list.includes(msg)) list.push(msg);
      issues.set(p.frame, list);
    },
  });
  files.push(out);
  process.stdout.write(`\r  rendered ${i + 1}/${picks.length}`);
}
await browser.close({ silent: true });
console.log("");

// ---- contact sheets (4×4 tiles, labelled with time and segment)
for (const old of fs.readdirSync(P.out).filter((f) => /^sheet-\d+\.jpg$/.test(f))) fs.rmSync(path.join(P.out, old));
const TW = 640;
const TH = 360;
const PAD = 8;
const LABEL = 30;
const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!);
for (let sheet = 0; sheet * 16 < files.length; sheet++) {
  const batch = files.slice(sheet * 16, sheet * 16 + 16);
  const cols = Math.min(4, batch.length);
  const rows = Math.ceil(batch.length / 4);
  const W = cols * (TW + PAD) + PAD;
  const H = rows * (TH + LABEL + PAD) + PAD;
  const layers = await Promise.all(
    batch.map(async (f, k) => {
      const i = sheet * 16 + k;
      const p = picks[i];
      const x = PAD + (k % 4) * (TW + PAD);
      const y = PAD + Math.floor(k / 4) * (TH + LABEL + PAD);
      const img = await sharp(f).resize(TW, TH).toBuffer();
      const q = issues.get(p.frame)?.length ?? 0;
      const label = `${k + 1}  ${fmtTime(p.frame / fps)}  ${p.seg} · ${p.choreo}${q ? `  ▲${q}` : ""}`;
      const svg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${LABEL}"><text x="4" y="21" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="${q ? "#ffb35c" : "#d0d6e0"}">${esc(label)}</text></svg>`,
      );
      return [
        { input: img, left: x, top: y },
        { input: svg, left: x, top: y + TH },
      ];
    }),
  );
  await sharp({ create: { width: W, height: H, channels: 3, background: "#1b1d22" } })
    .composite(layers.flat())
    .jpeg({ quality: 84 })
    .toFile(path.join(P.out, `sheet-${sheet + 1}.jpg`));
}

// ---- index
const lines = [
  `# Contact sheet — ${c.spec.title} (${c.style} · ${c.theme})`,
  "",
  `Generated by \`npm run sheet -- ${id}\`. Sheets are 4×4, read left to right, top to bottom.`,
  c.draft ? "\n> Timing is estimated (no narration yet). Run `npm run voice` for real timing.\n" : "",
  "| sheet | tile | time | segment | choreo | QA |",
  "|---|---|---|---|---|---|",
  ...picks.map((p, i) => {
    const q = issues.get(p.frame) ?? [];
    return `| ${Math.floor(i / 16) + 1} | ${(i % 16) + 1} | ${fmtTime(p.frame / fps)} (f${p.frame}) | ${p.seg} | ${p.choreo} | ${q.length ? q.join("; ") : "ok"} |`;
  }),
  "",
];
fs.writeFileSync(path.join(P.out, "sheet.md"), lines.join("\n"));
const sheets = fs.readdirSync(P.out).filter((f) => /^sheet-\d+\.jpg$/.test(f));
const totalIssues = [...issues.values()].reduce((n, l) => n + l.length, 0);
console.log(`\n${sheets.map((s) => rel(path.join(P.out, s))).join("\n")}\n${rel(path.join(P.out, "sheet.md"))}`);
console.log(totalIssues ? `\n▲ ${totalIssues} text QA issue(s):` : "\n✓ no text QA issues");
for (const [f, list] of issues) for (const m of list) console.log(`  ${fmtTime(f / fps)} f${f}: ${m}`);
