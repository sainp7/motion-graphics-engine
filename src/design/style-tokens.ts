/**
 * Style tokens: the data half of a style (palettes, fonts, type scale, curves). Pure data, safe to
 * import from Node scripts (the linter) as well as from the renderer.
 *
 * The renderer renders one composition at a time, so the active style's tokens are set once per
 * composition by <ThemeProvider style={…}> before any scene renders, and read by typeStyle() and
 * ease(). Scene code never imports a style directly: it asks the theme.
 */
import type React from "react";
import type { EaseName, Palette, ThemeName, TypeRole } from "./tokens";
import { TRANSIT_TOKENS } from "../styles/transit/tokens";

export type TypeSpec = {
  size: number;
  weight: number;
  lineHeight: number;
  tracking: number;
  /** Extra CSS for the role in this style (italic, uppercase, a font-feature…). */
  css?: React.CSSProperties;
};

export type StyleTokens = {
  id: string;
  name: string;
  /** One paragraph: the look, the feel, when to use it. Shown in the studio and the docs. */
  description: string;
  palettes: Record<ThemeName, Palette>;
  fonts: { sans: string; mono: string; display?: string };
  /** Type roles set in fonts.display (when the style has one). */
  displayRoles: TypeRole[];
  type: Record<TypeRole, TypeSpec>;
  ease: Record<EaseName, readonly [number, number, number, number]>;
  /** How {plates} look: a filled badge (transit signage) or a highlighter marker under ink. */
  plate?: "badge" | "marker";
  /** Defaults a channel inherits unless it sets its own. */
  defaults?: { music?: string; theme?: ThemeName };
};

let active: StyleTokens = TRANSIT_TOKENS;

export const setActiveTokens = (t: StyleTokens) => {
  active = t;
};
export const activeTokens = () => active;
