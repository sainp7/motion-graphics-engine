import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { lerp, prog } from "../design/motion";
import { typeStyle, useLayout, useTheme } from "../design/theme";
import { LAYOUT } from "../design/tokens";
import { RichText } from "../primitives/RichText";
import { StationDot } from "../primitives/Station";
import type { Resolved } from "../spec/compile";
import type { ListSceneT } from "../spec/schema";
import { useSegment } from "../video/context";

/** Takeaways or steps as stops along one line. The line grows to each stop as it is spoken. */
export const List: React.FC<{ scene: Resolved<ListSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const { p, line, on } = useTheme();
  const { safe, scale } = useLayout();
  const { motion } = seg.choreo;
  const color = scene.line as Parameters<typeof line>[0];
  const n = scene.items.length;
  const titleH = scene.title ? 150 * scale : 0;
  const top = safe.y + titleH + 40 * scale;
  const avail = safe.h - titleH - 80 * scale;
  const step = Math.min(170 * scale, avail / n);
  const blockH = step * (n - 1);
  const y0 = top + (avail - blockH) / 2;
  const x = safe.x + 40 * scale;
  const dot = (scene.numbered ? 64 : 40) * scale;
  const titleP = prog(frame, Math.max(0, (scene.items[0]?.at ?? 0) - 10), motion.enterFrames, "glide");

  // the line is drawn up to the most recently revealed stop
  let reach = 0;
  scene.items.forEach((it, i) => {
    const t = prog(frame, (it.at ?? 0) - 6, 14, "glide");
    if (t > 0) reach = Math.max(reach, (i - 1 + t) * step);
  });

  return (
    <AbsoluteFill>
      {scene.title && (
        <div
          style={{
            position: "absolute",
            left: safe.x,
            top: safe.y + 20 * scale,
            ...typeStyle("title", scale),
            color: p.text,
            opacity: titleP,
            translate: `0 ${lerp(16, 0, titleP) * scale}px`,
          }}
        >
          {scene.title}
        </div>
      )}
      <div style={{ position: "absolute", left: x - (LAYOUT.stroke.line * scale) / 2, top: y0, width: LAYOUT.stroke.line * scale, height: blockH, borderRadius: 99, backgroundColor: p.track, opacity: 0.5 }} />
      <div
        style={{
          position: "absolute",
          left: x - (LAYOUT.stroke.line * scale) / 2,
          top: y0,
          width: LAYOUT.stroke.line * scale,
          height: Math.max(0, reach),
          borderRadius: 99,
          backgroundColor: line(color),
        }}
      />
      {scene.items.map((it, i) => {
        const at = it.at ?? 0;
        const r = prog(frame, at, motion.enterFrames, motion.enter);
        const y = y0 + i * step;
        return (
          <React.Fragment key={i}>
            <StationDot
              x={x}
              y={y}
              size={dot}
              color={line(color)}
              progress={prog(frame, at, 10, "snap")}
              number={scene.numbered ? i + 1 : undefined}
              numberColor={on(color)}
              fontSize={30 * scale}
            />
            <div
              style={{
                position: "absolute",
                left: x + dot / 2 + 40 * scale,
                top: y,
                translate: `${lerp(-20, 0, r) * scale}px -50%`,
                opacity: r,
                maxWidth: safe.w - dot - 100 * scale,
              }}
            >
              <div style={{ ...typeStyle("body", scale), fontWeight: 700, fontSize: 52 * scale, color: p.text }}>
                <RichText text={it.text} accent={seg.accent} plate={prog(frame, at + 8, 12)} scale={scale} />
              </div>
              {it.detail && (
                <div style={{ ...typeStyle("caption", scale), fontSize: 30 * scale, color: p.textDim, marginTop: 8 * scale }}>{it.detail}</div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
