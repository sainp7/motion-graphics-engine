/**
 * Diagram state at a frame, folded from the event list.
 * Pure and deterministic: the same frame always yields the same picture.
 */
import { prog } from "../../design/motion";
import type { LineColor } from "../../design/tokens";
import type { DiagramEvent } from "../../spec/compile";
import type { DiagramDefT } from "../../spec/schema";
import { edgeId } from "./geometry";

type Channel = { on: boolean; changedAt: number };
const NEVER = -1e9;

const channelValue = (c: Channel, frame: number, dur: number) =>
  c.on ? prog(frame, c.changedAt, dur, "glide") : 1 - prog(frame, c.changedAt, dur, "glide");

export type ElementState = {
  visible: number;
  highlight: number;
  highlightColor: LineColor;
  dim: number;
  fail: number;
  failAt: number;
  pulses: { at: number; color?: LineColor }[];
  badges: { text: string; color: LineColor; at: number; until: number }[];
};

export type DiagramState = {
  el: (id: string) => ElementState;
  /** Events of kind flow, for packets and painted lines. */
  flows: (DiagramEvent & { do: "flow" })[];
  clears: { f: number; line?: string }[];
  /** Ids visible at a given frame (folded show/hide). */
  visibleAt: (f: number) => Set<string>;
};

export const foldDiagram = (def: DiagramDefT, events: DiagramEvent[], frame: number, enterFrames: number): DiagramState => {
  const nodeIds = def.nodes.map((n) => n.id);
  const edgeIds = def.edges.map(edgeId);
  const groupIds = def.groups.map((g) => g.id);
  const all = [...nodeIds, ...edgeIds, ...groupIds];

  const vis = new Map<string, Channel>();
  const hl = new Map<string, Channel & { color: LineColor }>();
  const dim = new Map<string, Channel>();
  const fail = new Map<string, Channel>();
  const pulses = new Map<string, ElementState["pulses"]>();
  const badges = new Map<string, ElementState["badges"]>();
  const explicit = new Set<string>();
  for (const e of events) if ((e.do === "show" || e.do === "hide") && e.target) explicit.add(e.target);

  const ch = (m: Map<string, Channel>, id: string) => {
    let c = m.get(id);
    if (!c) {
      c = { on: false, changedAt: NEVER };
      m.set(id, c);
    }
    return c;
  };
  const set = (m: Map<string, Channel>, id: string, on: boolean, f: number) => {
    const c = ch(m, id);
    if (c.on !== on) {
      c.on = on;
      c.changedAt = f;
    }
  };

  const flows: DiagramState["flows"] = [];
  const clears: DiagramState["clears"] = [];

  for (const e of events) {
    if (e.f > frame) break;
    switch (e.do) {
      case "show":
        if (e.target) set(vis, e.target, true, e.f);
        break;
      case "hide":
        if (e.target) set(vis, e.target, false, e.f);
        break;
      case "highlight":
        for (const id of e.targets) {
          const c = hl.get(id) ?? { on: false, changedAt: NEVER, color: "orange" as LineColor };
          if (!c.on) {
            c.on = true;
            c.changedAt = e.f;
          }
          c.color = (e.line as LineColor) ?? "orange";
          hl.set(id, c);
          set(dim, id, false, e.f);
        }
        break;
      case "dim": {
        const targets = e.targets ?? all.filter((id) => !(e.except ?? []).includes(id));
        for (const id of targets) set(dim, id, true, e.f);
        for (const id of e.except ?? []) set(dim, id, false, e.f);
        break;
      }
      case "reset": {
        const targets = e.targets ?? all;
        for (const id of targets) {
          const h = hl.get(id);
          if (h && h.on) {
            h.on = false;
            h.changedAt = e.f;
          }
          set(dim, id, false, e.f);
          const b = badges.get(id);
          if (b) for (const x of b) x.until = Math.min(x.until, e.f);
        }
        break;
      }
      case "fail":
        if (e.target) set(fail, e.target, true, e.f);
        break;
      case "recover":
        if (e.target) {
          set(fail, e.target, false, e.f);
          const list = pulses.get(e.target) ?? [];
          list.push({ at: e.f, color: "green" });
          pulses.set(e.target, list);
        }
        break;
      case "pulse":
        for (const id of e.targets) {
          const list = pulses.get(id) ?? [];
          list.push({ at: e.f, color: e.line as LineColor | undefined });
          pulses.set(id, list);
        }
        break;
      case "badge": {
        const list = badges.get(e.target) ?? [];
        for (const x of list) x.until = Math.min(x.until, e.f);
        list.push({ text: e.text, color: (e.line as LineColor) ?? "orange", at: e.f, until: e.until ?? 1e9 });
        badges.set(e.target, list);
        break;
      }
      case "flow":
        flows.push(e as DiagramState["flows"][number]);
        break;
      case "clear-lines":
        clears.push({ f: e.f, line: e.line });
        break;
      default:
        break;
    }
  }

  // implicit visibility: edges/groups that are never explicitly shown appear with their nodes
  const nodeVisibleSince = (id: string) => {
    const c = vis.get(id);
    return c && c.on ? c.changedAt : null;
  };
  for (const e of def.edges) {
    const id = edgeId(e);
    if (explicit.has(id)) continue;
    const a = nodeVisibleSince(e.from);
    const b = nodeVisibleSince(e.to);
    if (a !== null && b !== null) vis.set(id, { on: true, changedAt: Math.max(a, b) + Math.round(enterFrames * 0.5) });
    else {
      const anyHidden = [e.from, e.to].map((n) => vis.get(n)).find((c) => c && !c.on && c.changedAt > NEVER);
      vis.set(id, { on: false, changedAt: anyHidden ? anyHidden.changedAt : NEVER });
    }
  }
  for (const g of def.groups) {
    if (explicit.has(g.id)) continue;
    const since = g.nodes.map(nodeVisibleSince);
    if (since.every((s) => s !== null)) vis.set(g.id, { on: true, changedAt: Math.max(...(since as number[])) + enterFrames });
  }

  const el = (id: string): ElementState => {
    const v = vis.get(id);
    const h = hl.get(id);
    const fl = fail.get(id);
    return {
      visible: v ? channelValue(v, frame, enterFrames) : 0,
      highlight: h ? channelValue(h, frame, 12) : 0,
      highlightColor: h?.color ?? "orange",
      dim: dim.get(id) ? channelValue(dim.get(id)!, frame, 14) : 0,
      fail: fl ? channelValue(fl, frame, 8) : 0,
      failAt: fl && fl.on ? fl.changedAt : NEVER,
      pulses: pulses.get(id) ?? [],
      badges: badges.get(id) ?? [],
    };
  };

  const visibleAt = (f: number) => {
    const s = new Set<string>();
    const st = new Map<string, boolean>();
    for (const e of events) {
      if (e.f > f) break;
      if (e.do === "show" && e.target) st.set(e.target, true);
      if (e.do === "hide" && e.target) st.set(e.target, false);
    }
    for (const [k, on] of st) if (on) s.add(k);
    return s;
  };

  return { el, flows, clears, visibleAt };
};
