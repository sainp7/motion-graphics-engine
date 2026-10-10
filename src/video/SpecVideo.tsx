import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { AudioLayer } from "../audio/AudioLayer";
import "../design/fonts";
import { lerp, prog } from "../design/motion";
import { ThemeProvider, useTheme } from "../design/theme";
import { Stage } from "../primitives/Stage";
import { Chapter } from "../scenes/Chapter";
import { Code } from "../scenes/Code";
import { Compare } from "../scenes/Compare";
import { Diagram } from "../scenes/diagram/Diagram";
import { List } from "../scenes/List";
import { Outro } from "../scenes/Outro";
import { Sequence as SequenceScene } from "../scenes/Sequence";
import { Stat } from "../scenes/Stat";
import { Statement } from "../scenes/Statement";
import { Compiled, CompiledSegment, compile } from "../spec/compile";
import type { TimingFile } from "../spec/timing";
import type { VideoSpecInput } from "../spec/schema";
import { SegmentCtx, VideoCtx, useSegment } from "./context";
import { QaProbe } from "./QaProbe";

export type SpecVideoProps = {
  spec: VideoSpecInput;
  timing?: TimingFile | null;
  theme?: "dark" | "light";
  muteMusic?: boolean;
  muteSfx?: boolean;
  /** Turn on the automated text QA probe (used by npm run sheet). */
  qa?: boolean;
};

/** Renders any video spec. New videos never need new code here. */
export const SpecVideo: React.FC<SpecVideoProps> = ({ spec, timing, theme, muteMusic, muteSfx, qa }) => {
  const compiled = useMemo(() => compile(spec, timing, { theme }), [spec, timing, theme]);
  return (
    <VideoCtx.Provider value={compiled}>
      <ThemeProvider name={compiled.theme}>
        <Background />
        {compiled.segments.map((seg) => (
          <Sequence
            key={seg.id}
            from={seg.from}
            durationInFrames={seg.durationInFrames}
            name={`${seg.index + 1}. ${seg.id} · ${seg.choreo.id} · ${seg.scene.type}`}
          >
            <SegmentCtx.Provider value={seg}>
              <SegmentBody last={seg.index === compiled.segments.length - 1} />
            </SegmentCtx.Provider>
          </Sequence>
        ))}
        <LineWipes compiled={compiled} />
        <AudioLayer muteMusic={muteMusic} muteSfx={muteSfx} />
        {qa && <QaProbe />}
      </ThemeProvider>
    </VideoCtx.Provider>
  );
};

const Background: React.FC = () => {
  const { p } = useTheme();
  return <AbsoluteFill style={{ backgroundColor: p.bg }} />;
};

const SegmentBody: React.FC<{ last: boolean }> = ({ last }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const dur = seg.durationInFrames;
  const fadeIn = seg.transitionIn === "fade" ? prog(frame, 0, 8, "glide") : 1;
  const fadeOut = last || seg.transitionOut === "fade" ? 1 - prog(frame, dur - seg.exitFrames, seg.exitFrames, "exit") : 1;
  const push = 1 + seg.choreo.stage.pushIn * prog(frame, 0, dur, "drift");
  const isDiagram = seg.scene.type === "diagram";
  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Stage grid={isDiagram ? 0 : seg.choreo.stage.grid * 0.6} vignette={seg.choreo.stage.vignette} />
      <AbsoluteFill style={{ scale: `${push}` }}>
        <SceneSwitch seg={seg} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SceneSwitch: React.FC<{ seg: CompiledSegment }> = ({ seg }) => {
  const s = seg.scene;
  switch (s.type) {
    case "statement":
      return <Statement scene={s} />;
    case "stat":
      return <Stat scene={s} />;
    case "diagram":
      return <Diagram scene={s} />;
    case "sequence":
      return <SequenceScene scene={s} />;
    case "compare":
      return <Compare scene={s} />;
    case "list":
      return <List scene={s} />;
    case "chapter":
      return <Chapter scene={s} />;
    case "code":
      return <Code scene={s} />;
    case "outro":
      return <Outro scene={s} />;
  }
};

/** The studio's signature transition: a band in the next line's colour sweeps across, like a train passing. */
const LineWipes: React.FC<{ compiled: Compiled }> = ({ compiled }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const { line } = useTheme();
  const half = 8;
  const active = compiled.segments.find((s, i) => {
    if (s.transitionOut !== "line-wipe" || i === compiled.segments.length - 1) return false;
    const b = s.from + s.durationInFrames;
    return frame >= b - half && frame < b + half;
  });
  if (!active) return null;
  const next = compiled.segments[active.index + 1];
  const b = active.from + active.durationInFrames;
  const color = line(next.accent);
  const inP = prog(frame, b - half, half, "snap");
  const outP = prog(frame, b, half, "exit");
  const left = lerp(0, width, outP);
  const right = lerp(0, width, inP);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left,
          width: Math.max(0, right - left),
          backgroundColor: color,
        }}
      />
    </AbsoluteFill>
  );
};
