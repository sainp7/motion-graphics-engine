import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { prog, lerp, shake } from "../design/motion";
import { typeStyle, useLayout, useTheme } from "../design/theme";
import { LAYOUT } from "../design/tokens";
import { RichText } from "../primitives/RichText";
import type { Resolved } from "../spec/compile";
import type { StatementSceneT } from "../spec/schema";
import { useSegment } from "../video/context";

const ROLE = { xl: "display", lg: "headline", md: "title" } as const;

/**
 * Signage, not captions: a few large words, revealed line by line through a mask,
 * with plates for the words that carry the idea and an optional track underline.
 *
 * In a cold open the same scene becomes a hook: centred, each line slams in from oversize with a
 * jolt, accent rings pulse out behind it on every reveal and the first hit flashes the frame.
 * It must not look like any later slide.
 */
export const Statement: React.FC<{ scene: Resolved<StatementSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const { p, line } = useTheme();
  const { safe, scale } = useLayout();
  const { motion } = seg.choreo;
  const size = scene.size ?? seg.choreo.text.size;
  const role = ROLE[size];
  const reveal = scene.reveal ?? [];
  const hook = seg.choreo.id === "cold-open";
  const center = (scene.align ?? seg.choreo.text.align) === "center";

  const strikeAt = (index: number) => {
    const a = scene.actions.find((x) => x.do === "strike" && (x.index === undefined || x.index === index));
    return a ? prog(frame, a.at, 10, "snap") : 0;
  };
  const dimLine = (i: number) => {
    const a = scene.actions.find((x) => x.do === "dim-line" && x.index === i);
    return a ? prog(frame, a.at, 12, "glide") : 0;
  };

  const lastReveal = reveal[reveal.length - 1] ?? 0;
  const underlineP = scene.underline ? prog(frame, lastReveal + motion.enterFrames * 0.6, 22, "glide") : 0;
  const noteP = prog(frame, lastReveal + motion.enterFrames, 14, "glide");

  const body = (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: center ? "center" : "flex-start",
        paddingLeft: safe.x,
        paddingRight: safe.x,
        paddingBottom: safe.h * 0.06,
      }}
    >
      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: center ? "center" : "flex-start", maxWidth: safe.w }}>
        {scene.lines.map((text, i) => {
          const at = reveal[i] ?? 0;
          const r = prog(frame, at, motion.enterFrames, motion.enter);
          const plateP = prog(frame, at + motion.enterFrames * 0.55, Math.max(8, motion.enterFrames * 0.8), "glide");
          if (hook) {
            const slam = prog(frame, at, Math.max(8, motion.enterFrames * 0.7), "snap");
            return (
              <div key={i} style={{ textAlign: center ? "center" : "left", paddingBottom: "0.08em", marginBottom: "-0.06em" }}>
                <div
                  style={{
                    ...typeStyle(role, scale),
                    color: p.text,
                    scale: `${lerp(1.32, 1, slam)}`,
                    translate: `${shake(frame - at - 2, 9 * scale)}px 0`,
                    opacity: Math.min(1, slam * 2.2) * lerp(1, 0.35, dimLine(i)),
                    filter: `blur(${lerp(10, 0, Math.min(1, slam * 1.5)) * scale}px)`,
                    whiteSpace: "nowrap",
                  }}
                >
                  <RichText text={text} accent={seg.accent} plate={plateP} strike={strikeAt} scale={scale} />
                </div>
              </div>
            );
          }
          return (
            <div
              key={i}
              style={{
                overflow: "hidden",
                paddingBottom: "0.08em",
                marginBottom: "-0.06em",
                textAlign: center ? "center" : "left",
              }}
            >
              <div
                style={{
                  ...typeStyle(role, scale),
                  color: p.text,
                  translate: `0 ${lerp(105, 0, r)}%`,
                  opacity: lerp(0, 1, Math.min(1, r * 1.6)) * lerp(1, 0.35, dimLine(i)),
                  whiteSpace: "nowrap",
                }}
              >
                <RichText text={text} accent={seg.accent} plate={plateP} strike={strikeAt} scale={scale} />
              </div>
            </div>
          );
        })}
        {scene.underline && (
          <div style={{ position: "relative", alignSelf: "stretch", height: 34 * scale, marginTop: 30 * scale }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 17 * scale,
                top: 17 * scale - (LAYOUT.stroke.line * scale) / 2,
                height: LAYOUT.stroke.line * scale,
                borderRadius: 99,
                backgroundColor: line(scene.underline),
                transformOrigin: center ? "center" : "left center",
                scale: `${underlineP} 1`,
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: 34 * scale,
                height: 34 * scale,
                borderRadius: 99,
                backgroundColor: p.bg,
                border: `${7 * scale}px solid ${line(scene.underline)}`,
                boxSizing: "border-box",
                scale: `${prog(frame, lastReveal + motion.enterFrames * 0.6 + 16, 10, "snap")}`,
              }}
            />
          </div>
        )}
        {scene.note && (
          <div
            style={{
              ...typeStyle("caption", scale),
              color: p.textDim,
              marginTop: 34 * scale,
              opacity: noteP,
              translate: `0 ${lerp(10, 0, noteP) * scale}px`,
            }}
          >
            {scene.note}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
  if (!hook) return body;

  // hook layers: a frame flash on the first hit, then rings pulsing out from the centre on each reveal
  const ringBase = safe.h * 0.42;
  const first = reveal[0] ?? 0;
  const flash = frame >= first ? 1 - prog(frame, first, 9, "glide") : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: safe.h * 0.06 }}>
        {reveal.flatMap((at, i) =>
          [0, 5].map((lag, k) => {
            const t = prog(frame, at + lag, 44, "glide");
            if (frame < at + lag || t >= 1) return null;
            const size = ringBase * (i === 0 ? 1.15 : 1);
            return (
              <div
                key={`${i}-${k}`}
                style={{
                  position: "absolute",
                  width: size,
                  height: size,
                  borderRadius: 9999,
                  boxSizing: "border-box",
                  border: `${LAYOUT.stroke.line * scale * (k === 0 ? 0.7 : 0.4)}px solid ${line(seg.accent)}`,
                  scale: `${lerp(0.35, 2.9, t)}`,
                  opacity: (1 - t) * (k === 0 ? 0.55 : 0.3),
                }}
              />
            );
          }),
        )}
      </AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{ backgroundColor: line(seg.accent), opacity: flash * 0.16 }} />}
      {body}
    </AbsoluteFill>
  );
};
