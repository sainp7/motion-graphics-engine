import React from "react";
import { AbsoluteFill } from "remotion";
import { useTheme } from "../../design/theme";
import { alpha } from "../../design/tokens";

/** Paper: a fixed fibre grain (seeded, so every frame is identical) and a soft edge. No grid. */
export const Paper: React.FC<{ grid: number; vignette: number }> = ({ vignette }) => {
  const { p, name } = useTheme();
  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: name === "light" ? 0.09 : 0.06, mixBlendMode: name === "light" ? "multiply" : "screen" }}>
        <filter id="paper-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={7} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#paper-grain)" />
      </svg>
      {vignette > 0 && <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 75% at 50% 45%, transparent 60%, ${alpha(p.bgDeep, Math.min(1, vignette * 0.8))} 100%)` }} />}
    </AbsoluteFill>
  );
};
