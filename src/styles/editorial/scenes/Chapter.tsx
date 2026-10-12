import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { lerp, prog } from "../../../design/motion";
import { typeStyle, useLayout, useTheme } from "../../../design/theme";
import type { Resolved } from "../../../spec/compile";
import type { ChapterSceneT } from "../../../spec/schema";
import { useSegment, useVideo } from "../../../video/context";
import { KineticText, Rule } from "../Kinetic";

const two = (n: number) => String(n).padStart(2, "0");

/** A numbered section opener: a big numeral, the question as a headline, and the table of contents. */
export const EditorialChapter: React.FC<{ scene: Resolved<ChapterSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const video = useVideo();
  const { p, line } = useTheme();
  const { safe, scale, height } = useLayout();
  const c = line(video.lineColor(scene.line));
  const stops = video.segments.filter((s) => s.scene.type === "chapter").map((s) => ({ id: s.id, scene: s.scene as Resolved<ChapterSceneT> }));
  const here = stops.findIndex((s) => s.id === seg.id);
  const num = scene.number ?? here + 1;
  const numP = prog(frame, 2, 18, "glide");
  const col = safe.x + 400 * scale;
  const colW = safe.w - 400 * scale;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: safe.x - 10 * scale,
          top: height * 0.22,
          ...typeStyle("numeral", scale),
          fontSize: 360 * scale,
          color: c,
          opacity: numP,
          translate: `0 ${lerp(40, 0, numP) * scale}px`,
        }}
      >
        {two(num)}
      </div>
      <div style={{ position: "absolute", left: col, top: height * 0.28, width: colW }}>
        <Rule at={4} width={colW} color={p.text} thickness={3 * scale} />
        <div style={{ ...typeStyle("micro", scale), color: c, marginTop: 22 * scale, opacity: prog(frame, 8, 12, "glide") }}>
          {stops.length > 1 && here >= 0 ? `Chapter ${here + 1} of ${stops.length}` : "Chapter"}
        </div>
        <div style={{ ...typeStyle("headline", scale), color: p.text, marginTop: 18 * scale }}>
          <KineticText text={scene.title} at={10} accent={seg.accent} />
        </div>
        {scene.subtitle && (
          <div style={{ ...typeStyle("body", scale), color: p.textDim, marginTop: 22 * scale, opacity: prog(frame, 22, 14, "glide"), fontStyle: "italic" }}>{scene.subtitle}</div>
        )}
      </div>
      {stops.length > 1 && here >= 0 && (
        <div style={{ position: "absolute", left: safe.x, right: safe.x, bottom: safe.y + 10 * scale, opacity: prog(frame, 16, 16, "glide") }}>
          <Rule at={14} width={safe.w} color={p.track} thickness={2 * scale} />
          <div style={{ display: "flex", gap: 56 * scale, marginTop: 20 * scale }}>
            {stops.map((s, i) => (
              <div key={s.id} style={{ display: "flex", gap: 14 * scale, alignItems: "baseline", color: i === here ? p.text : i < here ? p.textDim : p.textFaint }}>
                <span style={{ ...typeStyle("label", scale), fontVariantNumeric: "tabular-nums", color: i === here ? c : undefined }}>{two(s.scene.number ?? i + 1)}</span>
                <span style={{ ...typeStyle("label", scale), fontWeight: i === here ? 700 : 500 }}>{s.scene.short ?? s.scene.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
