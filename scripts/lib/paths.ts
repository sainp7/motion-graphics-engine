/** Repo paths. No spec or generated imports, so scripts/sync.ts can always run. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

