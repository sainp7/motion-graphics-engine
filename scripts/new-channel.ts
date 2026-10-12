/**
 * npm run new-channel -- <id> "Channel name" [--style transit] [--handle @you] [--tagline "…"] [--theme dark]
 *
 * Creates channels/<id>/channel.json: the style, theme, narrator, music, handle and intro every
 * video of this channel inherits. Make it the default for new videos in studio.json.
 */
import fs from "node:fs";
import path from "node:path";
import { STYLE_TOKENS } from "../src/style-tokens.generated";
import { ROOT, cli, fail, rel } from "./lib/common";
import { sync } from "./sync";

const { values, positionals } = cli({ style: { type: "string" }, handle: { type: "string" }, tagline: { type: "string" }, theme: { type: "string" } });
const [id, name] = positionals;
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) fail('usage: npm run new-channel -- <id> "Channel name" [--style transit] [--handle @you]');
const style = values.style ?? "transit";
const tokens = STYLE_TOKENS[style];
if (!tokens) fail(`unknown style "${style}" (styles: ${Object.keys(STYLE_TOKENS).join(", ")})`);
const file = path.join(ROOT, "channels", id, "channel.json");
if (fs.existsSync(file)) fail(`${rel(file)} already exists`);
fs.mkdirSync(path.dirname(file), { recursive: true });
const channel = {
  $schema: "../../schema/channel.schema.json",
  id,
  name: name ?? id,
  tagline: values.tagline ?? "",
  handle: values.handle ?? "@yourhandle",
  platforms: ["youtube"],
  style,
  theme: values.theme ?? tokens.defaults?.theme ?? "dark",
  voice: { engine: "qwen3", voice: "Aiden" },
  music: { track: tokens.defaults?.music ?? "transit-drive", volume: 0.22 },
  intro: { enabled: true, seconds: 3.5, line: "orange", formats: ["landscape"] },
  outro: { cta: "Follow for more" },
};
fs.writeFileSync(file, JSON.stringify(channel, null, 2) + "\n");
sync(true);
console.log(`created ${rel(file)} (style ${style})`);
console.log(`next: edit the name, tagline, handle and CTA; then npm run new -- 001-first-video "Title" --channel ${id}`);
