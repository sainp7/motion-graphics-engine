import type { StyleTokens } from "../../design/style-tokens";
import { TYPE } from "../../design/tokens";

/**
 * Editorial: kinetic typography on paper. A magazine spread that moves: a high-contrast serif
 * (Fraunces) set big, words arriving one at a time, hairline rules, a highlighter for the words
 * that matter, chapters as numbered sections. For opinion pieces, history, career and tech essays;
 * anywhere the words carry the video more than diagrams do.
 */
const EDITORIAL: StyleTokens = {
  id: "editorial",
  name: "Editorial",
  description:
    "Kinetic typography on paper: a big high-contrast serif with words arriving one at a time, hairline rules, a highlighter for the key words, chapters as numbered sections. Made for essays and story-led explainers where the words carry the video.",
  palettes: {
    light: {
      bg: "#F3EEE4",
      bgDeep: "#E4DCCD",
      surface: "#FBF8F2",
      surfaceHi: "#FFFFFF",
      track: "#D6CDBD",
      trackHi: "#B8AD98",
      gridDot: "#E0D8C9",
      text: "#17140F",
      textDim: "#5E574C",
      textFaint: "#968D7E",
      ink: "#17140F",
      paper: "#FFFDF8",
      lines: { blue: "#2347C8", orange: "#E0571F", green: "#1E7A4C", red: "#C8202F", violet: "#6B3FA0", yellow: "#E8B21E", teal: "#127C7A" },
    },
    dark: {
      bg: "#15120E",
      bgDeep: "#0C0A07",
      surface: "#1F1B16",
      surfaceHi: "#29241D",
      track: "#3B342A",
      trackHi: "#564C3E",
      gridDot: "#2A251E",
      text: "#F2ECE0",
      textDim: "#B8AE9D",
      textFaint: "#807767",
      ink: "#15120E",
      paper: "#FFFDF8",
      lines: { blue: "#7090FF", orange: "#FF7A3D", green: "#4CC287", red: "#FF5468", violet: "#B28DFF", yellow: "#F2C14E", teal: "#3CC9C2" },
    },
  },
  fonts: {
    sans: "Inter Tight Variable, Inter Tight, system-ui, sans-serif",
    mono: "Overpass Mono Variable, Overpass Mono, ui-monospace, monospace",
    display: "Fraunces Variable, Fraunces, Georgia, serif",
  },
  displayRoles: ["display", "headline", "title", "numeral"],
  type: {
    ...TYPE,
    display: { size: 148, weight: 560, lineHeight: 0.96, tracking: -0.032, css: { fontVariationSettings: '"opsz" 144, "SOFT" 30' } },
    headline: { size: 104, weight: 520, lineHeight: 1.0, tracking: -0.026, css: { fontVariationSettings: '"opsz" 144, "SOFT" 30' } },
    title: { size: 62, weight: 500, lineHeight: 1.08, tracking: -0.012, css: { fontVariationSettings: '"opsz" 72' } },
    body: { size: 42, weight: 480, lineHeight: 1.25, tracking: -0.008 },
    label: { size: 30, weight: 600, lineHeight: 1.1, tracking: -0.004 },
    caption: { size: 24, weight: 480, lineHeight: 1.25, tracking: 0 },
    micro: { size: 19, weight: 700, lineHeight: 1.0, tracking: 0.14, css: { textTransform: "uppercase" } },
    code: { size: 32, weight: 500, lineHeight: 1.45, tracking: 0 },
    numeral: { size: 300, weight: 400, lineHeight: 0.86, tracking: -0.045, css: { fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 1' } },
  },
  ease: {
    snap: [0.76, 0, 0.24, 1],
    glide: [0.22, 1, 0.36, 1],
    drift: [0.65, 0, 0.35, 1],
    exit: [0.7, 0, 0.84, 0],
    linear: [0, 0, 1, 1],
  },
  plate: "marker",
  defaults: { theme: "light", music: "house-night-transit" },
};

export default EDITORIAL;
