/**
 * The Video Spec — the contract between Claude (who writes it) and the renderer (which plays it).
 *
 * A spec is JSON. Claude authors `videos/<id>/spec.json`; the renderer never needs new code for
 * a new video. Durations are not authored: they come from the narration audio (audio-first).
 * Visual actions are keyed to cue words in the narration, so picture and voice stay in sync
 * whatever the TTS engine or speed.
 *
 * Narration markup inside `say`:
 *   {words|cue-id}   marks a cue at those words, e.g. "every request hits the {cache|c-cache} first"
 *   [pause]          a 0.5s deliberate pause; [pause 0.8] for a custom length (seconds)
 *
 * On-screen text markup (statement lines, outro line, list/compare text):
 *   {words}          a line plate (filled badge) in the segment's accent colour
 *   {words|green}    a plate in a specific line colour or named line
 *   ~~words~~        text that can be struck through with a `strike` action
 */
import { z } from "zod";
import { CHOREO_IDS } from "../choreo/presets";
import { LINE_COLORS } from "../design/tokens";

export const Id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "ids are lowercase letters, digits, - and _")
  .describe("Lowercase identifier");

/** A line colour name or a key of `spec.lines`. */
export const LineRef = z.string().min(1).describe(`Line colour (${LINE_COLORS.join(", ")}) or a key of spec.lines`);

/**
 * A moment inside the segment:
 *   "start" | "end"                    segment start / the moment the exit begins
 *   "<cue>" | "<cue>.end"              a cue marked in narration with {words|cue}
 *   "<beat-id>" | "<beat-id>.end"      a beat's first / last word
 * Any of these may carry an offset in seconds: "c-cache+0.3", "end-1.2".
 */
export const CueRef = z
  .string()
  .regex(/^(start|end|[a-z0-9][a-z0-9_-]*(\.end)?)([+-]\d+(\.\d+)?)?$/, 'cue refs look like "start", "c1", "c1.end", "b2+0.4"')
  .describe('A moment: "start", "end", a cue id, a beat id, optionally ".end" and "+/-seconds"');

export const Beat = z
  .object({
    id: Id.optional().describe("Optional id, referable as a CueRef"),
    say: z.string().min(1).describe("Narration with {words|cue} cue marks and [pause 0.6] marks"),
    pace: z.enum(["slow", "normal", "brisk", "rush"]).optional().describe("Delivery speed; defaults to the choreography's pace"),
    style: z
      .enum(["neutral", "calm", "serious", "urgent", "excited", "warm"])
      .optional()
      .describe("Emotional delivery; used by expressive engines (elevenlabs, qwen3). Defaults to the choreography's style"),
    pauseAfter: z.number().min(0).max(5).optional().describe("Silence after this beat (s); defaults to the choreography"),
  })
  .strict();

// ---------------------------------------------------------------- diagrams

export const NODE_KINDS = [
  "client",
  "mobile",
  "browser",
  "user",
  "users",
  "dns",
  "cdn",
  "lb",
  "gateway",
  "service",
  "server",
  "worker",
  "cache",
  "db",
  "replica",
  "queue",
  "stream",
  "storage",
  "search",
  "auth",
  "cron",
  "metrics",
  "cloud",
  "generic",
] as const;

const Side = z.enum(["left", "right", "top", "bottom"]);

export const DiagramNode = z
  .object({
    id: Id,
    kind: z.enum(NODE_KINDS).describe("Picks the icon"),
    label: z.string().min(1).max(18).describe("Station name, ≤ 18 chars, e.g. 'Load balancer'"),
    sub: z.string().max(26).optional().describe("Secondary detail, e.g. 'Redis · 6 GB'"),
    at: z.tuple([z.number(), z.number()]).describe("Centre position in grid units [x, y]; the frame is 16 × 9 units"),
    size: z.enum(["sm", "md", "lg"]).default("md"),
    line: LineRef.optional().describe("Accent for the station ring when highlighted"),
  })
  .strict();

export const DiagramEdge = z
  .object({
    id: Id.optional().describe('Defaults to "<from>-<to>"'),
    from: Id,
    to: Id,
    label: z.string().max(18).optional().describe("Small chip at the middle of the track"),
    style: z.enum(["solid", "dashed"]).default("solid").describe("dashed = asynchronous"),
    arrow: z.enum(["end", "both", "none"]).default("end"),
    lane: z.number().int().min(-2).max(2).default(0).describe("Parallel offset for request/response pairs"),
    route: z.enum(["auto", "straight", "elbow"]).default("auto").describe("auto = octilinear (45° bends)"),
    fromSide: Side.optional(),
    toSide: Side.optional(),
  })
  .strict();

export const DiagramGroup = z
  .object({
    id: Id,
    label: z.string().max(24),
    nodes: z.array(Id).min(1),
    line: LineRef.optional(),
  })
  .strict();

export const DiagramDef = z
  .object({
    nodes: z.array(DiagramNode).min(1),
    edges: z.array(DiagramEdge).default([]),
    groups: z.array(DiagramGroup).default([]),
  })
  .strict();

const at = CueRef.describe("When the action happens");
const targets = z.array(Id).min(1).describe("Node, edge or group ids");

export const DiagramAction = z.discriminatedUnion("do", [
  z.object({ at, do: z.literal("show"), targets }).strict(),
  z.object({ at, do: z.literal("hide"), targets }).strict(),
  z
    .object({
      at,
      do: z.literal("flow"),
      path: z.array(Id).min(2).describe("Node ids in travel order; consecutive nodes must share an edge"),
      line: LineRef,
      packets: z.number().int().min(1).max(12).default(1),
      label: z.string().max(20).optional().describe("Chip that rides with the first packet, e.g. 'GET /user/42'"),
      stream: z.boolean().default(false).describe("Keep sending packets until the segment ends"),
      persist: z.boolean().default(true).describe("Leave the coloured line painted after the packet passes"),
      speed: z.number().min(0.25).max(4).default(1),
    })
    .strict(),
  z.object({ at, do: z.literal("highlight"), targets, line: LineRef.optional() }).strict(),
  z.object({ at, do: z.literal("dim"), targets: z.array(Id).optional(), except: z.array(Id).optional() }).strict(),
  z.object({ at, do: z.literal("reset"), targets: z.array(Id).optional() }).strict(),
  z.object({ at, do: z.literal("clear-lines"), line: LineRef.optional() }).strict(),
  z.object({ at, do: z.literal("fail"), targets }).strict(),
  z.object({ at, do: z.literal("recover"), targets }).strict(),
  z
    .object({
      at,
      do: z.literal("badge"),
      target: Id,
      text: z.string().min(1).max(14),
      line: LineRef.optional(),
      until: CueRef.optional(),
    })
    .strict(),
  z.object({ at, do: z.literal("pulse"), targets, line: LineRef.optional() }).strict(),
  z.object({ at, do: z.literal("focus"), targets, zoom: z.number().min(0.7).max(2.2).optional() }).strict(),
  z.object({ at, do: z.literal("fit") }).strict(),
  z.object({ at, do: z.literal("sfx"), sound: z.string() }).strict(),
]);

// ---------------------------------------------------------------- scenes

export const StatementScene = z
  .object({
    type: z.literal("statement"),
    lines: z.array(z.string().min(1)).min(1).max(4).describe("Explicit line breaks; signage, not sentences"),
    align: z.enum(["left", "center"]).optional().describe("Defaults to the choreography's alignment"),
    size: z.enum(["xl", "lg", "md"]).optional().describe("Defaults to the choreography's size"),
    reveal: z.array(CueRef).optional().describe("When each line appears; defaults to a stagger from the start"),
    underline: LineRef.optional().describe("Draw a track under the block in this line colour"),
    note: z.string().max(80).optional().describe("Small supporting line, e.g. a source"),
    line: LineRef.optional().describe("Accent for plates without an explicit colour"),
    actions: z
      .array(
        z.discriminatedUnion("do", [
          z.object({ at, do: z.literal("strike"), index: z.number().int().min(0).optional() }).strict(),
          z.object({ at, do: z.literal("dim-line"), index: z.number().int().min(0) }).strict(),
          z.object({ at, do: z.literal("sfx"), sound: z.string() }).strict(),
        ]),
      )
      .default([]),
  })
  .strict();

export const StatScene = z
  .object({
    type: z.literal("stat"),
    value: z.number(),
    from: z.number().default(0),
    decimals: z.number().int().min(0).max(3).default(0),
    prefix: z.string().max(4).optional(),
    suffix: z.string().max(10).optional().describe("Unit shown after the number, e.g. 'req/s'"),
    label: z.string().min(1).max(60).describe("What the number means (on-screen text markup allowed)"),
    at: CueRef.default("start").describe("When the counter starts"),
    countSeconds: z.number().min(0).max(6).default(1.2),
    line: LineRef.optional().describe("Colour of the number; default is text colour"),
    bars: z
      .array(
        z
          .object({
            label: z.string().max(32),
            value: z.number().min(0),
            line: LineRef,
            at: CueRef.optional(),
          })
          .strict(),
      )
      .max(3)
      .default([])
      .describe("Horizontal comparison bars, scaled to the largest value"),
    note: z.string().max(80).optional(),
  })
  .strict();

export const DiagramScene = z
  .object({
    type: z.literal("diagram"),
    heading: z.string().max(40).optional().describe("Large signage top-left, e.g. 'Fix 1: coalesce the misses'"),
    diagram: Id.describe("Key of spec.diagrams. Consecutive segments using the same diagram continue its state."),
    title: z.string().max(40).optional().describe("Small signage chip, top-left"),
    legend: z.boolean().default(true),
    fresh: z.boolean().default(false).describe("Start from an empty diagram instead of continuing earlier segments"),
    actions: z.array(DiagramAction).default([]),
  })
  .strict();

export const SequenceScene = z
  .object({
    type: z.literal("sequence"),
    title: z.string().max(40).optional(),
    actors: z
      .array(z.object({ id: Id, label: z.string().max(16), kind: z.enum(NODE_KINDS).default("generic") }).strict())
      .min(2)
      .max(5),
    messages: z
      .array(
        z
          .object({
            from: Id,
            to: Id,
            label: z.string().max(28).optional(),
            code: z.boolean().default(false).describe("Render the label in mono, for literal requests"),
            line: LineRef.default("blue"),
            style: z.enum(["solid", "dashed"]).default("solid").describe("dashed = response"),
            at: CueRef,
            badge: z.object({ text: z.string().max(12), line: LineRef }).strict().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(9),
  })
  .strict();

const CompareColumn = z
  .object({
    title: z.string().max(22),
    line: LineRef,
    at: CueRef.optional(),
    items: z
      .array(
        z
          .object({
            text: z.string().max(40),
            verdict: z.enum(["pro", "con", "neutral"]).default("neutral"),
            at: CueRef.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict();

export const CompareScene = z
  .object({
    type: z.literal("compare"),
    left: CompareColumn,
    right: CompareColumn,
    verdict: z.object({ side: z.enum(["left", "right"]), text: z.string().max(40), at: CueRef }).strict().optional(),
  })
  .strict();

export const ListScene = z
  .object({
    type: z.literal("list"),
    title: z.string().max(40).optional(),
    numbered: z.boolean().default(false).describe("Only when the items are a real sequence"),
    line: LineRef.default("orange"),
    items: z
      .array(z.object({ text: z.string().max(40), detail: z.string().max(70).optional(), at: CueRef.optional() }).strict())
      .min(1)
      .max(6),
  })
  .strict();

export const ChapterScene = z
  .object({
    type: z.literal("chapter"),
    number: z.number().int().min(1).max(20).optional(),
    /** Ask the chapter's question ("Why does it collapse?") rather than naming a topic. */
    title: z.string().min(1).max(32),
    /** Label on the route map of all chapters; defaults to the title. */
    short: z.string().min(1).max(22).optional(),
    subtitle: z.string().max(60).optional(),
    line: LineRef.default("orange"),
  })
  .strict();

export const CodeScene = z
  .object({
    type: z.literal("code"),
    heading: z.string().max(40).optional().describe("Large signage above the code, e.g. 'Fix 1: coalesce the misses'"),
    title: z.string().max(40).optional().describe("Small file name inside the panel"),
    lines: z.array(z.string().max(64)).min(1).max(14),
    actions: z
      .array(
        z.discriminatedUnion("do", [
          z.object({ at, do: z.literal("highlight"), lines: z.tuple([z.number().int(), z.number().int()]), line: LineRef.optional() }).strict(),
          z.object({ at, do: z.literal("reset") }).strict(),
          z.object({ at, do: z.literal("sfx"), sound: z.string() }).strict(),
        ]),
      )
      .default([]),
  })
  .strict();

export const OutroScene = z
  .object({
    type: z.literal("outro"),
    text: z.string().min(1).max(80).describe("The closing line (on-screen markup allowed)"),
    handle: z.string().min(2).max(30).describe("e.g. @sainp7"),
    cta: z.string().max(48).default("Follow for more system design"),
    next: z.string().max(48).optional().describe("Teaser for the next episode"),
  })
  .strict();

export const Scene = z.discriminatedUnion("type", [
  StatementScene,
  StatScene,
  DiagramScene,
  SequenceScene,
  CompareScene,
  ListScene,
  ChapterScene,
  CodeScene,
  OutroScene,
]);

export const Segment = z
  .object({
    id: Id,
    choreo: z.enum(CHOREO_IDS).describe("The segment's intent; drives motion, music, sfx and text limits"),
    chapter: z.string().max(40).optional().describe("Starts a YouTube chapter with this title"),
    beats: z.array(Beat).min(1).describe("Narration for this segment, in order"),
    scene: Scene,
    hold: z.number().min(0).max(6).default(0).describe("Extra seconds of picture after the choreography's tail"),
    transition: z.enum(["cut", "fade", "line-wipe"]).optional().describe("Overrides the choreography's exit"),
    sfx: z.boolean().default(true).describe("Automatic sound effects for this segment"),
  })
  .strict();

export const VideoSpec = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(1),
    id: Id,
    title: z.string().min(1),
    format: z.enum(["landscape", "portrait"]).default("landscape"),
    theme: z.enum(["dark", "light"]).default("dark"),
    fps: z.union([z.literal(30), z.literal(60)]).default(30),
    voice: z
      .object({
        engine: z.enum(["qwen3", "kokoro", "elevenlabs", "say", "espeak", "estimate"]).default("qwen3"),
        /** Qwen3 speaker ("Aiden") or Kokoro voice ("am_michael"); each engine maps the other's default to its own. */
        voice: z.string().default("Aiden"),
        speed: z.number().min(0.6).max(1.6).default(1),
      })
      .strict()
      .prefault({}),
    music: z
      .object({
        track: z.string().nullable().default("transit-drive").describe("Key in library/music/manifest.json, or null"),
        volume: z.number().min(0).max(1).default(0.22),
      })
      .strict()
      .prefault({}),
    lines: z
      .record(Id, z.object({ color: z.enum(LINE_COLORS), label: z.string().max(24) }).strict())
      .default({})
      .describe("Named lines (flows) used across the video, shown in the legend"),
    diagrams: z.record(Id, DiagramDef).default({}),
    thumbnail: z
      .object({ lines: z.array(z.string()).min(1).max(3), line: LineRef.default("orange") })
      .strict()
      .optional(),
    segments: z.array(Segment).min(1),
  })
  .strict();

export type VideoSpecInput = z.input<typeof VideoSpec>;
export type VideoSpecT = z.output<typeof VideoSpec>;
export type SegmentT = z.output<typeof Segment>;
export type SceneT = z.output<typeof Scene>;
export type DiagramDefT = z.output<typeof DiagramDef>;
export type DiagramNodeT = z.output<typeof DiagramNode>;
export type DiagramEdgeT = z.output<typeof DiagramEdge>;
export type DiagramActionT = z.output<typeof DiagramAction>;
export type BeatT = z.output<typeof Beat>;
export type StatementSceneT = z.output<typeof StatementScene>;
export type StatSceneT = z.output<typeof StatScene>;
export type DiagramSceneT = z.output<typeof DiagramScene>;
export type SequenceSceneT = z.output<typeof SequenceScene>;
export type CompareSceneT = z.output<typeof CompareScene>;
export type ListSceneT = z.output<typeof ListScene>;
export type ChapterSceneT = z.output<typeof ChapterScene>;
export type CodeSceneT = z.output<typeof CodeScene>;
export type OutroSceneT = z.output<typeof OutroScene>;
