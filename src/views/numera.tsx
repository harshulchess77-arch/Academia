/* Academia · Numera — Deterministic Graphing Engine & Mathematical Workbench.
   Features Desmos-class multi-row expression lists (EQUATION, SLIDER, TABLE, MATRIX, TEXT),
   cross-row variable bindings, off-thread vectorized coordinate sampling,
   human-readable parse trees, and real-time canvas rendering. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Eye, EyeOff, Sliders, Table,
  Layers, FileText, ChevronRight, ChevronDown, RotateCcw,
  ZoomIn, ZoomOut, Sparkles, Binary
} from "lucide-react";
import { PageHeader, Pill } from "@/components/ui";
import {
  parse, evalAst, toRpn, evalRpn, buildParseTree, findRoots, findIntersections,
  fmt, determinant, type ParseTreeNode, type RpnToken
} from "@/engine/math";
import { computeSamplingPoints, type ViewportBounds } from "@/engine/numera-worker";

/* ============================================================================
   TYPE DEFINITIONS & STATE SHAPE
   ============================================================================ */

export type ExpressionKind = "EQUATION" | "SLIDER" | "TABLE" | "MATRIX" | "TEXT";

export interface BaseRow {
  id: string;
  kind: ExpressionKind;
  visible: boolean;
  color: string;
}

export interface EquationRow extends BaseRow {
  kind: "EQUATION";
  latex: string; // e.g. "f(x) = a * x^2" or "y = sin(x)" or "a = 5"
}

export interface SliderRow extends BaseRow {
  kind: "SLIDER";
  varName: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

export interface TableRow extends BaseRow {
  kind: "TABLE";
  nameX: string;
  nameY: string;
  points: { x: number; y: number }[];
}

export interface MatrixRow extends BaseRow {
  kind: "MATRIX";
  name: string;
  rows: number;
  cols: number;
  data: number[][];
}

export interface TextRow extends BaseRow {
  kind: "TEXT";
  body: string;
}

export type ExpressionRow = EquationRow | SliderRow | TableRow | MatrixRow | TextRow;

const PALETTE = [
  "#0B3D91", // Academia Navy
  "#d92d20", // Vermillion
  "#12b76a", // Forest Green
  "#f79009", // Amber Marigold
  "#7a271a", // Deep Ochre
  "#6941c6", // Royal Violet
];

/* ============================================================================
   NUMERA MAIN COMPONENT
   ============================================================================ */

const GW = 1000, GH = 600;

export function NumeraView() {
  // Central Expression List State
  const [rows, setRows] = useState<ExpressionRow[]>([
    {
      id: "row_1",
      kind: "SLIDER",
      varName: "a",
      value: 1.5,
      min: -5,
      max: 5,
      step: 0.1,
      visible: true,
      color: PALETTE[0],
    },
    {
      id: "row_2",
      kind: "EQUATION",
      latex: "f(x) = a * sin(x)",
      visible: true,
      color: PALETTE[0],
    },
    {
      id: "row_3",
      kind: "EQUATION",
      latex: "g(x) = cos(x)",
      visible: true,
      color: PALETTE[1],
    },
    {
      id: "row_4",
      kind: "TABLE",
      nameX: "x1",
      nameY: "y1",
      points: [
        { x: -3, y: 1 },
        { x: -1, y: -1 },
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 3, y: -1 },
      ],
      visible: true,
      color: PALETTE[2],
    },
  ]);

  // Viewport bounds state
  const [view, setView] = useState({ cx: 0, cy: 0, ppu: 65 });
  const [tracePoint, setTracePoint] = useState<{ x: number; y: number } | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string>("row_2");
  const [activeParseTree, setActiveParseTree] = useState<ParseTreeNode | null>(null);

  const cvRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // 1. Resolve Global Variable & Function Bindings Across Rows
  const { scope, functions } = useMemo(() => {
    const sc: Record<string, number> = {};
    const fns: { id: string; name: string; raw: string; rpn: RpnToken[]; color: string }[] = [];

    // Pass 1: Extract slider variables
    for (const r of rows) {
      if (r.kind === "SLIDER") {
        sc[r.varName] = r.value;
      }
    }

    // Pass 2: Extract equations
    for (const r of rows) {
      if (r.kind === "EQUATION") {
        const text = r.latex.trim();
        if (!text) continue;

        // Check if variable assignment: e.g. "k = 10"
        const varMatch = text.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
        if (varMatch && !varMatch[1].includes("(")) {
          const varName = varMatch[1];
          const exprStr = varMatch[2];
          try {
            const ast = parse(exprStr);
            sc[varName] = evalAst(ast, sc);
          } catch {
            // invalid expression
          }
          continue;
        }

        // Check if function definition: e.g. "f(x) = sin(x)" or "y = 2x"
        let funcName = "f";
        let body = text;
        const fnMatch = text.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*x\s*\)\s*=\s*(.+)$/i);
        if (fnMatch) {
          funcName = fnMatch[1];
          body = fnMatch[2];
        } else if (text.startsWith("y=") || text.startsWith("y =")) {
          body = text.split("=")[1];
        }

        try {
          const rpn = toRpn(body);
          if (r.visible) {
            fns.push({ id: r.id, name: funcName, raw: body, rpn, color: r.color });
          }
        } catch {
          // parse error
        }
      }
    }

    return { scope: sc, functions: fns };
  }, [rows]);

  // Compute Viewport sampling bounds
  const viewportBounds = useMemo((): ViewportBounds => {
    const halfW = (GW / 2) / view.ppu;
    const halfH = (GH / 2) / view.ppu;
    return {
      xMin: view.cx - halfW,
      xMax: view.cx + halfW,
      yMin: view.cy - halfH,
      yMax: view.cy + halfH,
      width: GW,
      height: GH,
    };
  }, [view]);

  // 2. Vectorized Evaluation: Compute Sampling Points (2,000 points per expression)
  const evaluatedCurves = useMemo(() => {
    return functions.map(fn => {
      const data = computeSamplingPoints(fn.rpn, viewportBounds, scope);
      return { id: fn.id, name: fn.name, color: fn.color, data, rpn: fn.rpn };
    });
  }, [functions, viewportBounds, scope]);

  // 3. Find Intersections and Roots
  const keyPoints = useMemo(() => {
    const pts: { x: number; y: number; label: string; color: string }[] = [];
    const { xMin, xMax } = viewportBounds;

    // Y-intercepts and Roots
    for (const fn of functions) {
      const evalAt = (x: number) => {
        try { return evalRpn(fn.rpn, { ...scope, x }); } catch { return NaN; }
      };

      // Y-intercept (x = 0)
      if (xMin <= 0 && xMax >= 0) {
        const y0 = evalAt(0);
        if (isFinite(y0)) pts.push({ x: 0, y: y0, label: `${fn.name}(0) = ${fmt(y0, 3)}`, color: fn.color });
      }

      // Roots (f(x) = 0)
      const roots = findRoots(evalAt, xMin, xMax, 150);
      for (const r of roots.slice(0, 8)) {
        pts.push({ x: r, y: 0, label: `Root: (${fmt(r, 3)}, 0)`, color: fn.color });
      }
    }

    // Intersections between pairs of visible functions
    if (functions.length >= 2) {
      for (let i = 0; i < functions.length; i++) {
        for (let j = i + 1; j < functions.length; j++) {
          const f = (x: number) => evalRpn(functions[i].rpn, { ...scope, x });
          const g = (x: number) => evalRpn(functions[j].rpn, { ...scope, x });
          const inters = findIntersections(f, g, xMin, xMax, 150);
          for (const pt of inters.slice(0, 6)) {
            pts.push({
              x: pt.x,
              y: pt.y,
              label: `Cross: (${fmt(pt.x, 3)}, ${fmt(pt.y, 3)})`,
              color: "#f79009",
            });
          }
        }
      }
    }

    return pts;
  }, [functions, viewportBounds, scope]);

  // 4. Canvas Render Loop (60 FPS Locked)
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const { xMin, xMax, yMin, yMax } = viewportBounds;
    const toX = (x: number) => (x - xMin) * (GW / (xMax - xMin));
    const toY = (y: number) => GH - (y - yMin) * (GH / (yMax - yMin));

    // Clear Canvas with Stationery Paper Background
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, GW, GH);

    // Grid System
    const stepChoices = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];
    const step = stepChoices.find(st => st * view.ppu >= 55) ?? 10;
    const subStep = step / 5;

    // Minor Subgrid
    ctx.strokeStyle = "#f0e7d5";
    ctx.lineWidth = 0.75;
    const subX0 = Math.floor(xMin / subStep) * subStep;
    for (let x = subX0; x <= xMax; x += subStep) {
      const px = toX(x);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, GH);
      ctx.stroke();
    }
    const subY0 = Math.floor(yMin / subStep) * subStep;
    for (let y = subY0; y <= yMax; y += subStep) {
      const py = toY(y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(GW, py);
      ctx.stroke();
    }

    // Major Grid Lines & Numbers
    ctx.strokeStyle = "#dbceb5";
    ctx.lineWidth = 1.25;
    ctx.fillStyle = "#5c5040";
    ctx.font = "11px 'IBM Plex Mono', monospace";

    const x0 = Math.floor(xMin / step) * step;
    for (let x = x0; x <= xMax; x += step) {
      const px = toX(x);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, GH);
      ctx.stroke();
      if (Math.abs(x) > step / 4) {
        ctx.fillText(fmt(x, 4), px + 4, Math.min(GH - 6, Math.max(16, toY(0) + 14)));
      }
    }

    const y0 = Math.floor(yMin / step) * step;
    for (let y = y0; y <= yMax; y += step) {
      const py = toY(y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(GW, py);
      ctx.stroke();
      if (Math.abs(y) > step / 4) {
        ctx.fillText(fmt(y, 4), Math.min(GW - 30, Math.max(6, toX(0) + 6)), py - 4);
      }
    }

    // Primary Origin Axes (X & Y)
    ctx.strokeStyle = "#1a1612";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, toY(0));
    ctx.lineTo(GW, toY(0));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX(0), 0);
    ctx.lineTo(toX(0), GH);
    ctx.stroke();

    // Render Evaluated Curves (from 2,000 sampling points Float64Array)
    for (const curve of evaluatedCurves) {
      const data = curve.data;
      const len = data.length / 2;
      ctx.strokeStyle = curve.color;
      ctx.lineWidth = 3;
      ctx.beginPath();

      let inPath = false;
      for (let i = 0; i < len; i++) {
        const px = data[i * 2];
        const py = data[i * 2 + 1];

        if (isNaN(px) || isNaN(py)) {
          inPath = false;
          continue;
        }

        if (!inPath) {
          ctx.moveTo(px, py);
          inPath = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }

    // Render Discrete Tables Points
    for (const r of rows) {
      if (r.kind === "TABLE" && r.visible) {
        for (const pt of r.points) {
          const px = toX(pt.x);
          const py = toY(pt.y);
          if (px >= 0 && px <= GW && py >= 0 && py <= GH) {
            ctx.fillStyle = r.color;
            ctx.strokeStyle = "#1a1612";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#1a1612";
            ctx.font = "bold 11px 'IBM Plex Mono', monospace";
            ctx.fillText(`(${pt.x}, ${pt.y})`, px + 8, py - 6);
          }
        }
      }
    }

    // Render Key Intercepts & Intersections
    for (const kp of keyPoints) {
      const px = toX(kp.x);
      const py = toY(kp.y);
      if (px >= 0 && px <= GW && py >= 0 && py <= GH) {
        ctx.fillStyle = kp.color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Mouse Trace Crosshair
    if (tracePoint) {
      const px = toX(tracePoint.x);
      const py = toY(tracePoint.y);

      ctx.strokeStyle = "rgba(11, 61, 145, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, 0); ctx.lineTo(px, GH);
      ctx.moveTo(0, py); ctx.lineTo(GW, py);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#0B3D91";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Tooltip pill
      const label = `(${fmt(tracePoint.x, 3)}, ${fmt(tracePoint.y, 3)})`;
      ctx.fillStyle = "#1a1612";
      ctx.font = "bold 12px 'IBM Plex Mono', monospace";
      const txtWidth = ctx.measureText(label).width;
      const boxX = Math.min(GW - txtWidth - 20, Math.max(10, px + 12));
      const boxY = Math.max(26, Math.min(GH - 12, py - 12));

      ctx.fillStyle = "rgba(255, 253, 247, 0.95)";
      ctx.strokeStyle = "#1a1612";
      ctx.lineWidth = 1.5;
      ctx.fillRect(boxX - 4, boxY - 14, txtWidth + 12, 20);
      ctx.strokeRect(boxX - 4, boxY - 14, txtWidth + 12, 20);

      ctx.fillStyle = "#0B3D91";
      ctx.fillText(label, boxX + 2, boxY);
    }
  }, [viewportBounds, evaluatedCurves, keyPoints, tracePoint, rows, view.ppu]);

  // Pointer Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const cv = cvRef.current;
      if (!cv) return;
      const r = cv.getBoundingClientRect();
      const k = GW / r.width;
      const dx = (e.clientX - dragRef.current.x) * k;
      const dy = (e.clientY - dragRef.current.y) * k;
      dragRef.current = { x: e.clientX, y: e.clientY };
      setView(v => ({
        ...v,
        cx: v.cx - dx / v.ppu,
        cy: v.cy + dy / v.ppu,
      }));
      setTracePoint(null);
    } else {
      const cv = cvRef.current;
      if (!cv) return;
      const r = cv.getBoundingClientRect();
      const mx = ((e.clientX - r.left) / r.width) * GW;
      const my = ((e.clientY - r.top) / r.height) * GH;

      const { xMin, xMax, yMin, yMax } = viewportBounds;
      const worldX = xMin + mx * ((xMax - xMin) / GW);

      // Snap to closest evaluated curve
      let closestY = yMin + (GH - my) * ((yMax - yMin) / GH);
      if (functions.length > 0) {
        try {
          const fn = functions[0];
          const y = evalRpn(fn.rpn, { ...scope, x: worldX });
          if (isFinite(y)) closestY = y;
        } catch {
          // snap fallback
        }
      }
      setTracePoint({ x: worldX, y: closestY });
    }
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  // Zoom at pointer
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const cv = cvRef.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * GW;
    const my = ((e.clientY - r.top) / r.height) * GH;

    setView(v => {
      const ppu = Math.min(800, Math.max(10, v.ppu * (e.deltaY < 0 ? 1.15 : 0.87)));
      const wx = v.cx + (mx - GW / 2) / v.ppu;
      const wy = v.cy - (my - GH / 2) / v.ppu;
      return { ppu, cx: wx - (mx - GW / 2) / ppu, cy: wy + (my - GH / 2) / ppu };
    });
  }, []);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    cv.addEventListener("wheel", handleWheel, { passive: false });
    return () => cv.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Row Manipulation Helpers
  const addRow = (kind: ExpressionKind) => {
    const id = `row_${Date.now()}`;
    const color = PALETTE[rows.length % PALETTE.length];
    let newRow: ExpressionRow;

    switch (kind) {
      case "EQUATION":
        newRow = { id, kind: "EQUATION", latex: "y = x", visible: true, color };
        break;
      case "SLIDER":
        newRow = { id, kind: "SLIDER", varName: `m_${rows.length}`, value: 1, min: -10, max: 10, step: 0.1, visible: true, color };
        break;
      case "TABLE":
        newRow = { id, kind: "TABLE", nameX: "x", nameY: "y", points: [{ x: 1, y: 2 }, { x: 2, y: 4 }], visible: true, color };
        break;
      case "MATRIX":
        newRow = { id, kind: "MATRIX", name: "A", rows: 2, cols: 2, data: [[1, 0], [0, 1]], visible: true, color };
        break;
      case "TEXT":
        newRow = { id, kind: "TEXT", body: "Observation notes...", visible: true, color };
        break;
    }
    setRows(r => [...r, newRow]);
    setSelectedRowId(id);
  };

  const removeRow = (id: string) => {
    setRows(r => r.filter(x => x.id !== id));
    if (selectedRowId === id) setSelectedRowId("");
  };

  const updateRow = (id: string, patch: Partial<ExpressionRow>) => {
    setRows(r => r.map(x => (x.id === id ? ({ ...x, ...patch } as ExpressionRow) : x)));
  };

  // Inspect Parse Tree for selected equation
  const handleInspectParseTree = (latex: string) => {
    try {
      let body = latex;
      if (latex.includes("=")) body = latex.split("=")[1];
      const tree = buildParseTree(body);
      setActiveParseTree(tree);
    } catch {
      setActiveParseTree(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="The Deterministic Graphing Platform"
        title="Numera Engine"
        desc="Vectorized off-thread plotting evaluated across 2,000 sampling points per curve. Multi-row expression bindings, deterministic Shunting-Yard RPN compilation, and inspectable parse trees."
        right={
          <div className="flex items-center gap-2">
            <Pill tone="cobalt">2,000 pts / curve</Pill>
            <Pill tone="forest">60 FPS Locked</Pill>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        {/* LEFT PANEL: EXPRESSION LIST SHEET */}
        <section className="sheet flex flex-col p-4" style={{ minHeight: "680px" }}>
          {/* Header & Add Menu */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b-2 pb-3" style={{ borderColor: "var(--background-300)" }}>
            <h3 className="font-display text-lg font-bold" style={{ color: "var(--text-900)" }}>
              Expressions ({rows.length})
            </h3>
            <div className="flex flex-wrap gap-1">
              <button className="btn btn-sm" onClick={() => addRow("EQUATION")} title="Add Equation">
                <Plus size={13} /> Equation
              </button>
              <button className="btn btn-sm" onClick={() => addRow("SLIDER")} title="Add Slider">
                <Sliders size={13} /> Slider
              </button>
              <button className="btn btn-sm" onClick={() => addRow("TABLE")} title="Add Table">
                <Table size={13} /> Table
              </button>
              <button className="btn btn-sm" onClick={() => addRow("MATRIX")} title="Add Matrix">
                <Binary size={13} /> Matrix
              </button>
              <button className="btn btn-sm" onClick={() => addRow("TEXT")} title="Add Notes">
                <FileText size={13} /> Text
              </button>
            </div>
          </div>

          {/* Interactive Rows */}
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {rows.map((row, idx) => (
              <div
                key={row.id}
                className="rounded-xl border-2 p-3 transition-shadow"
                style={{
                  borderColor: selectedRowId === row.id ? "var(--cobalt-600)" : "var(--text-900)",
                  background: selectedRowId === row.id ? "var(--background-50)" : "var(--surface)",
                  boxShadow: selectedRowId === row.id ? "3px 3px 0 var(--cobalt-600)" : "2px 2px 0 var(--text-950)",
                }}
                onClick={() => setSelectedRowId(row.id)}
              >
                {/* Row Top Bar */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold" style={{ color: "var(--text-500)" }}>
                      {idx + 1}
                    </span>
                    <button
                      className="btn-icon btn-sm"
                      aria-label="Toggle visibility"
                      style={{ color: row.visible ? row.color : "var(--text-400)" }}
                      onClick={e => {
                        e.stopPropagation();
                        updateRow(row.id, { visible: !row.visible });
                      }}
                    >
                      {row.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <span
                      className="h-3 w-3 rounded-full border border-black"
                      style={{ backgroundColor: row.color }}
                      title="Expression color"
                    />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-500)" }}>
                      {row.kind}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {row.kind === "EQUATION" && (
                      <button
                        className="btn btn-ghost btn-sm !px-1.5 font-mono text-[11px]"
                        title="View deterministic algebraic parse tree"
                        onClick={e => {
                          e.stopPropagation();
                          handleInspectParseTree(row.latex);
                        }}
                      >
                        <Layers size={13} /> Tree
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: "var(--accent-600)" }}
                      aria-label="Delete expression"
                      onClick={e => {
                        e.stopPropagation();
                        removeRow(row.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Variant Row Content */}
                {row.kind === "EQUATION" && (
                  <div>
                    <input
                      className="input font-mono !text-base"
                      value={row.latex}
                      onChange={e => updateRow(row.id, { latex: e.target.value })}
                      placeholder="e.g. f(x) = a * x^2 or y = sin(x)"
                      spellCheck={false}
                    />
                  </div>
                )}

                {row.kind === "SLIDER" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-base font-bold" style={{ color: "var(--cobalt-600)" }}>
                        {row.varName} = {row.value}
                      </span>
                      <div className="flex items-center gap-1 font-mono text-xs text-[var(--text-500)]">
                        <span>[{row.min}, {row.max}]</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      className="range w-full"
                      min={row.min}
                      max={row.max}
                      step={row.step}
                      value={row.value}
                      onChange={e => updateRow(row.id, { value: parseFloat(e.target.value) })}
                    />
                    <div className="flex gap-2 text-[10px] font-mono">
                      <label className="flex items-center gap-1">
                        min:
                        <input
                          type="number"
                          className="input !h-6 !w-14 !px-1 !text-[11px]"
                          value={row.min}
                          onChange={e => updateRow(row.id, { min: Number(e.target.value) })}
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        max:
                        <input
                          type="number"
                          className="input !h-6 !w-14 !px-1 !text-[11px]"
                          value={row.max}
                          onChange={e => updateRow(row.id, { max: Number(e.target.value) })}
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        step:
                        <input
                          type="number"
                          className="input !h-6 !w-14 !px-1 !text-[11px]"
                          value={row.step}
                          onChange={e => updateRow(row.id, { step: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {row.kind === "TABLE" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="font-bold">{row.nameX}</span>
                      <span>·</span>
                      <span className="font-bold">{row.nameY}</span>
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-lg border border-[var(--background-300)] p-1">
                      <table className="w-full text-center font-mono text-xs">
                        <thead>
                          <tr className="border-b border-[var(--background-300)]">
                            <th className="py-1">x</th>
                            <th className="py-1">y</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {row.points.map((pt, pIdx) => (
                            <tr key={pIdx}>
                              <td className="p-1">
                                <input
                                  type="number"
                                  className="input !h-6 !w-16 !px-1 text-center !text-xs"
                                  value={pt.x}
                                  onChange={e => {
                                    const nextPts = [...row.points];
                                    nextPts[pIdx] = { ...pt, x: Number(e.target.value) };
                                    updateRow(row.id, { points: nextPts });
                                  }}
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="number"
                                  className="input !h-6 !w-16 !px-1 text-center !text-xs"
                                  value={pt.y}
                                  onChange={e => {
                                    const nextPts = [...row.points];
                                    nextPts[pIdx] = { ...pt, y: Number(e.target.value) };
                                    updateRow(row.id, { points: nextPts });
                                  }}
                                />
                              </td>
                              <td>
                                <button
                                  className="btn-ghost !p-0.5 text-[var(--accent-600)]"
                                  onClick={() => {
                                    const nextPts = row.points.filter((_, i) => i !== pIdx);
                                    updateRow(row.id, { points: nextPts });
                                  }}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      className="btn btn-sm !w-full !py-1 text-xs"
                      onClick={() => updateRow(row.id, { points: [...row.points, { x: 0, y: 0 }] })}
                    >
                      + Add Point
                    </button>
                  </div>
                )}

                {row.kind === "MATRIX" && (
                  <div className="space-y-2">
                    <p className="font-mono text-xs font-bold">{row.name} ({row.rows}×{row.cols})</p>
                    <div
                      className="inline-grid gap-1 rounded-lg border border-[var(--text-900)] p-2"
                      style={{ gridTemplateColumns: `repeat(${row.cols}, 48px)` }}
                    >
                      {row.data.map((rLine, rI) =>
                        rLine.map((val, cI) => (
                          <input
                            key={`${rI}-${cI}`}
                            type="number"
                            className="input !h-7 !px-0.5 text-center font-mono !text-xs"
                            value={val}
                            onChange={e => {
                              const next = row.data.map(ln => [...ln]);
                              next[rI][cI] = Number(e.target.value);
                              updateRow(row.id, { data: next });
                            }}
                          />
                        ))
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--text-500)]">
                      det: {row.rows === row.cols ? fmt(determinant(row.data), 4) : "—"}
                    </div>
                  </div>
                )}

                {row.kind === "TEXT" && (
                  <div>
                    <textarea
                      className="input min-h-[60px] font-sans text-xs"
                      value={row.body}
                      onChange={e => updateRow(row.id, { body: e.target.value })}
                      placeholder="Student notes, problem statement or theorem reference..."
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bound Scope Inspector */}
          <div className="mt-4 rounded-xl border-2 p-3 font-mono text-xs" style={{ borderColor: "var(--text-900)", background: "var(--background-50)" }}>
            <span className="font-bold uppercase tracking-wider text-[var(--text-500)] text-[10px]">Active Bindings</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(scope).map(([k, v]) => (
                <span key={k} className="pill pill-tab !text-[11px]">
                  {k} = {fmt(v, 4)}
                </span>
              ))}
              {Object.keys(scope).length === 0 && <span className="text-[var(--text-400)]">No variables defined</span>}
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: INTERACTIVE CANVAS VIEWPORT & CONTROLS */}
        <section className="space-y-4">
          <div className="sheet relative overflow-hidden !p-0">
            {/* Viewport Floating Controls */}
            <div className="absolute right-4 top-4 z-10 flex flex-col gap-1.5 rounded-xl border-2 p-1.5 shadow-md" style={{ borderColor: "var(--text-900)", background: "var(--surface)" }}>
              <button
                className="btn btn-icon btn-sm"
                aria-label="Zoom in"
                onClick={() => setView(v => ({ ...v, ppu: Math.min(800, v.ppu * 1.25) }))}
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
              <button
                className="btn btn-icon btn-sm"
                aria-label="Zoom out"
                onClick={() => setView(v => ({ ...v, ppu: Math.max(10, v.ppu / 1.25) }))}
                title="Zoom out"
              >
                <ZoomOut size={16} />
              </button>
              <button
                className="btn btn-icon btn-sm"
                aria-label="Reset viewport"
                onClick={() => setView({ cx: 0, cy: 0, ppu: 65 })}
                title="Center on origin (0, 0)"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            {/* Viewport Canvas */}
            <canvas
              ref={cvRef}
              width={GW}
              height={GH}
              className="block w-full touch-none"
              style={{ aspectRatio: `${GW}/${GH}`, cursor: dragRef.current ? "grabbing" : "crosshair" }}
              aria-label="Numera Graphing Canvas — Drag to pan, scroll to zoom, hover to trace"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={() => {
                dragRef.current = null;
                setTracePoint(null);
              }}
            />
          </div>

          {/* Viewport Status & Key Intercept Indicators */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono" style={{ color: "var(--text-500)" }}>
            <div className="flex items-center gap-3">
              <span>Center: ({fmt(view.cx, 3)}, {fmt(view.cy, 3)})</span>
              <span>Scale: {fmt(view.ppu, 2)} px/unit</span>
              <span>2,000 pts / stream</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[var(--text-900)]">Key Intercepts:</span>
              {keyPoints.slice(0, 4).map((kp, idx) => (
                <span key={idx} className="pill pill-tab !text-[11px]" style={{ color: kp.color }}>
                  {kp.label}
                </span>
              ))}
            </div>
          </div>

          {/* PARSE TREE DRAWER (IF ACTIVE) */}
          {activeParseTree && (
            <div className="sheet p-4" style={{ animation: "popIn .2s var(--ease-snap)" }}>
              <div className="mb-3 flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--background-300)" }}>
                <div className="flex items-center gap-2">
                  <Sparkles size={16} style={{ color: "var(--cobalt-600)" }} />
                  <h4 className="font-display text-base font-bold">Deterministic Parse Tree</h4>
                </div>
                <button className="btn btn-sm" onClick={() => setActiveParseTree(null)}>Close Tree</button>
              </div>
              <p className="mb-3 text-xs" style={{ color: "var(--text-500)" }}>
                Step-by-step algebraic evaluation hierarchy parsed via the Shunting-Yard algorithm into Reverse Polish Notation:
              </p>
              <div className="max-h-60 overflow-y-auto rounded-lg border-2 p-3 font-mono text-xs leading-relaxed" style={{ borderColor: "var(--background-300)", background: "var(--text-950)", color: "#d6f5d6" }}>
                <ParseTreeViewer node={activeParseTree} depth={0} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ParseTreeViewer({ node, depth }: { node: ParseTreeNode; depth: number }) {
  const [open, setOpen] = useState(true);
  const pad = "  ".repeat(depth);

  return (
    <div className="my-0.5">
      <div className="flex items-center gap-1 cursor-pointer hover:underline" onClick={() => setOpen(!open)}>
        {node.children && node.children.length > 0 ? (
          open ? <ChevronDown size={12} /> : <ChevronRight size={12} />
        ) : (
          <span className="inline-block w-3" />
        )}
        <span style={{ color: node.type === "operator" ? "#f79009" : node.type === "function" ? "#53b1fd" : "#75e0a7" }}>
          {pad}▸ [{node.type}] {node.label}
        </span>
        <span className="text-[10px] opacity-60">— {node.explanation}</span>
      </div>
      {open && node.children && (
        <div className="pl-2">
          {node.children.map(child => (
            <ParseTreeViewer key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
