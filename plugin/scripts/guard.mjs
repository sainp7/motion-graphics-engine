#!/usr/bin/env node
/**
 * Guardrail hook (PostToolUse on Write/Edit).
 *
 *   videos/<id>/spec.json   → runs `npm run check` for that video; errors are fed back to Claude
 *   src/**\/*.tsx outside src/design, and videos/<id>/scenes/*.tsx (custom scenes)
 *                           → rejects raw colours, CSS animations and randomness
 *
 * Exit 2 shows stderr to Claude so it fixes the problem in the same turn.
 * Anything else (or a project without the studio scripts) passes silently.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const input = await new Promise((resolve) => {
  let data = "";
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => {
    try {
      resolve(JSON.parse(data || "{}"));
    } catch {
      resolve({});
    }
  });
});

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const file = input?.tool_input?.file_path;
if (!file || !fs.existsSync(path.join(root, "scripts", "check.ts"))) process.exit(0);
const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join("/");

const spec = /^videos\/([^/]+)\/spec\.json$/.exec(rel);
if (spec) {
  const r = spawnSync("npx", ["tsx", "scripts/check.ts", spec[1], "--quiet"], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) {
    process.stderr.write(`Spec check failed for ${spec[1]}. Fix these before continuing:\n${r.stderr || r.stdout}`);
    process.exit(2);
  }
  process.exit(0);
}

const tokenFile = rel.startsWith("src/design/") || /^src\/styles\/[^/]+\/tokens\.ts$/.test(rel); // palettes live here
const designCode = (/^src\/.*\.tsx?$/.test(rel) && !tokenFile) || /^videos\/[^/]+\/scenes\/.*\.(tsx?|js)$/.test(rel);
if (designCode && fs.existsSync(path.join(root, rel))) {
  const text = fs.readFileSync(path.join(root, rel), "utf8");
  const problems = [];
  text.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    if (/#[0-9a-fA-F]{3,8}\b/.test(line) && !/url\(#/.test(line)) problems.push(`${rel}:${i + 1} raw hex colour — use the theme palette (useTheme().p / line())`);
    if (/\brgba?\(/.test(line)) problems.push(`${rel}:${i + 1} raw rgb colour — use alpha()/mix() from src/design/tokens`);
    if (/\b(transition|animation)\s*:/.test(line)) problems.push(`${rel}:${i + 1} CSS transition/animation does not render in Remotion — drive it from useCurrentFrame()`);
    if (/Math\.random\(/.test(line)) problems.push(`${rel}:${i + 1} Math.random() makes renders non-deterministic — use random(seed) from remotion`);
  });
  if (problems.length) {
    process.stderr.write(`Design-system guardrail:\n${problems.join("\n")}\n`);
    process.exit(2);
  }
}
process.exit(0);
