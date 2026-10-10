import React from "react";
import { AbsoluteFill } from "remotion";
import { useLayout, useTheme } from "../design/theme";
import { alpha } from "../design/tokens";

/**
 * The stage behind every scene: a faint map grid and a vignette.
 * Grid and vignette strength come from the segment's choreography.
 */
export const Stage: React.FC<{ grid: number; vignette: number }> = ({ grid, vignette }) => {
  const { p } = useTheme();
  const { unit, scale } = useLayout();
  const dot = Math.max(1.5, 2.6 * scale);
  return (
    <AbsoluteFill>
      {grid > 0 && (
        <AbsoluteFill
          style={{
            opacity: grid,
            backgroundImage: `radial-gradient(circle, ${p.gridDot} ${dot}px, transparent ${dot + 0.6}px)`,
            backgroundSize: `${unit / 2}px ${unit / 2}px`,
            backgroundPosition: `${unit / 4}px ${unit / 4}px`,
          }}
        />
      )}
      {vignette > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, ${alpha(p.bgDeep, Math.min(1, vignette))} 100%)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
