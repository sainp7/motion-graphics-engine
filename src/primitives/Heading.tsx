import React from "react";
import { useCurrentFrame } from "remotion";
import { lerp, prog } from "../design/motion";
import { typeStyle, useLayout, useTheme } from "../design/theme";
import { LAYOUT, LineColor } from "../design/tokens";
import { RichText } from "./RichText";

/**
 * Scene heading: signage that names what is on screen ("Fix 1: coalesce the misses").
 * A short line stub in the accent colour, then the words; plates in the text are allowed.
 */
export const Heading: React.FC<{ text: string; accent: LineColor; at?: number; style?: React.CSSProperties }> = ({ text, accent, at = 0, style }) => {
  const frame = useCurrentFrame();
  const { line } = useTheme();
  const { scale } = useLayout();
  const p = useTheme().p;
  const stub = prog(frame, at, 12, "snap");
  const r = prog(frame, at + 4, 16, "glide");
  const plate = prog(frame, at + 14, 12, "glide");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 26 * scale, whiteSpace: "nowrap", ...style }}>
      <div
        style={{
          width: 56 * scale,
          height: LAYOUT.stroke.line * scale,
          borderRadius: 99,
          backgroundColor: line(accent),
          scale: `${stub} 1`,
          transformOrigin: "left center",
          flex: "none",
        }}
      />
      <div style={{ ...typeStyle("title", scale), color: p.text, opacity: r, translate: `${lerp(-18, 0, r) * scale}px 0` }}>
        <RichText text={text} accent={accent} plate={plate} scale={scale} />
      </div>
    </div>
  );
};
