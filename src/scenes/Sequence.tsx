import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { lerp, prog } from "../design/motion";
import { typeStyle, useLayout, useTheme } from "../design/theme";
import { LAYOUT, LineColor } from "../design/tokens";
import { KindIcon } from "../primitives/Icon";
import type { Resolved } from "../spec/compile";
import type { SequenceSceneT } from "../spec/schema";
import { useSegment } from "../video/context";

/** A request's life over time: actors across the top, messages travelling between their tracks. */
export const Sequence: React.FC<{ scene: Resolved<SequenceSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const { p, line, on } = useTheme();
  const { safe, scale, height } = useLayout();
  const { motion } = seg.choreo;
  const n = scene.actors.length;
  const colW = safe.w / n;
  const xOf = (id: string) => {
    const i = scene.actors.findIndex((a) => a.id === id);
    return safe.x + colW * (Math.max(0, i) + 0.5);
  };
  const headTop = safe.y + (scene.title ? 70 : 10) * scale;
  const headH = 96 * scale;
  const rowsTop = headTop + headH + 70 * scale;
  const rowH = Math.min(124 * scale, (safe.bottom - rowsTop - 20 * scale) / scene.messages.length);
  const firstAt = Math.min(...scene.messages.map((m) => m.at));
  const headP = (i: number) => prog(frame, Math.max(0, firstAt - 18) + i * motion.stagger, motion.enterFrames, motion.enter);
  const lifeP = prog(frame, Math.max(0, firstAt - 10), 30, "glide");
  const lifeBottom = rowsTop + rowH * scene.messages.length;

  return (
    <AbsoluteFill>
      {scene.title && (
        <div style={{ position: "absolute", left: safe.x, top: safe.y * 0.75, ...typeStyle("label", scale), color: p.textDim, opacity: headP(0) }}>
          {scene.title}
        </div>
      )}
      {scene.actors.map((a, i) => {
        const x = xOf(a.id);
        const hp = headP(i);
        return (
          <React.Fragment key={a.id}>
            <div
              style={{
                position: "absolute",
                left: x - (LAYOUT.stroke.track * scale) / 2,
                top: headTop + headH,
                width: LAYOUT.stroke.track * scale,
                height: (lifeBottom - headTop - headH) * lifeP,
                backgroundColor: p.track,
                borderRadius: 99,
                opacity: 0.7,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: x,
                top: headTop,
                translate: `-50% ${lerp(16, 0, hp) * scale}px`,
                opacity: hp,
                height: headH,
                display: "flex",
                alignItems: "center",
                gap: 16 * scale,
                padding: `0 ${26 * scale}px 0 ${16 * scale}px`,
                borderRadius: LAYOUT.radius.node * scale,
                backgroundColor: p.surface,
                border: `${LAYOUT.stroke.border * scale}px solid ${p.track}`,
                boxSizing: "border-box",
                whiteSpace: "nowrap",
              }}
            >
              <div
                style={{
                  width: 58 * scale,
                  height: 58 * scale,
                  borderRadius: 99,
                  border: `${5 * scale}px solid ${p.trackHi}`,
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <KindIcon kind={a.kind} size={28 * scale} color={p.text} />
              </div>
              <span style={{ ...typeStyle("label", scale), color: p.text }}>{a.label}</span>
            </div>
          </React.Fragment>
        );
      })}
      <svg style={{ position: "absolute", inset: 0, overflow: "visible" }} width="100%" height={height}>
        {scene.messages.map((m, i) => {
          const y = rowsTop + rowH * (i + 0.5);
          const x1 = xOf(m.from);
          const x2 = xOf(m.to);
          const dir = Math.sign(x2 - x1) || 1;
          const a = x1 + dir * 10 * scale;
          const b = x2 - dir * 14 * scale;
          const t = prog(frame, m.at, 14, "glide");
          if (t <= 0) return null;
          const c = line(m.line as LineColor);
          const xe = lerp(a, b, t);
          const head = 16 * scale;
          return (
            <g key={i}>
              <line
                x1={a}
                y1={y}
                x2={xe}
                y2={y}
                stroke={c}
                strokeWidth={6 * scale}
                strokeLinecap="round"
                strokeDasharray={m.style === "dashed" ? `${14 * scale} ${12 * scale}` : undefined}
              />
              {t > 0.92 && (
                <path
                  d={`M ${b - dir * head} ${y - head * 0.7} L ${b} ${y} L ${b - dir * head} ${y + head * 0.7}`}
                  fill="none"
                  stroke={c}
                  strokeWidth={6 * scale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {t < 1 && <rect x={xe - 17 * scale} y={y - 10 * scale} width={34 * scale} height={20 * scale} rx={10 * scale} fill={c} stroke={p.bg} strokeWidth={5 * scale} paintOrder="stroke" />}
            </g>
          );
        })}
      </svg>
      {scene.messages.map((m, i) => {
        if (!m.label && !m.badge) return null;
        const y = rowsTop + rowH * (i + 0.5);
        const x1 = xOf(m.from);
        const x2 = xOf(m.to);
        const lp = prog(frame, m.at + 4, 12, "glide");
        const bp = m.badge ? prog(frame, m.at + 14, 10, "snap") : 0;
        return (
          <React.Fragment key={`l-${i}`}>
            {m.label && (
              <div
                style={{
                  position: "absolute",
                  left: (x1 + x2) / 2,
                  top: y - 12 * scale,
                  translate: "-50% -100%",
                  opacity: lp,
                  ...typeStyle(m.code ? "code" : "caption", scale),
                  fontSize: (m.code ? 25 : 26) * scale,
                  fontWeight: m.code ? 520 : 620,
                  color: m.style === "dashed" ? p.textDim : p.text,
                  whiteSpace: "nowrap",
                  padding: `${6 * scale}px ${12 * scale}px ${2 * scale}px`,
                  borderRadius: LAYOUT.radius.chip * scale,
                  backgroundColor: p.bg,
                }}
              >
                {m.label}
              </div>
            )}
            {m.badge && (
              <div
                style={{
                  position: "absolute",
                  left: x2 + (x2 > x1 ? 20 : -20) * scale,
                  top: y,
                  translate: `${x2 > x1 ? "0" : "-100%"} -50%`,
                  scale: `${lerp(0.6, 1, bp)}`,
                  opacity: bp,
                  ...typeStyle("micro", scale),
                  fontSize: 22 * scale,
                  padding: `${8 * scale}px ${13 * scale}px ${5 * scale}px`,
                  borderRadius: LAYOUT.radius.badge * scale,
                  backgroundColor: line(m.badge.line as LineColor),
                  color: on(m.badge.line as LineColor),
                  whiteSpace: "nowrap",
                }}
              >
                {m.badge.text}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
