import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ease, lerp, prog } from "../design/motion";
import { typeStyle, useLayout, useTheme } from "../design/theme";
import { LAYOUT } from "../design/tokens";
import { RichText } from "../primitives/RichText";
import type { Resolved } from "../spec/compile";
import type { StatSceneT } from "../spec/schema";
import { useSegment, useVideo } from "../video/context";

const fmt = (v: number, decimals: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** A number that carries the stakes, counting up, with optional bars comparing it to a limit. */
export const Stat: React.FC<{ scene: Resolved<StatSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const video = useVideo();
  const { p, line } = useTheme();
  const { safe, scale } = useLayout();
  const { motion } = seg.choreo;
  const countFrames = Math.round(scene.countSeconds * video.fps);
  const enter = prog(frame, scene.at, motion.enterFrames, motion.enter);
  const value = interpolate(frame, [scene.at, scene.at + countFrames], [scene.from, scene.value], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease("drift"),
  });
  const labelP = prog(frame, scene.at + 6, motion.enterFrames, "glide");
  const max = Math.max(scene.value, ...scene.bars.map((b) => b.value));
  const numberColor = scene.line ? line(scene.line) : p.text;

  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: safe.x, paddingRight: safe.x }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18 * scale, opacity: enter, translate: `0 ${lerp(40, 0, enter) * scale}px` }}>
        {scene.prefix && <span style={{ ...typeStyle("title", scale), color: p.textDim }}>{scene.prefix}</span>}
        <span style={{ ...typeStyle("numeral", scale), color: numberColor }}>{fmt(value, scene.decimals)}</span>
        {scene.suffix && <span style={{ ...typeStyle("title", scale), color: p.textDim }}>{scene.suffix}</span>}
      </div>
      <div
        style={{
          ...typeStyle("title", scale),
          color: p.text,
          marginTop: 26 * scale,
          opacity: labelP,
          translate: `0 ${lerp(16, 0, labelP) * scale}px`,
        }}
      >
        <RichText text={scene.label} accent={seg.accent} plate={prog(frame, scene.at + 14, 12)} scale={scale} />
      </div>
      {scene.bars.length > 0 && (
        <div style={{ marginTop: 64 * scale, display: "flex", flexDirection: "column", gap: 30 * scale, width: safe.w }}>
          {scene.bars.map((b, i) => {
            const bp = prog(frame, b.at ?? 0, 26, "glide");
            const w = (b.value / max) * safe.w * 0.92;
            return (
              <div key={i} style={{ opacity: Math.min(1, bp * 2) }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 18 * scale, whiteSpace: "nowrap" }}>
                  <span style={{ ...typeStyle("label", scale), fontWeight: 560, color: p.textDim }}>{b.label}</span>
                  <span style={{ ...typeStyle("label", scale), color: line(b.line), opacity: bp }}>{fmt(b.value, 0)}</span>
                </div>
                <div style={{ position: "relative", height: 16 * scale, marginTop: 10 * scale, width: safe.w * 0.92 }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 99, backgroundColor: p.track, opacity: 0.45 }} />
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: w * bp,
                      borderRadius: 99,
                      backgroundColor: line(b.line),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {scene.note && (
        <div style={{ ...typeStyle("caption", scale), color: p.textFaint, marginTop: 40 * scale, opacity: labelP }}>{scene.note}</div>
      )}
      <div style={{ height: LAYOUT.space }} />
    </AbsoluteFill>
  );
};
