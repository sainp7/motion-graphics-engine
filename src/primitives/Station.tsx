import React from "react";
import { useTheme } from "../design/theme";

/** A station dot on a vertical line: a bg-filled ring in the line colour, optionally numbered. */
export const StationDot: React.FC<{
  x: number;
  y: number;
  size: number;
  color: string;
  progress: number;
  number?: number;
  numberColor?: string;
  fontSize?: number;
}> = ({ x, y, size, color, progress, number, numberColor, fontSize }) => {
  const { p } = useTheme();
  const filled = number !== undefined;
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: 999,
        boxSizing: "border-box",
        backgroundColor: filled ? color : p.bg,
        border: filled ? "none" : `${Math.max(4, size * 0.24)}px solid ${color}`,
        scale: `${progress}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: numberColor,
        fontSize,
        fontWeight: 800,
        fontFamily: "Overpass Variable, sans-serif",
        lineHeight: 1,
        paddingTop: filled ? size * 0.06 : 0,
      }}
    >
      {number}
    </div>
  );
};
