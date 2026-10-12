import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { lerp, prog } from "../../../design/motion";
import { typeStyle, useLayout, useTheme } from "../../../design/theme";
import { RichText } from "../../../primitives/RichText";
import type { Resolved } from "../../../spec/compile";
import type { ListSceneT } from "../../../spec/schema";
import { useSegment, useVideo } from "../../../video/context";
import { Rule } from "../Kinetic";

/** A numbered column: each item a ruled row with a serif numeral, arriving as it is spoken. */
export const EditorialList: React.FC<{ scene: Resolved<ListSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const video = useVideo();
  const { p, line } = useTheme();
  const { safe, scale } = useLayout();
  const c = line(video.lineColor(scene.line));
  const first = scene.items[0]?.at ?? 0;
  return (
    <AbsoluteFill style={{ padding: `${safe.y + 10 * scale}px ${safe.x}px`, justifyContent: "center" }}>
      {scene.title && (
        <div style={{ opacity: prog(frame, Math.max(0, first - 12), 14, "glide") }}>
          <div style={{ ...typeStyle("micro", scale), color: c }}>In short</div>
          <div style={{ ...typeStyle("headline", scale), fontSize: 80 * scale, color: p.text, marginTop: 10 * scale }}>{scene.title}</div>
        </div>
      )}
      <div style={{ marginTop: 40 * scale }}>
        {scene.items.map((it, i) => {
          const at = it.at ?? 0;
          const r = prog(frame, at, 16, "glide");
          return (
            <div key={i}>
              <Rule at={at - 4} width={safe.w} color={p.track} thickness={2 * scale} />
              <div style={{ display: "flex", gap: 40 * scale, alignItems: "baseline", padding: `${22 * scale}px 0`, opacity: r, translate: `0 ${lerp(24, 0, r) * scale}px` }}>
                <div style={{ ...typeStyle("title", scale), color: c, width: 90 * scale, fontVariantNumeric: "tabular-nums" }}>{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <div style={{ ...typeStyle("title", scale), color: p.text }}>
                    <RichText text={it.text} accent={seg.accent} plate={prog(frame, at + 10, 12, "glide")} scale={scale} />
                  </div>
                  {it.detail && <div style={{ ...typeStyle("body", scale), fontSize: 30 * scale, color: p.textDim, marginTop: 6 * scale }}>{it.detail}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
