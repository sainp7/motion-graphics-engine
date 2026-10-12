/**
 * Spec linter: the studio's editorial and technical rules, as code.
 * Errors block a render. Warnings are judgement calls Claude should consciously accept or fix.
 */
import fs from "node:fs";
import path from "node:path";
import { CHOREO } from "../../src/choreo/presets";
import { ROOT } from "./common";
import { compile, Compiled } from "../../src/spec/compile";
import { countWords, parseSay, parseText, plainText } from "../../src/spec/markup";
import type { VideoSpecT, SegmentT } from "../../src/spec/schema";
import { channelIds, safeParseSpec } from "../../src/spec/channel";
import { STYLE_TOKENS } from "../../src/style-tokens.generated";
import type { TimingFile } from "../../src/spec/timing";
import { LAYOUT } from "../../src/design/tokens";
import { buildGeometry, edgeId } from "../../src/scenes/diagram/geometry";

export type Finding = { level: "error" | "warn" | "info"; where: string; msg: string };

const HOOKS = new Set(["cold-open", "big-number", "myth", "failure"]);

export const lint = (raw: unknown, timing: TimingFile | null): { findings: Finding[]; compiled?: Compiled; spec?: VideoSpecT } => {
  const findings: Finding[] = [];
  const err = (where: string, msg: string) => findings.push({ level: "error", where, msg });
  const warn = (where: string, msg: string) => findings.push({ level: "warn", where, msg });
  const info = (where: string, msg: string) => findings.push({ level: "info", where, msg });

  const rawChannel = (raw as { channel?: string }).channel;
  if (rawChannel && !channelIds().includes(rawChannel)) {
    err("channel", `unknown channel "${rawChannel}" (channels: ${channelIds().join(", ") || "none"}); create channels/${rawChannel}/channel.json or npm run new-channel`);
    return { findings };
  }
  const parsed = safeParseSpec(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) err(issue.path.join(".") || "spec", issue.message);
    return { findings };
  }
  const spec = parsed.data;
  const compiled = compile(spec, timing);
  const tokens = STYLE_TOKENS[compiled.style];
  if (!tokens) {
    err("style", `unknown style "${compiled.style}" (styles: ${Object.keys(STYLE_TOKENS).join(", ")})`);
    return { findings };
  }
  const TYPE = tokens.type;
  for (const s of spec.segments) if (!s.beats.length && s.scene.type !== "intro") err(s.id, "a segment needs at least one beat (only the intro is silent)");
  for (const w of compiled.warnings) {
    if (/unknown cue|Unknown line|not defined|defined twice/.test(w)) err(w.split(":")[0], w);
    else warn(w.split(":")[0], w);
  }

  // ---- ids
  const segIds = new Set<string>();
  for (const s of spec.segments) {
    if (segIds.has(s.id)) err(s.id, "duplicate segment id");
    segIds.add(s.id);
  }

  // ---- diagrams
  for (const [id, def] of Object.entries(spec.diagrams)) {
    const nodeIds = new Set<string>();
    for (const n of def.nodes) {
      if (nodeIds.has(n.id)) err(`diagrams.${id}`, `duplicate node id "${n.id}"`);
      nodeIds.add(n.id);
    }
    for (const e of def.edges) {
      if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) err(`diagrams.${id}`, `edge ${edgeId(e)} references a missing node`);
    }
    for (const g of def.groups) for (const n of g.nodes) if (!nodeIds.has(n)) err(`diagrams.${id}`, `group ${g.id} references missing node "${n}"`);
    const geom = buildGeometry(def, LAYOUT.unit);
    const boxes = [...geom.boxes.values()];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const gapX = Math.abs(a.cx - b.cx) - (a.w + b.w) / 2;
        const gapY = Math.abs(a.cy - b.cy) - (a.h + b.h) / 2;
        if (gapX < 24 && gapY < 24) err(`diagrams.${id}`, `stations "${a.id}" and "${b.id}" overlap or touch; move one at least 0.3 units away`);
      }
    const x0 = Math.min(...boxes.map((b) => b.cx - b.w / 2));
    const x1 = Math.max(...boxes.map((b) => b.cx + b.w / 2));
    const y0 = Math.min(...boxes.map((b) => b.cy - b.h / 2));
    const y1 = Math.max(...boxes.map((b) => b.cy + b.h / 2));
    const zoom = Math.min((1920 * 0.86) / (x1 - x0 + 216), (1080 * 0.76) / (y1 - y0 + 204));
    if (zoom < 0.8) warn(`diagrams.${id}`, `the full diagram needs zoom ${zoom.toFixed(2)} to fit; labels will be small. Tighten the layout or use focus/fit per segment.`);
    if (def.nodes.length > 10) warn(`diagrams.${id}`, `${def.nodes.length} stations: consider splitting into two diagrams (≤ 9 visible at once reads best)`);
  }

  // ---- cloned voice
  if (spec.voice.voice.startsWith("clone:")) {
    const name = spec.voice.voice.slice("clone:".length);
    const dir = path.join(ROOT, "library", "voice", name);
    if (!fs.existsSync(path.join(dir, "voice.json"))) err("voice", `cloned voice "${name}" does not exist; run npm run voice-ref -- ${name}`);
    else if (!fs.readdirSync(dir).some((f) => /\.(wav|flac)$/i.test(f)))
      warn("voice", `cloned voice "${name}" has no recordings on this machine (they are git-ignored); npm run voice will fail until you record them`);
  }

  // ---- custom scenes are for signature moments, not for the whole video
  const customs = spec.segments.filter((s) => s.scene.type === "custom");
  const components = new Set(customs.map((s) => (s.scene.type === "custom" ? s.scene.component : "")));
  if (components.size > 3)
    warn("segments", `${components.size} custom scene components: keep one to three signature moments per video and build the rest from the scene library (or promote a recurring custom scene with extend-studio)`);
  if (customs.length && spec.segments.length && customs.length / spec.segments.length > 0.4)
    warn("segments", "more than 40% of segments are custom; the channel's consistency comes from the shared scenes");

  // ---- per segment
  let anyPause = false;
  const plain = (s: SegmentT) => s.beats.map((b) => parseSay(b.say).plain).join(" ");
  compiled.segments.forEach((cs, i) => {
    const seg = spec.segments[i];
    const where = seg.id;
    const choreo = CHOREO[seg.choreo];
    const narration = plain(seg).toLowerCase();
    if (seg.beats.some((b) => /\[pause/.test(b.say))) anyPause = true;

    // diagram references
    if (seg.scene.type === "diagram") {
      const def = spec.diagrams[seg.scene.diagram];
      if (def) {
        const ids = new Set([...def.nodes.map((n) => n.id), ...def.edges.map(edgeId), ...def.groups.map((g) => g.id)]);
        const geom = buildGeometry(def, LAYOUT.unit);
        for (const a of seg.scene.actions) {
          const refs = "targets" in a && a.targets ? a.targets : "target" in a ? [a.target] : [];
          for (const r of [...refs, ...("except" in a && a.except ? a.except : [])]) if (!ids.has(r)) err(where, `${a.do} references unknown id "${r}" in diagram ${seg.scene.diagram}`);
          if (a.do === "flow") {
            for (let k = 0; k < a.path.length - 1; k++) {
              const [p, q] = [a.path[k], a.path[k + 1]];
              const ok = [...geom.edges.values()].some((e) => (e.from === p && e.to === q) || (e.from === q && e.to === p));
              if (!ok) err(where, `flow path ${p} → ${q} has no edge; add one to diagrams.${seg.scene.diagram}.edges`);
            }
          }
        }
      }
    }
    if (seg.scene.type === "sequence") {
      const actors = new Set(seg.scene.actors.map((a) => a.id));
      for (const m of seg.scene.messages) if (!actors.has(m.from) || !actors.has(m.to)) err(where, `message ${m.from} → ${m.to} uses an unknown actor`);
    }

    // on-screen text
    const texts: string[] = [];
    const sc = seg.scene;
    if (sc.type === "statement") texts.push(...sc.lines);
    if (sc.type === "stat") texts.push(sc.label);
    if (sc.type === "list") texts.push(...(sc.title ? [sc.title] : []), ...sc.items.map((x) => x.text));
    if (sc.type === "compare") texts.push(sc.left.title, sc.right.title, ...sc.left.items.map((x) => x.text), ...sc.right.items.map((x) => x.text));
    if (sc.type === "outro") texts.push(sc.text);
    if (sc.type === "custom") {
      texts.push(...sc.signage);
      const dir = path.join(ROOT, "videos", spec.id, "scenes");
      if (![".tsx", ".ts", ".js"].some((ext) => fs.existsSync(path.join(dir, `${sc.component}${ext}`))))
        err(where, `custom scene "${sc.component}" not found: create videos/${spec.id}/scenes/${sc.component}.tsx (React) or .js/.ts (seekable script), default export`);
    }
    // headings and chapter titles name what is on screen ("Fix 1: coalesce the misses", "Why does it
    // collapse?"); they may echo the voice
    const headings = (sc.type === "code" || sc.type === "diagram") && sc.heading ? [sc.heading] : sc.type === "chapter" ? [sc.title] : [];
    const words = [...texts, ...headings].reduce((n, t) => n + countWords(t), 0);
    // custom scenes carry labels like a diagram does: twice the budget
    const budget = sc.type === "custom" ? choreo.text.maxWords * 2 : choreo.text.maxWords;
    if (words > budget) warn(where, `${words} words on screen; "${seg.choreo}" allows ${budget}. Signage, not sentences.`);

    // caption check: on-screen text must not transcribe the narration
    for (const t of texts) {
      const p = plainText(t).toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim();
      const n = p.split(" ").filter(Boolean).length;
      const narr = narration.replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ");
      if (n >= 4 && narr.includes(p)) warn(where, `"${plainText(t)}" is read out word for word — that is a caption. Show the idea, or say it differently.`);
    }

    // statement fit and plates
    if (sc.type === "statement") {
      const size = sc.size ?? choreo.text.size;
      const role = size === "xl" ? TYPE.display : size === "lg" ? TYPE.headline : TYPE.title;
      const maxChars = Math.floor(1680 / (role.size * 0.56));
      sc.lines.forEach((l, k) => {
        const len = plainText(l).length;
        if (len > maxChars) err(where, `line ${k + 1} has ${len} characters; at size "${size}" a line fits about ${maxChars}. Break it or use a smaller size.`);
      });
      const plates = sc.lines.flatMap((l) => parseText(l).filter((r) => r.kind === "plate"));
      if (plates.length > 2) warn(where, `${plates.length} plates in one statement; plates mark the one or two words that carry the idea.`);
      const strikes = sc.lines.flatMap((l) => parseText(l).filter((r) => r.kind === "strike"));
      if (strikes.length && !sc.actions.some((a) => a.do === "strike")) warn(where, "~~strike~~ text without a strike action; it will never be struck");
    }

    // static stretches: largest gap between visual events
    const events = visualEvents(cs);
    const firstVisual = Math.min(...sceneEvents(cs), cs.durationInFrames) / compiled.fps;
    if (seg.scene.type !== "chapter" && seg.scene.type !== "outro" && firstVisual > 1.8 && !(seg.scene.type === "diagram" && i > 0 && spec.segments[i - 1].scene.type === "diagram"))
      warn(where, `the screen is empty for the first ${firstVisual.toFixed(1)}s; reveal something at "start" so the cut lands on a picture`);
    const gaps = events.slice(1).map((f, k) => f - events[k]);
    const maxGap = Math.max(0, ...gaps) / compiled.fps;
    if (maxGap > 12) warn(where, `nothing changes on screen for ${maxGap.toFixed(1)}s; add a cue-driven action or split the segment`);

    // density
    const secs = cs.durationInFrames / compiled.fps;
    const wordsSpoken = narration.split(/\s+/).filter(Boolean).length;
    const voiced = cs.beats.reduce((s, b) => s + b.timing.duration, 0);
    if (voiced > 0 && (wordsSpoken / voiced) * 60 > 190) warn(where, `narration runs at ${Math.round((wordsSpoken / voiced) * 60)} wpm; slow the pace or cut words`);
    if (seg.choreo === "insight" && !seg.beats.some((b) => /\[pause/.test(b.say)) && seg.beats.length < 2) info(where, "insight lands harder with a [pause] before the key phrase");
    if (secs > 45) warn(where, `segment is ${secs.toFixed(0)}s long; split it so the picture keeps moving with the story`);
  });

  // ---- whole video
  const first = spec.segments[0];
  if (!HOOKS.has(first.choreo)) warn(first.id, `the video opens with "${first.choreo}"; open with a hook (cold-open, big-number, myth or failure)`);
  const firstSecs = compiled.segments[0].durationInFrames / compiled.fps;
  if (firstSecs > 20) warn(first.id, `the hook runs ${firstSecs.toFixed(0)}s; get to the promise within ~15s`);
  if (!anyPause) warn("narration", "no [pause] marks anywhere; deliberate pauses give viewers time to absorb each idea");

  const types = spec.segments.map((s) => s.scene.type);
  for (let i = 3; i < types.length; i++) {
    if (types[i] === types[i - 1] && types[i] === types[i - 2] && types[i] === types[i - 3] && types[i] !== "diagram")
      warn(spec.segments[i].id, `four "${types[i]}" scenes in a row; vary the visual form`);
  }
  const choreos = spec.segments.map((s) => s.choreo);
  for (let i = 4; i < choreos.length; i++) {
    if (choreos.slice(i - 4, i + 1).every((c) => c === choreos[i])) warn(spec.segments[i].id, `five "${choreos[i]}" segments in a row; the rhythm flattens`);
  }
  const total = compiled.durationInFrames / compiled.fps;
  const distinct = new Set(types).size;
  if (total > 120 && distinct < 4) warn("video", `only ${distinct} scene types over ${Math.round(total)}s; repetitive videos risk YouTube's inauthentic-content policy`);
  if (total > 120 && compiled.chapters.length < 3) warn("video", "fewer than 3 chapters; YouTube shows chapters only with at least three, the first at 0:00");
  if (total < 150 || total > 300) info("video", `runtime ${(total / 60).toFixed(1)} min (target 3–4 min)`);
  if (spec.segments[spec.segments.length - 1].scene.type !== "outro") warn("video", "the video does not end on an outro (call to action)");
  if (compiled.draft) info("narration", "timing is estimated; run `npm run voice -- <id>` for real narration timing");

  return { findings, compiled, spec };
};

/** Frames (segment-relative) where something visibly changes, including the segment's edges. */
const visualEvents = (cs: Compiled["segments"][number]): number[] => [0, ...sceneEvents(cs), cs.durationInFrames].sort((a, b) => a - b);

/** Frames (segment-relative) where the scene itself changes. */
const sceneEvents = (cs: Compiled["segments"][number]): number[] => {
  const s = cs.scene;
  const out: number[] = [];
  const push = (f?: number) => typeof f === "number" && out.push(f);
  switch (s.type) {
    case "statement":
      (s.reveal ?? []).forEach(push);
      s.actions.forEach((a) => push(a.at));
      break;
    case "stat":
      push(s.at);
      s.bars.forEach((b) => push(b.at));
      break;
    case "diagram":
      (cs.diagramEvents ?? []).filter((e) => e.f >= 0).forEach((e) => push(e.f));
      break;
    case "sequence":
      push(Math.max(0, Math.min(...s.messages.map((m) => m.at)) - 18)); // actors arrive before the first message
      s.messages.forEach((m) => push(m.at));
      break;
    case "compare":
      push(s.left.at);
      push(s.right.at);
      [...s.left.items, ...s.right.items].forEach((x) => push(x.at));
      push(s.verdict?.at);
      break;
    case "list":
      s.items.forEach((x) => push(x.at));
      break;
    case "code":
      s.actions.forEach((a) => push(a.at));
      push(6);
      break;
    case "intro":
      push(0);
      break;
    case "custom":
      Object.values(s.cues).forEach(push);
      s.actions.forEach((a) => push(a.at));
      push(4);
      break;
    case "outro":
      push(10);
      push(cs.beats.length > 1 ? cs.beats[1].from : Math.round(cs.durationInFrames * 0.45));
      break;
    default:
      push(Math.round(cs.durationInFrames * 0.1));
  }
  return out;
};
