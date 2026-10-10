import { Config } from "@remotion/cli/config";

// Renders are deterministic and local. These defaults favour YouTube uploads:
// H.264 at a visually lossless CRF, yuv420p for compatibility.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
Config.setEntryPoint("src/index.ts");
Config.setPublicDir("public");
