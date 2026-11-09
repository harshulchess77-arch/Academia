/* Academia · whiteboard renderer. React elements only (no innerHTML): every string is rendered as text, every
   number is already clamped by validateLesson(). Plot curves are COMPUTED here from the expression with the Numera engine. */
import { memo, useMemo } from "react";
import { evalAst, parse } from "@/engine/math";
import { BOARD_H, BOARD_W, type Color, type Shape, type Step } from "./schema";

const CSS: Record<Color, string> = { ink: "var(--text-900)", cobalt: "var(--cobalt-500)", vermillion: "var(--accent-500)", forest: "var(--forest-500)", marigold: "var(--marigold-500)" };
const n1 = (n: number) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : 0);
const tick = (n: number) => (Math.abs(n) >= 1000 || (Math.abs(n) < 0.01 && n !== 0) ? n.toExponential(0) : String(Math.round(n * 100) / 100));

export interface PlotGeometry { path: string; ymin: number; ymax: number; zeroX: number | null; zeroY: number | null; points: number }

/** Samples fn over [xmin,xmax] and maps it into the plot box. Exported for tests. */
export function computePlot(sh: Extract<Shape, { t: "plot" }>, samples = 160): PlotGeometry | null {
  let ast; try { ast = parse(sh.fn); } catch { return null; }
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = sh.xmin + ((sh.xmax - sh.xmin) * i) / samples;
    let y = NaN;
    try { const r = evalAst(ast, { x }); if (typeof r === "number" && Number.isFinite(r) && Math.abs(r) < 1e9) y = r; } catch { /* undefined here — leave a gap */ }
    xs.push(x); ys.push(y);
  }
  const fin = ys.filter(Number.isFinite);
  if (fin.length < 2) return null;
  let lo = sh.ymin ?? Math.min(...fin), hi = sh.ymax ?? Math.max(...fin);
  if (sh.ymin === null) {
    /* auto-range: if a few extreme samples (poles of tan, 1/x …) dominate, frame the bulk of the curve instead,
       otherwise one huge value flattens everything into a line */
    const sorted = [...fin].sort((a, b) => a - b);
    const p2 = sorted[Math.floor(sorted.length * 0.02)], p98 = sorted[Math.ceil(sorted.length * 0.98) - 1];
    if (hi - lo > 6 * (p98 - p2) && p98 > p2) { const pad = (p98 - p2) * 0.15; lo = p2 - pad; hi = p98 + pad; }
  }
  if (!(hi > lo)) { lo -= 1; hi += 1; }
  if (sh.ymin === null) { const pad = (hi - lo) * 0.06; lo -= pad; hi += pad; }
  const X = (x: number) => sh.x + ((x - sh.xmin) / (sh.xmax - sh.xmin)) * sh.w;
  const Y = (y: number) => sh.y + sh.h - ((y - lo) / (hi - lo)) * sh.h;
  let d = "", pen = false, prev = NaN;
  const eps = (hi - lo) * 1e-9;
  ys.forEach((y, i) => {
    /* values outside the frame are CUT, never clamped: clamping would draw a flat "roof" that looks like real data */
    const off = !Number.isFinite(y) || y < lo - eps || y > hi + eps;
    // break the line across discontinuities (e.g. tan, 1/x) instead of drawing a vertical streak
    const jump = pen && Number.isFinite(prev) && Number.isFinite(y) && Math.abs(y - prev) > (hi - lo) * 1.5;
    if (off || jump) { pen = false; prev = y; if (off) return; }
    d += `${pen ? "L" : "M"}${n1(X(xs[i]))} ${n1(Y(y))} `;
    pen = true; prev = y;
  });
  return { path: d.trim(), ymin: lo, ymax: hi, zeroX: sh.xmin <= 0 && sh.xmax >= 0 ? X(0) : null, zeroY: lo <= 0 && hi >= 0 ? Y(0) : null, points: fin.length };
}

function Arrowhead({ x1, y1, x2, y2, c }: { x1: number; y1: number; x2: number; y2: number; c: string }) {
  const a = Math.atan2(y2 - y1, x2 - x1), L = 16, W = 0.45;
  const p = [[x2, y2], [x2 - L * Math.cos(a - W), y2 - L * Math.sin(a - W)], [x2 - L * Math.cos(a + W), y2 - L * Math.sin(a + W)]].map(q => `${n1(q[0])},${n1(q[1])}`).join(" ");
  return <polygon points={p} fill={c} />;
}

function Plot({ sh }: { sh: Extract<Shape, { t: "plot" }> }) {
  const g = useMemo(() => computePlot(sh), [sh]);
  const c = CSS[sh.color];
  if (!g) return <text x={sh.x} y={sh.y + 20} className="board-mono" fontSize={16} fill="var(--text-500)">(can’t plot {sh.fn.slice(0, 30)})</text>;
  const ax = "var(--text-500)";
  return (
    <g>
      <rect x={sh.x} y={sh.y} width={sh.w} height={sh.h} fill="none" stroke={ax} strokeWidth={1} strokeDasharray="3 4" opacity={0.5} />
      {g.zeroY !== null && <line x1={sh.x} y1={n1(g.zeroY)} x2={sh.x + sh.w} y2={n1(g.zeroY)} stroke={ax} strokeWidth={1.6} />}
      {g.zeroX !== null && <line x1={n1(g.zeroX)} y1={sh.y} x2={n1(g.zeroX)} y2={sh.y + sh.h} stroke={ax} strokeWidth={1.6} />}
      <path d={g.path} fill="none" stroke={c} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      <text x={sh.x} y={sh.y + sh.h + 18} className="board-mono" fontSize={13} fill={ax}>{tick(sh.xmin)}</text>
      <text x={sh.x + sh.w} y={sh.y + sh.h + 18} className="board-mono" fontSize={13} fill={ax} textAnchor="end">{tick(sh.xmax)}</text>
      <text x={sh.x - 6} y={sh.y + 10} className="board-mono" fontSize={13} fill={ax} textAnchor="end">{tick(g.ymax)}</text>
      <text x={sh.x - 6} y={sh.y + sh.h} className="board-mono" fontSize={13} fill={ax} textAnchor="end">{tick(g.ymin)}</text>
    </g>
  );
}

function Draw({ sh }: { sh: Shape }) {
  switch (sh.t) {
    case "text": return <text x={n1(sh.x)} y={n1(sh.y)} className="board-text" fontSize={sh.size} fill={CSS[sh.color]} textAnchor={sh.anchor}>{sh.s}</text>;
    case "line": return <line x1={n1(sh.x1)} y1={n1(sh.y1)} x2={n1(sh.x2)} y2={n1(sh.y2)} stroke={CSS[sh.color]} strokeWidth={3.5} strokeLinecap="round" strokeDasharray={sh.dashed ? "8 8" : undefined} />;
    case "arrow": return <g><line x1={n1(sh.x1)} y1={n1(sh.y1)} x2={n1(sh.x2)} y2={n1(sh.y2)} stroke={CSS[sh.color]} strokeWidth={3.5} strokeLinecap="round" strokeDasharray={sh.dashed ? "8 8" : undefined} /><Arrowhead x1={sh.x1} y1={sh.y1} x2={sh.x2} y2={sh.y2} c={CSS[sh.color]} /></g>;
    case "rect": return <g><rect x={n1(sh.x)} y={n1(sh.y)} width={n1(sh.w)} height={n1(sh.h)} rx={6} fill={sh.fill ? CSS[sh.color] : "none"} fillOpacity={sh.fill ? 0.18 : 1} stroke={CSS[sh.color]} strokeWidth={3} />{sh.label && <text x={n1(sh.x + sh.w / 2)} y={n1(sh.y + sh.h / 2 + 8)} textAnchor="middle" className="board-text" fontSize={26} fill={CSS[sh.color]}>{sh.label}</text>}</g>;
    case "circle": return <circle cx={n1(sh.x)} cy={n1(sh.y)} r={n1(sh.r)} fill={sh.fill ? CSS[sh.color] : "none"} fillOpacity={sh.fill ? 0.85 : 1} stroke={CSS[sh.color]} strokeWidth={3} />;
    case "plot": return <Plot sh={sh} />;
    case "table": {
      const cw = 150, rh = 36;
      return (
        <g>
          {sh.rows.map((row, r) => row.map((cell, c) => (
            <g key={`${r}-${c}`}>
              <rect x={n1(sh.x + c * cw)} y={n1(sh.y + r * rh)} width={cw} height={rh} fill={r === 0 ? CSS[sh.color] : "none"} fillOpacity={0.12} stroke={CSS[sh.color]} strokeWidth={1.4} />
              <text x={n1(sh.x + c * cw + cw / 2)} y={n1(sh.y + r * rh + 24)} textAnchor="middle" className="board-mono" fontSize={15} fill={CSS[sh.color]} fontWeight={r === 0 ? 700 : 400}>{cell}</text>
            </g>
          )))}
        </g>
      );
    }
  }
}

/** Shapes visible at `upTo`: everything drawn so far, minus whatever a `clear` step wiped. */
export function visibleShapes(steps: Step[], upTo: number): { sh: Shape; step: number }[] {
  let out: { sh: Shape; step: number }[] = [];
  for (let i = 0; i <= Math.min(upTo, steps.length - 1); i++) {
    if (steps[i].clear) out = [];
    steps[i].board.forEach(sh => out.push({ sh, step: i }));
  }
  return out;
}

export const Board = memo(function Board({ steps, upTo, label }: { steps: Step[]; upTo: number; label: string }) {
  const shapes = useMemo(() => visibleShapes(steps, upTo), [steps, upTo]);
  return (
    <svg className="tutor-board" viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {shapes.map(({ sh, step }, i) => (
        <g key={`${step}-${i}`} className={step === upTo ? "tutor-new" : undefined} style={{ "--i": i } as React.CSSProperties}><Draw sh={sh} /></g>
      ))}
    </svg>
  );
});
