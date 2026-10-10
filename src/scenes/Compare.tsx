import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Check, Minus, X } from "lucide-react";
import { lerp, prog } from "../design/motion";
import { typeStyle, useLayout, useTheme } from "../design/theme";
import { LAYOUT, LineColor } from "../design/tokens";
import { RichText } from "../primitives/RichText";
import { StationDot } from "../primitives/Station";
import type { Resolved } from "../spec/compile";
import type { CompareSceneT } from "../spec/schema";
import { useSegment } from "../video/context";

type Col = Resolved<CompareSceneT>["left"];

/** Two lines side by side, one per approach. Each trade-off is a stop. The verdict lights one line. */
export const Compare: React.FC<{ scene: Resolved<CompareSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { safe, scale } = useLayout();
  const gap = 100 * scale;
  const colW = (safe.w - gap) / 2;
  const verdictP = scene.verdict ? prog(frame, scene.verdict.at, 16, "glide") : 0;
  return (
    <AbsoluteFill>
      {(["left", "right"] as const).map((side, i) => (
        <Column
          key={side}
          col={scene[side]}
          x={safe.x + i * (colW + gap)}
          w={colW}
          dim={scene.verdict && scene.verdict.side !== side ? verdictP : 0}
          rows={Math.max(scene.left.items.length, scene.right.items.length)}
          hasVerdict={!!scene.verdict}
          verdict={scene.verdict && scene.verdict.side === side ? { text: scene.verdict.text, p: verdictP } : undefined}
        />
      ))}
    </AbsoluteFill>
  );
};

const Column: React.FC<{ col: Col; x: number; w: number; dim: number; rows: number; hasVerdict: boolean; verdict?: { text: string; p: number } }> = ({
  col,
  x,
  w,
  dim,
  rows,
  hasVerdict,
  verdict,
}) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const { p, line, on } = useTheme();
  const { safe, scale } = useLayout();
  const { motion } = seg.choreo;
  const c = col.line as LineColor;
  const headAt = col.at ?? 0;
  const head = prog(frame, headAt, motion.enterFrames, motion.enter);
  const bullet = 70 * scale;
  const step = Math.min(132 * scale, (safe.h - 330 * scale) / Math.max(1, rows));
  const blockH = 150 * scale + rows * step + (hasVerdict ? 90 * scale : 0);
  const top = safe.y + Math.max(30 * scale, (safe.h - blockH) / 2 - 20 * scale);
  const itemTop = top + 150 * scale;
  const lineX = x + bullet / 2;
  const lastAt = Math.max(...col.items.map((it) => it.at ?? 0));
  const reachP = prog(frame, headAt, Math.max(12, lastAt - headAt + 10), "glide");
  const trackLen = step * (col.items.length - 0.5) + (itemTop - top - bullet / 2);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: lerp(1, 0.38, dim) }}>
      <div
        style={{
          position: "absolute",
          left: lineX - (LAYOUT.stroke.line * scale) / 2,
          top: top + bullet / 2,
          width: LAYOUT.stroke.line * scale,
          height: trackLen * reachP,
          backgroundColor: line(c),
          borderRadius: 99,
        }}
      />
      <StationDot x={lineX} y={top + bullet / 2} size={bullet} color={line(c)} progress={prog(frame, headAt, 10, "snap")} />
      <div
        style={{
          position: "absolute",
          left: x + bullet + 28 * scale,
          top: top + bullet / 2,
          translate: `${lerp(-18, 0, head) * scale}px -50%`,
          opacity: head,
          ...typeStyle("title", scale),
          color: p.text,
          whiteSpace: "nowrap",
        }}
      >
        {col.title}
      </div>
      {col.items.map((it, i) => {
        const at = it.at ?? 0;
        const r = prog(frame, at, motion.enterFrames, motion.enter);
        const y = itemTop + i * step;
        const Icon = it.verdict === "pro" ? Check : it.verdict === "con" ? X : Minus;
        const iconColor = it.verdict === "pro" ? line("green") : it.verdict === "con" ? line("red") : p.textFaint;
        return (
          <React.Fragment key={i}>
            <StationDot x={lineX} y={y} size={30 * scale} color={line(c)} progress={prog(frame, at, 9, "snap")} />
            <div
              style={{
                position: "absolute",
                left: x + bullet + 28 * scale,
                top: y,
                translate: `${lerp(-14, 0, r) * scale}px -50%`,
                opacity: r,
                display: "flex",
                alignItems: "center",
                gap: 18 * scale,
                width: w - bullet - 40 * scale,
              }}
            >
              <Icon size={38 * scale} color={iconColor} strokeWidth={3} />
              <span style={{ ...typeStyle("body", scale), color: p.text }}>
                <RichText text={it.text} accent={c} scale={scale} />
              </span>
            </div>
          </React.Fragment>
        );
      })}
      {verdict && (
        <div
          style={{
            position: "absolute",
            left: x + bullet + 28 * scale,
            top: itemTop + col.items.length * step + 10 * scale,
            opacity: verdict.p,
            translate: `0 ${lerp(16, 0, verdict.p) * scale}px`,
            ...typeStyle("label", scale),
            fontSize: 36 * scale,
            padding: `${12 * scale}px ${22 * scale}px ${8 * scale}px`,
            borderRadius: LAYOUT.radius.plate * scale,
            backgroundColor: line(c),
            color: on(c),
          }}
        >
          {verdict.text}
        </div>
      )}
    </div>
  );
};
