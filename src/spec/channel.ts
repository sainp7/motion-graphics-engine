/**
 * Channels: one folder per YouTube channel or Instagram account, channels/<id>/channel.json.
 *
 * A channel fixes how its videos look and sound: the motion style, theme, narrator, music, handle,
 * call to action and the intro bumper after the hook. A video names its channel (or uses
 * studio.json's defaultChannel) and inherits all of it; anything the spec sets itself wins.
 */
import { CHANNELS, DEFAULT_CHANNEL } from "../channels.generated";
import { ChannelSpec, type ChannelT } from "./channel-schema";
import { VideoSpec, VideoSpecInput, VideoSpecT } from "./schema";

export { ChannelSpec, type ChannelT };



export const channelIds = () => Object.keys(CHANNELS);

type Seg = { id?: string; scene?: Record<string, unknown> } & Record<string, unknown>;

export const getChannel = (id: string | undefined): ChannelT | null => {
  const raw = CHANNELS[id ?? DEFAULT_CHANNEL];
  return raw ? ChannelSpec.parse(raw) : null;
};

type Raw = Record<string, unknown>;

/** The spec with its channel's defaults applied and the intro inserted. Pure; the input is not changed. */
export const resolveSpec = (input: VideoSpecInput | VideoSpecT): Raw => {
  const raw = structuredClone(input) as Raw;
  const chId = (raw.channel as string | undefined) ?? DEFAULT_CHANNEL;
  const ch = getChannel(chId);
  if (!ch) return raw; // unknown channel: the linter reports it
  raw.channel = chId;
  raw.style ??= ch.style;
  raw.theme ??= ch.theme;
  raw.voice = { ...ch.voice, ...(raw.voice as object) };
  raw.music = { ...ch.music, ...(raw.music as object) };
  const segments = (raw.segments ?? []) as Seg[];
  for (const seg of segments) {
    const sc = seg.scene;
    if (sc?.type === "outro") {
      sc.handle ??= ch.handle;
      if (ch.outro.cta) sc.cta ??= ch.outro.cta;
    }
  }
  const wants = raw.intro !== false && ch.intro.enabled && ch.intro.formats.includes(((raw.format as string) ?? "landscape") as "landscape" | "portrait");
  if (wants && !segments.some((s) => s.scene?.type === "intro") && segments.length) {
    const after = (typeof raw.intro === "object" && raw.intro ? (raw.intro as { after: string }).after : undefined) ?? ch.intro.after;
    const at = after ? segments.findIndex((s) => s.id === after) : 0;
    segments.splice(Math.max(0, at) + 1, 0, {
      id: "channel-intro",
      choreo: "intro",
      beats: [],
      hold: ch.intro.seconds,
      scene: { type: "intro", line: ch.intro.line },
    });
  }
  return raw;
};

/** Parse a spec the way the renderer sees it: channel defaults, intro, schema defaults. */
export const parseSpec = (input: VideoSpecInput | VideoSpecT): VideoSpecT => VideoSpec.parse(resolveSpec(input));
export const safeParseSpec = (input: unknown) => VideoSpec.safeParse(resolveSpec(input as VideoSpecInput));
