import React, { useEffect, useState } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { LAYOUT } from "../design/tokens";

/**
 * Automated visual QA, active only when the composition gets `qa: true` (npm run sheet).
 * After each frame renders it measures every visible run of text and logs problems:
 *   clipped  — text leaves the frame
 *   unsafe   — text sits outside the safe margins
 *   overlap  — two visible text runs collide
 * The sheet script collects these logs and prints them with the frame number.
 */
export const QaProbe: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const [handle] = useState(() => delayRender("qa-probe"));

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const issues = measure(width, height);
        for (const i of issues) console.log(`QA_ISSUE ${JSON.stringify({ frame, ...i })}`);
      } finally {
        continueRender(handle);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [frame, width, height, handle]);

  return null;
};

type Issue = { kind: "clipped" | "unsafe" | "overlap"; text: string; other?: string };

const effectiveOpacity = (el: Element | null): number => {
  let o = 1;
  for (let e = el; e && e instanceof Element; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none") return 0;
    o *= parseFloat(cs.opacity || "1");
    if (o < 0.05) return o;
  }
  return o;
};

function measure(W: number, H: number): Issue[] {
  const scale = W > H ? W / 1920 : W / 1080;
  const sx = LAYOUT.safe.x * scale * 0.55;
  const sy = LAYOUT.safe.top * scale * 0.45;
  const runs: { text: string; r: DOMRect }[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent ?? "").trim();
    if (!text) continue;
    const el = n.parentElement;
    if (!el || effectiveOpacity(el) < 0.35) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const box = range.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) continue;
    // the glyph band: line boxes include ascender/descender space that may legitimately touch
    const r = new DOMRect(box.left, box.top + box.height * 0.22, box.width, box.height * 0.56);
    runs.push({ text, r });
  }
  const issues: Issue[] = [];
  for (const { text, r } of runs) {
    if (r.left < -2 || r.top < -2 || r.right > W + 2 || r.bottom > H + 2) issues.push({ kind: "clipped", text });
    else if (r.left < sx || r.top < sy || r.right > W - sx || r.bottom > H - sy) issues.push({ kind: "unsafe", text });
  }
  for (let i = 0; i < runs.length; i++)
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i].r;
      const b = runs[j].r;
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix <= 0 || iy <= 0) continue;
      const overlap = (ix * iy) / Math.min(a.width * a.height, b.width * b.height);
      if (overlap > 0.18) issues.push({ kind: "overlap", text: runs[i].text, other: runs[j].text });
    }
  return issues;
}
