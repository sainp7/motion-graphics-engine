import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { lerp, prog } from "../design/motion";
import { typeStyle, useLayout, useTheme } from "../design/theme";
import { LAYOUT, LineColor } from "../design/tokens";
import type { Resolved } from "../spec/compile";
import type { ChapterSceneT } from "../spec/schema";
import { useSegment, useVideo } from "../video/context";

/**
 * A line bullet and a station name: the chapter marker. A track leaves the bullet and runs
 * off the right edge — the viewer is about to travel somewhere new.
 *
 * Below it, the route: every chapter of the video as a station on one line. Past chapters are
 * travelled (coloured, dimmed), this one is lit, the rest are still ahead (faint). The viewer
 * always knows "part 2 of what".
 */
export const Chapter: React.FC<{ scene: Resolved<ChapterSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const video = useVideo();
  const { p, line, on } = useTheme();
  const { safe, scale, width, height } = useLayout();
  const c = video.lineColor(scene.line);
  const start = Math.round(0.15 * video.fps);
  const bullet = prog(frame, start, 14, "snap");
  const track = prog(frame, start + 6, 30, "glide");
  const title = prog(frame, start + 10, seg.choreo.motion.enterFrames, "glide");
  const sub = prog(frame, start + 18, seg.choreo.motion.enterFrames, "glide");

  const stops = video.segments
    .filter((s) => s.scene.type === "chapter")
    .map((s) => {
      const sc = s.scene as Resolved<ChapterSceneT>;
      return { id: s.id, label: sc.short ?? sc.title, color: video.lineColor(sc.line) };
    });
  const here = stops.findIndex((s) => s.id === seg.id);
  const route = stops.length >= 2 && here >= 0;

  const d = 168 * scale;
  const cy = height * (route ? 0.43 : 0.5);
  const trackH = LAYOUT.stroke.line * 1.4 * scale;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: safe.x + d / 2,
          top: cy - trackH / 2,
          width: (width - safe.x - d / 2) * track,
          height: trackH,
          backgroundColor: line(c),
          borderRadius: 99,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: safe.x,
          top: cy - d / 2,
          width: d,
          height: d,
          borderRadius: 999,
          backgroundColor: line(c),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          scale: `${bullet}`,
          ...typeStyle("headline", scale),
          color: on(c),
        }}
      >
        {scene.number ?? ""}
        {scene.number === undefined && (
          <div style={{ width: d * 0.38, height: d * 0.38, borderRadius: 999, backgroundColor: p.bg }} />
        )}
      </div>
      {route && (
        <div
          style={{
            position: "absolute",
            left: safe.x + d + 46 * scale,
            bottom: height - cy + 30 * scale + 96 * 1.04 * scale + 14 * scale,
            ...typeStyle("micro", scale),
            textTransform: "uppercase",
            color: line(c),
            opacity: title,
            whiteSpace: "nowrap",
          }}
        >
          {`Part ${here + 1} of ${stops.length}`}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: safe.x + d + 44 * scale,
          bottom: height - cy + 30 * scale,
          ...typeStyle("headline", scale),
          color: p.text,
          opacity: title,
          translate: `${lerp(-24, 0, title) * scale}px 0`,
          whiteSpace: "nowrap",
        }}
      >
        {scene.title}
      </div>
      {scene.subtitle && (
        <div
          style={{
            position: "absolute",
            left: safe.x + d + 44 * scale,
            top: cy + 36 * scale,
            ...typeStyle("body", scale),
            color: p.textDim,
            opacity: sub,
            translate: `${lerp(-16, 0, sub) * scale}px 0`,
            maxWidth: safe.w - d - 60 * scale,
          }}
        >
          {scene.subtitle}
        </div>
      )}
      {route && <Route stops={stops} here={here} at={start + 14} />}
    </AbsoluteFill>
  );
};

const Route: React.FC<{ stops: { id: string; label: string; color: LineColor }[]; here: number; at: number }> = ({
  stops,
  here,
  at,
}) => {
  const frame = useCurrentFrame();
  const { p, line } = useTheme();
  const { safe, scale, height } = useLayout();
  const y = height * 0.8;
  const n = stops.length;
  const x0 = safe.x + 40 * scale;
  const x1 = safe.x + safe.w - 40 * scale;
  const xs = stops.map((_, i) => lerp(x0, x1, n === 1 ? 0 : i / (n - 1)));
  const h = LAYOUT.stroke.line * 0.8 * scale;
  const appear = prog(frame, at, 16, "glide");
  // the leg into this chapter is travelled now
  const leg = prog(frame, at + 8, 26, "glide");
  const lit = prog(frame, at + 8 + 22, 10, "snap");
  const r = 22 * scale;

  return (
    <AbsoluteFill style={{ opacity: appear, translate: `0 ${lerp(16, 0, appear) * scale}px` }}>
      {/* ahead: the whole route, faint */}
      <div style={{ position: "absolute", left: xs[0], width: xs[n - 1] - xs[0], top: y - h / 2, height: h, borderRadius: 99, backgroundColor: p.track }} />
      {/* travelled legs */}
      {stops.slice(1).map((s, k) => {
        const i = k + 1;
        if (i > here) return null;
        const t = i === here ? leg : 1;
        return (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: xs[i - 1],
              width: (xs[i] - xs[i - 1]) * t,
              top: y - h / 2,
              height: h,
              borderRadius: 99,
              backgroundColor: line(s.color),
              opacity: i === here ? 1 : 0.5,
            }}
          />
        );
      })}
      {stops.map((s, i) => {
        const past = i < here;
        const now = i === here;
        const size = now ? r * 2 * lerp(1, 1.25, lit) : r * 2;
        return (
          <React.Fragment key={s.id}>
            {now && (
              <div
                style={{
                  position: "absolute",
                  left: xs[i] - r * 2,
                  top: y - r * 2,
                  width: r * 4,
                  height: r * 4,
                  borderRadius: 999,
                  boxSizing: "border-box",
                  border: `${3 * scale}px solid ${line(s.color)}`,
                  scale: `${lerp(0.5, 1.4, prog(frame, at + 30, 30, "glide"))}`,
                  opacity: lit * (1 - prog(frame, at + 30, 30, "glide")),
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                left: xs[i] - size / 2,
                top: y - size / 2,
                width: size,
                height: size,
                borderRadius: 999,
                boxSizing: "border-box",
                backgroundColor: now && lit > 0.5 ? line(s.color) : p.bg,
                border: `${7 * scale}px solid ${past || now ? line(s.color) : p.trackHi}`,
                opacity: past ? 0.6 : 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: xs[i],
                top: y + r + 22 * scale,
                translate: i === 0 ? "0 0" : i === n - 1 ? "-100% 0" : "-50% 0",
                ...typeStyle(now ? "label" : "caption", scale),
                color: now ? p.text : past ? p.textDim : p.textFaint,
                whiteSpace: "nowrap",
              }}
            >
              {s.label}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
