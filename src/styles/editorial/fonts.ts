import { loadFont } from "@remotion/fonts";
import fraunces from "@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2";
import frauncesItalic from "@fontsource-variable/fraunces/files/fraunces-latin-full-italic.woff2";
import interTight from "@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2";
import interTightItalic from "@fontsource-variable/inter-tight/files/inter-tight-latin-wght-italic.woff2";

/** Bundled from npm (Fontsource, OFL), so renders never fetch fonts. */
export const editorialFonts = Promise.all([
  loadFont({ family: "Fraunces Variable", url: fraunces, weight: "100 900", style: "normal" }),
  loadFont({ family: "Fraunces Variable", url: frauncesItalic, weight: "100 900", style: "italic" }),
  loadFont({ family: "Inter Tight Variable", url: interTight, weight: "100 900", style: "normal" }),
  loadFont({ family: "Inter Tight Variable", url: interTightItalic, weight: "100 900", style: "italic" }),
]);
