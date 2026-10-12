import React from "react";
import { useCurrentFrame } from "remotion";
import { lerp, prog } from "../../design/motion";
import { useTheme } from "../../design/theme";
import type { LineColor } from "../../design/tokens";
import { parseText } from "../../spec/markup";
import { useVideo } from "../../video/context";

type Token = { kind: "word" | "plate" | "strike"; text: string; line?: string; index?: number };

const tokenize = (text: string): Token[] => {
  const out: Token[] = [];
  for (const r of parseText(text)) {
    if (r.kind === "text") r.text.split(/(\s+)/).filter(Boolean).forEach((w) => out.push({ kind: "word", text: w }));
    else if (r.kind === "plate") out.push({ kind: "plate", text: r.text, line: r.line });
    else out.push({ kind: "strike", text: r.text, index: r.index });
  }
  return out;
};

/**
 * Editorial kinetic type: words rise out of their own baseline one after another; {plates} get a
 * highlighter stroke after they land; ~~strikes~~ are crossed out by a strike action.
 */
export const KineticText: React.FC<{
  text: string;
  at: number;
  accent: LineColor;
  stagger?: number;
  dur?: number;
  strike?: (index: number) => number;
  dim?: number;
}> = ({ text, at, accent, stagger = 2.5, dur = 14, strike, dim = 0 }) => {
  const frame = useCurrentFrame();
  const { p, line } = useTheme();
  const video = useVideo();
  let k = 0;
  return (
    <>
      {tokenize(text).map((t, i) => {
        if (t.kind === "word" && /^\s+$/.test(t.text)) return <span key={i}>{t.text}</span>;
        const start = at + k++ * stagger;
        const r = prog(frame, start, dur, "glide");
        const inner: React.CSSProperties = {
          display: "inline-block",
          translate: `0 ${lerp(100, 0, r)}%`,
          opacity: Math.min(1, r * 1.8) * lerp(1, 0.3, dim),
        };
        let body: React.ReactNode = t.text;
        if (t.kind === "plate") {
          const c = video.lineColor(t.line, accent);
          const m = prog(frame, start + dur * 0.6, 12, "glide");
          body = (
            <span style={{ position: "relative", display: "inline-block", isolation: "isolate", fontStyle: "italic", padding: "0 0.05em" }}>
              <span
                style={{
                  position: "absolute",
                  left: "-0.02em",
                  right: "-0.02em",
                  top: "56%",
                  bottom: "2%",
                  backgroundColor: line(c),
                  opacity: 0.42,
                  borderRadius: "0.06em",
                  transformOrigin: "left center",
                  scale: `${m} 1`,
                  zIndex: -1,
                }}
              />
              {t.text}
            </span>
          );
        }
        if (t.kind === "strike") {
          const s = strike ? strike(t.index ?? 0) : 0;
          body = (
            <span style={{ position: "relative", display: "inline-block", color: s > 0.5 ? p.textFaint : "inherit" }}>
              {t.text}
              <span
                style={{
                  position: "absolute",
                  left: "-0.04em",
                  right: "-0.04em",
                  top: "50%",
                  height: "0.07em",
                  backgroundColor: line("red"),
                  transformOrigin: "left center",
                  scale: `${s} 1`,
                }}
              />
            </span>
          );
        }
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.1em", marginBottom: "-0.1em" }}>
            <span style={inner}>{body}</span>
          </span>
        );
      })}
    </>
  );
};

/** A hairline rule that draws from the left. */
export const Rule: React.FC<{ at: number; width: number; color: string; thickness?: number; dur?: number; style?: React.CSSProperties }> = ({
  at,
  width,
  color,
  thickness = 2,
  dur = 18,
  style,
}) => {
  const frame = useCurrentFrame();
  const r = prog(frame, at, dur, "glide");
  return <div style={{ width: width * r, height: thickness, backgroundColor: color, ...style }} />;
};
