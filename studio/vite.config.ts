/**
 * npm run studio — the review studio (Vite + @remotion/player).
 *
 * Besides serving the app it runs a small local API:
 *   GET  /api/check/:id   the full linter (Node), same findings as `npm run check`
 *   POST /api/run         { script: "voice"|"sheet"|"render"|"check"|"publish-kit", id, args? }
 *   GET  /api/jobs        status and output tail of the jobs started from the studio
 * and re-runs `npm run sync` when a video, scene, channel or style is added or removed, so new
 * files show up without a restart. Edits to spec.json hot-reload the preview.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, "..");

type Job = { id: number; label: string; status: "running" | "done" | "failed"; out: string; started: number };
const jobs: Job[] = [];
const ALLOWED = new Set(["voice", "sheet", "render", "check", "publish-kit"]);

const json = (res: import("node:http").ServerResponse, code: number, body: unknown) => {
  res.statusCode = code;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
};

const readBody = (req: import("node:http").IncomingMessage) =>
  new Promise<string>((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });

const studioApi = (): Plugin => ({
  name: "studio-api",
  configureServer(server: ViteDevServer) {
    const sync = async () => {
      try {
        const mod = await server.ssrLoadModule(path.join(repo, "scripts/sync.ts"));
        mod.sync(true);
      } catch (e) {
        server.config.logger.error(`sync failed: ${(e as Error).message}`);
      }
    };
    void sync();
    const watched = /[/\\](videos|channels)[/\\]|[/\\]src[/\\]styles[/\\][^/\\]+[/\\](index\.tsx|tokens\.ts)$/;
    for (const ev of ["add", "unlink", "addDir", "unlinkDir"] as const) server.watcher.on(ev, (p: string) => watched.test(p) && void sync());
    server.watcher.add([path.join(repo, "videos"), path.join(repo, "channels"), path.join(repo, "public/videos")]);

    server.middlewares.use(async (req, res, next) => {
      const url = req.url ?? "";
      if (!url.startsWith("/api/")) return next();
      try {
        const check = /^\/api\/check\/([\w-]+)/.exec(url);
        if (check && req.method === "GET") {
          const common = await server.ssrLoadModule(path.join(repo, "scripts/lib/common.ts"));
          const { lint } = await server.ssrLoadModule(path.join(repo, "scripts/lib/lint.ts"));
          const r = lint(common.loadRawSpec(check[1]), common.loadTiming(check[1]));
          return json(res, 200, { findings: r.findings });
        }
        if (url.startsWith("/api/run") && req.method === "POST") {
          const { script, id, args = [] } = JSON.parse(await readBody(req)) as { script: string; id: string; args?: string[] };
          if (!ALLOWED.has(script) || !/^[\w-]+$/.test(id) || !args.every((a) => /^[\w:.=-]+$/.test(a))) return json(res, 400, { error: "not allowed" });
          const job: Job = { id: jobs.length + 1, label: `npm run ${script} -- ${[id, ...args].join(" ")}`, status: "running", out: "", started: Date.now() };
          jobs.unshift(job);
          const child = spawn("npm", ["run", script, "--", id, ...args], { cwd: repo, env: process.env });
          const add = (d: Buffer) => (job.out = (job.out + d.toString()).slice(-20000));
          child.stdout.on("data", add);
          child.stderr.on("data", add);
          child.on("close", (code) => {
            job.status = code === 0 ? "done" : "failed";
            if (script === "voice") void sync(); // new timing.json → registry
          });
          return json(res, 200, { job: job.id });
        }
        if (url.startsWith("/api/jobs")) return json(res, 200, { jobs: jobs.slice(0, 12) });
        return json(res, 404, { error: "unknown endpoint" });
      } catch (e) {
        return json(res, 500, { error: (e as Error).message });
      }
    });
  },
});

export default defineConfig({
  root,
  publicDir: path.join(repo, "public"),
  plugins: [studioApi()],
  server: { port: 4321, open: true, fs: { allow: [repo] } },
  // the scenes are plain TSX/JS; Vite transforms JSX with the automatic runtime from tsconfig
  esbuild: { jsx: "automatic" },
});
