import React, { createContext, useContext, useMemo } from "react";
import { useVideoConfig } from "remotion";
import { FONT, LAYOUT, LineColor, PALETTES, ThemeName, TYPE, TypeRole, onColor } from "./tokens";

type ThemeValue = {
  name: ThemeName;
  p: (typeof PALETTES)[ThemeName];
  /** Resolve a line colour (or a named line from spec.lines) to hex. */
  line: (c: LineColor) => string;
  /** Text colour that reads on a plate filled with the given line colour. */
  on: (c: LineColor) => string;
};

const ThemeCtx = createContext<ThemeValue | null>(null);

export const ThemeProvider: React.FC<{ name: ThemeName; children: React.ReactNode }> = ({ name, children }) => {
  const value = useMemo<ThemeValue>(() => {
    const p = PALETTES[name];
    return { name, p, line: (c) => p.lines[c], on: (c) => onColor(p.lines[c], p) };
  }, [name]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
};

export const useTheme = () => {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useTheme() must be used inside <ThemeProvider>");
  return v;
};

/** Frame geometry. All sizes in scene code derive from here so a 9:16 layout can reuse the same scenes. */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const scale = portrait ? width / 1080 : width / 1920;
  const sx = LAYOUT.safe.x * scale * (portrait ? 0.6 : 1);
  const top = LAYOUT.safe.top * scale * (portrait ? 2.2 : 1);
  const bottom = LAYOUT.safe.bottom * scale * (portrait ? 3 : 1);
  return {
    width,
    height,
    portrait,
    scale,
    safe: { x: sx, y: top, w: width - 2 * sx, h: height - top - bottom, right: width - sx, bottom: height - bottom },
    unit: LAYOUT.unit * scale,
  };
};

/** CSS for a type role, scaled to the frame. */
export const typeStyle = (role: TypeRole, scale: number, mono = false): React.CSSProperties => {
  const t = TYPE[role];
  return {
    fontFamily: mono || role === "code" ? FONT.mono : FONT.sans,
    fontSize: t.size * scale,
    fontWeight: t.weight,
    lineHeight: t.lineHeight,
    letterSpacing: `${t.tracking}em`,
    fontVariantNumeric: "tabular-nums",
    fontFeatureSettings: '"ss01" 0',
  };
};
