/** channels/<id>/channel.json schema (no generated imports, so scripts/sync.ts can use it). */
import { z } from "zod";
import { Id, LineRef, MusicSettings, VoiceSettings } from "./schema";

export const ChannelSpec = z
  .object({
    $schema: z.string().optional(),
    id: Id,
    name: z.string().min(1).max(40).describe("Shown in the intro"),
    tagline: z.string().max(60).optional().describe("One line under the name in the intro"),
    handle: z.string().min(2).max(30).describe("e.g. @sainp7; used by the outro"),
    platforms: z.array(z.enum(["youtube", "shorts", "instagram", "tiktok"])).default(["youtube"]),
    style: z.string().default("transit").describe("Motion style: a folder in src/styles/"),
    theme: z.enum(["dark", "light"]).default("dark"),
    voice: VoiceSettings.partial().default({}),
    music: MusicSettings.partial().default({}),
    intro: z
      .object({
        enabled: z.boolean().default(true),
        after: Id.optional().describe("Segment id the intro follows; default: the first segment (the hook)"),
        seconds: z.number().min(1.5).max(8).default(3.5),
        line: LineRef.default("orange").describe("Accent colour of the intro"),
        formats: z.array(z.enum(["landscape", "portrait"])).default(["landscape"]).describe("Shorts and Reels skip the intro"),
      })
      .strict()
      .prefault({}),
    outro: z.object({ cta: z.string().max(48).optional() }).strict().prefault({}),
  })
  .strict();

export type ChannelT = z.output<typeof ChannelSpec>;
