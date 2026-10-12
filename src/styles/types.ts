import type React from "react";
import type { StyleTokens } from "../design/style-tokens";
import type { LineColor } from "../design/tokens";
import type { Compiled, ResolvedScene } from "../spec/compile";

export type SceneType = ResolvedScene["type"];

/** What a style's channel intro receives (from channels/<id>/channel.json). */
export type IntroProps = {
  name: string;
  tagline?: string;
  handle: string;
  durationInFrames: number;
  accent: LineColor;
};

/**
 * A motion style: everything that makes videos look like one family. A channel picks one.
 *
 *   tokens      palettes (dark, light), fonts, type scale, easing curves
 *   scenes      optional overrides per scene type; anything not overridden uses the shared
 *               scene library (src/scenes), restyled by the tokens
 *   Background  the stage behind every scene
 *   Overlay     what sits above the scenes: transitions (transit's line wipe)
 *   Intro       the channel intro bumper that plays after the hook
 *
 * Add one with `npm run new-style -- <id>`; it is registered automatically from src/styles/<id>/.
 */
export type StyleDef = {
  tokens: StyleTokens;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scenes?: Partial<Record<SceneType, React.FC<{ scene: any }>>>;
  Background?: React.FC<{ grid: number; vignette: number }>;
  Overlay?: React.FC<{ compiled: Compiled }>;
  Intro: React.FC<IntroProps>;
};
