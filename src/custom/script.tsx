/**
 * Seekable script scenes: pure JavaScript/TypeScript custom scenes, for animation that is easier
 * to write imperatively than in React — a GSAP timeline, a canvas or WebGL loop, three.js, a
 * physics sketch, anime.js, Lottie. Same contract as HyperFrames' frame adapters:
 *
 *   setup(ctx)  build the scene once into ctx.root (DOM, SVG, canvas…); may be async
 *   seek(t)     put the scene in its state at t seconds from the start of the segment
 *
 * seek must be a pure function of t: frames render in any order and in parallel tabs, so never
 * advance state incrementally, never read the wall clock, never use Math.random (ctx.random(seed)).
 * A paused GSAP timeline is ideal: build it in setup, call tl.seek(t) in seek.
 *
 * Files: videos/<id>/scenes/<PascalCase>.js or .ts, default export defineScene({ setup }).
 */
import React, { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayout, useTheme, typeStyle } from "../design/theme";
import type { LineColor, Palette, TypeRole } from "../design/tokens";
import type { CustomSceneProps } from "./kit";
import { useNarration } from "./kit";

export type ScriptContext = {
  /** Draw into this element. It fills the frame and is emptied when the scene unmounts. */
  root: HTMLDivElement;
  width: number;
  height: number;
  fps: number;
  /** Segment length. */
  duration: number;
  durationInFrames: number;
  /** Multiply px sizes by this (1 at 1920×1080). */
  scale: number;
  safe: { x: number; y: number; w: number; h: number; right: number; bottom: number };
  /** The active style's palette for the active theme. */
  palette: Palette;
  line: (c: LineColor) => string;
  /** Text colour that reads on a plate of the given line colour. */
  on: (c: LineColor) => string;
  accent: LineColor;
  /** CSS for a type role in the active style (font family, size, weight…), as a style object. */
  type: (role: TypeRole, mono?: boolean) => Partial<CSSStyleDeclaration>;
  /** Named moments from the spec's `cues`, in seconds from the segment start. */
  cues: Record<string, number>;
  /** Every narration word with its time in seconds, for type that moves with the voice. */
  words: { word: string; from: number; to: number }[];
  props: Record<string, unknown>;
  /** Deterministic random in [0, 1) for a seed. */
  random: (seed: string | number) => number;
};

export type ScriptInstance = { seek: (t: number, frame: number) => void; destroy?: () => void };
export type ScriptScene = { setup: (ctx: ScriptContext) => ScriptInstance | Promise<ScriptInstance> };

export const defineScene = (scene: ScriptScene): ScriptScene => scene;

const toCss = (o: React.CSSProperties) => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = typeof v === "number" && !["fontWeight", "lineHeight", "opacity"].includes(k) ? `${v}px` : String(v);
  return out as Partial<CSSStyleDeclaration>;
};

/** Wraps a script scene as a custom-scene component (done by the generated registry). */
export const scriptScene = (mod: ScriptScene) => {
  const ScriptHost: React.FC<CustomSceneProps> = ({ cues, props, durationInFrames, accent }) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const { p, line, on } = useTheme();
    const { scale, safe } = useLayout();
    const words = useNarration();
    const ref = useRef<HTMLDivElement>(null);
    const inst = useRef<ScriptInstance | null>(null);
    const [handle] = useState(() => delayRender("script scene setup"));
    const frameRef = useRef(frame);
    frameRef.current = frame;

    useLayoutEffect(() => {
      const root = ref.current!;
      let cancelled = false;
      const ctx: ScriptContext = {
        root,
        width,
        height,
        fps,
        duration: durationInFrames / fps,
        durationInFrames,
        scale,
        safe,
        palette: p,
        line,
        on,
        accent,
        type: (role, mono) => toCss(typeStyle(role, scale, mono)),
        cues: Object.fromEntries(Object.entries(cues).map(([k, f]) => [k, f / fps])),
        words: words.map((w) => ({ word: w.word, from: w.from / fps, to: w.to / fps })),
        props,
        random: (seed) => random(seed),
      };
      Promise.resolve()
        .then(() => mod.setup(ctx))
        .then((i) => {
          if (cancelled) return i.destroy?.();
          inst.current = i;
          i.seek(frameRef.current / fps, frameRef.current);
          continueRender(handle);
        })
        .catch((e) => cancelRender(e));
      return () => {
        cancelled = true;
        inst.current?.destroy?.();
        inst.current = null;
        root.replaceChildren();
      };
      // set up once per mount; the parent remounts on theme or style change
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useLayoutEffect(() => {
      inst.current?.seek(frame / fps, frame);
    }, [frame, fps]);

    return (
      <AbsoluteFill>
        <div ref={ref} style={{ position: "absolute", inset: 0, overflow: "hidden" }} />
      </AbsoluteFill>
    );
  };
  return ScriptHost;
};
