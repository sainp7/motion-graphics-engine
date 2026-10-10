/**
 * Choreography presets.
 *
 * The theme never changes inside a video. What changes from segment to segment is the
 * choreography: how things move, how much the stage shows, what the music does, which
 * sounds punctuate the action and how much text is allowed on screen.
 *
 * Every segment in a video spec picks exactly one preset with `choreo`. The preset is the
 * segment's intent ("this part is the hook", "this part builds the system", "this part is
 * the aha"). Scene components read the preset; they never invent their own timing or sound.
 */
import type { EaseName } from "../design/tokens";

export type SfxId =
  | "tick"
  | "tock"
  | "pop"
  | "blip"
  | "whoosh"
  | "swish"
  | "hit"
  | "riser"
  | "glitch"
  | "chime"
  | "snap";

export type TransitionKind = "cut" | "fade" | "line-wipe";

export type SceneType =
  | "statement"
  | "stat"
  | "diagram"
  | "sequence"
  | "compare"
  | "list"
  | "chapter"
  | "code"
  | "outro";

export type Choreo = {
  id: ChoreoId;
  /** What this choreography is for. Read this when choosing. */
  purpose: string;
  /** Scene types that fit this intent. The linter warns on others. */
  scenes: SceneType[];
  motion: {
    /** Curve and duration for things entering the frame. */
    enter: EaseName;
    enterFrames: number;
    /** Frames between staggered siblings (lines, nodes, items). */
    stagger: number;
    /** Camera curve for diagram focus moves. */
    camera: EaseName;
    cameraFrames: number;
    /** How this segment hands over to the next one. */
    exit: TransitionKind;
  };
  stage: {
    /** Opacity multiplier for the background dot grid (0 hides it). */
    grid: number;
    /** Strength of the edge vignette that pulls the eye to the centre. */
    vignette: number;
    /** Slow push-in over the whole segment, as a fraction of scale (0.03 = 3%). */
    pushIn: number;
  };
  text: {
    /** Max words visible at once in this segment's on-screen text. */
    maxWords: number;
    /** Default statement size. */
    size: "xl" | "lg" | "md";
    /** Default statement alignment. */
    align: "left" | "center";
  };
  voice: {
    /** Default delivery speed for beats that don't set `pace`. */
    pace: "slow" | "normal" | "brisk" | "rush";
    /** Pace of the segment's first beat, when it should differ (e.g. a hook that starts fast). */
    firstPace?: "slow" | "normal" | "brisk" | "rush";
    /** Emotional delivery for expressive engines (elevenlabs, qwen3). */
    style: "neutral" | "calm" | "serious" | "urgent" | "excited" | "warm";
  };
  timing: {
    /** Seconds of picture before the first spoken word. */
    leadIn: number;
    /** Default silence between beats, seconds. */
    beatGap: number;
    /** Seconds of hold after the last word, so the picture can land. */
    tail: number;
  };
  sound: {
    /** Music energy: 0 silence, 1 bed, 2 bed + pulse, 3 everything. */
    energy: 0 | 1 | 2 | 3;
    /** How far music ducks under narration (linear gain multiplier while the voice is active). */
    duck: number;
    /** Sound at the very start of the segment. */
    sting?: SfxId;
    /** Sounds for events. `reveal` may be a pair: [first reveal, later reveals]. */
    sfx: {
      reveal?: SfxId | [SfxId, SfxId];
      show?: SfxId;
      flow?: SfxId;
      fail?: SfxId;
      recover?: SfxId;
      emphasis?: SfxId;
      strike?: SfxId;
      camera?: SfxId;
      count?: SfxId;
      verdict?: SfxId;
    };
  };
};

export const CHOREO_IDS = [
  "cold-open",
  "big-number",
  "myth",
  "failure",
  "chapter",
  "build",
  "flow",
  "deep-dive",
  "compare",
  "insight",
  "recap",
  "outro",
  "solution",
] as const;
export type ChoreoId = (typeof CHOREO_IDS)[number];

const base = {
  motion: { enter: "glide", enterFrames: 18, stagger: 5, camera: "drift", cameraFrames: 30, exit: "fade" },
  stage: { grid: 1, vignette: 0.35, pushIn: 0 },
  text: { maxWords: 10, size: "lg", align: "left" },
  timing: { leadIn: 0.35, beatGap: 0.3, tail: 0.6 },
  voice: { pace: "normal", style: "neutral" },
} as const;

export const CHOREO: Record<ChoreoId, Choreo> = {
  "cold-open": {
    id: "cold-open",
    purpose:
      "The first 5–20 seconds. A question, a stake or a surprising claim that makes the viewer need the answer. Punchy, high contrast, nothing on stage but the line.",
    scenes: ["statement", "stat", "diagram"],
    motion: { ...base.motion, enter: "snap", enterFrames: 9, stagger: 6, exit: "line-wipe" },
    stage: { grid: 0, vignette: 0.6, pushIn: 0.04 },
    text: { maxWords: 12, size: "xl", align: "center" },
    voice: { pace: "brisk", firstPace: "rush", style: "urgent" },
    timing: { leadIn: 0.6, beatGap: 0.3, tail: 0.7 },
    sound: { energy: 2, duck: 0.5, sting: "riser", sfx: { reveal: ["hit", "pop"], emphasis: "pop", strike: "snap", show: "tick" } },
  },
  "big-number": {
    id: "big-number",
    purpose: "A number that carries the stakes: scale, cost, latency, a ratio. The number counts up; bars compare it to a limit.",
    scenes: ["stat"],
    motion: { ...base.motion, enter: "snap", enterFrames: 10, stagger: 6, exit: "fade" },
    stage: { grid: 0, vignette: 0.55, pushIn: 0.02 },
    text: { maxWords: 10, size: "xl", align: "left" },
    voice: { pace: "brisk", style: "excited" },
    timing: { leadIn: 0.4, beatGap: 0.3, tail: 0.8 },
    sound: { energy: 2, duck: 0.5, sfx: { reveal: "hit", count: "tick", emphasis: "pop" } },
  },
  myth: {
    id: "myth",
    purpose: "State the common belief, then strike it out and replace it. Use for misconceptions and 'everyone does X, but'.",
    scenes: ["statement"],
    motion: { ...base.motion, enter: "snap", enterFrames: 10, stagger: 6, exit: "fade" },
    stage: { grid: 0, vignette: 0.5, pushIn: 0 },
    text: { maxWords: 12, size: "lg", align: "left" },
    voice: { pace: "normal", style: "serious" },
    timing: { leadIn: 0.35, beatGap: 0.35, tail: 0.7 },
    sound: { energy: 1, duck: 0.5, sfx: { reveal: "pop", strike: "snap", emphasis: "pop" } },
  },
  failure: {
    id: "failure",
    purpose:
      "Something breaks: a node dies, a queue overflows, a stampede hits the database. The music drops out so the failure is felt. Hold after it lands.",
    scenes: ["diagram", "sequence", "statement", "stat"],
    motion: { ...base.motion, enter: "snap", enterFrames: 10, exit: "fade" },
    stage: { grid: 0.7, vignette: 0.55, pushIn: 0 },
    text: { maxWords: 8, size: "lg", align: "left" },
    voice: { pace: "brisk", style: "urgent" },
    timing: { leadIn: 0.3, beatGap: 0.4, tail: 1.0 },
    sound: { energy: 0, duck: 0.4, sfx: { fail: "glitch", flow: "blip", show: "tick", reveal: "hit", emphasis: "pop" } },
  },
  chapter: {
    id: "chapter",
    purpose: "A short section marker that becomes a YouTube chapter. One line bullet, one title. Gives the viewer a map of the video.",
    scenes: ["chapter"],
    motion: { ...base.motion, enter: "glide", enterFrames: 16, exit: "cut" },
    stage: { grid: 0.4, vignette: 0.35, pushIn: 0 },
    text: { maxWords: 6, size: "lg", align: "left" },
    voice: { pace: "normal", style: "warm" },
    timing: { leadIn: 0.45, beatGap: 0.25, tail: 0.5 },
    sound: { energy: 2, duck: 0.6, sting: "whoosh", sfx: { reveal: "chime" } },
  },
  build: {
    id: "build",
    purpose:
      "Construct the system piece by piece as the narration introduces each component. Calm, precise, one new thing at a time. The default for explaining architecture.",
    scenes: ["diagram", "sequence", "list"],
    motion: { ...base.motion },
    stage: { grid: 1, vignette: 0.3, pushIn: 0 },
    text: { maxWords: 8, size: "md", align: "left" },
    voice: { pace: "normal", style: "calm" },
    timing: { leadIn: 0.3, beatGap: 0.3, tail: 0.6 },
    sound: { energy: 1, duck: 0.55, sfx: { show: "tick", flow: "blip", emphasis: "pop", camera: "swish" } },
  },
  flow: {
    id: "flow",
    purpose: "Show requests moving through an existing system: the read path, the write path, a retry. Packets ride coloured lines.",
    scenes: ["diagram", "sequence"],
    motion: { ...base.motion, enter: "glide", enterFrames: 16 },
    stage: { grid: 1, vignette: 0.3, pushIn: 0 },
    text: { maxWords: 8, size: "md", align: "left" },
    voice: { pace: "brisk", style: "neutral" },
    timing: { leadIn: 0.3, beatGap: 0.3, tail: 0.7 },
    sound: { energy: 1, duck: 0.55, sfx: { flow: "blip", show: "tick", emphasis: "pop", fail: "glitch", camera: "swish" } },
  },
  "deep-dive": {
    id: "deep-dive",
    purpose: "Zoom into one component and explain its internals. Everything else dims. The camera moves slowly and deliberately.",
    scenes: ["diagram", "code", "sequence"],
    motion: { ...base.motion, enter: "glide", camera: "drift", cameraFrames: 36 },
    stage: { grid: 0.8, vignette: 0.45, pushIn: 0 },
    text: { maxWords: 8, size: "md", align: "left" },
    voice: { pace: "slow", style: "serious" },
    timing: { leadIn: 0.4, beatGap: 0.35, tail: 0.7 },
    sound: { energy: 1, duck: 0.5, sfx: { camera: "swish", show: "tick", flow: "blip", emphasis: "pop", reveal: "tick" } },
  },
  compare: {
    id: "compare",
    purpose: "Two approaches side by side with their trade-offs, then a verdict: when to use which. Balanced, symmetric motion.",
    scenes: ["compare", "diagram"],
    motion: { ...base.motion, enter: "glide", stagger: 6 },
    stage: { grid: 0.3, vignette: 0.35, pushIn: 0 },
    text: { maxWords: 30, size: "md", align: "left" },
    voice: { pace: "normal", style: "neutral" },
    timing: { leadIn: 0.35, beatGap: 0.3, tail: 0.8 },
    sound: { energy: 1, duck: 0.55, sfx: { reveal: "pop", verdict: "chime", emphasis: "pop" } },
  },
  insight: {
    id: "insight",
    purpose:
      "The aha. One sentence the viewer should remember. The music steps back, the stage empties, the camera pushes in slowly, and the line holds long enough to sink in.",
    scenes: ["statement"],
    motion: { ...base.motion, enter: "drift", enterFrames: 26, stagger: 10, exit: "fade" },
    stage: { grid: 0, vignette: 0.7, pushIn: 0.035 },
    text: { maxWords: 12, size: "lg", align: "center" },
    voice: { pace: "slow", style: "serious" },
    timing: { leadIn: 0.5, beatGap: 0.5, tail: 1.4 },
    sound: { energy: 0, duck: 0.4, sfx: { reveal: "hit", emphasis: "pop" } },
  },
  recap: {
    id: "recap",
    purpose: "The takeaways, one per stop on a line. Rhythmic, a little more energy, ready to wrap up.",
    scenes: ["list"],
    motion: { ...base.motion, enter: "glide", stagger: 6 },
    stage: { grid: 0.3, vignette: 0.35, pushIn: 0 },
    text: { maxWords: 30, size: "md", align: "left" },
    voice: { pace: "brisk", style: "warm" },
    timing: { leadIn: 0.35, beatGap: 0.3, tail: 0.8 },
    sound: { energy: 2, duck: 0.55, sfx: { reveal: "tick", emphasis: "pop" } },
  },
  outro: {
    id: "outro",
    purpose: "Close the loop on the opening question, then the call to action. Calm; the music fades out under the last line.",
    scenes: ["outro", "statement"],
    motion: { ...base.motion, enter: "glide", exit: "fade" },
    stage: { grid: 0.3, vignette: 0.45, pushIn: 0.015 },
    text: { maxWords: 14, size: "lg", align: "left" },
    voice: { pace: "normal", style: "warm" },
    timing: { leadIn: 0.35, beatGap: 0.35, tail: 1.6 },
    sound: { energy: 1, duck: 0.5, sfx: { reveal: "pop", emphasis: "pop" } },
  },
  solution: {
    id: "solution",
    purpose:
      "The fix. Visually and sonically the opposite of the failure: green accent, brighter stage, full music energy with percussion, crisp confident motion. Put the fix's name on screen as a heading.",
    scenes: ["diagram", "code", "compare", "statement", "list", "sequence"],
    motion: { ...base.motion, enter: "snap", enterFrames: 12, stagger: 5, exit: "fade" },
    stage: { grid: 0.5, vignette: 0.2, pushIn: 0.01 },
    text: { maxWords: 32, size: "lg", align: "left" },
    voice: { pace: "normal", style: "excited" },
    timing: { leadIn: 0.35, beatGap: 0.3, tail: 0.7 },
    sound: { energy: 3, duck: 0.5, sting: "whoosh", sfx: { reveal: "pop", show: "tick", flow: "blip", recover: "chime", verdict: "chime", emphasis: "pop", camera: "swish" } },
  },
};
