import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { lerp, prog } from "../../design/motion";
import { typeStyle, useLayout, useTheme } from "../../design/theme";
import { LAYOUT } from "../../design/tokens";
import type { IntroProps } from "../types";

/**
 * Transit channel intro (≈3.5 s): a line draws across the frame, three stations stop on it, the
 * channel name rises out of the line and the tagline follows; then the line runs on off the right
 * edge and takes everything with it, into the first chapter.
 */
export const TransitIntro: React.FC<IntroProps> = ({ name, tagline, handle, durationInFrames, accent }) => {
  const frame = useCurrentFrame();
  const { p, line, on } = useTheme();
  const { width, height, scale, safe } = useLayout();
  const c = line(accent);
  const y = height * 0.58;
  const h = LAYOUT.stroke.line * 1.6 * scale;
  const draw = prog(frame, 0, 16, "snap");
  const out = prog(frame, durationInFrames - 16, 16, "exit");
  const stops = [0.18, 0.5, 0.82];
  const nameP = prog(frame, 10, 18, "glide");
  const tagP = prog(frame, 22, 16, "glide");
  const handleP = prog(frame, 30, 14, "glide");
  const shift = lerp(0, -width * 0.35, out);
  return (
    <AbsoluteFill style={{ backgroundColor: p.bg, opacity: 1 - prog(frame, durationInFrames - 6, 6, "exit") }}>
      <div style={{ position: "absolute", left: 0, top: y - h / 2, width: width * draw + width * out, height: h, backgroundColor: c, borderRadius: 99 }} />
      {stops.map((x, i) => {
        const s = prog(frame, 6 + i * 4, 10, "snap") * (1 - out);
        const d = 44 * scale;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x * width - d / 2 + shift,
              top: y - d / 2,
              width: d,
              height: d,
              borderRadius: 99,
              boxSizing: "border-box",
              backgroundColor: p.bg,
              border: `${9 * scale}px solid ${c}`,
              scale: `${s}`,
            }}
          />
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: height - y + 46 * scale, display: "flex", justifyContent: "center", overflow: "hidden", translate: `${shift}px 0` }}>
        <div style={{ ...typeStyle("display", scale), color: p.text, whiteSpace: "nowrap", translate: `0 ${lerp(110, 0, nameP)}%`, opacity: Math.min(1, nameP * 2) * (1 - out) }}>{name}</div>
      </div>
      {tagline && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: y + 46 * scale,
            textAlign: "center",
            ...typeStyle("title", scale),
            color: p.textDim,
            opacity: tagP * (1 - out),
            translate: `${shift}px ${lerp(14, 0, tagP) * scale}px`,
            whiteSpace: "nowrap",
          }}
        >
          {tagline}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          right: safe.x,
          bottom: safe.y,
          ...typeStyle("label", scale),
          padding: `${6 * scale}px ${14 * scale}px`,
          borderRadius: LAYOUT.radius.chip * scale,
          backgroundColor: c,
          color: on(accent),
          opacity: handleP * (1 - out),
        }}
      >
        {handle}
      </div>
    </AbsoluteFill>
  );
};
