/**
 * Compile a spec (+ optional narration timing) into a frame-accurate timeline.
 *
 * This is the only place where seconds become frames, cue references become numbers,
 * line names become colours and sound effects get scheduled. Scene components receive
 * resolved data and never parse cue strings themselves.
 */
import { CHOREO, Choreo, SfxId, TransitionKind } from "../choreo/presets";
import { FORMATS, LINE_COLORS, LineColor } from "../design/tokens";
import { parseSay } from "./markup";
import { BeatTiming, TimingFile, applyVoiceDefaults, beatHash, beatKey, beatSpeed, estimateBeat } from "./timing";
import { VideoSpecInput, VideoSpecT, SceneT, DiagramActionT } from "./schema";
import { ChannelT, getChannel, parseSpec } from "./channel";

// ---------------------------------------------------------------- types

/** Replace cue-reference fields with resolved frame numbers, recursively. */
export type Resolved<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends Array<infer U>
    ? Resolved<U>[]
    : T extends object
      ? {
          [K in keyof T]: K extends "at" | "until"
            ? number
            : K extends "reveal"
              ? number[]
              : K extends "line" | "underline"
                ? LineColor
                : K extends "cues"
                  ? Record<string, number>
                  : Resolved<T[K]>;
        }
      : T;

export type ResolvedScene = Resolved<SceneT>;
export type DiagramEvent = Resolved<DiagramActionT> & { f: number; target?: string };

export type CompiledBeat = {
  key: string;
  from: number;
  durationInFrames: number;
  timing: BeatTiming;
  estimated: boolean;
};

export type CompiledSegment = {
  index: number;
  id: string;
  choreo: Choreo;
  scene: ResolvedScene;
  from: number;
  durationInFrames: number;
  exitFrames: number;
  transitionOut: TransitionKind;
  transitionIn: TransitionKind;
  beats: CompiledBeat[];
  accent: LineColor;
  /** For diagram scenes: events from earlier segments (negative frames) followed by this segment's. */
  diagramEvents?: DiagramEvent[];
  autoFit?: boolean;
};

export type SfxEvent = { frame: number; sound: string; gain: number };

export type Compiled = {
  spec: VideoSpecT;
  fps: number;
  width: number;
  height: number;
  theme: "dark" | "light";
  /** Motion style id (src/styles/<id>). */
  style: string;
  /** The video's channel (channels/<id>/channel.json), or null if it has none. */
  channel: ChannelT | null;
  durationInFrames: number;
  segments: CompiledSegment[];
  sfx: SfxEvent[];
  chapters: { title: string; frame: number }[];
  /** Frame where the music enters: the hook's first impact, so the first downbeat lands on it. */
  musicStart: number;
  /** Absolute frame ranges where narration is audible, for music ducking. */
  voiceWindows: [number, number][];
  draft: boolean;
  warnings: string[];
  lineColor: (ref: string | undefined, fallback?: LineColor) => LineColor;
  lineLabel: (ref: string) => string | undefined;
};

// ---------------------------------------------------------------- helpers

const EXIT_FRAMES: Record<TransitionKind, number> = { cut: 0, fade: 9, "line-wipe": 8 };
const isColor = (s: string): s is LineColor => (LINE_COLORS as readonly string[]).includes(s);
const OFFSET = /([+-]\d+(?:\.\d+)?)$/;

type Ctx = {
  fps: number;
  warn: (msg: string) => void;
};

const deepMap = (v: unknown, fn: (key: string, value: unknown) => unknown): unknown => {
  if (Array.isArray(v)) return v.map((x) => deepMap(x, fn));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = fn(k, deepMap(x, fn));
    return out;
  }
  return v;
};

const tagLineNames = (v: unknown, lines: Record<string, unknown>) => {
  if (Array.isArray(v)) v.forEach((x) => tagLineNames(x, lines));
  else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.line === "string" && o.line in lines) o.lineName = o.line;
    for (const x of Object.values(o)) tagLineNames(x, lines);
  }
};

// ---------------------------------------------------------------- compile

export type CompileOptions = { theme?: "dark" | "light"; /** override the channel's motion style */ style?: string };

export const compile = (input: VideoSpecInput | VideoSpecT, timing?: TimingFile | null, opts: CompileOptions = {}): Compiled => {
  const spec = applyVoiceDefaults(parseSpec(input));
  const channel = getChannel(spec.channel);
  const warnings: string[] = [];
  const warn = (m: string) => warnings.push(m);
  const fps = spec.fps;
  const { width, height } = FORMATS[spec.format];
  const ctx: Ctx = { fps, warn };
  const secs = (s: number) => Math.round(s * fps);

  const lineColor = (ref: string | undefined, fallback: LineColor = "orange"): LineColor => {
    if (!ref) return fallback;
    if (isColor(ref)) return ref;
    const named = spec.lines[ref];
    if (named) return named.color;
    warn(`Unknown line "${ref}" — use a colour (${LINE_COLORS.join(", ")}) or define it in spec.lines`);
    return fallback;
  };
  const lineLabel = (ref: string) => spec.lines[ref]?.label;

  let draft = false;
  const segments: CompiledSegment[] = [];
  const sfx: SfxEvent[] = [];
  const voiceWindows: [number, number][] = [];
  const chapters: Compiled["chapters"] = [];
  let cursor = 0;

  spec.segments.forEach((seg, index) => {
    const choreo = CHOREO[seg.choreo];
    if (seg.scene.type !== "custom" && !choreo.scenes.includes(seg.scene.type)) {
      warn(`${seg.id}: scene "${seg.scene.type}" is unusual for choreo "${seg.choreo}" (expected ${choreo.scenes.join(", ")})`);
    }
    const transitionOut: TransitionKind = seg.transition ?? choreo.motion.exit;
    const prev = segments[index - 1];
    const transitionIn: TransitionKind = prev ? prev.transitionOut : "fade";
    const exitFrames = index === spec.segments.length - 1 ? secs(1.2) : EXIT_FRAMES[transitionOut];

    // ---- beats & durations (audio-first)
    let t = choreo.timing.leadIn;
    const beats: CompiledBeat[] = seg.beats.map((beat, i) => {
      const key = beatKey(seg.id, beat, i);
      const hash = beatHash(spec, beat);
      const real = timing?.beats[key];
      let bt: BeatTiming;
      let estimated = false;
      if (real && real.hash === hash) bt = real;
      else {
        if (real) warn(`${key}: narration changed since audio was generated — run \`npm run voice -- ${spec.id}\``);
        bt = estimateBeat(parseSay(beat.say), beatSpeed(spec, beat), hash);
        estimated = true;
        draft = true;
      }
      const from = secs(t);
      const durationInFrames = Math.max(1, Math.ceil(bt.duration * fps));
      t += bt.duration;
      const isLast = i === seg.beats.length - 1;
      t += beat.pauseAfter ?? (isLast ? 0 : choreo.timing.beatGap);
      return { key, from, durationInFrames, timing: bt, estimated };
    });
    t += choreo.timing.tail + seg.hold;
    const durationInFrames = Math.max(secs(t) + exitFrames, secs(1));

    for (const b of beats) voiceWindows.push([cursor + b.from, cursor + b.from + b.durationInFrames]);
    if (seg.chapter) chapters.push({ title: seg.chapter, frame: cursor });

    // ---- cue resolver
    const cueMap = new Map<string, { start: number; end: number }>();
    beats.forEach((b, i) => {
      const beat = seg.beats[i];
      const words = b.timing.words;
      const lastWordEnd = words.length ? words[words.length - 1].e : b.timing.duration;
      const range = { start: b.from + secs(words[0]?.s ?? 0), end: b.from + secs(lastWordEnd) };
      cueMap.set(`b${i + 1}`, range);
      if (beat.id) cueMap.set(beat.id, range);
      for (const [cue, c] of Object.entries(b.timing.cues)) {
        if (cueMap.has(cue)) warn(`${seg.id}: cue "${cue}" is defined twice`);
        cueMap.set(cue, { start: b.from + secs(c.start), end: b.from + secs(c.end) });
      }
    });
    const endFrame = durationInFrames - exitFrames;
    const resolve = (ref: string): number => {
      let id = ref;
      let offset = 0;
      const known = (s: string) => s === "start" || s === "end" || cueMap.has(s.replace(/\.end$/, ""));
      if (!known(id)) {
        const m = OFFSET.exec(ref);
        if (m) {
          offset = parseFloat(m[1]);
          id = ref.slice(0, -m[1].length);
        }
      }
      const isEnd = id.endsWith(".end") && id !== "end";
      const base = isEnd ? id.slice(0, -4) : id;
      let f: number;
      if (base === "start") f = 0;
      else if (base === "end") f = endFrame;
      else {
        const c = cueMap.get(base);
        if (!c) {
          warn(`${seg.id}: unknown cue "${ref}" (cues: ${[...cueMap.keys()].join(", ")})`);
          f = 0;
        } else f = isEnd ? c.end : c.start;
      }
      return Math.max(0, Math.min(endFrame, f + secs(offset)));
    };

    // word-proportional default timing: the i-th of n items appears as narration reaches i/n
    const allWords = beats.flatMap((b) => b.timing.words.map((w) => b.from + secs(w.s)));
    const firstWord = allWords[0] ?? secs(choreo.timing.leadIn);
    const propFrame = (i: number, n: number) => {
      if (!allWords.length) return secs(choreo.timing.leadIn) + i * choreo.motion.stagger;
      return allWords[Math.min(allWords.length - 1, Math.floor((i * allWords.length) / n))];
    };
    const defaultFor = (i: number, n: number) => (n === beats.length ? cueMap.get(`b${i + 1}`)!.start : propFrame(i, n));

    // keep the names of named lines (for the legend) before they become colours
    const sceneCopy = structuredClone(seg.scene);
    tagLineNames(sceneCopy, spec.lines);

    // ---- resolve the scene: cue refs → frames, line refs → colours
    const scene = deepMap(sceneCopy, (key, value) => {
      if ((key === "at" || key === "until") && typeof value === "string") return resolve(value);
      if (key === "reveal" && Array.isArray(value)) return value.map((v) => (typeof v === "string" ? resolve(v) : v));
      if (key === "cues" && sceneCopy.type === "custom" && value && typeof value === "object" && !Array.isArray(value))
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typeof v === "string" ? resolve(v) : v]));
      if ((key === "line" || key === "underline") && typeof value === "string") return lineColor(value);
      return value;
    }) as ResolvedScene;

    const accent: LineColor =
      ("line" in scene && typeof scene.line === "string" ? (scene.line as LineColor) : undefined) ??
      (seg.choreo === "failure" ? "red" : seg.choreo === "solution" ? "green" : "orange");

    fillDefaults(scene, { defaultFor, firstWord, choreo, secs, endFrame, ctx, segId: seg.id });

    // ---- diagram history
    let diagramEvents: DiagramEvent[] | undefined;
    let autoFit: boolean | undefined;
    if (scene.type === "diagram") {
      const own = expandDiagramEvents(scene.actions as Resolved<DiagramActionT>[], choreo);
      const history: DiagramEvent[] = [];
      if (!scene.fresh) {
        for (const p of segments) {
          if (p.scene.type !== "diagram" || p.scene.diagram !== scene.diagram || !p.diagramEvents) continue;
          const shift = cursor - p.from;
          // only p's own events (f >= 0); its history is covered by iterating earlier segments
          for (const e of p.diagramEvents) if (e.f >= 0) history.push({ ...e, f: e.f - shift });
        }
        history.sort((a, b) => a.f - b.f);
      }
      if (!spec.diagrams[scene.diagram]) warn(`${seg.id}: diagram "${scene.diagram}" is not defined in spec.diagrams`);
      const release: DiagramEvent[] = history.length ? [{ f: 0, at: 0, do: "reset", synthetic: true } as DiagramEvent] : [];
      diagramEvents = [...history, ...release, ...own];
      autoFit = !own.some((e) => (e.do === "focus" || e.do === "fit") && e.f <= secs(0.3));
    }

    // ---- sound effects
    if (seg.sfx) scheduleSfx(sfx, cursor, scene, choreo, diagramEvents, transitionIn, index, secs);

    segments.push({
      index,
      id: seg.id,
      choreo,
      scene,
      from: cursor,
      durationInFrames,
      exitFrames,
      transitionOut,
      transitionIn,
      beats,
      accent,
      diagramEvents,
      autoFit,
    });
    cursor += durationInFrames;
  });

  if (chapters.length && chapters[0].frame !== 0) chapters.unshift({ title: "Intro", frame: 0 });

  return {
    spec,
    fps,
    width,
    height,
    theme: opts.theme ?? spec.theme,
    style: opts.style ?? spec.style ?? channel?.style ?? "transit",
    channel,
    durationInFrames: cursor,
    segments,
    sfx: dedupeSfx(sfx),
    musicStart: firstImpact(segments),
    chapters,
    voiceWindows,
    draft,
    warnings,
    lineColor,
    lineLabel,
  };
};

// ---------------------------------------------------------------- defaults per scene type

type DefaultCtx = {
  defaultFor: (i: number, n: number) => number;
  firstWord: number;
  choreo: Choreo;
  secs: (s: number) => number;
  endFrame: number;
  ctx: Ctx;
  segId: string;
};

function fillDefaults(scene: ResolvedScene, d: DefaultCtx) {
  const early = Math.max(2, d.firstWord - 4);
  switch (scene.type) {
    case "statement": {
      const n = scene.lines.length;
      if (!scene.reveal || scene.reveal.length === 0) {
        scene.reveal = scene.lines.map((_, i) => (i === 0 ? early : d.defaultFor(i, n)));
      } else if (scene.reveal.length < n) {
        const r = scene.reveal;
        for (let i = r.length; i < n; i++) r.push(r[i - 1] + d.choreo.motion.stagger * 3);
      }
      break;
    }
    case "list": {
      const n = scene.items.length;
      scene.items.forEach((it, i) => {
        if (it.at === undefined) it.at = i === 0 ? early : d.defaultFor(i, n);
      });
      break;
    }
    case "compare": {
      const items = [...scene.left.items, ...scene.right.items];
      const n = items.length + 2;
      if (scene.left.at === undefined) scene.left.at = early;
      scene.left.items.forEach((it, i) => {
        if (it.at === undefined) it.at = d.defaultFor(i + 1, n);
      });
      if (scene.right.at === undefined) scene.right.at = d.defaultFor(scene.left.items.length + 1, n);
      scene.right.items.forEach((it, i) => {
        if (it.at === undefined) it.at = d.defaultFor(scene.left.items.length + 2 + i, n);
      });
      break;
    }
    case "stat": {
      scene.bars.forEach((b, i) => {
        if (b.at === undefined) b.at = scene.at + d.secs(scene.countSeconds) + i * d.choreo.motion.stagger * 2;
      });
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------- diagram events

/** One event per target, with show-staggering applied, sorted by frame. */
function expandDiagramEvents(actions: Resolved<DiagramActionT>[], choreo: Choreo): DiagramEvent[] {
  const out: DiagramEvent[] = [];
  for (const a of actions) {
    if ("targets" in a && Array.isArray(a.targets) && (a.do === "show" || a.do === "hide" || a.do === "fail" || a.do === "recover")) {
      a.targets.forEach((target, i) => {
        const stagger = a.do === "show" ? choreo.motion.stagger : a.do === "fail" ? 3 : 0;
        out.push({ ...a, f: a.at + i * stagger, target } as DiagramEvent);
      });
    } else {
      out.push({ ...a, f: a.at } as DiagramEvent);
    }
  }
  return out.sort((x, y) => x.f - y.f);
}

// ---------------------------------------------------------------- sfx scheduling

const SFX_GAIN: Partial<Record<SfxId, number>> = {
  tick: 0.5,
  tock: 0.55,
  pop: 0.5,
  blip: 0.35,
  whoosh: 0.55,
  swish: 0.35,
  hit: 0.8,
  riser: 0.45,
  glitch: 0.6,
  chime: 0.5,
  snap: 0.6,
};

function scheduleSfx(
  out: SfxEvent[],
  base: number,
  scene: ResolvedScene,
  choreo: Choreo,
  diagramEvents: DiagramEvent[] | undefined,
  transitionIn: TransitionKind,
  index: number,
  secs: (s: number) => number,
) {
  const s = choreo.sound.sfx;
  const add = (frame: number, sound: SfxId | string | undefined, gainMul = 1) => {
    if (!sound) return;
    out.push({ frame: Math.max(0, base + frame), sound, gain: (SFX_GAIN[sound as SfxId] ?? 0.5) * gainMul });
  };
  const reveal = (i: number) => (Array.isArray(s.reveal) ? (i === 0 ? s.reveal[0] : s.reveal[1]) : s.reveal);

  if (choreo.sound.sting === "riser") {
    // the riser ends on the first reveal (the hit)
    const firstReveal = scene.type === "statement" ? (scene.reveal?.[0] ?? 0) : scene.type === "stat" ? scene.at : 0;
    add(firstReveal - secs(0.9), "riser");
  } else if (choreo.sound.sting) add(index === 0 ? 0 : -secs(0.15), choreo.sound.sting);
  if (transitionIn === "line-wipe" && choreo.sound.sting !== "whoosh") add(-secs(0.2), "whoosh", 0.8);

  switch (scene.type) {
    case "statement":
      (scene.reveal ?? []).forEach((f, i) => add(f, reveal(i), i === 0 ? 1 : 0.8));
      for (const a of scene.actions) {
        if (a.do === "strike") add(a.at, s.strike ?? "snap");
        if (a.do === "sfx") add(a.at, a.sound);
      }
      break;
    case "stat": {
      add(scene.at, reveal(0));
      const n = Math.floor(secs(scene.countSeconds) / 4);
      if (s.count) for (let k = 1; k < n; k++) add(scene.at + k * 4, s.count, 0.35 + 0.4 * (k / n));
      scene.bars.forEach((b, i) => i === scene.bars.length - 1 && add(b.at ?? 0, "blip", 0.8));
      break;
    }
    case "list":
      scene.items.forEach((it, i) => add(it.at ?? 0, reveal(i), 0.9));
      break;
    case "compare":
      add(scene.left.at ?? 0, reveal(0));
      add(scene.right.at ?? 0, reveal(1));
      if (scene.verdict) add(scene.verdict.at, s.verdict ?? "chime");
      break;
    case "chapter":
      add(secs(0.25), reveal(0));
      break;
    case "sequence":
      scene.messages.forEach((m) => {
        add(m.at, s.flow ?? "blip");
        if (m.badge) add(m.at + 14, s.emphasis ?? "pop", 0.8);
      });
      break;
    case "code":
      for (const a of scene.actions) {
        if (a.do === "highlight") add(a.at, "tick", 0.6);
        if (a.do === "sfx") add(a.at, a.sound);
      }
      break;
    case "outro":
      add(secs(0.4), reveal(0));
      break;
    case "intro":
      add(secs(0.1), reveal(0), 0.8);
      break;
    case "custom":
      // a custom scene owns its moments: each named cue gets the reveal sound unless the scene
      // says otherwise with explicit sfx actions
      if (scene.actions.length) for (const a of scene.actions) add(a.at, a.sound);
      else Object.values(scene.cues).forEach((f, i) => add(f, reveal(i), i === 0 ? 1 : 0.8));
      break;
    case "diagram": {
      const showsAtFrame = new Map<number, number>();
      for (const e of diagramEvents ?? []) {
        if (e.f < 0) continue;
        switch (e.do) {
          case "show": {
            const n = showsAtFrame.get(e.at) ?? 0;
            showsAtFrame.set(e.at, n + 1);
            if (n < 4) add(e.f, s.show, 1 - n * 0.12);
            break;
          }
          case "flow": {
            const spacing = 9;
            const k = e.stream ? 1 : Math.min(e.packets, 3);
            for (let j = 0; j < k; j++) add(e.f + j * spacing, s.flow, 1 - j * 0.2);
            break;
          }
          case "fail":
            add(e.f, s.fail ?? "glitch");
            break;
          case "recover":
            add(e.f, s.recover ?? "chime", 0.8);
            break;
          case "badge":
            add(e.f, s.emphasis, 0.8);
            break;
          case "highlight":
            add(e.f, s.emphasis, 0.6);
            break;
          case "focus":
          case "fit":
            add(e.f, s.camera, 0.8);
            break;
          case "sfx":
            add(e.f, e.sound);
            break;
        }
      }
      break;
    }
  }
}

/**
 * Thin the schedule so no sound becomes a tic: each sound has a minimum gap before it may repeat
 * (in frames at 30 fps), and nothing fires within 5 frames of another sound. Accents first: when two
 * sounds collide, the one already placed wins, so put important events earlier in the list.
 */
const MIN_REPEAT: Record<string, number> = { tick: 6, tock: 75, pop: 30, blip: 12, whoosh: 30, swish: 45, hit: 90, riser: 300, glitch: 60, chime: 120, snap: 45 };

function dedupeSfx(list: SfxEvent[]): SfxEvent[] {
  const sorted = [...list].sort((a, b) => a.frame - b.frame);
  const out: SfxEvent[] = [];
  const lastBySound = new Map<string, number>();
  let lastAny = -1e9;
  for (const e of sorted) {
    const last = lastBySound.get(e.sound);
    if (last !== undefined && e.frame - last < (MIN_REPEAT[e.sound] ?? 15)) continue;
    const isAccent = e.sound === "hit" || e.sound === "glitch" || e.sound === "riser" || e.sound === "whoosh";
    if (!isAccent && e.frame - lastAny < 5) continue;
    lastBySound.set(e.sound, e.frame);
    lastAny = e.frame;
    out.push(e);
  }
  return out;
}

// ---------------------------------------------------------------- music

/** First visual impact of the video (the hook's first reveal), where music should enter. */
const earliest = (fs: number[]) => (fs.length ? Math.min(...fs) : 0);

function firstImpact(segments: CompiledSegment[]): number {
  const s = segments[0];
  if (!s) return 0;
  const sc = s.scene;
  const f =
    sc.type === "statement"
      ? (sc.reveal?.[0] ?? 0)
      : sc.type === "stat"
        ? sc.at
        : sc.type === "custom"
          ? earliest(Object.values(sc.cues))
          : 0;
  return s.from + f;
}

export type StemLevels = Record<string, number>;
export type EnergyTable = Record<"0" | "1" | "2" | "3", StemLevels>;

/** Levels for tracks whose manifest entry has no `energy` table (the bed / pulse / perc layout). */
export const STEM_LEVELS: EnergyTable = {
  "0": { bed: 0, pulse: 0, perc: 0 },
  "1": { bed: 1, pulse: 0, perc: 0 },
  "2": { bed: 1, pulse: 1, perc: 0 },
  "3": { bed: 1, pulse: 1, perc: 1 },
};

/**
 * Per-frame gain for each music stem: energy changes, ducking under the voice, fades.
 * Stems loop continuously from `musicStart`, so every change is placed on the track's grid:
 *   - a drop to silence (failure, insight) is immediate: the cut is the effect
 *   - the return from silence lands on the next beat: the groove slams back in
 *   - any other change waits for the next bar line
 */
export const musicEnvelope = (c: Compiled, track: { bpm?: number; energy?: EnergyTable } = {}) => {
  const n = c.durationInFrames;
  const table = track.energy ?? STEM_LEVELS;
  const names = Object.keys(table["3"]);
  const beatFrames = (60 / (track.bpm ?? 90)) * c.fps;
  const barFrames = 4 * beatFrames;
  const grid = (f: number, step: number) => (f <= c.musicStart ? f : Math.round(c.musicStart + Math.ceil((f - c.musicStart) / step - 1e-6) * step));
  const levels = (seg: CompiledSegment) => table[String(seg.choreo.sound.energy) as keyof EnergyTable];
  const silent = (lv: StemLevels) => names.every((k) => !lv[k]);
  const stems: Record<string, Float32Array> = Object.fromEntries(names.map((k) => [k, new Float32Array(n)]));
  const duck = new Float32Array(n).fill(1);
  for (const seg of c.segments) {
    const lv = levels(seg);
    const prev = c.segments[seg.index - 1];
    // the intro drops in on its first frame and hands back on the next segment's first frame
    const isIntro = seg.choreo.id === "intro" || prev?.choreo.id === "intro";
    const start =
      seg.index === 0
        ? c.musicStart
        : silent(lv) || isIntro
          ? seg.from
          : prev && silent(levels(prev))
            ? grid(seg.from, beatFrames)
            : grid(seg.from, barFrames);
    for (let f = Math.max(0, start); f < n; f++) for (const k of names) stems[k][f] = lv[k] ?? 0;
    for (const [a, b] of c.voiceWindows) {
      if (a < seg.from || a >= seg.from + seg.durationInFrames) continue;
      for (let f = a; f < b && f < n; f++) duck[f] = Math.min(duck[f], seg.choreo.sound.duck);
    }
  }
  // smoothing: one-pole filters, quick rise so re-entries hit, slower fall
  const smooth = (arr: Float32Array, rise: number, fall: number) => {
    let v = arr[0];
    for (let f = 0; f < n; f++) {
      const target = arr[f];
      v += (target - v) * (target > v ? rise : fall);
      arr[f] = v;
    }
  };
  const fps = c.fps;
  for (const k of names) smooth(stems[k], 0.6, 4 / fps);
  smooth(duck, 6 / fps, 3 / fps);
  const fadeOut = Math.round(3 * fps);
  for (let f = 0; f < n; f++) {
    let g = f < c.musicStart ? 0 : 1;
    if (f > n - fadeOut) g *= Math.max(0, (n - f) / fadeOut);
    for (const k of names) stems[k][f] *= g * duck[f];
  }
  return stems;
};
