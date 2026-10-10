/**
 * Narration timing.
 *
 * The audio pipeline (audio/tts.py) writes public/videos/<id>/timing.json with real
 * durations and word timestamps. Until it has run — or for a beat whose text changed —
 * we estimate, so the Studio preview always works ("draft timing").
 */
import { parseSay, pauseBefore, ParsedSay } from "./markup";
import { speak } from "./pronounce";
import { CHOREO } from "../choreo/presets";
import type { BeatT, VideoSpecT } from "./schema";

export type WordTime = { w: string; s: number; e: number };
export type BeatTiming = {
  hash: string;
  duration: number;
  words: WordTime[];
  cues: Record<string, { start: number; end: number }>;
  /** Path relative to public/, present when real audio exists. */
  file?: string;
  engine: string;
};
export type TimingFile = {
  version: 1;
  video: string;
  engine: string;
  voice: string;
  beats: Record<string, BeatTiming>;
};

/** Speed multipliers. Deliberately wide: an evenly paced narrator sounds monotonous. */
export const PACE_FACTOR = { slow: 0.84, normal: 1, brisk: 1.12, rush: 1.22 } as const;

/** Fill each beat's pace and style from its segment's choreography when the spec leaves them out. */
export const applyVoiceDefaults = (spec: VideoSpecT): VideoSpecT => {
  for (const seg of spec.segments) {
    const v = CHOREO[seg.choreo].voice;
    seg.beats.forEach((b, i) => {
      if (!b.pace) b.pace = (i === 0 ? v.firstPace : undefined) ?? v.pace;
      if (!b.style) b.style = v.style;
    });
  }
  return spec;
};

/** FNV-1a 32-bit. Identical implementation in audio/tts.py. */
export const fnv1a = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

export const beatKey = (segmentId: string, beat: BeatT, index: number) => `${segmentId}.${beat.id ?? `b${index + 1}`}`;

export const beatSpeed = (spec: VideoSpecT, beat: BeatT) => +(spec.voice.speed * PACE_FACTOR[beat.pace ?? "normal"]).toFixed(3);

/**
 * Hash of what is said and how fast. If it changes, the beat's audio is stale and the renderer
 * falls back to estimated timing until `npm run voice` runs again. The engine and voice are
 * not part of it: tts.py tracks those itself when deciding what to re-synthesise.
 */
export const beatHash = (spec: VideoSpecT, beat: BeatT) => {
  const p = parseSay(beat.say);
  const payload = JSON.stringify({
    chunks: p.chunks.map((c) => [speak(c.text), c.pauseAfter]),
    lead: pauseBefore(p),
    speed: beatSpeed(spec, beat),
    ...(beat.style && beat.style !== "neutral" ? { style: beat.style } : {}),
  });
  return fnv1a(payload);
};

const wordSeconds = (w: string) => {
  const letters = w.replace(/[^\p{L}\p{N}]/gu, "").length;
  let t = 0.11 + 0.056 * letters;
  if (/[,;:]$/.test(w)) t += 0.17;
  if (/[—–-]$/.test(w)) t += 0.2;
  if (/[.?!]["”’)]?$/.test(w)) t += 0.32;
  if (/\d/.test(w)) t += 0.12 * letters; // numbers are read out long
  return t;
};

/** Estimated timing, used for drafts and as a fallback. Same model as audio/tts.py --engine estimate. */
export const estimateBeat = (parsed: ParsedSay, speed: number, hash: string): BeatTiming => {
  const words: WordTime[] = [];
  let t = pauseBefore(parsed);
  parsed.chunks.forEach((chunk, ci) => {
    parsed.words
      .filter((w) => w.chunk === ci)
      .forEach((w) => {
        const d = wordSeconds(w.text) / speed;
        words.push({ w: w.text, s: +t.toFixed(3), e: +(t + d * 0.92).toFixed(3) });
        t += d;
      });
    t += chunk.pauseAfter;
  });
  const cues: BeatTiming["cues"] = {};
  for (const [id, r] of Object.entries(parsed.cues)) {
    const a = words[r.from];
    const b = words[r.to] ?? a;
    if (a) cues[id] = { start: a.s, end: b.e };
  }
  return { hash, duration: +t.toFixed(3), words, cues, engine: "estimate" };
};

// ---------------------------------------------------------------- narration manifest (input to audio/tts.py)

export type NarrationManifest = {
  version: 1;
  video: string;
  engine: string;
  voice: string;
  beats: {
    key: string;
    hash: string;
    speed: number;
    /** emotional delivery hint for expressive engines */
    style: string;
    pauseBefore: number;
    chunks: { text: string; pauseAfter: number }[];
    /** words per chunk, in order, for timestamp alignment */
    words: { text: string; chunk: number }[];
    cues: Record<string, { from: number; to: number }>;
  }[];
};

export const buildNarrationManifest = (input: VideoSpecT): NarrationManifest => {
  const spec = applyVoiceDefaults(input);
  return {
  version: 1,
  video: spec.id,
  engine: spec.voice.engine,
  voice: spec.voice.voice,
  beats: spec.segments.flatMap((seg) =>
    seg.beats.map((beat, i) => {
      const p = parseSay(beat.say);
      return {
        key: beatKey(seg.id, beat, i),
        hash: beatHash(spec, beat),
        speed: beatSpeed(spec, beat),
        pauseBefore: pauseBefore(p),
        // spoken forms from the pronunciation dictionary; one entry per original word so cues stay aligned
        chunks: p.chunks.map((c) => ({ text: speak(c.text), pauseAfter: c.pauseAfter })),
        words: p.words.map((w) => ({ text: speak(w.text), chunk: w.chunk })),
        cues: p.cues,
        style: beat.style ?? "neutral",
      };
    }),
  ),
  };
};
