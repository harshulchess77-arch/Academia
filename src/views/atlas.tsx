/* Academia · Phase 3.17 — Knowledge Atlas: prerequisite minimap across modules */
import { useRef, useState } from "react";
import { ArrowRight, Minus, Plus, RotateCcw } from "lucide-react";
import { useApp } from "@/engine/store";
import { navigate } from "@/engine/router";
import { PageHeader, Pill, SectionHead } from "@/components/ui";

interface ANode { id: string; label: string; x: number; y: number; cluster: "Sandbox" | "Numera" | "Library"; to: string; desc: string; pre: string[] }
const NODES: ANode[] = [
  { id: "alg-vars", label: "Variables & types", x: 130, y: 120, cluster: "Sandbox", to: "/sandbox", desc: "let bindings, numbers vs strings — the atom of every acad-vm program.", pre: [] },
  { id: "alg-loops", label: "Loops & invariants", x: 300, y: 80, cluster: "Sandbox", to: "/sandbox", desc: "while loops with provable invariants; the step budget makes non-termination visible.", pre: ["alg-vars"] },
  { id: "alg-funcs", label: "Functions & scope", x: 470, y: 130, cluster: "Sandbox", to: "/sandbox", desc: "Builtin call frames and argument evaluation order.", pre: ["alg-vars"] },
  { id: "alg-big-o", label: "Complexity", x: 620, y: 70, cluster: "Sandbox", to: "/library", desc: "Counting operations, not seconds — connects directly to the op counter in the runner.", pre: ["alg-loops", "math-limits"] },
  { id: "math-linear", label: "Linear systems", x: 220, y: 300, cluster: "Numera", to: "/numera", desc: "Gaussian elimination and RREF — the same solver the Workbench MNA uses.", pre: [] },
  { id: "math-matrix", label: "Matrix algebra", x: 400, y: 340, cluster: "Numera", to: "/numera", desc: "Products, determinants, rank — the language of the nodal conductance matrix.", pre: ["math-linear"] },
  { id: "math-calc", label: "Derivatives", x: 560, y: 290, cluster: "Numera", to: "/numera", desc: "Chain rule patterns; slopes you can see on the graphical plotter.", pre: ["math-limits"] },
  { id: "math-limits", label: "Limits", x: 700, y: 340, cluster: "Numera", to: "/numera", desc: "What 'approaches' means — the gate to both calculus and complexity.", pre: [] },
  { id: "lib-recall", label: "Active recall", x: 160, y: 490, cluster: "Library", to: "/library", desc: "Retrieval practice; SM-2 turns it into a schedule.", pre: [] },
  { id: "lib-sm2", label: "SM-2 scheduling", x: 350, y: 530, cluster: "Library", to: "/library", desc: "Ease factors and intervals — a deterministic function of your ratings.", pre: ["lib-recall"] },
  { id: "lib-notes", label: "Margin notes", x: 550, y: 480, cluster: "Library", to: "/library", desc: "Compressed explanations that feed the recall decks.", pre: ["lib-recall"] },
];
const CLUSTER_COLOR = { Sandbox: "var(--marigold-500)", Numera: "var(--cobalt-500)", Library: "var(--forest-500)" };

export function AtlasView() {
  const { s, up, toast } = useApp();
  const [sel, setSel] = useState<string>("alg-loops");
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const mastered = (n: ANode): boolean => {
    if (n.id === "alg-loops") return s.sandbox.runs >= 10 || s.atlasVisited.includes(n.id);
    if (n.id === "lib-recall") return s.flashcards.some(f => f.reps >= 3) || s.atlasVisited.includes(n.id);
    if (n.id === "math-matrix") return s.atlasVisited.includes(n.id);
    return s.atlasVisited.includes(n.id);
  };
  const stateOf = (n: ANode): "mastered" | "open" | "locked" => {
    if (mastered(n)) return "mastered";
    return n.pre.every(p => mastered(NODES.find(x => x.id === p)!)) ? "open" : "locked";
  };
  const node = NODES.find(n => n.id === sel)!;
  const st = stateOf(node);

  return (
    <div>
      <PageHeader kicker="knowledge has edges" title="Knowledge Atlas"
        desc="A prerequisite minimap across Sandbox, Numera and Library. Locked nodes unlock when their prerequisites are marked mastered — the graph is the syllabus."
        right={<Pill tone="forest">{NODES.filter(mastered).length}/{NODES.length} mastered</Pill>} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="sheet sheet-dotted relative overflow-hidden !p-0">
          <div className="absolute right-3 top-3 z-10 flex gap-1.5">
            <button className="btn btn-icon btn-sm" aria-label="Zoom in" onClick={() => setView(v => ({ ...v, k: Math.min(2.2, v.k * 1.25) }))}><Plus size={14} /></button>
            <button className="btn btn-icon btn-sm" aria-label="Zoom out" onClick={() => setView(v => ({ ...v, k: Math.max(0.55, v.k / 1.25) }))}><Minus size={14} /></button>
            <button className="btn btn-icon btn-sm" aria-label="Reset map view" onClick={() => setView({ x: 0, y: 0, k: 1 })}><RotateCcw size={14} /></button>
          </div>
          <svg viewBox="0 0 800 600" className="block w-full touch-none" style={{ aspectRatio: "4/3", cursor: drag.current ? "grabbing" : "grab" }}
            role="application" aria-label="Knowledge atlas map — drag to pan, click nodes for details"
            onPointerDown={e => { if ((e.target as Element).tagName === "svg" || (e.target as Element).tagName === "rect") { (e.target as Element).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }; } }}
            onPointerMove={e => {
              if (!drag.current) return;
              const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
              drag.current = { x: e.clientX, y: e.clientY };
              setView(v => ({ ...v, x: v.x + dx * 1.4, y: v.y + dy * 1.4 }));
            }}
            onPointerUp={() => { drag.current = null; }}>
            <rect width={800} height={600} fill="transparent" />
            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`} style={{ transformOrigin: "400px 300px" }}>
              {/* cluster hulls */}
              {[{ l: "Sandbox", x: 360, y: 95, rx: 330, ry: 85 }, { l: "Numera", x: 450, y: 315, rx: 320, ry: 80 }, { l: "Library", x: 350, y: 505, rx: 290, ry: 70 }].map(c => (
                <g key={c.l}>
                  <ellipse cx={c.x} cy={c.y} rx={c.rx} ry={c.ry} fill={`color-mix(in srgb, ${CLUSTER_COLOR[c.l as keyof typeof CLUSTER_COLOR]} 7%, transparent)`} stroke={`color-mix(in srgb, ${CLUSTER_COLOR[c.l as keyof typeof CLUSTER_COLOR]} 40%, transparent)`} strokeWidth={1.5} strokeDasharray="8 6" />
                  <text x={c.x - c.rx + 16} y={c.y - c.ry + 22} fontFamily="Caveat" fontSize={22} fill={CLUSTER_COLOR[c.l as keyof typeof CLUSTER_COLOR]}>{c.l}</text>
                </g>
              ))}
              {/* edges */}
              {NODES.flatMap(n => n.pre.map(p => {
                const from = NODES.find(x => x.id === p)!;
                const unlocked = stateOf(n) !== "locked";
                return <line key={`${p}-${n.id}`} x1={from.x} y1={from.y} x2={n.x} y2={n.y}
                  stroke={unlocked ? "var(--text-500)" : "var(--background-400)"} strokeWidth={unlocked ? 2 : 1.5} strokeDasharray={unlocked ? undefined : "5 5"} />;
              }))}
              {/* nodes */}
              {NODES.map(n => {
                const state = stateOf(n);
                const active = sel === n.id;
                return (
                  <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: "pointer" }} onClick={() => setSel(n.id)}
                    role="button" aria-label={`${n.label} — ${state}`}>
                    {active && <circle r={26} fill="none" stroke="var(--accent-500)" strokeWidth={2.5} strokeDasharray="4 4" />}
                    <circle r={18} fill={state === "mastered" ? CLUSTER_COLOR[n.cluster] : state === "open" ? "var(--surface)" : "var(--background-200)"}
                      stroke="var(--text-900)" strokeWidth={2.5} opacity={state === "locked" ? 0.6 : 1} />
                    <text textAnchor="middle" dy={5} fontSize={14} fontWeight={800} fill={state === "mastered" ? "#fff" : "var(--text-900)"}>
                      {state === "mastered" ? "✓" : state === "locked" ? "🔒" : "•"}
                    </text>
                    <text textAnchor="middle" y={36} fontSize={11.5} fontWeight={700} fill="var(--text-900)">{n.label}</text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <aside className="space-y-4">
          <div className="sheet p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: CLUSTER_COLOR[node.cluster] }}>{node.cluster} · {st.toUpperCase()}</p>
            <h2 className="mt-1 font-display text-xl font-black">{node.label}</h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-700)" }}>{node.desc}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-500)" }}>Prerequisites</p>
            {node.pre.length === 0 ? <p className="text-sm" style={{ color: "var(--text-500)" }}>None — a root concept.</p> : (
              <ul className="mt-1 space-y-1">
                {node.pre.map(p => {
                  const pn = NODES.find(x => x.id === p)!;
                  return (
                    <li key={p}>
                      <button className="link-ink text-sm" onClick={() => setSel(p)}>{mastered(pn) ? "✓" : "○"} {pn.label}</button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => navigate(node.to)}>Open {node.cluster} <ArrowRight size={14} /></button>
              {st !== "mastered" && (
                <button className="btn btn-sm" disabled={st === "locked"}
                  onClick={() => { up(d => { d.atlasVisited.push(node.id); }); toast(`“${node.label}” marked mastered`, "ok"); }}>
                  {st === "locked" ? "Locked — finish prerequisites" : "Mark mastered"}
                </button>
              )}
            </div>
          </div>
          <div className="sheet p-4">
            <SectionHead title="Legend" />
            <ul className="space-y-1.5 text-xs font-semibold">
              <li><span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: "var(--forest-500)", border: "2px solid var(--text-900)" }} /> mastered (rule-verified or self-marked)</li>
              <li><span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: "var(--surface)", border: "2px solid var(--text-900)" }} /> open — prerequisites met</li>
              <li><span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: "var(--background-200)", border: "2px solid var(--text-900)" }} /> locked — dashed edges show why</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}