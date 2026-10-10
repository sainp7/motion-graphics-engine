import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { lerp, prog } from "../design/motion";
import { typeStyle, useLayout, useTheme } from "../design/theme";
import { LAYOUT } from "../design/tokens";
import { RichText } from "../primitives/RichText";
import type { Resolved } from "../spec/compile";
import type { OutroSceneT } from "../spec/schema";
import { useSegment, useVideo } from "../video/context";

/** The closing line, then the handle on a plate and the call to action. */
export const Outro: React.FC<{ scene: Resolved<OutroSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const video = useVideo();
  const { p, line, on } = useTheme();
  const { safe, scale } = useLayout();
  const t0 = Math.round(0.35 * video.fps);
  const lineP = prog(frame, t0, seg.choreo.motion.enterFrames, "glide");
  const mid = seg.beats.length > 1 ? seg.beats[1].from : Math.round(seg.durationInFrames * 0.45);
  const ctaP = prog(frame, mid, 18, "glide");
  const nextP = prog(frame, mid + 12, 18, "glide");
  const c = seg.accent;
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: safe.x, paddingRight: safe.x }}>
      <div
        style={{
          ...typeStyle("headline", scale),
          color: p.text,
          maxWidth: safe.w * 0.9,
          opacity: lineP,
          translate: `0 ${lerp(30, 0, lineP) * scale}px`,
        }}
      >
        <RichText text={scene.text} accent={c} plate={prog(frame, t0 + 12, 12)} scale={scale} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 28 * scale, marginTop: 72 * scale, opacity: ctaP, translate: `0 ${lerp(20, 0, ctaP) * scale}px` }}>
        <div
          style={{
            ...typeStyle("title", scale),
            padding: `${14 * scale}px ${28 * scale}px ${8 * scale}px`,
            borderRadius: LAYOUT.radius.plate * scale,
            backgroundColor: line(c),
            color: on(c),
          }}
        >
          {scene.handle}
        </div>
        <div style={{ ...typeStyle("body", scale), color: p.textDim }}>{scene.cta}</div>
      </div>
      {scene.next && (
        <div style={{ ...typeStyle("caption", scale), fontSize: 30 * scale, color: p.textFaint, marginTop: 40 * scale, opacity: nextP }}>
          Next: {scene.next}
        </div>
      )}
    </AbsoluteFill>
  );
};
