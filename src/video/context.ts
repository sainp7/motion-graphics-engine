import { createContext, useContext } from "react";
import type { Compiled, CompiledSegment } from "../spec/compile";

export const VideoCtx = createContext<Compiled | null>(null);
export const SegmentCtx = createContext<CompiledSegment | null>(null);

export const useVideo = () => {
  const v = useContext(VideoCtx);
  if (!v) throw new Error("useVideo() outside <VideoCtx>");
  return v;
};

export const useSegment = () => {
  const s = useContext(SegmentCtx);
  if (!s) throw new Error("useSegment() outside <SegmentCtx>");
  return s;
};
