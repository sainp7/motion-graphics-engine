/**
 * Diagram geometry: station boxes, octilinear track routing (horizontal, vertical and
 * 45° segments, like a transit map) and rounded-corner SVG paths.
 * Everything is in canvas pixels at zoom 1 (1 grid unit = LAYOUT.unit px).
 */
import { getLength, getPointAtLength, getTangentAtLength } from "@remotion/paths";
import type { DiagramDefT, DiagramEdgeT, DiagramNodeT } from "../../spec/schema";

export type Pt = { x: number; y: number };
export type Side = "left" | "right" | "top" | "bottom";
export type Box = { id: string; cx: number; cy: number; w: number; h: number };

const SIZE = { sm: { w: 2.1, h: 0.9 }, md: { w: 2.45, h: 1.04 }, lg: { w: 2.9, h: 1.16 } } as const;

/** Approximate label width in px for Overpass at the label role (used only to grow boxes). */
const labelWidth = (s: string, px: number) => s.length * px * 0.56;

export const nodeBox = (n: DiagramNodeT, U: number): Box => {
  const s = SIZE[n.size];
  const label = labelWidth(n.label, 35);
  const sub = n.sub ? labelWidth(n.sub, 26) : 0;
  const needed = 18 + 70 + 20 + Math.max(label, sub) + 30;
  const w = Math.max(s.w * U, needed);
  return { id: n.id, cx: n.at[0] * U, cy: n.at[1] * U, w, h: s.h * U };
};

const LANE_GAP = 20;

export const anchor = (b: Box, side: Side, lane: number): Pt => {
  const o = lane * LANE_GAP;
  switch (side) {
    case "left":
      return { x: b.cx - b.w / 2, y: b.cy + o };
    case "right":
      return { x: b.cx + b.w / 2, y: b.cy + o };
    case "top":
      return { x: b.cx + o, y: b.cy - b.h / 2 };
    case "bottom":
      return { x: b.cx + o, y: b.cy + b.h / 2 };
  }
};

export const chooseSides = (a: Box, b: Box): [Side, Side] => {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  // stations are wide, so prefer horizontal tracks unless the target is clearly above/below
  const horizontalGap = Math.abs(dx) - (a.w + b.w) / 2;
  if (horizontalGap > 30 || Math.abs(dx) > Math.abs(dy) * 1.25) return dx >= 0 ? ["right", "left"] : ["left", "right"];
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
};

const isH = (s: Side) => s === "left" || s === "right";

/** Polyline from a to b leaving/entering along the given sides. */
export const routePoints = (a: Pt, sa: Side, b: Pt, sb: Side, mode: DiagramEdgeT["route"]): Pt[] => {
  if (mode === "straight") return [a, b];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (isH(sa) && isH(sb)) {
    if (Math.abs(dy) < 1) return [a, b];
    const dir = Math.sign(dx) || 1;
    const run = Math.abs(dx);
    if (mode === "auto" && run - 40 >= Math.abs(dy)) {
      const x1 = a.x + dir * ((run - Math.abs(dy)) / 2);
      return [a, { x: x1, y: a.y }, { x: x1 + dir * Math.abs(dy), y: b.y }, b];
    }
    const xm = (a.x + b.x) / 2;
    return [a, { x: xm, y: a.y }, { x: xm, y: b.y }, b];
  }
  if (!isH(sa) && !isH(sb)) {
    if (Math.abs(dx) < 1) return [a, b];
    const dir = Math.sign(dy) || 1;
    const run = Math.abs(dy);
    if (mode === "auto" && run - 40 >= Math.abs(dx)) {
      const y1 = a.y + dir * ((run - Math.abs(dx)) / 2);
      return [a, { x: a.x, y: y1 }, { x: b.x, y: y1 + dir * Math.abs(dx) }, b];
    }
    const ym = (a.y + b.y) / 2;
    return [a, { x: a.x, y: ym }, { x: b.x, y: ym }, b];
  }
  // mixed: one L bend
  return isH(sa) ? [a, { x: b.x, y: a.y }, b] : [a, { x: a.x, y: b.y }, b];
};

/** SVG path through the points with rounded corners. */
export const roundedPath = (pts: Pt[], radius = 26): string => {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    if (r < 0.5 || l1 === 0 || l2 === 0) {
      d += ` L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
      continue;
    }
    const a = { x: p1.x - ((p1.x - p0.x) / l1) * r, y: p1.y - ((p1.y - p0.y) / l1) * r };
    const b = { x: p1.x + ((p2.x - p1.x) / l2) * r, y: p1.y + ((p2.y - p1.y) / l2) * r };
    d += ` L ${a.x.toFixed(2)} ${a.y.toFixed(2)} Q ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return d;
};

export type EdgeGeom = {
  id: string;
  from: string;
  to: string;
  points: Pt[];
  d: string;
  length: number;
  mid: Pt;
  edge: DiagramEdgeT;
};

export const edgeId = (e: DiagramEdgeT) => e.id ?? `${e.from}-${e.to}`;

export type DiagramGeom = {
  boxes: Map<string, Box>;
  edges: Map<string, EdgeGeom>;
  groups: Map<string, { x: number; y: number; w: number; h: number; label: string }>;
};

export const buildGeometry = (def: DiagramDefT, U: number): DiagramGeom => {
  const boxes = new Map<string, Box>();
  for (const n of def.nodes) boxes.set(n.id, nodeBox(n, U));
  const edges = new Map<string, EdgeGeom>();
  for (const e of def.edges) {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    if (!a || !b) continue;
    const [sa0, sb0] = chooseSides(a, b);
    const sa = e.fromSide ?? sa0;
    const sb = e.toSide ?? sb0;
    const pa = anchor(a, sa, e.lane);
    const pb = anchor(b, sb, e.lane);
    // leave a small gap before the arrowhead
    const points = routePoints(pa, sa, pb, sb, e.route);
    const d = roundedPath(points);
    const length = getLength(d);
    const mid = getPointAtLength(d, length / 2) ?? points[0];
    edges.set(edgeId(e), { id: edgeId(e), from: e.from, to: e.to, points, d, length, mid, edge: e });
  }
  const groups = new Map<string, { x: number; y: number; w: number; h: number; label: string }>();
  for (const g of def.groups) {
    const bs = g.nodes.map((id) => boxes.get(id)).filter(Boolean) as Box[];
    if (!bs.length) continue;
    const pad = 0.34 * U;
    const x0 = Math.min(...bs.map((b) => b.cx - b.w / 2)) - pad;
    const x1 = Math.max(...bs.map((b) => b.cx + b.w / 2)) + pad;
    const y0 = Math.min(...bs.map((b) => b.cy - b.h / 2)) - pad - 0.32 * U;
    const y1 = Math.max(...bs.map((b) => b.cy + b.h / 2)) + pad;
    groups.set(g.id, { x: x0, y: y0, w: x1 - x0, h: y1 - y0, label: g.label });
  }
  return { boxes, edges, groups };
};

/** A path through a chain of nodes, following existing edges in either direction. */
export type Chain = { d: string; length: number; nodeAt: { id: string; at: number }[]; ok: boolean; missing?: string };

export const chainPath = (geom: DiagramGeom, nodes: string[]): Chain => {
  const pts: Pt[] = [];
  const nodeAt: Chain["nodeAt"] = [];
  let length = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    let eg: EdgeGeom | undefined;
    let reverse = false;
    for (const e of geom.edges.values()) {
      if (e.from === a && e.to === b) {
        eg = e;
        break;
      }
      if (e.from === b && e.to === a && !eg) {
        eg = e;
        reverse = true;
      }
    }
    if (!eg) return { d: "", length: 0, nodeAt: [], ok: false, missing: `${a} → ${b}` };
    const seg = reverse ? [...eg.points].reverse() : eg.points;
    if (i === 0) nodeAt.push({ id: a, at: 0 });
    if (pts.length) {
      const last = pts[pts.length - 1];
      length += Math.hypot(seg[0].x - last.x, seg[0].y - last.y);
    }
    pts.push(...seg);
    length += eg.length;
    nodeAt.push({ id: b, at: length });
  }
  const d = roundedPath(pts, 22);
  // recompute exact lengths along the merged path
  const total = getLength(d);
  const k = length > 0 ? total / length : 1;
  return { d, length: total, nodeAt: nodeAt.map((n) => ({ ...n, at: n.at * k })), ok: true };
};

export const pointAt = (d: string, l: number): Pt => getPointAtLength(d, l) ?? { x: 0, y: 0 };
export const tangentAt = (d: string, l: number): Pt => getTangentAtLength(d, l) ?? { x: 1, y: 0 };

/** Bounding box of a set of boxes, in px. */
export const bounds = (bs: Box[]) => {
  const x0 = Math.min(...bs.map((b) => b.cx - b.w / 2));
  const x1 = Math.max(...bs.map((b) => b.cx + b.w / 2));
  const y0 = Math.min(...bs.map((b) => b.cy - b.h / 2));
  const y1 = Math.max(...bs.map((b) => b.cy + b.h / 2));
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
