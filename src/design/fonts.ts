import { loadFont } from "@remotion/fonts";
import overpass from "@fontsource-variable/overpass/files/overpass-latin-wght-normal.woff2";
import overpassItalic from "@fontsource-variable/overpass/files/overpass-latin-wght-italic.woff2";
import overpassMono from "@fontsource-variable/overpass-mono/files/overpass-mono-latin-wght-normal.woff2";

/**
 * Fonts are bundled from npm (Fontsource), never fetched at render time,
 * so renders are reproducible offline. loadFont() blocks rendering until loaded.
 */
export const fontsReady = Promise.all([
  loadFont({ family: "Overpass Variable", url: overpass, weight: "100 900", style: "normal" }),
  loadFont({ family: "Overpass Variable", url: overpassItalic, weight: "100 900", style: "italic" }),
  loadFont({ family: "Overpass Mono Variable", url: overpassMono, weight: "300 700", style: "normal" }),
]);
