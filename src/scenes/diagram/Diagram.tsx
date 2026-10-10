import React, { useMemo } from "react";
import { Heading } from "../../primitives/Heading";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { evolvePath } from "@remotion/paths";
import { ease, lerp, prog, shake } from "../../design/motion";
import { typeStyle, useLayout, useTheme } from "../../design/theme";
import { LAYOUT, LineColor, PACKET_SPEED, alpha, mix } from "../../design/tokens";
import { KindIcon } from "../../primitives/Icon";
import type { DiagramEvent, Resolved } from "../../spec/compile";
import type { DiagramNodeT, DiagramSceneT } from "../../spec/schema";
import { useSegment, useVideo } from "../../video/context";
import { Box, Chain, DiagramGeom, bounds, buildGeometry, chainPath, edgeId, pointAt, tangentAt } from "./geometry";
import { ElementState, foldDiagram } from "./state";

const U = LAYOUT.unit;
const PACKET_SPACING = 9;
const STREAM_SPACING = 14;

type Cam = { cx: number; cy: number; z: number };

/**
 * The system as a transit map. Stations (components) appear in their final positions as the
 * narration introduces them; tracks connect them; requests ride coloured lines and leave the
 * line painted behind them; the camera frames what matters now.
 */
export const Diagram: React.FC<{ scene: Resolved<DiagramSceneT> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const seg = useSegment();
  const video = useVideo();
  const theme = useTheme();
  const { p, line } = theme;
  const { width, height, scale, safe } = useLayout();
  const def = video.spec.diagrams[scene.diagram];
  const geom = useMemo(() => (def ? buildGeometry(def, U) : null), [def]);
  const events = useMemo(() => seg.diagramEvents ?? [], [seg]);
  const { motion, stage } = seg.choreo;

  // memoised chains for every flow in this segment's history
  const chains = useMemo(() => {
    const m = new Map<string, Chain>();
    if (!geom) return m;
    for (const e of events) if (e.do === "flow") m.set(e.path.join(">"), chainPath(geom, e.path));
    return m;
  }, [events, geom]);

  if (!def || !geom) return null;
  const st = foldDiagram(def, events, frame, motion.enterFrames);
  // a heading takes the top band of the frame; the camera frames the diagram below it
  const topInset = scene.heading ? 150 : 0;
  const cam = cameraAt(frame, events, geom, def, seg.autoFit ?? true, seg.durationInFrames, motion.cameraFrames, width / scale, height / scale, st, topInset);
  const zt = cam.z * scale;
  const tx = width / 2 - cam.cx * zt;
  const ty = height / 2 - cam.cy * zt;

  // ---- flows: painted lines, packets, arrival pulses
  const fps = video.fps;
  const arrivals = new Map<string, { at: number; color: LineColor }[]>();
  const painted: React.ReactNode[] = [];
  const visibleLines: { name?: string; color: LineColor; at: number }[] = [];
  const packets: React.ReactNode[] = [];
  const packetLabels: React.ReactNode[] = [];
  st.flows.forEach((e, k) => {
    const chain = chains.get(e.path.join(">"));
    if (!chain || !chain.ok) return;
    const color = e.line as LineColor;
    const travel = Math.max(12, Math.round((chain.length / (PACKET_SPEED * e.speed)) * fps));
    const local = frame - e.f;
    const paint = interpolate(local, [0, travel], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease("linear") });
    let fade = 1;
    if (!e.persist) fade *= 1 - prog(frame, e.f + travel + 8, 18, "glide");
    // lines painted in earlier segments settle into a quiet residue so this segment's flows lead
    if (e.f < 0) fade *= lerp(1, 0.28, prog(frame, 0, 14, "glide"));
    const clear = st.clears.find((c) => c.f > e.f && (!c.line || c.line === e.line));
    if (clear) fade *= 1 - prog(frame, clear.f, 14, "glide");
    if (fade > 0.25) visibleLines.push({ name: (e as DiagramEvent & { lineName?: string }).lineName, color, at: Math.max(0, e.f) });
    if (fade > 0.01) {
      painted.push(
        <path
          key={`paint-${k}`}
          d={chain.d}
          fill="none"
          stroke={line(color)}
          strokeWidth={LAYOUT.stroke.line}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${paint * chain.length} ${chain.length + 20}`}
          opacity={fade}
        />,
      );
    }
    for (const n of chain.nodeAt.slice(1)) {
      const list = arrivals.get(n.id) ?? [];
      list.push({ at: e.f + Math.round((n.at / chain.length) * travel), color });
      arrivals.set(n.id, list);
    }
    const count = e.stream ? Math.max(1, Math.floor((seg.durationInFrames - e.f) / STREAM_SPACING)) : e.packets;
    const spacing = e.stream ? STREAM_SPACING : PACKET_SPACING;
    for (let j = 0; j < count; j++) {
      const depart = e.f + j * spacing;
      const t = (frame - depart) / travel;
      if (t < 0 || t > 1) continue;
      if (clear && frame >= clear.f) continue;
      const l = t * chain.length;
      const pt = pointAt(chain.d, l);
      const tan = tangentAt(chain.d, l);
      const angle = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
      const op = Math.min(1, t * 12, (1 - t) * 14);
      packets.push(
        <g key={`pk-${k}-${j}`} transform={`translate(${pt.x} ${pt.y}) rotate(${angle})`} opacity={op}>
          <rect x={-17} y={-10} width={34} height={20} rx={10} fill={line(color)} stroke={p.bg} strokeWidth={5} paintOrder="stroke" />
        </g>,
      );
      if (j === 0 && e.label) {
        packetLabels.push(
          <div
            key={`pl-${k}`}
            style={{
              position: "absolute",
              left: pt.x,
              top: pt.y - 30,
              translate: "-50% -100%",
              opacity: op,
              ...typeStyle("micro", 1, true),
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 0,
              whiteSpace: "nowrap",
              padding: "7px 12px 5px",
              borderRadius: LAYOUT.radius.chip,
              backgroundColor: p.surfaceHi,
              border: `2px solid ${line(color)}`,
              color: p.text,
            }}
          >
            {e.label}
          </div>,
        );
      }
    }
  });

  // ---- legend: named lines that are on screen right now
  const legend: { name: string; color: LineColor; at: number }[] = [];
  for (const l of visibleLines) {
    const label = l.name ? video.lineLabel(l.name) : undefined;
    if (label && !legend.some((x) => x.name === label)) legend.push({ name: label, color: l.color, at: l.at });
  }

  const dimOf = (id: string) => st.el(id).dim;
  const gridOpacity = stage.grid;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${zt})` }}>
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
          <defs>
            <pattern id={`grid-${seg.id}`} width={U / 2} height={U / 2} patternUnits="userSpaceOnUse" x={U / 4} y={U / 4}>
              <circle cx={U / 4} cy={U / 4} r={2.6} fill={p.gridDot} />
            </pattern>
          </defs>
          {gridOpacity > 0 && <rect x={-30 * U} y={-20 * U} width={80 * U} height={50 * U} fill={`url(#grid-${seg.id})`} opacity={gridOpacity} />}
          {def.groups.map((g) => {
            const gg = geom.groups.get(g.id);
            const s = st.el(g.id);
            if (!gg || s.visible <= 0.001) return null;
            return (
              <rect
                key={g.id}
                x={gg.x}
                y={gg.y}
                width={gg.w}
                height={gg.h}
                rx={30}
                fill={alpha(g.line ? line(g.line as LineColor) : p.surface, g.line ? 0.06 : 0.35)}
                stroke={g.line ? alpha(line(g.line as LineColor), 0.7) : p.trackHi}
                strokeWidth={3}
                strokeDasharray="12 10"
                opacity={s.visible * lerp(1, 0.3, s.dim)}
              />
            );
          })}
          {[...geom.edges.values()].map((eg) => {
            const s = st.el(eg.id);
            if (s.visible <= 0.001) return null;
            const dim = Math.max(dimOf(eg.from), dimOf(eg.to), s.dim);
            const dashed = eg.edge.style === "dashed";
            const evo = evolvePath(s.visible, eg.d);
            const stroke = s.highlight > 0 ? mix(p.track, line(s.highlightColor), s.highlight) : p.track;
            return (
              <g key={eg.id} opacity={lerp(1, 0.25, dim) * (dashed ? s.visible : 1)}>
                <path
                  d={eg.d}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={LAYOUT.stroke.track + 2 * s.highlight}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={dashed ? "14 12" : evo.strokeDasharray}
                  strokeDashoffset={dashed ? 0 : evo.strokeDashoffset}
                />
                {eg.edge.arrow !== "none" && s.visible > 0.85 && <Arrow d={eg.d} at={eg.length} color={stroke} />}
                {eg.edge.arrow === "both" && s.visible > 0.85 && <Arrow d={eg.d} at={0} color={stroke} reverse />}
              </g>
            );
          })}
          {painted}
          {packets}
        </svg>
        {[...geom.edges.values()].map((eg) => {
          if (!eg.edge.label) return null;
          const s = st.el(eg.id);
          if (s.visible < 0.6) return null;
          const dim = Math.max(dimOf(eg.from), dimOf(eg.to));
          return (
            <div
              key={`lbl-${eg.id}`}
              style={{
                position: "absolute",
                left: eg.mid.x,
                top: eg.mid.y,
                translate: "-50% -50%",
                ...typeStyle("caption", 1),
                fontSize: 22,
                fontWeight: 600,
                padding: "6px 12px 4px",
                borderRadius: LAYOUT.radius.chip,
                backgroundColor: p.bg,
                color: p.textDim,
                whiteSpace: "nowrap",
                opacity: prog(s.visible, 0.6, 0.4, "linear") * lerp(1, 0.3, dim),
              }}
            >
              {eg.edge.label}
            </div>
          );
        })}
        {def.groups.map((g) => {
          const gg = geom.groups.get(g.id);
          const s = st.el(g.id);
          if (!gg || s.visible <= 0.001) return null;
          return (
            <div
              key={`gl-${g.id}`}
              style={{
                position: "absolute",
                left: gg.x + 26,
                top: gg.y + 16,
                ...typeStyle("caption", 1),
                fontWeight: 650,
                color: g.line ? line(g.line as LineColor) : p.textDim,
                opacity: s.visible * lerp(1, 0.3, s.dim),
                whiteSpace: "nowrap",
              }}
            >
              {g.label}
            </div>
          );
        })}
        {def.nodes.map((n) => {
          const s = st.el(n.id);
          if (s.visible <= 0.001) return null;
          const box = geom.boxes.get(n.id)!;
          return <NodeCard key={n.id} node={n} box={box} s={s} frame={frame} arrivals={arrivals.get(n.id) ?? []} />;
        })}
        {packetLabels}
      </div>

      {scene.heading && <Heading text={scene.heading} accent={seg.accent} at={2} style={{ position: "absolute", left: safe.x, top: safe.y * 0.9 }} />}
      {scene.title && !scene.heading && (
        <div
          style={{
            position: "absolute",
            left: safe.x,
            top: safe.y * 0.75,
            display: "flex",
            alignItems: "center",
            gap: 16 * scale,
            opacity: prog(frame, 2, 14, "glide"),
          }}
        >
          <div style={{ width: 22 * scale, height: 22 * scale, borderRadius: 99, border: `${6 * scale}px solid ${line(seg.accent)}`, boxSizing: "border-box" }} />
          <div style={{ ...typeStyle("label", scale), color: p.textDim }}>{scene.title}</div>
        </div>
      )}
      {scene.legend && legend.length > 0 && (
        <div style={{ position: "absolute", left: safe.x, bottom: (height - safe.bottom) * 0.75, display: "flex", gap: 40 * scale }}>
          {legend.map((l) => (
            <div key={l.name} style={{ display: "flex", alignItems: "center", gap: 14 * scale, opacity: prog(frame, l.at, 14, "glide") }}>
              <div style={{ width: 52 * scale, height: LAYOUT.stroke.line * scale, borderRadius: 99, backgroundColor: line(l.color) }} />
              <div style={{ ...typeStyle("caption", scale), color: p.textDim }}>{l.name}</div>
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

const Arrow: React.FC<{ d: string; at: number; color: string; reverse?: boolean }> = ({ d, at, color, reverse }) => {
  const pt = pointAt(d, at);
  const t = tangentAt(d, at);
  const dir = reverse ? -1 : 1;
  const ang = Math.atan2(t.y * dir, t.x * dir);
  const len = 18;
  const spread = 0.5;
  const a = { x: pt.x - Math.cos(ang - spread) * len, y: pt.y - Math.sin(ang - spread) * len };
  const b = { x: pt.x - Math.cos(ang + spread) * len, y: pt.y - Math.sin(ang + spread) * len };
  return (
    <path
      d={`M ${a.x} ${a.y} L ${pt.x} ${pt.y} L ${b.x} ${b.y}`}
      fill="none"
      stroke={color}
      strokeWidth={LAYOUT.stroke.track}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
};

const NodeCard: React.FC<{ node: DiagramNodeT; box: Box; s: ElementState; frame: number; arrivals: { at: number; color: LineColor }[] }> = ({
  node,
  box,
  s,
  frame,
  arrivals,
}) => {
  const { p, line, on } = useTheme();
  const accent = (s.highlight > 0 ? s.highlightColor : (node.line as LineColor | undefined)) ?? "orange";
  const red = line("red");
  const hl = s.highlight;
  const fail = s.fail;
  const borderColor = fail > 0 ? mix(p.track, red, fail) : mix(p.track, line(accent), hl);
  const ringColor = fail > 0 ? mix(p.trackHi, red, fail) : mix(p.trackHi, line(accent), hl);
  const ringFill = fail > 0.5 ? red : hl > 0.5 ? line(accent) : p.bg;
  const iconColor = fail > 0.5 ? on("red") : hl > 0.5 ? on(accent) : p.text;
  const enter = s.visible;
  const dx = shake(frame - s.failAt, 9);
  const ring = 70;

  // the most recent arrival or pulse drives a ping ring
  const pings = [...arrivals.map((a) => ({ at: a.at, color: a.color })), ...s.pulses.map((x) => ({ at: x.at, color: x.color ?? accent }))].filter(
    (x) => frame >= x.at && frame < x.at + 22,
  );

  return (
    <div
      style={{
        position: "absolute",
        left: box.cx - box.w / 2,
        top: box.cy - box.h / 2,
        width: box.w,
        height: box.h,
        opacity: Math.min(1, enter * 1.4) * lerp(1, 0.26, s.dim),
        scale: `${lerp(0.88, 1, enter)}`,
        translate: `${dx}px ${lerp(14, 0, enter)}px`,
      }}
    >
      {hl > 0 && (
        <div
          style={{
            position: "absolute",
            inset: -11,
            borderRadius: LAYOUT.radius.node + 10,
            border: `4px solid ${alpha(line(accent), 0.4 * hl)}`,
          }}
        />
      )}
      {pings.map((x, i) => {
        const t = (frame - x.at) / 22;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: -6 - 22 * t,
              borderRadius: LAYOUT.radius.node + 6 + 22 * t,
              border: `3px solid ${alpha(line(x.color), 0.55 * (1 - t))}`,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: LAYOUT.radius.node,
          backgroundColor: fail > 0 ? mix(p.surface, red, 0.14 * fail) : p.surface,
          border: `${LAYOUT.stroke.border}px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          gap: 20,
          paddingLeft: 18,
          paddingRight: 26,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            flex: "none",
            width: ring,
            height: ring,
            borderRadius: 99,
            boxSizing: "border-box",
            border: `5px solid ${ringColor}`,
            backgroundColor: ringFill,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <KindIcon kind={node.kind} size={33} color={iconColor} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...typeStyle("label", 1), fontSize: 35, color: p.text, whiteSpace: "nowrap" }} data-qa-fit="node-label">
            {node.label}
          </div>
          {node.sub && (
            <div style={{ ...typeStyle("caption", 1), fontSize: 26, color: p.textDim, marginTop: 6, whiteSpace: "nowrap" }} data-qa-fit="node-sub">
              {node.sub}
            </div>
          )}
        </div>
      </div>
      {s.badges
        .filter((b) => frame >= b.at && frame < b.until + 8)
        .map((b, i) => {
          const inP = prog(frame, b.at, 10, "snap");
          const outP = prog(frame, b.until, 8, "glide");
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                right: -14,
                top: -22,
                ...typeStyle("micro", 1),
                fontSize: 22,
                padding: "8px 13px 5px",
                borderRadius: LAYOUT.radius.badge,
                backgroundColor: line(b.color),
                color: on(b.color),
                scale: `${lerp(0.6, 1, inP)}`,
                opacity: inP * (1 - outP),
                whiteSpace: "nowrap",
              }}
            >
              {b.text}
            </div>
          );
        })}
    </div>
  );
};

// ---------------------------------------------------------------- camera

function cameraAt(
  frame: number,
  events: DiagramEvent[],
  geom: DiagramGeom,
  def: { nodes: DiagramNodeT[]; groups: { id: string; nodes: string[] }[] },
  autoFit: boolean,
  segDuration: number,
  camFrames: number,
  viewW: number,
  viewH: number,
  st: ReturnType<typeof foldDiagram>,
  topInset = 0,
): Cam {
  const nodeIds = new Set(def.nodes.map((n) => n.id));
  const resolveTargets = (ids: string[]) => {
    const out = new Set<string>();
    for (const id of ids) {
      if (nodeIds.has(id)) out.add(id);
      const g = def.groups.find((x) => x.id === id);
      if (g) g.nodes.forEach((n) => out.add(n));
      const e = geom.edges.get(id);
      if (e) {
        out.add(e.from);
        out.add(e.to);
      }
    }
    return [...out].map((id) => geom.boxes.get(id)).filter(Boolean) as Box[];
  };
  const fitBoxes = (at: number) => {
    // everything that is visible by the end of this segment (stations keep their final positions)
    const vis = st.visibleAt(Math.max(at, segDuration));
    const bs = [...vis].filter((id) => nodeIds.has(id)).map((id) => geom.boxes.get(id)!);
    return bs.length ? bs : [...geom.boxes.values()];
  };
  const target = (bs: Box[], maxZ: number, minZ = 0.72): Cam => {
    const b = bounds(bs);
    const padX = 0.9 * U;
    const padY = 0.85 * U;
    const h = viewH - topInset;
    const z = Math.max(minZ, Math.min(maxZ, (viewW * 0.86) / (b.w + 2 * padX), (h * 0.76) / (b.h + 2 * padY)));
    return { cx: b.cx, cy: b.cy + 0.05 * U - topInset / 2 / z, z };
  };

  const camEvents: { f: number; cam: Cam }[] = [];
  for (const e of events) {
    if (e.do === "fit") camEvents.push({ f: e.f, cam: target(fitBoxes(e.f), 1.45) });
    if (e.do === "focus") camEvents.push({ f: e.f, cam: target(resolveTargets(e.targets), e.zoom ?? 1.7, e.zoom ?? 0.72) });
  }
  if (autoFit) camEvents.push({ f: 0, cam: target(fitBoxes(0), 1.45) });
  camEvents.sort((a, b) => a.f - b.f);
  if (!camEvents.length) return { cx: 8 * U, cy: 4.5 * U, z: 1 };

  let from = camEvents[0].cam;
  let to = camEvents[0].cam;
  let start = camEvents[0].f;
  const value = (f: number): Cam => {
    const t = f <= start ? 0 : Math.min(1, (f - start) / camFrames);
    const k = ease("drift")(t);
    return { cx: lerp(from.cx, to.cx, k), cy: lerp(from.cy, to.cy, k), z: from.z * Math.pow(to.z / from.z, k) };
  };
  for (let i = 1; i < camEvents.length; i++) {
    const e = camEvents[i];
    if (e.f > frame) break;
    from = value(e.f);
    to = e.cam;
    start = e.f;
  }
  return value(frame);
}

export { edgeId };
