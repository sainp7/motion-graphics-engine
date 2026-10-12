import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { prog } from "../../../design/motion";
import { typeStyle, useLayout, useTheme } from "../../../design/theme";
import type { Resolved } from "../../../spec/compile";
import type { OutroSceneT } from "../../../spec/schema";
import { useSegment } from "../../../video/context";
import { KineticText, Rule } from "../Kinetic";

/** The sign-off: the closing line set large, a rule, the byline and what is next. */
export const EditorialOutro: React.FC<{ scene: Resolved<OutroSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const { p, line } = useTheme();
  const { safe, scale } = useLayout();
  const c = line(seg.accent);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${safe.x}px` }}>
      <div style={{ ...typeStyle("headline", scale), color: p.text, maxWidth: safe.w }}>
        <KineticText text={scene.text} at={10} accent={seg.accent} />
      </div>
      <Rule at={30} width={safe.w * 0.5} color={p.text} thickness={3 * scale} style={{ marginTop: 44 * scale }} />
      <div style={{ display: "flex", gap: 28 * scale, alignItems: "baseline", marginTop: 26 * scale, opacity: prog(frame, 36, 14, "glide") }}>
        <span style={{ ...typeStyle("title", scale), color: c, fontStyle: "italic" }}>{scene.handle}</span>
        <span style={{ ...typeStyle("body", scale), color: p.textDim }}>{scene.cta}</span>
      </div>
      {scene.next && (
        <div style={{ ...typeStyle("caption", scale), color: p.textDim, marginTop: 30 * scale, opacity: prog(frame, 48, 14, "glide") }}>
          <span style={{ ...typeStyle("micro", scale), color: c, marginRight: 14 * scale }}>Next</span>
          {scene.next}
        </div>
      )}
    </AbsoluteFill>
  );
};
