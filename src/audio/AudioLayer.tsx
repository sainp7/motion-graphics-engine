import React, { useMemo } from "react";
import { staticFile } from "remotion";
import { Audio } from "@remotion/media";
import sfxManifest from "../../library/sfx/manifest.json";
import musicManifest from "../../library/music/manifest.json";
import { EnergyTable, musicEnvelope } from "../spec/compile";
import { useVideo } from "../video/context";

type SoundDef = { file: string; seconds: number };
type TrackDef = { stems?: Record<string, string>; file?: string; gain?: Record<string, number>; bpm?: number; energy?: EnergyTable };

/** Mix headroom: mastering sets the final loudness, so the raw mix stays well below clipping. */
const VOICE_GAIN = 0.72;
const SFX_GAIN = 0.62;
const MUSIC_GAIN = 0.85;

const SOUNDS = (sfxManifest as { sounds: Record<string, SoundDef> }).sounds;
const TRACKS = (musicManifest as unknown as { tracks: Record<string, TrackDef> }).tracks;

/**
 * Three layers, mixed by Remotion:
 *   narration — one clip per beat, placed exactly where the compiler put it
 *   music     — stems whose levels follow each segment's choreography energy, ducked under the voice
 *   sfx       — the house sound kit, scheduled by the compiler from scene events
 */
export const AudioLayer: React.FC<{ muteMusic?: boolean; muteSfx?: boolean }> = ({ muteMusic, muteSfx }) => {
  const video = useVideo();
  const track = video.spec.music.track ? TRACKS[video.spec.music.track] : undefined;
  const env = useMemo(() => musicEnvelope(video, track), [video, track]);
  // music enters on the hook's first impact, so bar 1 of the loop lands on it
  const m0 = video.musicStart;
  const at = (curve: Float32Array, f: number) => curve[Math.min(curve.length - 1, Math.max(0, m0 + Math.round(f)))] ?? 0;
  const base = video.spec.music.volume;

  return (
    <>
      {video.segments.flatMap((seg) =>
        seg.beats
          .filter((b) => b.timing.file && !b.estimated)
          .map((b) => (
            <Audio
              key={b.key}
              name={`voice ${b.key}`}
              src={staticFile(b.timing.file!)}
              from={seg.from + b.from}
              durationInFrames={b.durationInFrames + 2}
              volume={VOICE_GAIN}
            />
          )),
      )}
      {!muteMusic && track?.stems &&
        Object.entries(track.stems).map(([stem, file]) => {
          const curve = env[stem];
          if (!curve) return null;
          const g = (track.gain?.[stem] ?? 1) * base * MUSIC_GAIN;
          return (
            <Audio
              key={stem}
              name={`music ${stem}`}
              src={staticFile(file)}
              from={m0}
              loop
              loopVolumeCurveBehavior="extend"
              volume={(f) => at(curve, f) * g}
            />
          );
        })}
      {!muteMusic && track?.file && (
        <Audio
          name="music"
          src={staticFile(track.file)}
          from={m0}
          loop
          loopVolumeCurveBehavior="extend"
          volume={(f) => at(env[Object.keys(env)[0]], f) * base * MUSIC_GAIN}
        />
      )}
      {!muteSfx &&
        video.sfx.map((e, i) => {
          const s = SOUNDS[e.sound];
          if (!s) return null;
          return (
            <Audio
              key={i}
              name={`sfx ${e.sound}`}
              src={staticFile(s.file)}
              from={e.frame}
              durationInFrames={Math.max(2, Math.ceil(s.seconds * video.fps) + 1)}
              volume={e.gain * SFX_GAIN}
            />
          );
        })}
    </>
  );
};
