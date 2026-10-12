import { Easing, interpolate } from "remotion";
import { activeTokens } from "./style-tokens";
import type { EaseName } from "./tokens";

const cache = new Map<string, (t: number) => number>();

/** Easing function for a named curve from the active style's token set. */
export const ease = (name: EaseName) => {
  const tok = activeTokens();
  const key = `${tok.id}:${name}`;
  let fn = cache.get(key);
  if (!fn) {
    const [a, b, c, d] = tok.ease[name];
    fn = Easing.bezier(a, b, c, d);
    cache.set(key, fn);
  }
  return fn;
};

/**
 * 0→1 progress of an animation that starts at `start` and lasts `dur` frames.
 * Clamped on both sides, so it is safe to call for any frame.
 */
export const prog = (frame: number, start: number, dur: number, curve: EaseName = "glide") => {
  if (dur <= 0) return frame >= start ? 1 : 0;
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease(curve),
  });
};

/** Linear map with clamping, for when you already have a 0–1 progress. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A short decaying shake, used when something fails. Returns px offset. */
export const shake = (framesSince: number, amplitude: number) => {
  if (framesSince < 0 || framesSince > 14) return 0;
  const decay = 1 - framesSince / 14;
  return Math.sin(framesSince * 2.4) * amplitude * decay;
};

/** Scale frame counts authored at 30fps to the composition fps. */
export const f30 = (frames: number, fps: number) => Math.round((frames * fps) / 30);
