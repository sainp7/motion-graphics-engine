import React from "react";
import { CalculateMetadataFunction, Composition, Folder, Still } from "remotion";
import { GALLERY_SPEC } from "./gallery/gallery-spec";
import { REGISTRY } from "./registry.generated";
import { compile } from "./spec/compile";
import { FORMATS } from "./design/tokens";
import { SpecVideo, SpecVideoProps } from "./video/SpecVideo";
import { Thumbnail, ThumbnailProps } from "./video/Thumbnail";

const calculateMetadata: CalculateMetadataFunction<SpecVideoProps> = ({ props }) => {
  const c = compile(props.spec, props.timing, { theme: props.theme });
  return {
    durationInFrames: c.durationInFrames,
    fps: c.fps,
    width: c.width,
    height: c.height,
    defaultOutName: `${c.spec.id}-${c.theme}`,
  };
};

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="videos">
      {REGISTRY.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={SpecVideo}
          width={FORMATS.landscape.width}
          height={FORMATS.landscape.height}
          fps={30}
          durationInFrames={300}
          defaultProps={{ spec: v.spec, timing: v.timing } as SpecVideoProps}
          calculateMetadata={calculateMetadata}
        />
      ))}
    </Folder>
    <Folder name="other-theme">
      {REGISTRY.map((v) => {
        const alt = (v.spec as { theme?: string }).theme === "light" ? "dark" : "light";
        return (
          <Composition
            key={v.id}
            id={`${v.id}-${alt}`}
            component={SpecVideo}
            width={FORMATS.landscape.width}
            height={FORMATS.landscape.height}
            fps={30}
            durationInFrames={300}
            defaultProps={{ spec: v.spec, timing: v.timing, theme: alt } as SpecVideoProps}
            calculateMetadata={calculateMetadata}
          />
        );
      })}
    </Folder>
    <Folder name="thumbnails">
      {REGISTRY.filter((v) => v.spec.thumbnail).map((v) => (
        <Still
          key={v.id}
          id={`thumb-${v.id}`}
          component={Thumbnail}
          width={1280}
          height={720}
          defaultProps={{ spec: v.spec } as ThumbnailProps}
        />
      ))}
    </Folder>
    <Folder name="design-system">
      {(["dark", "light"] as const).map((theme) => (
        <Composition
          key={theme}
          id={`gallery-${theme}`}
          component={SpecVideo}
          width={FORMATS.landscape.width}
          height={FORMATS.landscape.height}
          fps={30}
          durationInFrames={300}
          defaultProps={{ spec: GALLERY_SPEC, timing: null, theme, muteMusic: true } as SpecVideoProps}
          calculateMetadata={calculateMetadata}
        />
      ))}
    </Folder>
  </>
);
