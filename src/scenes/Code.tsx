import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { lerp, prog } from "../design/motion";
import { typeStyle, useLayout, useTheme } from "../design/theme";
import { LAYOUT, alpha } from "../design/tokens";
import { Heading } from "../primitives/Heading";
import type { Resolved } from "../spec/compile";
import type { CodeSceneT } from "../spec/schema";
import { useSegment, useVideo } from "../video/context";

/** Literal code, config or commands. Lines arrive in a quick stagger; highlights point at the part being explained. */
export const Code: React.FC<{ scene: Resolved<CodeSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const video = useVideo();
  const { p, line } = useTheme();
  const { safe, scale } = useLayout();
  const fs = 36 * scale;
  const lh = fs * 1.5;
  const panelP = prog(frame, 2, seg.choreo.motion.enterFrames, "glide");

  // the active highlight is the latest highlight action not yet reset
  let hl: { from: number; to: number; at: number; color: string } | null = null;
  for (const a of scene.actions) {
    if (a.at > frame) continue;
    if (a.do === "highlight") hl = { from: a.lines[0], to: a.lines[1], at: a.at, color: line(video.lineColor(a.line, seg.accent)) };
    if (a.do === "reset") hl = null;
  }
  const hp = hl ? prog(frame, hl.at, 12, "glide") : 0;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 44 * scale, maxWidth: safe.w }}>
      {scene.heading && <Heading text={scene.heading} accent={seg.accent} at={0} />}
      <div
        style={{
          position: "relative",
          minWidth: safe.w * 0.62,
          maxWidth: safe.w,
          padding: `${56 * scale}px ${64 * scale}px`,
          borderRadius: LAYOUT.radius.node * 1.4 * scale,
          backgroundColor: p.surface,
          border: `${LAYOUT.stroke.border * scale}px solid ${p.track}`,
          opacity: panelP,
          translate: `0 ${lerp(30, 0, panelP) * scale}px`,
        }}
      >
        {scene.title && (
          <div style={{ ...typeStyle("caption", scale), color: p.textDim, marginBottom: 28 * scale }}>{scene.title}</div>
        )}
        <div style={{ position: "relative" }}>
          {hl && (
            <div
              style={{
                position: "absolute",
                left: -28 * scale,
                right: -28 * scale,
                top: (hl.from - 1) * lh - 4 * scale,
                height: (hl.to - hl.from + 1) * lh + 8 * scale,
                borderRadius: LAYOUT.radius.chip * scale,
                backgroundColor: alpha(hl.color, 0.16 * hp),
                borderLeft: `${6 * scale}px solid ${alpha(hl.color, hp)}`,
              }}
            />
          )}
          {scene.lines.map((l, i) => {
            const r = prog(frame, 6 + i * 2, 12, "glide");
            const inHl = hl && i + 1 >= hl.from && i + 1 <= hl.to;
            return (
              <div
                key={i}
                style={{
                  ...typeStyle("code", scale),
                  fontSize: fs,
                  lineHeight: `${lh}px`,
                  height: lh,
                  whiteSpace: "pre",
                  display: "flex",
                  gap: 36 * scale,
                  opacity: r * (hl && !inHl ? lerp(1, 0.4, hp) : 1),
                  translate: `${lerp(-12, 0, r) * scale}px 0`,
                }}
              >
                <span style={{ color: p.textFaint, width: 40 * scale, textAlign: "right" }}>{i + 1}</span>
                <span style={{ color: p.text }}>{l}</span>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </AbsoluteFill>
  );
};
