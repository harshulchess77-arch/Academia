/* Academia · Phase 3.11 — Numera: Scientific / Graphical / Matrix / Geometry / 3D */
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { PageHeader, Pill, SectionHead, Tabs, Toggle } from "@/components/ui";
import { parse, evalAst, astLines, fmt, matAdd, matMul, determinant, rref, type Mat } from "@/engine/math";
import { useApp } from "@/engine/store";

/* ================= SCIENTIFIC ================= */
function Scientific() {
  const [expr, setExpr] = useState("sin(pi/6) + 2^10 / 8");
  const [ans, setAns] = useState(0);
  const [hist, setHist] = useState<string[]>([]);
  const parsed = useMemo(() => { try { return { ast: parse(expr), err: null as string | null }; } catch (e) { return { ast: null, err: (e as Error).message }; } }, [expr]);
  const value = useMemo(() => { if (!parsed.ast) return null; try { return evalAst(parsed.ast, { ans }); } catch (e) { return `⚠ ${(e as Error).message}`; } }, [parsed, ans]);
  const KEYS = [["7", "8", "9", "/"], ["4", "5", "6", "*"], ["1", "2", "3", "-"], ["0", ".", "(", ")"], ["^", "%", "+", "="]];
  const FKEYS = ["sin(", "cos(", "tan(", "sqrt(", "ln(", "log(", "pi", "e", "ans"];

  const press = (k: string) => {
    if (k === "=") {
      if (typeof value === "number") { setAns(value); setHist(h => [`${expr} = ${fmt(value)}`, ...h].slice(0, 5)); }
      return;
    }
    setExpr(x => x + k);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="sheet p-5">
        <label className="field-label" htmlFor="sci-expr">Expression</label>
        <input id="sci-expr" className="input font-mono !text-base" value={expr} onChange={e => setExpr(e.target.value)} spellCheck={false} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FKEYS.map(k => <button key={k} className="pill pill-tab font-mono !text-[11px]" onClick={() => setExpr(x => x + k)}>{k}</button>)}
          <button className="pill pill-tab !text-[11px]" onClick={() => setExpr("")}>clear</button>
          <button className="pill pill-tab !text-[11px]" onClick={() => setExpr(x => x.slice(0, -1))}>⌫</button>
        </div>
        <div className="mt-4 grid max-w-xs grid-cols-4 gap-2">
          {KEYS.flat().map(k => (
            <button key={k} className={`btn font-mono !text-lg ${k === "=" ? "btn-primary" : ""}`} onClick={() => press(k)} aria-label={k === "=" ? "Evaluate" : `Insert ${k}`}>{k}</button>
          ))}
        </div>
        <div className="mt-5 rounded-xl border-2 p-4" style={{ borderColor: "var(--text-900)", background: "var(--background-50)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>Live result</p>
          <p className="font-mono text-3xl font-semibold">{value === null ? "—" : typeof value === "number" ? fmt(value, 10) : <span className="text-base" style={{ color: "var(--accent-600)" }}>{value}</span>}</p>
          <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--text-500)" }}>ans = {fmt(ans)}</p>
        </div>
        {hist.length > 0 && (
          <ul className="mt-4 space-y-1 font-mono text-xs" style={{ color: "var(--text-500)" }}>
            {hist.map((h, i) => <li key={i}>▸ {h}</li>)}
          </ul>
        )}
      </section>
      <section className="sheet p-5">
        <SectionHead title="AST parsing preview" right={<Pill tone={parsed.err ? "accent" : "forest"}>{parsed.err ? "parse error" : "valid tree"}</Pill>} />
        {parsed.err
          ? <p className="rounded-lg border-2 p-3 font-mono text-xs" style={{ borderColor: "var(--accent-600)", color: "var(--accent-600)", background: "var(--accent-100)" }}>{parsed.err}</p>
          : <pre className="overflow-x-auto rounded-lg border-2 p-4 font-mono text-[12px] leading-relaxed" style={{ borderColor: "var(--background-300)", background: "var(--text-950)", color: "#d6f5d6" }}>{astLines(parsed.ast!).join("\n")}</pre>}
        <p className="mt-3 text-xs" style={{ color: "var(--text-500)" }}>Precedence: ^ &gt; * / % &gt; + − · ^ is right-associative · the working is the answer.</p>
      </section>
    </div>
  );
}

/* ================= GRAPHICAL ================= */
const GW = 1000, GH = 540;
function Graphical() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [fsrc, setFsrc] = useState("sin(x) * x / 2");
  const [gsrc, setGsrc] = useState("cos(x)");
  const [showG, setShowG] = useState(true);
  const [view, setView] = useState({ cx: 0, cy: 0, ppu: 70 });
  const [trace, setTrace] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const f = useMemo(() => { try { const a = parse(fsrc); return (x: number) => evalAst(a, { x }); } catch { return null; } }, [fsrc]);
  const g = useMemo(() => { try { const a = parse(gsrc); return (x: number) => evalAst(a, { x }); } catch { return null; } }, [gsrc]);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const mx = ((e.clientX - r.left) / r.width) * GW, my = ((e.clientY - r.top) / r.height) * GH;
      setView(v => {
        const ppu = Math.min(600, Math.max(8, v.ppu * (e.deltaY < 0 ? 1.15 : 0.87)));
        const wx = v.cx + (mx - GW / 2) / v.ppu, wy = v.cy - (my - GH / 2) / v.ppu;
        return { ppu, cx: wx - (mx - GW / 2) / ppu, cy: wy + (my - GH / 2) / ppu };
      });
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--text-900").trim() || "#241c14";
    const dot = css.getPropertyValue("--background-300").trim() || "#d5c7a8";
    const paper = css.getPropertyValue("--surface").trim() || "#fffdf6";
    ctx.fillStyle = paper; ctx.fillRect(0, 0, GW, GH);
    const toX = (x: number) => GW / 2 + (x - view.cx) * view.ppu;
    const toY = (y: number) => GH / 2 - (y - view.cy) * view.ppu;
    const stepChoices = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
    const step = stepChoices.find(st => st * view.ppu >= 60) ?? 100;
    ctx.strokeStyle = dot; ctx.lineWidth = 1; ctx.fillStyle = ink; ctx.font = "11px IBM Plex Mono";
    const x0 = Math.floor((view.cx - GW / 2 / view.ppu) / step) * step;
    for (let x = x0; toX(x) < GW; x += step) {
      ctx.beginPath(); ctx.moveTo(toX(x), 0); ctx.lineTo(toX(x), GH); ctx.stroke();
      if (Math.abs(x) > step / 2) ctx.fillText(fmt(x, 4), toX(x) + 3, toY(0) + 14);
    }
    const y0 = Math.floor((view.cy - GH / 2 / view.ppu) / step) * step;
    for (let y = y0; toY(y) > 0; y += step) {
      ctx.beginPath(); ctx.moveTo(0, toY(y)); ctx.lineTo(GW, toY(y)); ctx.stroke();
      if (Math.abs(y) > step / 2) ctx.fillText(fmt(y, 4), toX(0) + 5, toY(y) - 4);
    }
    ctx.strokeStyle = ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, toY(0)); ctx.lineTo(GW, toY(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), GH); ctx.stroke();
    const plot = (fn: ((x: number) => number) | null, color: string) => {
      if (!fn) return;
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath();
      let pen = false;
      for (let px = 0; px <= GW; px += 2) {
        const x = view.cx + (px - GW / 2) / view.ppu;
        let y: number;
        try { y = fn(x); } catch { pen = false; continue; }
        if (!isFinite(y)) { pen = false; continue; }
        const py = toY(y);
        if (py < -2000 || py > GH + 2000) { pen = false; continue; }
        if (!pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };
    plot(g && showG ? g : null, "#d92d20");
    plot(f, "#2742d6");
    if (trace !== null && f) {
      try {
        const y = f(trace);
        if (isFinite(y)) {
          ctx.fillStyle = "#2742d6"; ctx.strokeStyle = ink; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(toX(trace), toY(y), 6, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = ink; ctx.font = "bold 13px IBM Plex Mono";
          ctx.fillText(`(${fmt(trace, 4)}, ${fmt(y, 4)})`, Math.min(GW - 170, toX(trace) + 12), Math.max(20, toY(y) - 12));
        }
      } catch { /* outside domain */ }
    }
  }, [f, g, showG, view, trace]);

  const toWorld = (e: React.PointerEvent) => {
    const r = cvRef.current!.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * GW, my = ((e.clientY - r.top) / r.height) * GH;
    return { mx, my, x: view.cx + (mx - GW / 2) / view.ppu };
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="field-label" htmlFor="gfx-f">f(x) — cobalt</label>
          <input id="gfx-f" className="input font-mono" value={fsrc} onChange={e => setFsrc(e.target.value)} />
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="field-label" htmlFor="gfx-g">g(x) — vermillion</label>
          <input id="gfx-g" className="input font-mono" value={gsrc} onChange={e => setGsrc(e.target.value)} disabled={!showG} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-xs font-bold">g(x)<Toggle on={showG} onChange={setShowG} label="Show second function" /></label>
        <div className="flex gap-1.5 pb-1">
          <button className="btn btn-icon btn-sm" aria-label="Zoom in" onClick={() => setView(v => ({ ...v, ppu: Math.min(600, v.ppu * 1.3) }))}><Plus size={15} /></button>
          <button className="btn btn-icon btn-sm" aria-label="Zoom out" onClick={() => setView(v => ({ ...v, ppu: Math.max(8, v.ppu / 1.3) }))}><Minus size={15} /></button>
          <button className="btn btn-icon btn-sm" aria-label="Reset view" onClick={() => setView({ cx: 0, cy: 0, ppu: 70 })}><RotateCcw size={15} /></button>
        </div>
      </div>
      {(!f || (showG && !g)) && <p className="mb-3 font-mono text-xs font-bold" style={{ color: "var(--accent-600)" }}>⚠ one expression failed to parse — its curve is omitted</p>}
      <div className="sheet overflow-hidden !p-0">
        <canvas ref={cvRef} width={GW} height={GH} className="block w-full touch-none" style={{ aspectRatio: "1000/540", cursor: drag.current ? "grabbing" : "crosshair" }}
          aria-label="Function plotter — drag to pan, scroll to zoom, hover to trace"
          onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }; }}
          onPointerMove={e => {
            if (drag.current) {
              const r = cvRef.current!.getBoundingClientRect();
              const k = GW / r.width;
              const dx = (e.clientX - drag.current.x) * k, dy = (e.clientY - drag.current.y) * k;
              drag.current = { x: e.clientX, y: e.clientY };
              setView(v => ({ ...v, cx: v.cx - dx / v.ppu, cy: v.cy + dy / v.ppu }));
              setTrace(null);
            } else setTrace(toWorld(e).x);
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerLeave={() => { drag.current = null; setTrace(null); }}
        />
      </div>
      <p className="mt-2 font-mono text-[11px]" style={{ color: "var(--text-500)" }}>drag = pan · wheel = zoom at cursor · hover = trace f(x) · scale {fmt(view.ppu, 3)} px/unit</p>
    </div>
  );
}

/* ================= MATRIX ================= */
function MatrixMode() {
  const { toast } = useApp();
  const [n, setN] = useState(3);
  const defaults = (d: number[][]) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => String(d[i % d.length][j % d[0].length])));
  const [A, setA] = useState<string[][]>(defaults([[2, 1, 1], [4, 3, 3], [8, 7, 9]]));
  const [B, setB] = useState<string[][]>(defaults([[1, 0, 2], [0, 1, 0], [3, 0, 1]]));
  const [out, setOut] = useState<{ m?: Mat; det?: number; steps?: string[]; label: string } | null>(null);

  const resize = (k: number) => {
    const size = Math.min(4, Math.max(2, k));
    const fix = (m: string[][]) => Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => m[i]?.[j] ?? (i === j ? "1" : "0")));
    setN(size); setA(fix(A)); setB(fix(B)); setOut(null);
  };
  const num = (m: string[][]): Mat => m.map(r => r.map(v => { const x = parseFloat(v); if (isNaN(x)) throw new Error(`"${v || "∅"}" is not a number`); return x; }));
  const run = (op: string) => {
    try {
      const a = num(A), b = num(B);
      if (op === "A + B") setOut({ m: matAdd(a, b), label: "A + B" });
      else if (op === "A × B") setOut({ m: matMul(a, b), label: "A × B" });
      else if (op === "det A") setOut({ det: determinant(a), label: "det(A)" });
      else { const r = rref(a); setOut({ m: r.m, steps: r.steps, label: "RREF(A)" }); }
    } catch (e) { toast((e as Error).message, "err"); }
  };

  const grid = (label: string, m: string[][], set: (v: string[][]) => void, color: string) => (
    <div>
      <p className="mb-2 font-display text-lg font-bold" style={{ color }}>{label}</p>
      <div className="inline-grid gap-1.5 rounded-xl border-2 p-3" style={{ gridTemplateColumns: `repeat(${n}, 64px)`, borderColor: "var(--text-900)", background: "var(--surface)", boxShadow: "3px 3px 0 var(--text-950)" }}>
        {m.map((row, i) => row.map((v, j) => (
          <input key={`${i}-${j}`} className="input !min-h-[40px] !px-1 text-center font-mono !text-sm" aria-label={`${label} row ${i + 1} column ${j + 1}`} value={v}
            onChange={e => { const c = m.map(r => [...r]); c[i][j] = e.target.value; set(c); }} />
        )))}
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-500)" }}>Dimension</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-icon btn-sm" aria-label="Fewer rows and columns" onClick={() => resize(n - 1)}><Minus size={14} /></button>
          <span className="font-mono text-lg font-semibold">{n}×{n}</span>
          <button className="btn btn-icon btn-sm" aria-label="More rows and columns" onClick={() => resize(n + 1)}><Plus size={14} /></button>
        </div>
        {["A + B", "A × B", "det A", "RREF A"].map(op => <button key={op} className="btn btn-sm" onClick={() => run(op)}>{op}</button>)}
      </div>
      <div className="flex flex-wrap gap-8">
        {grid("A", A, setA, "var(--cobalt-600)")}
        {grid("B", B, setB, "var(--accent-600)")}
        <div className="min-w-[220px] flex-1">
          <p className="mb-2 font-display text-lg font-bold">{out ? out.label : "Result"}</p>
          {!out && <p className="rounded-xl border-2 border-dashed p-6 text-sm" style={{ borderColor: "var(--text-300)", color: "var(--text-500)" }}>Pick an operation — every step is shown, nothing is rounded away silently.</p>}
          {out?.det !== undefined && <p className="sheet inline-block px-6 py-4 font-mono text-3xl font-semibold">{fmt(out.det, 8)}</p>}
          {out?.m && (
            <div className="inline-grid gap-1.5 rounded-xl border-2 p-3" style={{ gridTemplateColumns: `repeat(${out.m[0].length}, minmax(56px,auto))`, borderColor: "var(--forest-500)", background: "var(--forest-100)", boxShadow: "3px 3px 0 var(--text-950)" }}>
              {out.m.flatMap((row, i) => row.map((v, j) => <span key={`${i}-${j}`} className="px-1 py-2 text-center font-mono text-sm font-semibold">{fmt(v, 5)}</span>))}
            </div>
          )}
          {out?.steps && (
            <ol className="mt-3 max-h-44 space-y-1 overflow-y-auto font-mono text-[11px]" style={{ color: "var(--text-500)" }}>
              {out.steps.length === 0 ? <li>already in RREF — 0 row operations</li> : out.steps.map((st, i) => <li key={i}>{i + 1}. {st}</li>)}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= GEOMETRY ================= */
function Geometry() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pts, setPts] = useState([{ x: 150, y: 290 }, { x: 450, y: 310 }, { x: 300, y: 90 }]);
  const [dragI, setDragI] = useState<number | null>(null);
  const [circum, setCircum] = useState(true);
  const [circleA, setCircleA] = useState(true);
  const [snap, setSnap] = useState(false);

  const [A, B, C] = pts;
  const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
  const angle = (at: { x: number; y: number }, p: { x: number; y: number }, q: { x: number; y: number }) => {
    const v1 = { x: p.x - at.x, y: p.y - at.y }, v2 = { x: q.x - at.x, y: q.y - at.y };
    const cos = (v1.x * v2.x + v1.y * v2.y) / ((Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)) || 1);
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  };
  const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
  const ok = Math.abs(d) > 1e-6;
  const ux = ok ? ((A.x ** 2 + A.y ** 2) * (B.y - C.y) + (B.x ** 2 + B.y ** 2) * (C.y - A.y) + (C.x ** 2 + C.y ** 2) * (A.y - B.y)) / d : 0;
  const uy = ok ? ((A.x ** 2 + A.y ** 2) * (C.x - B.x) + (B.x ** 2 + B.y ** 2) * (A.x - C.x) + (C.x ** 2 + C.y ** 2) * (B.x - A.x)) / d : 0;
  const R = ok ? dist({ x: ux, y: uy }, A) : 0;
  const rA = dist(A, B);
  /* circle–circle intersections: circumcircle (u,R) with circle (A, rA) */
  const d0 = dist({ x: ux, y: uy }, A);
  const inters: { x: number; y: number }[] = [];
  if (ok && d0 > 1e-6 && d0 < R + rA && d0 > Math.abs(R - rA)) {
    const a = (R * R - rA * rA + d0 * d0) / (2 * d0);
    const h = Math.sqrt(Math.max(0, R * R - a * a));
    const px = ux + (a * (A.x - ux)) / d0, py = uy + (a * (A.y - uy)) / d0;
    inters.push({ x: px + (h * (A.y - uy)) / d0, y: py - (h * (A.x - ux)) / d0 });
    inters.push({ x: px - (h * (A.y - uy)) / d0, y: py + (h * (A.x - ux)) / d0 });
  }
  const angles = [angle(A, B, C), angle(B, A, C), angle(C, A, B)];

  const movePt = (e: React.PointerEvent) => {
    if (dragI === null) return;
    const r = svgRef.current!.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width) * 600, y = ((e.clientY - r.top) / r.height) * 400;
    if (snap) { x = Math.round(x / 20) * 20; y = Math.round(y / 20) * 20; }
    x = Math.max(14, Math.min(586, x)); y = Math.max(14, Math.min(386, y));
    setPts(p => p.map((q, i) => (i === dragI ? { x, y } : q)));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="sheet sheet-dotted overflow-hidden !p-0">
        <svg ref={svgRef} viewBox="0 0 600 400" className="block w-full touch-none" style={{ aspectRatio: "3/2" }}
          role="application" aria-label="Geometry constraint canvas — drag vertices A, B, C"
          onPointerMove={movePt} onPointerUp={() => setDragI(null)} onPointerLeave={() => setDragI(null)}>
          {circum && ok && <circle cx={ux} cy={uy} r={R} fill="none" stroke="var(--cobalt-500)" strokeWidth={2} strokeDasharray="7 5" />}
          {circleA && <circle cx={A.x} cy={A.y} r={rA} fill="none" stroke="var(--accent-500)" strokeWidth={2} strokeDasharray="3 5" />}
          <polygon points={pts.map(p => `${p.x},${p.y}`).join(" ")} fill="color-mix(in srgb, var(--marigold-500) 18%, transparent)" stroke="var(--text-900)" strokeWidth={2.5} strokeLinejoin="round" />
          {inters.map((p, i) => (
            <g key={i}>
              <path d={`M${p.x - 7} ${p.y - 7} L${p.x + 7} ${p.y + 7} M${p.x - 7} ${p.y + 7} L${p.x + 7} ${p.y - 7}`} stroke="var(--plum-500)" strokeWidth={3} strokeLinecap="round" />
              <text x={p.x + 10} y={p.y - 8} fontSize={11} fontFamily="IBM Plex Mono" fill="var(--plum-500)">P{i + 1} ({Math.round(p.x)},{Math.round(p.y)})</text>
            </g>
          ))}
          {ok && circum && <circle cx={ux} cy={uy} r={4} fill="var(--cobalt-500)" stroke="var(--text-900)" strokeWidth={1.5} />}
          {pts.map((p, i) => (
            <g key={i} style={{ cursor: "grab" }} onPointerDown={e => { (e.target as Element).setPointerCapture(e.pointerId); setDragI(i); }}>
              <circle cx={p.x} cy={p.y} r={16} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={9} fill={["var(--marigold-500)", "var(--forest-500)", "var(--chart-7)"][i]} stroke="var(--text-900)" strokeWidth={2.5} />
              <text x={p.x + 13} y={p.y - 12} fontFamily="Fraunces" fontWeight={800} fontSize={17} fill="var(--text-900)">{["A", "B", "C"][i]}</text>
              <text x={p.x + 13} y={p.y + 5} fontSize={11} fontFamily="IBM Plex Mono" fill="var(--text-500)">{angles[i].toFixed(1)}°</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="space-y-4">
        <div className="sheet p-4">
          <SectionHead title="Constraints" />
          {[{ l: "Circumcircle", v: circum, set: setCircum }, { l: "Circle A · radius |AB|", v: circleA, set: setCircleA }, { l: "Snap to 20px grid", v: snap, set: setSnap }].map(t => (
            <label key={t.l} className="mb-2.5 flex items-center justify-between gap-3 text-sm font-semibold">{t.l}<Toggle on={t.v} onChange={t.set} label={t.l} /></label>
          ))}
        </div>
        <div className="sheet p-4 font-mono text-xs leading-relaxed">
          <p className="mb-2 font-body text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>Live readout</p>
          <p>∠A {angles[0].toFixed(2)}° · ∠B {angles[1].toFixed(2)}° · ∠C {angles[2].toFixed(2)}°</p>
          <p>Σ = {angles.reduce((a, b) => a + b, 0).toFixed(2)}° {ok ? "✓" : "⚠ collinear"}</p>
          <p className="mt-1">|AB| {rA.toFixed(1)} · R {R.toFixed(1)}</p>
          <p>intersections: {inters.length}</p>
          {!ok && <p style={{ color: "var(--accent-600)" }}>points collinear — circumcircle undefined</p>}
        </div>
      </div>
    </div>
  );
}

/* ================= 3D ================= */
const SURFACES: Record<string, (x: number, y: number) => number> = {
  "ripple · sin(r)": (x, y) => Math.sin(Math.sqrt(x * x + y * y) * 2.2) * 0.8,
  "saddle · x²−y²": (x, y) => (x * x - y * y) * 0.35,
  "gaussian peak": (x, y) => 1.6 * Math.exp(-(x * x + y * y) * 0.8),
};
const DW = 1000, DH = 600;
function lerpColor(t: number): string {
  const stops = [[39, 66, 214], [237, 163, 18], [217, 45, 32]];
  const tt = Math.max(0, Math.min(0.999, t)) * 2;
  const i = Math.floor(tt), f = tt - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function ThreeD() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [surf, setSurf] = useState("ripple · sin(r)");
  const [rot, setRot] = useState({ yaw: 0.7, pitch: 0.55 });
  const [dist, setDist] = useState(6);
  const [zScale, setZScale] = useState(1);
  const [res, setRes] = useState(30);
  const [wire, setWire] = useState(false);
  const [auto, setAuto] = useState(true);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!auto) return;
    let raf = 0;
    const loop = () => { setRot(r => ({ ...r, yaw: r.yaw + 0.005 })); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [auto]);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setDist(v => Math.min(12, Math.max(3.2, v * (e.deltaY > 0 ? 1.1 : 0.9)))); };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    ctx.fillStyle = css.getPropertyValue("--surface").trim() || "#fffdf6";
    ctx.fillRect(0, 0, DW, DH);
    const fn = SURFACES[surf];
    const cy = Math.cos(rot.yaw), sy = Math.sin(rot.yaw), cp = Math.cos(rot.pitch), sp = Math.sin(rot.pitch);
    const R = 2.1, scale = 110;
    const project = (x: number, y: number, zRaw: number) => {
      const z = zRaw * zScale;
      const x1 = x * cy - y * sy, y1 = x * sy + y * cy;
      const y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp;
      const depth = z2 + dist;
      const persp = dist / Math.max(1.2, depth);
      return { sx: DW / 2 + x1 * scale * persp, sy: DH / 2 + 30 - y2 * scale * persp, depth, x1, y2, z2 };
    };
    interface Quad { pts: { sx: number; sy: number }[]; depth: number; color: string; light: number }
    const quads: Quad[] = [];
    const step = (R * 2) / res;
    for (let i = 0; i < res; i++) for (let j = 0; j < res; j++) {
      const x = -R + i * step, y = -R + j * step;
      const corners = [[x, y], [x + step, y], [x + step, y + step], [x, y + step]];
      const zs = corners.map(([a, b]) => fn(a, b));
      const pr = corners.map(([a, b], k) => project(a, b, zs[k]));
      const depth = pr.reduce((a, p) => a + p.depth, 0) / 4;
      const ux1 = pr[1].x1 - pr[0].x1, uy1 = pr[1].y2 - pr[0].y2, uz1 = pr[1].z2 - pr[0].z2;
      const vx1 = pr[3].x1 - pr[0].x1, vy1 = pr[3].y2 - pr[0].y2, vz1 = pr[3].z2 - pr[0].z2;
      const nx = uy1 * vz1 - uz1 * vy1, ny = uz1 * vx1 - ux1 * vz1, nz = ux1 * vy1 - uy1 * vx1;
      const nl = Math.hypot(nx, ny, nz) || 1;
      const light = Math.max(0, (nx * -0.35 + ny * 0.55 + nz * -0.75) / nl);
      const hAvg = zs.reduce((a, b) => a + b, 0) / 4;
      quads.push({ pts: pr.map(p => ({ sx: p.sx, sy: p.sy })), depth, color: lerpColor((hAvg + 1) / 2.6), light: 0.4 + 0.6 * light });
    }
    quads.sort((a, b) => b.depth - a.depth); // painter's z-order
    for (const q of quads) {
      ctx.beginPath();
      ctx.moveTo(q.pts[0].sx, q.pts[0].sy);
      for (let k = 1; k < 4; k++) ctx.lineTo(q.pts[k].sx, q.pts[k].sy);
      ctx.closePath();
      if (!wire) {
        ctx.fillStyle = q.color;
        ctx.globalAlpha = q.light;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = wire ? q.color : "rgba(23,17,11,.28)";
      ctx.lineWidth = wire ? 1.4 : 0.7;
      ctx.stroke();
    }
    ctx.fillStyle = css.getPropertyValue("--text-500").trim();
    ctx.font = "12px IBM Plex Mono";
    ctx.fillText(`yaw ${(rot.yaw % (Math.PI * 2)).toFixed(2)} · pitch ${rot.pitch.toFixed(2)} · cam ${dist.toFixed(1)} · z×${zScale.toFixed(1)} · ${res}² cells`, 16, DH - 16);
  }, [surf, rot, dist, zScale, res, wire]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_270px]">
      <div className="sheet overflow-hidden !p-0">
        <canvas ref={cvRef} width={DW} height={DH} className="block w-full touch-none" style={{ aspectRatio: "5/3", cursor: "grab" }}
          aria-label="3D surface — drag to orbit, scroll to zoom"
          onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }; setAuto(false); }}
          onPointerMove={e => {
            if (!drag.current) return;
            const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
            drag.current = { x: e.clientX, y: e.clientY };
            setRot(r => ({ yaw: r.yaw + dx * 0.008, pitch: Math.max(0.08, Math.min(1.45, r.pitch + dy * 0.006)) }));
          }}
          onPointerUp={() => { drag.current = null; }}
        />
      </div>
      <div className="space-y-4">
        <div className="sheet p-4">
          <label className="field-label" htmlFor="surf">Surface</label>
          <select id="surf" className="input" value={surf} onChange={e => setSurf(e.target.value)}>
            {Object.keys(SURFACES).map(k => <option key={k}>{k}</option>)}
          </select>
          <label className="field-label mt-4" htmlFor="zdepth">z-buffer depth scale · {zScale.toFixed(1)}×</label>
          <input id="zdepth" type="range" className="range" min={0.2} max={2.5} step={0.1} value={zScale} onChange={e => setZScale(Number(e.target.value))} />
          <label className="field-label mt-3" htmlFor="camdist">Camera distance · {dist.toFixed(1)}</label>
          <input id="camdist" type="range" className="range" min={3.2} max={12} step={0.1} value={dist} onChange={e => setDist(Number(e.target.value))} />
          <label className="field-label mt-3" htmlFor="meshres">Mesh resolution</label>
          <select id="meshres" className="input" value={res} onChange={e => setRes(Number(e.target.value))}>
            <option value={20}>20² · fast</option><option value={30}>30² · balanced</option><option value={44}>44² · fine</option>
          </select>
          <label className="mt-4 flex items-center justify-between text-sm font-semibold">Wireframe<Toggle on={wire} onChange={setWire} label="Wireframe" /></label>
          <label className="mt-2.5 flex items-center justify-between text-sm font-semibold">Auto-orbit<Toggle on={auto} onChange={setAuto} label="Auto orbit" /></label>
        </div>
        <p className="px-1 font-mono text-[11px]" style={{ color: "var(--text-500)" }}>painter-sorted quads · fixed key light · drag pauses auto-orbit</p>
      </div>
    </div>
  );
}

/* ================= SHELL ================= */
export function NumeraView() {
  const [tab, setTab] = useState("Scientific");
  return (
    <div>
      <PageHeader kicker="the working is the answer" title="Numera Math Engine"
        desc="Five deterministic modes over one shared parser — every result can be traced to an expression tree, a row operation or a solved system."
        right={<Pill tone="cobalt">shared AST core</Pill>} />
      <Tabs tabs={["Scientific", "Graphical", "Matrix", "Geometry", "3D"]} active={tab} onChange={setTab} className="mb-6" />
      {tab === "Scientific" && <Scientific />}
      {tab === "Graphical" && <Graphical />}
      {tab === "Matrix" && <MatrixMode />}
      {tab === "Geometry" && <Geometry />}
      {tab === "3D" && <ThreeD />}
    </div>
  );
}