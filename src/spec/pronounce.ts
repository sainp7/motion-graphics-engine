/**
 * Pronunciation dictionary (library/pronunciation.json): how the narrator says tech terms.
 * Applied to the text sent to TTS only; on-screen text and cue positions are unchanged.
 */
import dict from "../../library/pronunciation.json";

const WORDS = (dict as { words: Record<string, string> }).words;
const entries = Object.entries(WORDS).sort((a, b) => b[0].length - a[0].length);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RE = entries.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${entries.map(([k]) => escape(k)).join("|")})(?![\\p{L}\\p{N}])`, "giu") : null;
const lookup = new Map(entries.map(([k, v]) => [k.toLowerCase(), v]));

/** Replace dictionary words with their spoken form. */
export const speak = (text: string) => (RE ? text.replace(RE, (m) => lookup.get(m.toLowerCase()) ?? m) : text);
