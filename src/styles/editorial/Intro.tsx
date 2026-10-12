import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { lerp, prog } from "../../design/motion";
import { typeStyle, useLayout, useTheme } from "../../design/theme";
import type { IntroProps } from "../types";

/**
 * Editorial channel intro: a masthead. Double rules draw out from the centre, the channel name
 * sets letter by letter, the tagline follows in italic, and the page lifts away.
 */
export const EditorialIntro: React.FC<IntroProps> = ({ name, tagline, handle, durationInFrames, accent }) => {
  const frame = useCurrentFrame();
  const { p, line } = useTheme();
  const { width, scale, safe } = useLayout();
  const c = line(accent);
  const rule = prog(frame, 0, 18, "glide");
  const out = prog(frame, durationInFrames - 14, 14, "exit");
  const ruleW = (width - 2 * safe.x) * rule;
  const letters = [...name];
  return (
    <AbsoluteFill style={{ backgroundColor: p.bg, justifyContent: "center", alignItems: "center", translate: `0 ${lerp(0, -80, out) * scale}px`, opacity: 1 - out }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * scale }}>
        <div style={{ width: ruleW, height: 6 * scale, backgroundColor: p.text }} />
        <div style={{ width: ruleW, height: 2 * scale, backgroundColor: p.text, marginBottom: 26 * scale }} />
        <div style={{ ...typeStyle("display", scale), fontSize: 170 * scale, color: p.text, whiteSpace: "pre", display: "flex" }}>
          {letters.map((ch, i) => {
            const r = prog(frame, 8 + i * 1.4, 14, "glide");
            return (
              <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.12em", marginBottom: "-0.12em" }}>
                <span style={{ display: "inline-block", translate: `0 ${lerp(100, 0, r)}%`, opacity: Math.min(1, r * 2) }}>{ch}</span>
              </span>
            );
          })}
        </div>
        {tagline && (
          <div style={{ ...typeStyle("title", scale), color: p.textDim, fontStyle: "italic", marginTop: 6 * scale, opacity: prog(frame, 26, 16, "glide") }}>{tagline}</div>
        )}
        <div style={{ width: ruleW, height: 2 * scale, backgroundColor: p.text, marginTop: 30 * scale }} />
        <div style={{ ...typeStyle("micro", scale), color: c, marginTop: 14 * scale, opacity: prog(frame, 34, 12, "glide") }}>{handle}</div>
      </div>
    </AbsoluteFill>
  );
};
