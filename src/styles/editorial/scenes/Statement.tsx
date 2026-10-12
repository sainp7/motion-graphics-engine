import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { lerp, prog } from "../../../design/motion";
import { typeStyle, useLayout, useTheme } from "../../../design/theme";
import type { Resolved } from "../../../spec/compile";
import type { StatementSceneT } from "../../../spec/schema";
import { useSegment } from "../../../video/context";
import { KineticText, Rule } from "../Kinetic";

const ROLE = { xl: "display", lg: "headline", md: "title" } as const;
/** A small-caps kicker names what kind of statement this is, like a magazine section label. */
const KICKER: Record<string, string> = { myth: "The myth", failure: "What breaks", insight: "Remember this", "big-number": "By the numbers" };

export const EditorialStatement: React.FC<{ scene: Resolved<StatementSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const { p, line } = useTheme();
  const { safe, scale } = useLayout();
  const size = scene.size ?? seg.choreo.text.size;
  const role = ROLE[size];
  const center = (scene.align ?? seg.choreo.text.align) === "center";
  const hook = seg.choreo.id === "cold-open";
  const reveal = scene.reveal ?? [];
  const first = reveal[0] ?? 0;
  const last = reveal[reveal.length - 1] ?? 0;
  const kicker = KICKER[seg.choreo.id];
  const strikeAt = (index: number) => {
    const a = scene.actions.find((x) => x.do === "strike" && (x.index === undefined || x.index === index));
    return a ? prog(frame, a.at, 12, "snap") : 0;
  };
  const dimLine = (i: number) => {
    const a = scene.actions.find((x) => x.do === "dim-line" && x.index === i);
    return a ? prog(frame, a.at, 12, "glide") : 0;
  };
  const accent = line(seg.accent);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: center ? "center" : "flex-start", padding: `0 ${safe.x}px` }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: center ? "center" : "flex-start", maxWidth: safe.w }}>
        {kicker && (
          <div style={{ display: "flex", alignItems: "center", gap: 18 * scale, marginBottom: 30 * scale, opacity: prog(frame, Math.max(0, first - 8), 12, "glide") }}>
            <Rule at={Math.max(0, first - 8)} width={64 * scale} color={accent} thickness={4 * scale} />
            <span style={{ ...typeStyle("micro", scale), color: accent }}>{kicker}</span>
          </div>
        )}
        {scene.lines.map((text, i) => (
          <div
            key={i}
            style={{
              ...typeStyle(role, scale),
              ...(hook ? { fontSize: typeStyle(role, scale).fontSize as number * 1.12 } : {}),
              color: p.text,
              textAlign: center ? "center" : "left",
              whiteSpace: "nowrap",
            }}
          >
            <KineticText text={text} at={reveal[i] ?? 0} accent={seg.accent} stagger={hook ? 3.5 : 2.5} dur={hook ? 12 : 14} strike={strikeAt} dim={dimLine(i)} />
          </div>
        ))}
        {scene.underline && <Rule at={last + 10} width={Math.min(safe.w, 900 * scale)} color={line(scene.underline)} thickness={8 * scale} style={{ marginTop: 34 * scale }} />}
        {scene.note && (
          <div style={{ ...typeStyle("caption", scale), color: p.textDim, marginTop: 30 * scale, fontStyle: "italic", opacity: prog(frame, last + 14, 14, "glide"), translate: `0 ${lerp(8, 0, prog(frame, last + 14, 14, "glide"))}px` }}>
            {scene.note}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
