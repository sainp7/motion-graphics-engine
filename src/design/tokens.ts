/**
 * Design tokens — the single source of truth for the studio's visual language.
 *
 * Visual direction (ADR-0001): "the system is a transit map".
 *   - Components are stations, connections are tracks, requests ride coloured lines.
 *   - Colour always carries meaning: a line colour is a flow or a state, never decoration.
 *   - Text is signage: few words, large, placed with intent. Never captions.
 *
 * Nothing outside src/design may hard-code a colour, font size or easing curve.
 * The guardrail hook (plugin/hooks) rejects raw hex values in scene code.
 */

export type ThemeName = "dark" | "light";

/** Semantic line colours. Each one means something; see LINE_MEANING. */
export const LINE_COLORS = ["blue", "orange", "green", "red", "violet", "yellow", "teal"] as const;
export type LineColor = (typeof LINE_COLORS)[number];

/** Default meaning of each line colour. A video may rename lines in `spec.lines`, but keep the spirit. */
export const LINE_MEANING: Record<LineColor, string> = {
  blue: "The primary request path (reads, the happy path)",
  orange: "The thing we are talking about right now: the hot path, the focus, the point",
  green: "Healthy, success, cache hit, the fix",
  red: "Failure, overload, danger, the bug",
  violet: "Asynchronous work: queues, events, background jobs",
  yellow: "Latency, cost, warnings, things to watch",
  teal: "Secondary path (writes, replication, a second region)",
};

type Palette = {
  bg: string;
  bgDeep: string;
  surface: string;
  surfaceHi: string;
  track: string;
  trackHi: string;
  gridDot: string;
  text: string;
  textDim: string;
  textFaint: string;
  ink: string; // dark text used on bright plates
  paper: string; // light text used on deep plates
  lines: Record<LineColor, string>;
};

const DARK: Palette = {
  bg: "#0E1626",
  bgDeep: "#090F1B",
  surface: "#152136",
  surfaceHi: "#1C2B45",
  track: "#2A3A57",
  trackHi: "#3B4E72",
  gridDot: "#22324E",
  text: "#EAF0F8",
  textDim: "#9DABC3",
  textFaint: "#66779A",
  ink: "#0B1322",
  paper: "#FFFFFF",
  lines: {
    blue: "#4D8DFF",
    orange: "#FF8A2A",
    green: "#2FCB7A",
    red: "#FF5A5F",
    violet: "#A182FF",
    yellow: "#FFC93D",
    teal: "#2CC6C0",
  },
};

const LIGHT: Palette = {
  bg: "#F3F5F9",
  bgDeep: "#E4E9F1",
  surface: "#FFFFFF",
  surfaceHi: "#F8FAFD",
  track: "#C8D1DF",
  trackHi: "#A9B6CA",
  gridDot: "#D3DBE7",
  text: "#0E192B",
  textDim: "#46556F",
  textFaint: "#76839A",
  ink: "#0B1322",
  paper: "#FFFFFF",
  lines: {
    blue: "#1F5FE0",
    orange: "#E35F07",
    green: "#0E9156",
    red: "#D3262D",
    violet: "#6A45DE",
    yellow: "#C08C00",
    teal: "#0B8F8C",
  },
};

export const PALETTES: Record<ThemeName, Palette> = { dark: DARK, light: LIGHT };

// ---------- contrast helpers (used to pick plate text colour automatically) ----------

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
};
const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/** Text colour for a filled plate of the given colour: whichever of ink/paper reads better. */
export const onColor = (fill: string, p: Palette) => (contrast(fill, p.ink) >= contrast(fill, p.paper) ? p.ink : p.paper);

/** Mix a hex colour with another (t = 0 → a, 1 → b). Used for tints, never for new hues. */
export const mix = (a: string, b: string, t: number) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round((v + (cb[i] - v) * t) * 255));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

/** Hex colour with alpha, e.g. alpha("#FF0000", 0.3). */
export const alpha = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 255));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// ---------- typography ----------

export const FONT = {
  sans: "Overpass Variable, Overpass, system-ui, sans-serif",
  mono: "Overpass Mono Variable, Overpass Mono, ui-monospace, monospace",
} as const;

/**
 * Type roles at 1920×1080. Scale with layout.scale for other sizes.
 * Sizes follow a ~1.333 (perfect fourth) scale anchored on 40px body text.
 */
export const TYPE = {
  /** Hero statements, the hook line, the big idea. ≤ 6 words per line. */
  display: { size: 132, weight: 800, lineHeight: 1.0, tracking: -0.028 },
  /** Statements that need two or three lines, chapter titles. */
  headline: { size: 96, weight: 760, lineHeight: 1.04, tracking: -0.022 },
  /** Column titles, list titles. */
  title: { size: 64, weight: 720, lineHeight: 1.08, tracking: -0.015 },
  /** List items, compare items. */
  body: { size: 44, weight: 560, lineHeight: 1.2, tracking: -0.005 },
  /** Node labels, actor labels. */
  label: { size: 32, weight: 660, lineHeight: 1.1, tracking: 0 },
  /** Secondary detail under a label or item. */
  caption: { size: 25, weight: 520, lineHeight: 1.2, tracking: 0.004 },
  /** Badges and legend text. */
  micro: { size: 21, weight: 720, lineHeight: 1.0, tracking: 0.02 },
  /** Literal code, keys, commands, numbers that are identifiers. */
  code: { size: 34, weight: 500, lineHeight: 1.45, tracking: 0 },
  /** Stat counters. */
  numeral: { size: 240, weight: 820, lineHeight: 0.92, tracking: -0.04 },
} as const;
export type TypeRole = keyof typeof TYPE;

// ---------- layout ----------

export const FORMATS = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
} as const;
export type FormatName = keyof typeof FORMATS;

export const LAYOUT = {
  /** Safe margins at 1920×1080: key content stays inside. */
  safe: { x: 120, top: 96, bottom: 96 },
  /** Diagram grid unit in px at camera zoom 1. A 1920×1080 frame shows 16 × 9 units. */
  unit: 120,
  /** Base spacing step. Every gap is a multiple of this. */
  space: 8,
  radius: { node: 22, plate: 14, chip: 10, badge: 8 },
  stroke: { track: 6, line: 10, border: 3, hairline: 2 },
} as const;

// ---------- motion ----------

/** Cubic bezier control points; resolve with Easing.bezier(...EASE.glide). */
export const EASE = {
  /** Fast out, crisp settle. Hooks, stamps, impacts. */
  snap: [0.2, 0.9, 0.1, 1],
  /** Expo-out glide. The default for things arriving. */
  glide: [0.16, 1, 0.3, 1],
  /** Slow in-out drift. Camera moves, insight push-ins. */
  drift: [0.45, 0, 0.2, 1],
  /** Leaving the stage. */
  exit: [0.55, 0, 0.75, 0.2],
  /** Constant velocity. Packets on a line. */
  linear: [0, 0, 1, 1],
} as const;
export type EaseName = keyof typeof EASE;

export const DURATION = {
  /** Frames at 30fps. Scale by fps/30 when rendering at other rates. */
  snap: 9,
  glide: 18,
  drift: 30,
  exit: 10,
  stagger: 5,
} as const;

/** Packet travel speed along a line, px per second at zoom 1. */
export const PACKET_SPEED = 900;
