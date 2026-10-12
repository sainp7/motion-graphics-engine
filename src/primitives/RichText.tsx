import React from "react";
import { activeTokens } from "../design/style-tokens";
import { useTheme } from "../design/theme";
import { LAYOUT, LineColor } from "../design/tokens";
import { parseText } from "../spec/markup";
import { useVideo } from "../video/context";

type Props = {
  text: string;
  /** Colour for plates that don't name one. */
  accent: LineColor;
  /** 0→1: plates stamp in left to right. */
  plate?: number;
  /** 0→1 per strike index. */
  strike?: (index: number) => number;
  scale: number;
};

/**
 * Renders on-screen markup: {plate}, {plate|green}, ~~strike~~.
 * Plates are the signage device of the studio — a word on a filled line-colour badge,
 * the way a transit map labels a line. Use them for the one or two words that carry
 * the idea, never for decoration.
 */
export const RichText: React.FC<Props> = ({ text, accent, plate = 1, strike, scale }) => {
  const { p, line, on } = useTheme();
  const video = useVideo();
  const runs = parseText(text);
  return (
    <>
      {runs.map((r, i) => {
        if (r.kind === "text") return <span key={i}>{r.text}</span>;
        if (r.kind === "plate" && activeTokens().plate === "marker") {
          // a highlighter stroke under the lower half of the word; the text stays ink
          const c = video.lineColor(r.line, accent);
          return (
            <span key={i} style={{ position: "relative", display: "inline-block", isolation: "isolate", padding: "0 0.06em", fontStyle: "italic" }}>
              <span
                style={{
                  position: "absolute",
                  left: "-0.02em",
                  right: "-0.02em",
                  top: "56%",
                  bottom: "2%",
                  backgroundColor: line(c),
                  opacity: 0.42,
                  borderRadius: "0.08em",
                  transformOrigin: "left center",
                  scale: `${plate} 1`,
                  zIndex: -1,
                }}
              />
              {r.text}
            </span>
          );
        }
        if (r.kind === "plate") {
          const c = video.lineColor(r.line, accent);
          return (
            <span
              key={i}
              style={{
                position: "relative",
                display: "inline-block",
                padding: "0.02em 0.2em 0 0.2em",
                margin: "0 0.02em",
                borderRadius: LAYOUT.radius.plate * scale,
                color: plate > 0.55 ? on(c) : "inherit",
                backgroundColor: "transparent",
                isolation: "isolate",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: LAYOUT.radius.plate * scale,
                  backgroundColor: line(c),
                  clipPath: `inset(0 ${(1 - plate) * 100}% 0 0 round ${LAYOUT.radius.plate * scale}px)`,
                  zIndex: -1,
                }}
              />
              {r.text}
            </span>
          );
        }
        const s = strike ? strike(r.index) : 0;
        return (
          <span key={i} style={{ position: "relative", display: "inline-block", color: s > 0.5 ? p.textFaint : "inherit" }}>
            {r.text}
            <span
              style={{
                position: "absolute",
                left: "-0.04em",
                right: "-0.04em",
                top: "52%",
                height: "0.085em",
                borderRadius: 999,
                backgroundColor: line("red"),
                transformOrigin: "left center",
                scale: `${s} 1`,
              }}
            />
          </span>
        );
      })}
    </>
  );
};
