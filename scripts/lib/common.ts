import { spawnSync, SpawnSyncOptions } from "node:child_process";
import { parseArgs, ParseArgsConfig } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VideoSpec, VideoSpecT } from "../../src/spec/schema";
import type { TimingFile } from "../../src/spec/timing";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const VIDEOS = path.join(ROOT, "videos");
export const PUBLIC = path.join(ROOT, "public");
export const OUT = path.join(ROOT, "out");

export const paths = (id: string) => ({
  dir: path.join(VIDEOS, id),
  spec: path.join(VIDEOS, id, "spec.json"),
  script: path.join(VIDEOS, id, "script.md"),
  brief: path.join(VIDEOS, id, "brief.md"),
  publish: path.join(VIDEOS, id, "publish.md"),
  build: path.join(PUBLIC, "videos", id),
  timing: path.join(PUBLIC, "videos", id, "timing.json"),
  narration: path.join(PUBLIC, "videos", id, "narration.json"),
  out: path.join(OUT, id),
});

export const listVideos = () =>
  fs.existsSync(VIDEOS)
    ? fs
        .readdirSync(VIDEOS)
        .filter((d) => fs.existsSync(path.join(VIDEOS, d, "spec.json")))
        .sort()
    : [];

export const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

export const loadRawSpec = (id: string): unknown => {
  const p = paths(id).spec;
  if (!fs.existsSync(p)) fail(`No spec at ${rel(p)}. Create it with \`npm run new -- ${id}\`.`);
  return readJson(p);
};

export const loadSpec = (id: string): VideoSpecT => VideoSpec.parse(loadRawSpec(id));

export const loadTiming = (id: string): TimingFile | null => {
  const p = paths(id).timing;
  return fs.existsSync(p) ? readJson<TimingFile>(p) : null;
};

export const rel = (p: string) => path.relative(ROOT, p) || ".";

export const fail = (msg: string): never => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

/** Parse CLI arguments. Options are declared per script; unknown flags are an error. */
export const cli = <O extends NonNullable<ParseArgsConfig["options"]>>(options: O) => {
  try {
    return parseArgs({ options, allowPositionals: true, strict: true });
  } catch (e) {
    return fail((e as Error).message);
  }
};

export const requireId = (positionals: string[]) => {
  const id = positionals[0];
  if (!id) {
    const vids = listVideos();
    fail(`Pass a video id. Available: ${vids.length ? vids.join(", ") : "(none yet — npm run new -- <id>)"}`);
  }
  return id!;
};

export const run = (cmd: string, args: string[], opts: SpawnSyncOptions = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, ...opts });
  if (r.error) fail(`${cmd} failed: ${r.error.message}`);
  if (r.status !== 0) fail(`${cmd} ${args.slice(0, 3).join(" ")} … exited with ${r.status}`);
  return r;
};

export const capture = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};

/** Extra CLI args for Remotion, e.g. a custom Chrome via REMOTION_BROWSER_EXECUTABLE. */
export const remotionBrowserArgs = () =>
  process.env.REMOTION_BROWSER_EXECUTABLE ? [`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`] : [];

export const ffmpeg = (args: string[]) => capture("npx", ["remotion", "ffmpeg", ...args]);
export const ffprobe = (args: string[]) => capture("npx", ["remotion", "ffprobe", ...args]);

export const fmtTime = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
