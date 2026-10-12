import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, prog } from "../../design/motion";
import { useTheme } from "../../design/theme";
import type { Compiled } from "../../spec/compile";

/** Editorial's transition: an ink page with an accent edge sweeps across, like turning a page. */
export const PageWipe: React.FC<{ compiled: Compiled }> = ({ compiled }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const { p, line } = useTheme();
  const half = 9;
  const active = compiled.segments.find((s, i) => {
    if (s.transitionOut !== "line-wipe" || i === compiled.segments.length - 1) return false;
    const b = s.from + s.durationInFrames;
    return frame >= b - half && frame < b + half;
  });
  if (!active) return null;
  const next = compiled.segments[active.index + 1];
  const b = active.from + active.durationInFrames;
  const inP = prog(frame, b - half, half, "snap");
  const outP = prog(frame, b, half, "snap");
  const left = lerp(0, width, outP);
  const right = lerp(0, width, inP);
  const edge = 18;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left, width: Math.max(0, right - left), backgroundColor: p.text }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: right - edge, width: edge, backgroundColor: line(next.accent), opacity: inP < 1 ? 1 : 0 }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: left - edge, width: edge, backgroundColor: line(next.accent), opacity: outP > 0 && outP < 1 ? 1 : 0 }} />
    </AbsoluteFill>
  );
};
