import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { AudioLayer } from "../audio/AudioLayer";
import { prog } from "../design/motion";
import { ThemeProvider, typeStyle, useLayout, useStyle, useTheme } from "../design/theme";
import { Stage } from "../primitives/Stage";
import { STYLES } from "../styles.generated";
import { Chapter } from "../scenes/Chapter";
import { Code } from "../scenes/Code";
import { Compare } from "../scenes/Compare";
import { Diagram } from "../scenes/diagram/Diagram";
import { List } from "../scenes/List";
import { Outro } from "../scenes/Outro";
import { Sequence as SequenceScene } from "../scenes/Sequence";
import { Stat } from "../scenes/Stat";
import { Statement } from "../scenes/Statement";
import { CompiledSegment, Resolved, compile } from "../spec/compile";
import { CUSTOM_SCENES } from "../registry.generated";
import type { TimingFile } from "../spec/timing";
import type { CustomSceneT, IntroSceneT, VideoSpecInput } from "../spec/schema";
import { SegmentCtx, VideoCtx, useSegment, useVideo } from "./context";
import { QaProbe } from "./QaProbe";

export type SpecVideoProps = {
  spec: VideoSpecInput;
  timing?: TimingFile | null;
  theme?: "dark" | "light";
  /** Preview or render in another motion style than the channel's. */
  style?: string;
  muteMusic?: boolean;
  muteSfx?: boolean;
  /** Turn on the automated text QA probe (used by npm run sheet). */
  qa?: boolean;
};

/** Renders any video spec. New videos never need new code here. */
export const SpecVideo: React.FC<SpecVideoProps> = ({ spec, timing, theme, style, muteMusic, muteSfx, qa }) => {
  const compiled = useMemo(() => compile(spec, timing, { theme, style }), [spec, timing, theme, style]);
  const def = STYLES[compiled.style] ?? STYLES.transit;
  const Overlay = def.Overlay;
  return (
    <VideoCtx.Provider value={compiled}>
      <ThemeProvider name={compiled.theme} style={def}>
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
        {Overlay && <Overlay compiled={compiled} />}
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
      <StyledStage grid={isDiagram ? 0 : seg.choreo.stage.grid * 0.6} vignette={seg.choreo.stage.vignette} />
      <AbsoluteFill style={{ scale: `${push}` }}>
        <SceneSwitch seg={seg} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const StyledStage: React.FC<{ grid: number; vignette: number }> = (props) => {
  const B = useStyle()?.Background ?? Stage;
  return <B {...props} />;
};

const SceneSwitch: React.FC<{ seg: CompiledSegment }> = ({ seg }) => {
  const s = seg.scene;
  const style = useStyle();
  const Override = s.type !== "custom" && s.type !== "intro" ? style?.scenes?.[s.type] : undefined;
  if (Override) return <Override scene={s} />;
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
    case "custom":
      return <CustomSlot seg={seg} />;
    case "intro":
      return <IntroSlot seg={seg} />;
  }
};

/** The channel intro, drawn by the style. */
const IntroSlot: React.FC<{ seg: CompiledSegment }> = ({ seg }) => {
  const video = useVideo();
  const style = useStyle();
  const s = seg.scene as Resolved<IntroSceneT>;
  const Intro = style?.Intro;
  if (!Intro) return null;
  return (
    <Intro
      name={s.name ?? video.channel?.name ?? video.spec.title}
      tagline={s.tagline ?? video.channel?.tagline}
      handle={video.channel?.handle ?? ""}
      durationInFrames={seg.durationInFrames}
      accent={seg.accent}
    />
  );
};

/** Mounts a video's own scene component (videos/<id>/scenes/<Name>.tsx) with resolved cues. */
const CustomSlot: React.FC<{ seg: CompiledSegment }> = ({ seg }) => {
  const video = useVideo();
  const { p, line, name } = useTheme();
  const { scale } = useLayout();
  const s = seg.scene as Resolved<CustomSceneT>;
  const Component = CUSTOM_SCENES[video.spec.id]?.[s.component];
  if (!Component)
    return (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", color: line("red"), ...typeStyle("title", scale) }}>
        <div>
          Missing custom scene <span style={{ color: p.text }}>videos/{video.spec.id}/scenes/{s.component}.tsx</span>
        </div>
      </AbsoluteFill>
    );
  // remount on theme or style change: script scenes build their DOM once
  return <Component key={`${name}-${video.style}`} cues={s.cues} props={s.props} durationInFrames={seg.durationInFrames} accent={seg.accent} />;
};

