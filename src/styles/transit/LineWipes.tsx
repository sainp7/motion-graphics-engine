import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, prog } from "../../design/motion";
import { useTheme } from "../../design/theme";
import type { Compiled } from "../../spec/compile";

/** Transit's signature transition: a band in the next line's colour sweeps across, like a train passing. */
export const LineWipes: React.FC<{ compiled: Compiled }> = ({ compiled }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const { line } = useTheme();
  const half = 8;
  const active = compiled.segments.find((s, i) => {
    if (s.transitionOut !== "line-wipe" || i === compiled.segments.length - 1) return false;
    const b = s.from + s.durationInFrames;
    return frame >= b - half && frame < b + half;
  });
  if (!active) return null;
  const next = compiled.segments[active.index + 1];
  const b = active.from + active.durationInFrames;
  const color = line(next.accent);
  const inP = prog(frame, b - half, half, "snap");
  const outP = prog(frame, b, half, "exit");
  const left = lerp(0, width, outP);
  const right = lerp(0, width, inP);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left, width: Math.max(0, right - left), backgroundColor: color }} />
    </AbsoluteFill>
  );
};
