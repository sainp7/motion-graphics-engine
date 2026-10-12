import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, prog } from "../../../design/motion";
import { typeStyle, useLayout, useTheme } from "../../../design/theme";
import { RichText } from "../../../primitives/RichText";
import type { Resolved } from "../../../spec/compile";
import type { StatSceneT } from "../../../spec/schema";
import { useSegment, useVideo } from "../../../video/context";

const fmt = (v: number, d: number) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/** A figure set like a magazine chart: a huge serif number, its meaning as a deck, ruled bars. */
export const EditorialStat: React.FC<{ scene: Resolved<StatSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seg = useSegment();
  const video = useVideo();
  const { p, line } = useTheme();
  const { safe, scale } = useLayout();
  const count = prog(frame, scene.at, Math.round(scene.countSeconds * fps), "glide");
  const v = lerp(scene.from, scene.value, count);
  const appear = prog(frame, scene.at, 10, "glide");
  const max = Math.max(1, ...scene.bars.map((b) => b.value));
  const color = scene.line ? line(video.lineColor(scene.line)) : p.text;
  return (
    <AbsoluteFill style={{ padding: `${safe.y + 30 * scale}px ${safe.x}px` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18 * scale, opacity: appear }}>
        <span style={{ ...typeStyle("numeral", scale), color }}>
          {scene.prefix}
          {fmt(v, scene.decimals)}
        </span>
        {scene.suffix && <span style={{ ...typeStyle("title", scale), color: p.textDim, fontStyle: "italic" }}>{scene.suffix}</span>}
      </div>
      <div style={{ ...typeStyle("title", scale), color: p.text, marginTop: 14 * scale, maxWidth: safe.w * 0.8, opacity: prog(frame, scene.at + 8, 14, "glide") }}>
        <RichText text={scene.label} accent={seg.accent} plate={prog(frame, scene.at + 16, 14, "glide")} scale={scale} />
      </div>
      <div style={{ marginTop: 60 * scale, display: "flex", flexDirection: "column", gap: 34 * scale }}>
        {scene.bars.map((b, i) => {
          const t = prog(frame, b.at ?? scene.at + 20 + i * 10, 22, "glide");
          const w = safe.w - 560 * scale;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 28 * scale, opacity: Math.min(1, t * 2) }}>
              <div style={{ width: 360 * scale, ...typeStyle("label", scale), color: p.text }}>{b.label}</div>
              <div style={{ position: "relative", width: w, height: 14 * scale }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2 * scale, backgroundColor: p.track }} />
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: (w * b.value * t) / max, backgroundColor: line(video.lineColor(b.line)) }} />
              </div>
              <div style={{ width: 140 * scale, textAlign: "right", ...typeStyle("title", scale), fontSize: 44 * scale, color: p.text }}>{fmt(b.value * t, 0)}</div>
            </div>
          );
        })}
      </div>
      {scene.note && <div style={{ ...typeStyle("caption", scale), color: p.textDim, marginTop: 40 * scale, fontStyle: "italic" }}>{scene.note}</div>}
    </AbsoluteFill>
  );
};
