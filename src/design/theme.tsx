import React, { createContext, useContext, useMemo } from "react";
import { useVideoConfig } from "remotion";
import type { StyleDef } from "../styles/types";
import { activeTokens, setActiveTokens } from "./style-tokens";
import { LAYOUT, LineColor, Palette, ThemeName, TypeRole, onColor } from "./tokens";

type ThemeValue = {
  name: ThemeName;
  /** The active style: its tokens, scene overrides, background, transitions and intro. */
  style: StyleDef | null;
  p: Palette;
  /** Resolve a line colour (or a named line from spec.lines) to hex. */
  line: (c: LineColor) => string;
  /** Text colour that reads on a plate filled with the given line colour. */
  on: (c: LineColor) => string;
};

const ThemeCtx = createContext<ThemeValue | null>(null);

export const ThemeProvider: React.FC<{ name: ThemeName; style?: StyleDef | null; children: React.ReactNode }> = ({ name, style = null, children }) => {
  // set before any child renders: typeStyle() and ease() read the active style's tokens
  if (style) setActiveTokens(style.tokens);
  const value = useMemo<ThemeValue>(() => {
    const p = (style?.tokens ?? activeTokens()).palettes[name];
    return { name, style, p, line: (c) => p.lines[c], on: (c) => onColor(p.lines[c], p) };
  }, [name, style]);
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

/** CSS for a type role, scaled to the frame, in the active style. */
export const typeStyle = (role: TypeRole, scale: number, mono = false): React.CSSProperties => {
  const tok = activeTokens();
  const t = tok.type[role];
  const family = mono || role === "code" ? tok.fonts.mono : tok.fonts.display && tok.displayRoles.includes(role) ? tok.fonts.display : tok.fonts.sans;
  return {
    fontFamily: family,
    fontSize: t.size * scale,
    fontWeight: t.weight,
    lineHeight: t.lineHeight,
    letterSpacing: `${t.tracking}em`,
    fontVariantNumeric: "tabular-nums",
    fontFeatureSettings: '"ss01" 0',
    ...t.css,
  };
};

/** The active style (null outside a styled composition). */
export const useStyle = () => useTheme().style;
