/**
 * npm run new-style -- <id> "Style name" [--from transit]
 *
 * Scaffolds src/styles/<id>/ from an existing style: editable tokens (palettes, fonts, type, curves),
 * an index that registers the style, and an Intro to redesign. Scene overrides are opt-in: copy a
 * scene from src/scenes (or another style's scenes/) into src/styles/<id>/scenes/ and register it.
 * The style is picked up automatically (npm run sync) and selectable in the studio and channels.
 */
import fs from "node:fs";
import path from "node:path";
import { STYLE_TOKENS } from "../src/style-tokens.generated";
import { ROOT, cli, fail, rel } from "./lib/common";
import { sync } from "./sync";

const { values, positionals } = cli({ from: { type: "string" } });
const [id, name] = positionals;
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) fail('usage: npm run new-style -- <id> "Style name" [--from transit]');
const from = values.from ?? "transit";
const base = STYLE_TOKENS[from];
if (!base) fail(`unknown style "${from}" (styles: ${Object.keys(STYLE_TOKENS).join(", ")})`);
const dir = path.join(ROOT, "src", "styles", id);
if (fs.existsSync(dir)) fail(`${rel(dir)} already exists`);
fs.mkdirSync(path.join(dir, "scenes"), { recursive: true });

const tokens = { ...base, id, name: name ?? id, description: `TODO: one paragraph on the look, the feel and when to use ${name ?? id}.` };
fs.writeFileSync(
  path.join(dir, "tokens.ts"),
  `import type { StyleTokens } from "../../design/style-tokens";

/**
 * ${tokens.name} — started from "${from}". Change what makes this style itself: the palettes (keep
 * the seven line colours' meanings), fonts (bundle them from Fontsource in fonts.ts), the type scale,
 * the easing curves and how {plates} look ("badge" or "marker").
 */
const tokens: StyleTokens = ${JSON.stringify(tokens, null, 2)};

export default tokens;
`,
);
fs.writeFileSync(
  path.join(dir, "Intro.tsx"),
  fs
    .readFileSync(path.join(ROOT, "src", "styles", "transit", "Intro.tsx"), "utf8")
    .replace("export const TransitIntro", `export const Intro`)
    .replace("Transit channel intro", `${tokens.name} channel intro (copied from transit: redesign it)`),
);
fs.writeFileSync(
  path.join(dir, "index.tsx"),
  `import "../../design/fonts";
import { Stage } from "../../primitives/Stage";
import { LineWipes } from "../transit/LineWipes";
import type { StyleDef } from "../types";
import { Intro } from "./Intro";
import tokens from "./tokens";

/**
 * ${tokens.name}. Every scene type falls back to the shared library (src/scenes), restyled by the
 * tokens. Override the ones that should look different: scenes: { statement: MyStatement, … }.
 */
const style: StyleDef = {
  tokens,
  scenes: {},
  Background: Stage,
  Overlay: LineWipes,
  Intro,
};

export default style;
`,
);
fs.writeFileSync(path.join(dir, "scenes", ".gitkeep"), "");
sync(true);
console.log(`created ${rel(dir)}/ (tokens.ts, index.tsx, Intro.tsx, scenes/)`);
console.log(`preview: npm run studio (pick "Style: ${tokens.name}") or npm run sheet -- gallery --style ${id}`);
