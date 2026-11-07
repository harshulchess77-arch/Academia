/* Academia · Phase 3.15 — Workbench: MNA circuit solver + logic-gate simulation */
import { useMemo, useState } from "react";
import { Camera, RotateCcw, Trash2, Zap } from "lucide-react";
import { useApp, uid } from "@/engine/store";
import { solveLinear, matZeros, fmt } from "@/engine/math";
import { PageHeader, Pill, SectionHead, Tabs, Toggle } from "@/components/ui";

/* ---------- circuit model ---------- */
type Kind = "wire" | "resistor" | "battery" | "led" | "switch";
interface Comp { id: string; a: number; b: number; kind: Kind; closed: boolean }
const COLS = 5, ROWS = 4, GAP = 100, PAD = 50;
const NODES = COLS * ROWS;
const GROUND = 15;
const nx = (i: number) => PAD + (i % COLS) * GAP;
const ny = (i: number) => PAD + Math.floor(i / COLS) * GAP;
const RES: Record<Kind, number> = { wire: 1e-6, resistor: 1000, led: 330, battery: 0, switch: 1e-6 };
const KIND_LABEL: Record<Kind, string> = { wire: "Wire", resistor: "Resistor 1kΩ", battery: "Battery 5V", led: "LED (330Ω)", switch: "Switch" };

const SEED: Comp[] = [
  { id: "c1", a: 15, b: 10, kind: "battery", closed: true },
  { id: "c2", a: 10, b: 11, kind: "resistor", closed: true },
  { id: "c3", a: 11, b: 12, kind: "led", closed: true },
  { id: "c4", a: 12, b: 17, kind: "wire", closed: true },
  { id: "c5", a: 17, b: 16, kind: "wire", closed: true },
  { id: "c6", a: 16, b: 15, kind: "switch", closed: true },
];

function solveCircuit(comps: Comp[]) {
  const active = comps.filter(c => !(c.kind === "switch" && !c.closed));
  const batteries = active.filter(c => c.kind === "battery");
  const idx = new Map<number, number>();
  let k = 0;
  for (let i = 0; i < NODES; i++) if (i !== GROUND) idx.set(i, k++);
  const n = k + batteries.length;
  const A = matZeros(n, n), b = Array(n).fill(0);
  for (const c of active) {
    if (c.kind === "battery") continue;
    const g = 1 / RES[c.kind];
    const ia = idx.get(c.a), ib = idx.get(c.b);
    if (ia !== undefined) A[ia][ia] += g;
    if (ib !== undefined) A[ib][ib] += g;
    if (ia !== undefined && ib !== undefined) { A[ia][ib] -= g; A[ib][ia] -= g; }
  }
  batteries.forEach((bt, bi) => {
    const row = k + bi;
    const ia = idx.get(bt.b), ib = idx.get(bt.a); // + terminal at b
    if (ia !== undefined) { A[row][ia] = 1; A[ia][row] = 1; }
    if (ib !== undefined) { A[row][ib] = -1; A[ib][row] = -1; }
    b[row] = 5;
  });
  const x = solveLinear(A, b);
  const volts = Array(NODES).fill(0);
  idx.forEach((i, node) => { volts[node] = x[i]; });
  const currents = active.map(c => {
    if (c.kind === "battery") { const bi = batteries.indexOf(c); return { c, i: x[k + bi] }; }
    return { c, i: (volts[c.a] - volts[c.b]) / RES[c.kind] };
  });
  return { volts, currents, size: n };
}

function CircuitBoard() {
  const { toast } = useApp();
  const [comps, setComps] = useState<Comp[]>(SEED);
  const [tool, setTool] = useState<Kind | "erase">("resistor");
  const [pending, setPending] = useState<number | null>(null);
  const [snaps, setSnaps] = useState<{ id: string; label: string; comps: Comp[] }[]>([{ id: "wb-seed", label: "Seed · LED loop", comps: SEED }]);

  const solved = useMemo(() => {
    try { return { ok: true as const, ...solveCircuit(comps) }; }
    catch (e) { return { ok: false as const, err: (e as Error).message }; }
  }, [comps]);

  const clickNode = (i: number) => {
    if (tool === "erase") return;
    if (pending === null) { setPending(i); return; }
    if (pending === i) { setPending(null); return; }
    const adjacent = Math.abs((pending % COLS) - (i % COLS)) + Math.abs(Math.floor(pending / COLS) - Math.floor(i / COLS)) === 1;
    if (!adjacent) { toast("Components span adjacent nodes only", "warn"); setPending(i); return; }
    if (comps.some(c => (c.a === pending && c.b === i) || (c.a === i && c.b === pending))) { toast("That branch already has a component", "warn"); setPending(null); return; }
    setComps(cs => [...cs, { id: uid(), a: pending, b: i, kind: tool as Kind, closed: true }]);
    setPending(null);
  };

  const ledCurrent = solved.ok ? Math.max(0, ...solved.currents.filter(x => x.c.kind === "led").map(x => Math.abs(x.i))) : 0;
  const ledOn = ledCurrent > 0.001;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(Object.keys(KIND_LABEL) as Kind[]).map(kd => (
            <button key={kd} className="pill pill-tab" aria-pressed={tool === kd} onClick={() => { setTool(kd); setPending(null); }}>{KIND_LABEL[kd]}</button>
          ))}
          <button className="pill pill-tab" aria-pressed={tool === "erase"} style={tool === "erase" ? { background: "var(--accent-500)", color: "#fff" } : undefined} onClick={() => { setTool("erase"); setPending(null); }}>
            <Trash2 size={12} /> Erase
          </button>
        </div>
        <div className="sheet sheet-dotted overflow-x-auto !p-0">
          <svg viewBox="0 0 500 400" className="block w-full min-w-[440px]" role="application" aria-label="Circuit canvas — pick a component, click two adjacent nodes">
            {/* components */}
            {comps.map(c => {
              const x1 = nx(c.a), y1 = ny(c.a), x2 = nx(c.b), y2 = ny(c.b);
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
              const horiz = y1 === y2;
              const cur = solved.ok ? solved.currents.find(x => x.c.id === c.id) : undefined;
              const glow = c.kind === "led" && ledOn;
              const stroke = c.kind === "switch" && !c.closed ? "var(--text-300)" : "var(--text-900)";
              return (
                <g key={c.id} style={{ cursor: "pointer" }}
                  onClick={() => {
                    if (tool === "erase") { setComps(cs => cs.filter(x => x.id !== c.id)); return; }
                    if (c.kind === "switch") setComps(cs => cs.map(x => x.id === c.id ? { ...x, closed: !x.closed } : x));
                  }}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={22} />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={2.5} />
                  {c.kind === "resistor" && (
                    <g transform={`translate(${mx},${my}) rotate(${horiz ? 0 : 90})`}>
                      <rect x={-26} y={-9} width={52} height={18} fill="var(--surface)" stroke="var(--text-900)" strokeWidth={2.5} rx={3} />
                      <path d="M-20 0 L-14 -6 L-6 6 L2 -6 L10 6 L16 0" fill="none" stroke="var(--accent-500)" strokeWidth={2} />
                    </g>
                  )}
                  {c.kind === "battery" && (
                    <g transform={`translate(${mx},${my}) rotate(${horiz ? 0 : 90})`}>
                      <rect x={-16} y={-14} width={32} height={28} fill="var(--surface)" stroke="none" />
                      <line x1={-6} y1={-13} x2={-6} y2={13} stroke="var(--text-900)" strokeWidth={3.5} />
                      <line x1={6} y1={-7} x2={6} y2={7} stroke="var(--text-900)" strokeWidth={3.5} />
                      <text x={12} y={-10} fontSize={10} fontFamily="IBM Plex Mono" fill="var(--cobalt-600)">+5V</text>
                    </g>
                  )}
                  {c.kind === "led" && (
                    <g transform={`translate(${mx},${my}) rotate(${horiz ? 0 : 90})`}>
                      {glow && <circle r={20} fill="var(--marigold-500)" opacity={0.45} className="pulse-dot" />}
                      <circle r={11} fill={glow ? "var(--marigold-500)" : "var(--surface)"} stroke="var(--text-900)" strokeWidth={2.5} />
                      <path d="M-5 -5 L5 0 L-5 5 Z" fill="var(--text-900)" />
                    </g>
                  )}
                  {c.kind === "switch" && (
                    <g transform={`translate(${mx},${my}) rotate(${horiz ? 0 : 90})`}>
                      <rect x={-20} y={-12} width={40} height={24} fill="var(--surface)" stroke="none" />
                      <circle cx={-12} cy={0} r={3.5} fill="var(--text-900)" />
                      <circle cx={12} cy={0} r={3.5} fill="var(--text-900)" />
                      <line x1={-12} y1={0} x2={12} y2={c.closed ? 0 : -12} stroke={c.closed ? "var(--forest-500)" : "var(--accent-500)"} strokeWidth={3} strokeLinecap="round" />
                    </g>
                  )}
                  {cur && Math.abs(cur.i) > 1e-4 && c.kind !== "battery" && (
                    <text x={mx + (horiz ? 0 : 14)} y={my + (horiz ? -14 : 4)} fontSize={9.5} fontFamily="IBM Plex Mono" fill="var(--cobalt-600)" textAnchor="middle">
                      {(Math.abs(cur.i) * 1000).toFixed(2)}mA
                    </text>
                  )}
                </g>
              );
            })}
            {/* nodes */}
            {Array.from({ length: NODES }, (_, i) => (
              <g key={i} onClick={() => clickNode(i)} style={{ cursor: tool === "erase" ? "default" : "crosshair" }}>
                <circle cx={nx(i)} cy={ny(i)} r={14} fill="transparent" />
                <circle cx={nx(i)} cy={ny(i)} r={pending === i ? 7 : 4.5}
                  fill={i === GROUND ? "var(--forest-500)" : pending === i ? "var(--marigold-500)" : "var(--surface)"}
                  stroke="var(--text-900)" strokeWidth={2} />
                {solved.ok && Math.abs(solved.volts[i]) > 0.01 && (
                  <text x={nx(i) + 8} y={ny(i) + 16} fontSize={9} fontFamily="IBM Plex Mono" fill="var(--text-500)">{fmt(solved.volts[i], 3)}V</text>
                )}
              </g>
            ))}
            <g transform={`translate(${nx(GROUND)},${ny(GROUND) + 12})`} stroke="var(--forest-700)" strokeWidth={2}>
              <line x1={-9} y1={4} x2={9} y2={4} /><line x1={-5} y1={8} x2={5} y2={8} /><line x1={-1.5} y1={12} x2={1.5} y2={12} />
            </g>
          </svg>
        </div>
        <p className="mt-2 font-mono text-[11px]" style={{ color: "var(--text-500)" }}>
          {pending !== null ? `node ${pending} selected — click an adjacent node` : "pick a component pill, then click two adjacent nodes · click a switch to toggle · erase tool removes"}
        </p>
      </div>

      <div className="space-y-4">
        <div className="sheet p-4">
          <SectionHead title="MNA solver" right={<Zap size={16} style={{ color: ledOn ? "var(--marigold-500)" : "var(--text-300)" }} />} />
          {solved.ok ? (
            <div className="font-mono text-xs leading-relaxed">
              <p className="pill mb-2 !text-[10px]" style={{ background: "var(--forest-100)", borderColor: "var(--forest-500)", color: "var(--forest-700)" }}>converged · {solved.size}×{solved.size} system</p>
              <p>LED current: {(ledCurrent * 1000).toFixed(2)} mA {ledOn ? "→ ON" : "→ off"}</p>
              <p className="mt-1" style={{ color: "var(--text-500)" }}>node voltages:</p>
              {solved.volts.map((v, i) => Math.abs(v) > 0.01 ? <p key={i}>n{i} = {fmt(v, 4)} V</p> : null)}
            </div>
          ) : (
            <p className="rounded-lg border-2 p-3 text-xs font-bold" style={{ borderColor: "var(--accent-600)", background: "var(--accent-100)", color: "var(--accent-600)" }}>⚠ {solved.err}</p>
          )}
        </div>
        <div className="sheet p-4">
          <SectionHead title="Rollback snapshots" />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={() => { setSnaps(sn => [{ id: uid(), label: `Snapshot · ${sn.length + 1}`, comps: comps.map(c => ({ ...c })) }, ...sn]); toast("Circuit snapshot saved", "ok"); }}>
              <Camera size={14} /> Save
            </button>
            <button className="btn btn-warn btn-sm" onClick={() => { const snap = snaps[0]; if (snap) { setComps(snap.comps.map(c => ({ ...c }))); toast(`Instant rollback → ${snap.label}`, "info"); } }}>
              <RotateCcw size={14} /> Instant rollback
            </button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {snaps.map(sn => (
              <li key={sn.id}>
                <button className="w-full rounded-lg border-2 px-3 py-1.5 text-left font-mono text-[11px] hover:bg-[var(--background-200)]" style={{ borderColor: "var(--background-300)" }}
                  onClick={() => { setComps(sn.comps.map(c => ({ ...c }))); toast(`Restored ${sn.label}`, "info"); }}>
                  ⟲ {sn.label} · {sn.comps.length} parts
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------- logic gates ---------- */
const GATES: Record<string, (a: boolean, b: boolean) => boolean> = {
  AND: (a, b) => a && b, OR: (a, b) => a || b, XOR: (a, b) => a !== b, NAND: (a, b) => !(a && b), NOR: (a, b) => !(a || b),
};
function LogicLab() {
  const [inputs, setInputs] = useState({ A: true, B: false, C: true });
  const [g1, setG1] = useState("AND");
  const [g2, setG2] = useState("OR");
  const [invertC, setInvertC] = useState(true);
  const X = GATES[g1](inputs.A, inputs.B);
  const Y = invertC ? !inputs.C : inputs.C;
  const OUT = GATES[g2](X, Y);
  const wire = (on: boolean) => on ? "var(--forest-500)" : "var(--text-300)";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="sheet sheet-dotted !p-0">
        <svg viewBox="0 0 560 300" className="block w-full" role="img" aria-label={`Logic circuit: (${inputs.A ? 1 : 0} ${g1} ${inputs.B ? 1 : 0}) ${g2} ${invertC ? "NOT " : ""}${inputs.C ? 1 : 0} = ${OUT ? 1 : 0}`}>
          {(["A", "B", "C"] as const).map((k, i) => (
            <g key={k} transform={`translate(50, ${60 + i * 90})`} style={{ cursor: "pointer" }} onClick={() => setInputs(v => ({ ...v, [k]: !v[k] }))}>
              <rect x={-24} y={-18} width={48} height={36} rx={9} fill={inputs[k] ? "var(--forest-500)" : "var(--surface)"} stroke="var(--text-900)" strokeWidth={2.5} />
              <text textAnchor="middle" dy={5} fontFamily="Fraunces" fontWeight={800} fontSize={16} fill={inputs[k] ? "#fff" : "var(--text-900)"}>{k}</text>
              <text textAnchor="middle" y={32} fontSize={10} fontFamily="IBM Plex Mono" fill="var(--text-500)">{inputs[k] ? 1 : 0} · click</text>
            </g>
          ))}
          <path d="M74 60 H180 M74 150 H150 V96 H180" fill="none" stroke={wire(inputs.A)} strokeWidth={3} />
          <path d="M150 150 V132 H180" fill="none" stroke={wire(inputs.B)} strokeWidth={3} />
          <path d="M74 240 H260" fill="none" stroke={wire(inputs.C)} strokeWidth={3} />
          {/* gate 1 */}
          <g transform="translate(180, 78)">
            <rect width={90} height={72} rx={12} fill="var(--cobalt-100)" stroke="var(--text-900)" strokeWidth={2.5} />
            <text x={45} y={42} textAnchor="middle" fontFamily="Fraunces" fontWeight={800} fontSize={18} fill="var(--text-900)">{g1}</text>
          </g>
          <path d="M270 114 H360 V132 H390" fill="none" stroke={wire(X)} strokeWidth={3} />
          {/* inverter */}
          {invertC && (
            <g transform="translate(260, 228)">
              <path d="M0 0 L34 12 L0 24 Z" fill="var(--marigold-100)" stroke="var(--text-900)" strokeWidth={2.5} />
              <circle cx={39} cy={12} r={5} fill="var(--surface)" stroke="var(--text-900)" strokeWidth={2.5} />
            </g>
          )}
          <path d={invertC ? "M304 240 H360 V180 H390" : "M300 240 H360 V180 H390"} fill="none" stroke={wire(Y)} strokeWidth={3} />
          {/* gate 2 */}
          <g transform="translate(390, 120)">
            <rect width={90} height={72} rx={12} fill="var(--plum-100)" stroke="var(--text-900)" strokeWidth={2.5} />
            <text x={45} y={42} textAnchor="middle" fontFamily="Fraunces" fontWeight={800} fontSize={18} fill="var(--text-900)">{g2}</text>
          </g>
          <path d="M480 156 H512" stroke={wire(OUT)} strokeWidth={3} />
          <circle cx={528} cy={156} r={15} fill={OUT ? "var(--marigold-500)" : "var(--surface)"} stroke="var(--text-900)" strokeWidth={2.5} className={OUT ? "pulse-dot" : undefined} />
          <text x={528} y={190} textAnchor="middle" fontSize={11} fontFamily="IBM Plex Mono" fontWeight={700} fill="var(--text-900)">OUT {OUT ? 1 : 0}</text>
        </svg>
      </div>
      <div className="space-y-4">
        <div className="sheet p-4">
          <SectionHead title="Gate configuration" />
          <label className="field-label" htmlFor="gate1">Gate 1 · (A, B)</label>
          <select id="gate1" className="input" value={g1} onChange={e => setG1(e.target.value)}>{Object.keys(GATES).map(g => <option key={g}>{g}</option>)}</select>
          <label className="field-label mt-3" htmlFor="gate2">Gate 2 · (X, C)</label>
          <select id="gate2" className="input" value={g2} onChange={e => setG2(e.target.value)}>{Object.keys(GATES).map(g => <option key={g}>{g}</option>)}</select>
          <label className="mt-3 flex items-center justify-between text-sm font-semibold">Invert C (NOT)<Toggle on={invertC} onChange={setInvertC} label="Invert input C" /></label>
        </div>
        <div className="sheet p-4">
          <SectionHead title="Truth table" />
          <table className="w-full font-mono text-[11px]">
            <thead><tr style={{ color: "var(--text-500)" }}><th className="text-left">A B C</th><th>X</th><th>Y</th><th>OUT</th></tr></thead>
            <tbody>
              {[0, 1].flatMap(a => [0, 1].flatMap(b => [0, 1].map(c => {
                const xx = GATES[g1](!!a, !!b), yy = invertC ? !c : !!c, oo = GATES[g2](xx, yy);
                const cur = !!a === inputs.A && !!b === inputs.B && !!c === inputs.C;
                return (
                  <tr key={`${a}${b}${c}`} style={cur ? { background: "var(--marigold-100)", fontWeight: 700 } : undefined}>
                    <td className="py-0.5">{a} {b} {c}{cur ? " ◂" : ""}</td>
                    <td className="text-center">{xx ? 1 : 0}</td><td className="text-center">{yy ? 1 : 0}</td>
                    <td className="text-center" style={{ color: oo ? "var(--forest-700)" : "var(--text-500)" }}>{oo ? 1 : 0}</td>
                  </tr>
                );
              })))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function WorkbenchView() {
  const [tab, setTab] = useState("Circuit schematic");
  return (
    <div>
      <PageHeader kicker=" Kirchhoff would approve" title="Workbench"
        desc="Build resistor networks and solve them with modified nodal analysis, or wire logic gates and read the truth table live."
        right={<Pill tone="cobalt">MNA · Gaussian pivot</Pill>} />
      <Tabs tabs={["Circuit schematic", "Logic gates"]} active={tab} onChange={setTab} className="mb-6" />
      {tab === "Circuit schematic" ? <CircuitBoard /> : <LogicLab />}
    </div>
  );
}