/**
 * Parsers for the two small markup languages in a spec:
 *   - narration markup in `beat.say`: {words|cue}, [pause], [pause 0.8]
 *   - on-screen markup in visible text: {plate}, {plate|green}, ~~strike~~
 * Pure functions, shared by the renderer, the linter and the narration manifest.
 */

export type SayChunk = { text: string; pauseAfter: number };
export type SayWord = { text: string; chunk: number };
export type ParsedSay = {
  chunks: SayChunk[];
  words: SayWord[];
  /** cue id → inclusive word index range */
  cues: Record<string, { from: number; to: number }>;
  plain: string;
};

const SAY_TOKEN = /\[pause(?:\s+(\d+(?:\.\d+)?))?\]|\{([^{}|]+)\|([a-z0-9][a-z0-9_-]*)\}/g;
export const DEFAULT_PAUSE = 0.5;

const splitWords = (s: string) => s.split(/\s+/).filter(Boolean);

export const parseSay = (say: string): ParsedSay => {
  const chunks: SayChunk[] = [];
  const words: SayWord[] = [];
  const cues: ParsedSay["cues"] = {};
  let current = "";

  const pushText = (text: string) => {
    const glued = text.length > 0 && !/^\s/.test(text) && current.length > 0 && !/\s$/.test(current);
    current += text;
    const parts = splitWords(text);
    if (glued && parts.length && words.length && words[words.length - 1].chunk === chunks.length) {
      words[words.length - 1].text += parts.shift();
    }
    for (const w of parts) words.push({ text: w, chunk: chunks.length });
  };

  let last = 0;
  for (const m of say.matchAll(SAY_TOKEN)) {
    pushText(say.slice(last, m.index));
    if (m[0].startsWith("[pause")) {
      chunks.push({ text: current.trim(), pauseAfter: m[1] ? parseFloat(m[1]) : DEFAULT_PAUSE });
      current = "";
    } else {
      const from = words.length;
      pushText(m[2]);
      cues[m[3]] = { from, to: Math.max(from, words.length - 1) };
    }
    last = (m.index ?? 0) + m[0].length;
  }
  pushText(say.slice(last));
  chunks.push({ text: current.trim(), pauseAfter: 0 });

  // Drop empty chunks (e.g. a leading [pause]) but keep their pause by folding it forward.
  const merged: SayChunk[] = [];
  const remap: number[] = [];
  let carry = 0;
  chunks.forEach((c, i) => {
    if (c.text === "") {
      if (merged.length) merged[merged.length - 1].pauseAfter += c.pauseAfter;
      else carry += c.pauseAfter;
      remap[i] = Math.max(0, merged.length - 1);
      return;
    }
    remap[i] = merged.length;
    merged.push({ ...c });
  });
  for (const w of words) w.chunk = remap[w.chunk] ?? 0;
  if (carry > 0 && merged.length) (merged as (SayChunk & { pauseBefore?: number })[])[0].pauseBefore = carry;

  return { chunks: merged, words, cues, plain: merged.map((c) => c.text).join(" ") };
};

/** Leading pause (from a `[pause]` at the very start of a beat), seconds. */
export const pauseBefore = (p: ParsedSay) => (p.chunks[0] as SayChunk & { pauseBefore?: number })?.pauseBefore ?? 0;

// ---------------------------------------------------------------- on-screen text

export type TextRun =
  | { kind: "text"; text: string }
  | { kind: "plate"; text: string; line?: string }
  | { kind: "strike"; text: string; index: number };

const TEXT_TOKEN = /\{([^{}|]+)(?:\|([a-z0-9][a-z0-9_-]*))?\}|~~(.+?)~~/g;

export const parseText = (s: string): TextRun[] => {
  // punctuation right after a plate rides on the plate, so it doesn't float after the badge
  s = s.replace(/\{([^{}|]+)(\|[a-z0-9][a-z0-9_-]*)?\}([.,;:!?]+)/g, "{$1$3$2}");
  const runs: TextRun[] = [];
  let last = 0;
  let strikeIndex = 0;
  for (const m of s.matchAll(TEXT_TOKEN)) {
    if ((m.index ?? 0) > last) runs.push({ kind: "text", text: s.slice(last, m.index) });
    if (m[3] !== undefined) runs.push({ kind: "strike", text: m[3], index: strikeIndex++ });
    else runs.push({ kind: "plate", text: m[1], line: m[2] });
    last = (m.index ?? 0) + m[0].length;
  }
  if (last < s.length) runs.push({ kind: "text", text: s.slice(last) });
  return runs;
};

/** Visible text without markup. */
export const plainText = (s: string) => parseText(s).map((r) => r.text).join("");

export const countWords = (s: string) => splitWords(plainText(s).replace(/[^\p{L}\p{N}'’\s.-]/gu, " ")).length;

/** Narration text without markup, for the linter's caption check. */
export const plainSay = (s: string) => parseSay(s).plain;
