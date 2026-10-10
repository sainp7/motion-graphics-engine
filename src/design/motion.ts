import { Easing, interpolate } from "remotion";
import { EASE, EaseName } from "./tokens";

const cache = new Map<EaseName, (t: number) => number>();

/** Easing function for a named curve from the token set. */
export const ease = (name: EaseName) => {
  let fn = cache.get(name);
  if (!fn) {
    const [a, b, c, d] = EASE[name];
    fn = Easing.bezier(a, b, c, d);
    cache.set(name, fn);
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
