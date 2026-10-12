import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThemeProvider, typeStyle, useLayout, useTheme } from "../design/theme";
import { LAYOUT, LineColor } from "../design/tokens";
import { RichText } from "../primitives/RichText";
import { compile } from "../spec/compile";
import { STYLES } from "../styles.generated";
import { parseText, plainText } from "../spec/markup";
import type { VideoSpecInput } from "../spec/schema";
import { VideoCtx } from "./context";

export type ThumbnailProps = { spec: VideoSpecInput; theme?: "dark" | "light"; style?: string };

/** YouTube thumbnail (1280×720): the title as signage, on the same line language as the video. */
export const Thumbnail: React.FC<ThumbnailProps> = ({ spec, theme, style }) => {
  const compiled = useMemo(() => compile(spec, null, { theme, style }), [spec, theme, style]);
  return (
    <VideoCtx.Provider value={compiled}>
      <ThemeProvider name={compiled.theme} style={STYLES[compiled.style] ?? STYLES.transit}>
        <ThumbBody lines={compiled.spec.thumbnail?.lines ?? [compiled.spec.title]} accent={compiled.lineColor(compiled.spec.thumbnail?.line)} />
      </ThemeProvider>
    </VideoCtx.Provider>
  );
};

const ThumbBody: React.FC<{ lines: string[]; accent: LineColor }> = ({ lines, accent }) => {
  const { p, line } = useTheme();
  const { scale, width, height } = useLayout();
  // fit the longest line inside the margins (bold Overpass averages ~0.53em per character)
  const longest = Math.max(...lines.map((l) => plainText(l).length + (parseText(l).some((r) => r.kind === "plate") ? 1 : 0)));
  const s = Math.min(scale * 1.55, (width - 200) / (longest * 0.53 * 132));
  const trackY = height * 0.82;
  return (
    <AbsoluteFill style={{ backgroundColor: p.bg }}>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 80, paddingBottom: height * 0.12 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ ...typeStyle("display", s), color: p.text, whiteSpace: "nowrap" }}>
            <RichText text={l} accent={accent} scale={s} />
          </div>
        ))}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 80, right: 0, top: trackY - 6, height: 12, borderRadius: 99, backgroundColor: line(accent) }} />
      {[0, 0.28, 0.56].map((x, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 80 + x * (width - 160) - 18,
            top: trackY - 18,
            width: 36,
            height: 36,
            borderRadius: 99,
            boxSizing: "border-box",
            backgroundColor: p.bg,
            border: `${LAYOUT.stroke.line * 0.9}px solid ${line(accent)}`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
