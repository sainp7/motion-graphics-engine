import { Player, type PlayerRef } from "@remotion/player";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHANNELS } from "../src/channels.generated";
import { REGISTRY } from "../src/registry.generated";
import { getChannel } from "../src/spec/channel";
import { compile, type Compiled } from "../src/spec/compile";
import { STYLES } from "../src/styles.generated";
import { SpecVideo } from "../src/video/SpecVideo";

type Finding = { level: "error" | "warn" | "info"; where: string; msg: string };
type Job = { id: number; label: string; status: "running" | "done" | "failed"; out: string };

const store = {
  get: (k: string, d = "") => {
    try {
      return localStorage.getItem(`studio.${k}`) ?? d;
    } catch {
      return d;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(`studio.${k}`, v);
    } catch {
      /* private window: settings just don't persist */
    }
  },
};

const fmt = (f: number, fps: number) => {
  const s = f / fps;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.floor(f % fps)).padStart(2, "0")}`;
};

export const App: React.FC = () => {
  const [videoId, setVideoId] = useState(() => {
    const h = location.hash.slice(1);
    return REGISTRY.some((v) => v.id === h) ? h : store.get("video", REGISTRY[0]?.id ?? "");
  });
  const [styleId, setStyleId] = useState(() => store.get("style"));
  const [theme, setTheme] = useState<"" | "dark" | "light">(() => store.get("theme") as "" | "dark" | "light");
  const [muteMusic, setMuteMusic] = useState(() => store.get("muteMusic") === "1");
  const [muteSfx, setMuteSfx] = useState(() => store.get("muteSfx") === "1");
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [openJob, setOpenJob] = useState<number | null>(null);
  const player = useRef<PlayerRef>(null);

  const entry = REGISTRY.find((v) => v.id === videoId) ?? REGISTRY[0];
  const compiled: Compiled | null = useMemo(() => {
    if (!entry) return null;
    try {
      return compile(entry.spec, entry.timing, { theme: theme || undefined, style: styleId || undefined });
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [entry, theme, styleId]);

  useEffect(() => {
    store.set("video", videoId);
    location.hash = videoId;
  }, [videoId]);
  useEffect(() => store.set("style", styleId), [styleId]);
  useEffect(() => store.set("theme", theme), [theme]);
  useEffect(() => store.set("muteMusic", muteMusic ? "1" : "0"), [muteMusic]);
  useEffect(() => store.set("muteSfx", muteSfx ? "1" : "0"), [muteSfx]);

  // player events; restore the playhead after a hot reload
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    (window as unknown as { __player?: PlayerRef }).__player = p; // for debugging from the console
    const saved = Number(store.get(`frame.${videoId}`, "0"));
    if (saved > 0 && compiled && saved < compiled.durationInFrames) p.seekTo(saved);
    // the UI follows the playhead at ~15 fps; the Player itself renders every frame
    let last = -1;
    const onFrame = (e: { type?: string; detail: { frame: number } }) => {
      const f = e.detail.frame;
      if (Math.abs(f - last) < 2 && e.type !== "seeked") return;
      last = f;
      setFrame(f);
      if (f % 15 === 0 || e.type === "seeked") store.set(`frame.${videoId}`, String(f));
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      setFrame(p.getCurrentFrame());
      store.set(`frame.${videoId}`, String(p.getCurrentFrame()));
    };
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("seeked", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("seeked", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, compiled?.durationInFrames]);

  // the linter runs in Node, through the studio server
  useEffect(() => {
    setFindings(null);
    fetch(`/api/check/${videoId}`)
      .then((r) => r.json())
      .then((d) => setFindings(d.findings ?? []))
      .catch(() => setFindings([]));
  }, [videoId, entry]);

  // jobs: poll while something runs
  const pollJobs = useCallback(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    pollJobs();
    if (!jobs.some((j) => j.status === "running")) return;
    const t = setInterval(pollJobs, 1500);
    return () => clearInterval(t);
  }, [jobs, pollJobs]);
  const run = (script: string, args: string[] = []) => {
    fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ script, id: videoId, args }) })
      .then((r) => r.json())
      .then((d) => {
        setOpenJob(d.job);
        pollJobs();
      });
  };

  const seek = useCallback((f: number) => {
    player.current?.seekTo(Math.max(0, Math.round(f)));
    setFrame(Math.max(0, Math.round(f)));
  }, []);

  // keyboard: space, arrows, [ ], J/L, M, T
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!compiled || (e.target as HTMLElement).tagName === "SELECT") return;
      const fps = compiled.fps;
      const f = player.current?.getCurrentFrame() ?? frame;
      const segs = compiled.segments;
      const cur = segs.findIndex((s) => f >= s.from && f < s.from + s.durationInFrames);
      const k = e.key;
      if (k === " ") player.current?.toggle();
      else if (k === "ArrowRight") seek(f + (e.shiftKey ? fps : 1));
      else if (k === "ArrowLeft") seek(f - (e.shiftKey ? fps : 1));
      else if (k === "l" || k === "L") seek(f + 5 * fps);
      else if (k === "j" || k === "J") seek(f - 5 * fps);
      else if (k === "]") seek(segs[Math.min(segs.length - 1, cur + 1)].from);
      else if (k === "[") seek(segs[Math.max(0, f - segs[cur].from > fps ? cur : cur - 1)].from);
      else if (k === "m" || k === "M") setMuteMusic((v) => !v);
      else if (k === "t" || k === "T") setTheme((v) => (v === "light" ? "dark" : "light"));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compiled, frame, seek]);

  if (!entry) return <div className="empty">No videos yet. Run <code>npm run new -- 004-my-topic "Title"</code>.</div>;
  if (!compiled) return <div className="empty">This spec does not compile. Run <code>npm run check -- {videoId}</code> for details.</div>;

  const c = compiled;
  const fps = c.fps;
  const style = STYLES[c.style] ?? STYLES.transit;
  const palette = style.tokens.palettes[c.theme];
  const seg = c.segments.find((s) => frame >= s.from && frame < s.from + s.durationInFrames) ?? c.segments[0];
  const localFrame = frame - seg.from;
  const channels = Object.keys(CHANNELS);
  const byChannel = channels.map((ch) => ({ ch, name: getChannel(ch)?.name ?? ch, videos: REGISTRY.filter((v) => (v.spec.channel ?? channels[0]) === ch) }));
  const orphans = REGISTRY.filter((v) => v.spec.channel && !channels.includes(v.spec.channel));
  const errors = (findings ?? []).filter((f) => f.level === "error");
  const warns = (findings ?? []).filter((f) => f.level === "warn");

  return (
    <div className="app" style={{ ["--accent" as string]: palette.lines.orange }}>
      <header>
        <div className="brand">Motion Studio</div>
        <select value={videoId} onChange={(e) => setVideoId(e.target.value)} title="Video">
          {byChannel.map((g) => (
            <optgroup key={g.ch} label={g.name}>
              {g.videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
            </optgroup>
          ))}
          {orphans.map((v) => (
            <option key={v.id} value={v.id}>
              {v.id}
            </option>
          ))}
        </select>
        <select value={styleId} onChange={(e) => setStyleId(e.target.value)} title="Motion style">
          <option value="">Style: channel ({c.channel?.style ?? "transit"})</option>
          {Object.entries(STYLES).map(([id, s]) => (
            <option key={id} value={id}>
              Style: {s.tokens.name}
            </option>
          ))}
        </select>
        <div className="seg-toggle" title="Theme (T)">
          {(["", "dark", "light"] as const).map((t) => (
            <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)}>
              {t === "" ? "Spec" : t === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </div>
        <label className="chk" title="Mute music (M)">
          <input type="checkbox" checked={muteMusic} onChange={(e) => setMuteMusic(e.target.checked)} /> mute music
        </label>
        <label className="chk">
          <input type="checkbox" checked={muteSfx} onChange={(e) => setMuteSfx(e.target.checked)} /> mute sfx
        </label>
        <span className={`pill ${c.draft ? "warn" : "ok"}`}>{c.draft ? "draft timing" : "voiced"}</span>
        <div className="actions">
          <button onClick={() => run("voice")}>Voice</button>
          <button onClick={() => run("sheet", [...(styleId ? ["--style", styleId] : []), ...(theme ? ["--theme", theme] : [])])}>Sheet</button>
          <button onClick={() => run("render", ["--draft", ...(styleId ? ["--style", styleId] : []), ...(theme ? ["--theme", theme] : [])])}>Draft render</button>
          <button className="primary" onClick={() => run("render", [...(styleId ? ["--style", styleId] : []), ...(theme ? ["--theme", theme] : [])])}>
            Render
          </button>
        </div>
      </header>

      <main>
        <section className="stage">
          <div className="player-wrap">
            <Preview
              playerRef={player}
              spec={entry.spec}
              timing={entry.timing}
              theme={theme || undefined}
              styleId={styleId || undefined}
              muteMusic={muteMusic}
              muteSfx={muteSfx}
              durationInFrames={c.durationInFrames}
              fps={fps}
              width={c.width}
              height={c.height}
            />
          </div>
          <Timeline c={c} frame={frame} onSeek={seek} palette={palette} />
          <Script c={c} frame={frame} onSeek={seek} />
        </section>

        <aside>
          <div className="card">
            <div className="kicker">
              Segment {seg.index + 1} of {c.segments.length} · {fmt(frame, fps)} {playing ? "▶" : ""}
            </div>
            <h2>{seg.id}</h2>
            <div className="meta">
              <span className="tag" style={{ background: palette.lines[seg.accent] }}>{seg.choreo.id}</span>
              <span className="tag ghost">{seg.scene.type}</span>
              <span className="tag ghost">{(seg.durationInFrames / fps).toFixed(1)} s</span>
              <span className="tag ghost">energy {seg.choreo.sound.energy}</span>
            </div>
            <p className="purpose">{seg.choreo.purpose}</p>
            <Cues seg={seg} fps={fps} onSeek={seek} localFrame={localFrame} />
          </div>

          <div className="card">
            <div className="kicker">
              Check {findings === null ? "…" : `· ${errors.length} errors · ${warns.length} warnings`}
            </div>
            {findings !== null && errors.length + warns.length === 0 && <div className="ok-line">Clean.</div>}
            <ul className="findings">
              {[...errors, ...warns].slice(0, 30).map((f, i) => (
                <li key={i} className={f.level} onClick={() => {
                  const s = c.segments.find((x) => x.id === f.where);
                  if (s) seek(s.from);
                }}>
                  <b>{f.where}</b> {f.msg}
                </li>
              ))}
            </ul>
          </div>

          {jobs.length > 0 && (
            <div className="card">
              <div className="kicker">Jobs</div>
              <ul className="jobs">
                {jobs.map((j) => (
                  <li key={j.id} className={j.status} onClick={() => setOpenJob(openJob === j.id ? null : j.id)}>
                    <span className="dot" /> {j.label}
                    {openJob === j.id && <pre>{j.out.split("\n").slice(-40).join("\n")}</pre>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card keys">
            <div className="kicker">Keys</div>
            <div>
              <kbd>Space</kbd> play · <kbd>←</kbd>/<kbd>→</kbd> frame (<kbd>Shift</kbd> 1 s) · <kbd>J</kbd>/<kbd>L</kbd> ±5 s · <kbd>[</kbd>/<kbd>]</kbd> segment · <kbd>T</kbd> theme · <kbd>M</kbd> music
            </div>
            <div className="muted">Edit <code>videos/{videoId}/spec.json</code>: the preview reloads on save.</div>
          </div>
        </aside>
      </main>
    </div>
  );
};

/**
 * The Player, isolated from the studio's UI state: the playhead updates the panels many times a
 * second, and none of that may re-render the video (new inputProps every render made the Player
 * re-render the whole composition on top of its own frame updates).
 */
const Preview = React.memo(function Preview(props: {
  playerRef: React.RefObject<PlayerRef | null>;
  spec: (typeof REGISTRY)[number]["spec"];
  timing: (typeof REGISTRY)[number]["timing"];
  theme?: "dark" | "light";
  styleId?: string;
  muteMusic: boolean;
  muteSfx: boolean;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}) {
  const { spec, timing, theme, styleId, muteMusic, muteSfx } = props;
  const inputProps = useMemo(() => ({ spec, timing, theme, style: styleId, muteMusic, muteSfx }), [spec, timing, theme, styleId, muteMusic, muteSfx]);
  return (
    <Player
      ref={props.playerRef}
      component={SpecVideo}
      inputProps={inputProps}
      durationInFrames={props.durationInFrames}
      fps={props.fps}
      compositionWidth={props.width}
      compositionHeight={props.height}
      style={{ width: "100%", aspectRatio: `${props.width} / ${props.height}` }}
      controls
      clickToPlay
      doubleClickToFullscreen
      acknowledgeRemotionLicense
      bufferStateDelayInMilliseconds={300}
    />
  );
});

const Timeline: React.FC<{ c: Compiled; frame: number; onSeek: (f: number) => void; palette: { lines: Record<string, string> } }> = ({ c, frame, onSeek, palette }) => {
  const total = c.durationInFrames;
  const ref = useRef<HTMLDivElement>(null);
  const click = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    onSeek(((e.clientX - r.left) / r.width) * total);
  };
  return (
    <div className="timeline" ref={ref} onClick={click}>
      <div className="chapters">
        {c.chapters.map((ch) => (
          <span key={ch.frame} style={{ left: `${(ch.frame / total) * 100}%` }}>
            {ch.title}
          </span>
        ))}
      </div>
      <div className="segs">
        {c.segments.map((s) => (
          <div
            key={s.id}
            className={`seg ${frame >= s.from && frame < s.from + s.durationInFrames ? "cur" : ""}`}
            style={{ width: `${(s.durationInFrames / total) * 100}%`, ["--c" as string]: palette.lines[s.accent], height: `${10 + s.choreo.sound.energy * 6}px` }}
            title={`${s.id} · ${s.choreo.id} · ${s.scene.type}`}
          />
        ))}
      </div>
      <div className="labels">
        {c.segments.map((s) => (
          <span key={s.id} style={{ width: `${(s.durationInFrames / total) * 100}%` }}>
            {s.durationInFrames / total > 0.04 ? s.id : ""}
          </span>
        ))}
      </div>
      <div className="playhead" style={{ left: `${(frame / total) * 100}%` }} />
    </div>
  );
};

const Script: React.FC<{ c: Compiled; frame: number; onSeek: (f: number) => void }> = ({ c, frame, onSeek }) => {
  const fps = c.fps;
  const seg = c.segments.find((s) => frame >= s.from && frame < s.from + s.durationInFrames) ?? c.segments[0];
  const raw = c.spec.segments.find((s) => s.id === seg.id);
  if (!seg.beats.length) return <div className="script muted">No narration: {seg.scene.type === "intro" ? "the channel intro." : "silent segment."}</div>;
  return (
    <div className="script">
      {seg.beats.map((b, i) => {
        const start = seg.from + b.from;
        const active = frame >= start && frame < start + b.durationInFrames;
        const beat = raw?.beats[i];
        return (
          <p key={b.key} className={active ? "active" : ""}>
            <span className="beat-tag">
              b{i + 1}
              {beat?.pace ? ` · ${beat.pace}` : ""}
              {beat?.style ? ` · ${beat.style}` : ""}
            </span>
            {b.timing.words.map((w, k) => {
              const f0 = start + Math.round(w.s * fps);
              const f1 = start + Math.round(w.e * fps);
              const on = frame >= f0 && frame < f1 + 2;
              return (
                <span key={k} className={`w ${on ? "on" : frame >= f1 ? "said" : ""}`} onClick={() => onSeek(f0)}>
                  {w.w}{" "}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
};

const Cues: React.FC<{ seg: Compiled["segments"][number]; fps: number; onSeek: (f: number) => void; localFrame: number }> = ({ seg, fps, onSeek, localFrame }) => {
  const cues: { name: string; f: number }[] = [];
  seg.beats.forEach((b) => {
    for (const [name, r] of Object.entries(b.timing.cues)) cues.push({ name, f: b.from + Math.round(r.start * fps) });
  });
  if (seg.scene.type === "custom") for (const [name, f] of Object.entries(seg.scene.cues)) cues.push({ name: `scene.${name}`, f });
  cues.sort((a, b) => a.f - b.f);
  if (!cues.length) return null;
  return (
    <div className="cues">
      {cues.map((q) => (
        <button key={q.name} className={localFrame >= q.f ? "past" : ""} onClick={() => onSeek(seg.from + q.f)}>
          {q.name} <span>{(q.f / fps).toFixed(2)}s</span>
        </button>
      ))}
    </div>
  );
};
