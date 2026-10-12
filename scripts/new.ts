/**
 * npm run new -- <video-id> ["Working title"] [--channel essays]
 *
 * Scaffolds videos/<id>/ with brief.md, script.md and a starter spec.json. The video inherits its
 * style, theme, voice, music, handle and intro from the channel (studio.json's default if omitted).
 * Ids look like 002-rate-limiting: a running number and a short slug.
 */
import fs from "node:fs";
import { cli, fail, paths, rel, requireId } from "./lib/common";
import { sync } from "./sync";
import { channelIds } from "../src/spec/channel";

const { values, positionals } = cli({ channel: { type: "string" } });
if (values.channel && !channelIds().includes(values.channel))
  fail(`unknown channel "${values.channel}" (channels: ${channelIds().join(", ")}). Create one: npm run new-channel -- ${values.channel} "Name"`);
const id = requireId(positionals);
if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) fail("ids are lowercase letters, digits, - and _ (e.g. 002-rate-limiting)");
const title = positionals[1] ?? id.replace(/^\d+-/, "").replace(/-/g, " ");
const P = paths(id);
if (fs.existsSync(P.spec)) fail(`${rel(P.spec)} already exists`);
fs.mkdirSync(P.dir, { recursive: true });

fs.writeFileSync(
  P.brief,
  `# Brief: ${title}

## The idea
<!-- What the viewer asked for or the link that sparked it. -->

## Audience and promise
<!-- Who is this for, and what will they be able to explain after 3–4 minutes? -->

## Key facts (verified)
<!-- One claim per line, each with a source link. Nothing goes on screen unless it is here. -->

## Sources
<!-- - [Title](url) -->
`,
);

fs.writeFileSync(
  P.script,
  `# Script: ${title}

<!-- The human-readable script. One block per segment; the spec mirrors it.
     Use {words|cue} to mark sync points and [pause 0.6] for deliberate pauses. -->
`,
);

const spec = {
  $schema: "../../schema/video-spec.schema.json",
  version: 1,
  id,
  title,
  ...(values.channel ? { channel: values.channel } : {}),
  lines: {},
  diagrams: {},
  thumbnail: { lines: [title] },
  segments: [
    {
      id: "hook",
      choreo: "cold-open",
      beats: [{ say: "Replace this with the hook. [pause 0.4] Make the viewer need the answer." }],
      scene: { type: "statement", lines: ["Replace with", "the {hook}."], underline: "orange" },
    },
    {
      id: "outro",
      choreo: "outro",
      beats: [{ say: "Close the loop on the opening question." }, { say: "Follow for more system design." }],
      scene: { type: "outro", text: "The closing line." },
    },
  ],
};
fs.writeFileSync(P.spec, JSON.stringify(spec, null, 2) + "\n");
sync(true);
console.log(`created ${rel(P.dir)}/ (brief.md, script.md, spec.json)`);
