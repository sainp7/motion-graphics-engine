/**
 * The custom-scene kit: everything a hand-coded scene in videos/<id>/scenes/*.tsx may build on.
 *
 * A custom scene is free in what it draws and how it moves, and bound to the studio in three ways:
 *   1. look   colours from useTheme() (p.* and line(c)), type from typeStyle(), sizes × useLayout().scale
 *   2. time   everything is a function of useCurrentFrame(); moments come from `cues` (frames,
 *             keyed to narration words) and curves from prog()/ease() — never CSS animation or Math.random
 *   3. sound  sfx come from the spec (cue reveals or explicit sfx actions), music and voice are mixed for you
 *
 * Import from "../../../src/custom/kit" only; that keeps the contract in one place.
 */
import { useMemo } from "react";
import { useVideoConfig } from "remotion";
import type { LineColor } from "../design/tokens";
import { useSegment } from "../video/context";

export type CustomSceneProps<P = Record<string, unknown>> = {
  /** Named moments from the spec's `cues`, resolved to frames from the start of the segment. */
  cues: Record<string, number>;
  /** Free data from the spec's `props`. */
  props: P;
  /** Segment length in frames, including the exit transition. */
  durationInFrames: number;
  /** The segment's accent line colour. */
  accent: LineColor;
};

/** Narration words with frame times relative to the segment, for type that moves with the voice. */
export const useNarration = () => {
  const seg = useSegment();
  const { fps } = useVideoConfig();
  return useMemo(
    () =>
      seg.beats.flatMap((b) =>
        b.timing.words.map((w) => ({ word: w.w, from: b.from + Math.round(w.s * fps), to: b.from + Math.round(w.e * fps) })),
      ),
    [seg, fps],
  );
};

/** A cue's frame, or a fallback when the spec does not name it (keeps previews working). */
export const cue = (cues: Record<string, number>, name: string, fallback = 0) => cues[name] ?? fallback;

export { AbsoluteFill, Easing, Sequence, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
export { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
export { useTheme, useLayout, typeStyle } from "../design/theme";
export { LAYOUT, TYPE, EASE, LINE_COLORS, alpha, mix, type LineColor } from "../design/tokens";
export { prog, lerp, ease, shake } from "../design/motion";
export { RichText } from "../primitives/RichText";
export { Heading } from "../primitives/Heading";
export { StationDot } from "../primitives/Station";
export { KindIcon } from "../primitives/Icon";
export { useSegment, useVideo } from "../video/context";
