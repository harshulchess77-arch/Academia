/* Academia · Phase 3.14 — Adoro diagnostic report card: gauges, weakness map, rule-linked recommendations */
import { ArrowRight, HeartPulse } from "lucide-react";
import { useApp } from "@/engine/store";
import { navigate } from "@/engine/router";
import { Gauge, PageHeader, Pill, SectionHead } from "@/components/ui";

const NOTE_LINK: Record<string, { note: string; module: string }> = {
  Algebra: { note: "n1", module: "Row reduction, without tears" },
  Calculus: { note: "n2", module: "Chain rule pattern bank" },
  Mechanics: { note: "n3", module: "KCL / KVA loop discipline" },
  Circuits: { note: "n3", module: "KCL / KVA loop discipline" },
  Algorithms: { note: "n4", module: "Binary search invariants" },
  Writing: { note: "n2", module: "Pattern-bank method (adapted)" },
};
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

export function AdoroView() {
  const { s } = useApp();
  const scores = s.adoro;
  const composite = Math.round(scores.reduce((a, x) => a + x.score, 0) / scores.length);
  const sorted = [...scores].sort((a, b) => a.score - b.score);
  const weak = sorted.filter(x => x.score < 70);
  const band = composite >= 80 ? "APPLICATION READY" : composite >= 65 ? "CONSOLIDATING" : "FOUNDATION";

  /* hexagonal weakness map */
  const cx = 170, cy = 150, R = 110;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / scores.length - Math.PI / 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  };
  const poly = scores.map((sc, i) => { const p = pt(i, (sc.score / 100) * R); return `${p.x},${p.y}`; }).join(" ");
  const threshold = scores.map((_, i) => { const p = pt(i, 0.7 * R); return `${p.x},${p.y}`; }).join(" ");

  return (
    <div>
      <PageHeader kicker="diagnosis before drills" title="Adoro report card"
        desc="Fixed-threshold diagnostics: below 70 is a weakness, 65/80 are the readiness bands. Recommendations are rules, and every rule links to a Library note."
        right={<Pill tone={composite >= 80 ? "forest" : composite >= 65 ? "marigold" : "accent"}>{band}</Pill>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="sheet tape flex flex-col items-center p-6">
          <SectionHead title="Composite readiness" />
          <Gauge value={composite} label={band} size={200} color={composite >= 80 ? "var(--forest-500)" : composite >= 65 ? "var(--marigold-500)" : "var(--accent-500)"} />
          <p className="mt-3 text-center font-mono text-[11px]" style={{ color: "var(--text-500)" }}>unweighted mean · {scores.length} diagnostics<br />bands fixed at 65 / 80 — never adaptive</p>
          <div className="mt-4 flex items-center gap-2 font-hand text-xl" style={{ color: "var(--accent-500)" }}>
            <HeartPulse size={18} /> {weak.length} weakness{weak.length === 1 ? "" : "es"} flagged
          </div>
        </section>

        <section className="sheet p-6">
          <SectionHead title="Weakness map" right={<span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>dashed = 70 threshold</span>} />
          <svg viewBox="0 0 340 300" className="mx-auto w-full max-w-[340px]" role="img" aria-label={`Radar of scores: ${scores.map(x => `${x.subject} ${x.score}`).join(", ")}`}>
            {[0.25, 0.5, 0.75, 1].map(f => (
              <polygon key={f} points={scores.map((_, i) => { const p = pt(i, f * R); return `${p.x},${p.y}`; }).join(" ")} fill="none" stroke="var(--background-300)" strokeWidth={1} />
            ))}
            <polygon points={threshold} fill="none" stroke="var(--accent-500)" strokeWidth={1.8} strokeDasharray="5 4" />
            {scores.map((_, i) => { const p = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--background-300)" strokeWidth={1} />; })}
            <polygon points={poly} fill="color-mix(in srgb, var(--cobalt-500) 25%, transparent)" stroke="var(--cobalt-500)" strokeWidth={2.5} strokeLinejoin="round" />
            {scores.map((sc, i) => {
              const p = pt(i, (sc.score / 100) * R);
              const lp = pt(i, R + 26);
              return (
                <g key={sc.subject}>
                  <circle cx={p.x} cy={p.y} r={5} fill={sc.score < 70 ? "var(--accent-500)" : COLORS[i]} stroke="var(--text-900)" strokeWidth={1.5} />
                  <text x={lp.x} y={lp.y} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-900)">{sc.subject}</text>
                  <text x={lp.x} y={lp.y + 13} textAnchor="middle" fontSize={10} fontFamily="IBM Plex Mono" fill={sc.score < 70 ? "var(--accent-600)" : "var(--text-500)"}>{sc.score}</text>
                </g>
              );
            })}
          </svg>
        </section>

        <section className="sheet p-6">
          <SectionHead title="Subject gauges" />
          <div className="grid grid-cols-2 gap-x-2 gap-y-4">
            {scores.map((sc, i) => (
              <Gauge key={sc.subject} value={sc.score} label={sc.subject} size={116} color={sc.score < 70 ? "var(--accent-500)" : COLORS[i]} />
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6">
        <SectionHead title="Rule-generated recommendations" right={<span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>rule set ADORO-REC-v2</span>} />
        <div className="grid gap-4 md:grid-cols-3">
          {sorted.slice(0, 3).map((sc, i) => {
            const link = NOTE_LINK[sc.subject];
            return (
              <article key={sc.subject} className="sheet sheet-lift p-5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: sc.score < 70 ? "var(--accent-600)" : "var(--marigold-900)" }}>
                  {sc.score < 70 ? "RULE R1 · score < 70" : "RULE R2 · lowest remaining"}
                </p>
                <h3 className="mt-1.5 font-display text-lg font-bold">{sc.subject} · {sc.score}/100</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm" style={{ color: "var(--text-700)" }}>
                  <li>One 25-min Pomodoro on the linked note.</li>
                  <li>Rate every due {sc.subject} card honestly.</li>
                  <li>Re-run diagnostics after 3 sessions.</li>
                </ol>
                {link && (
                  <button className="btn btn-sm mt-4 w-full" onClick={() => navigate(`/library?note=${link.note}`)}>
                    Library · {link.module.slice(0, 24)}… <ArrowRight size={14} />
                  </button>
                )}
                <span className="mt-2 block text-center font-mono text-[10px]" style={{ color: "var(--text-300)" }}>priority {i + 1} of 3</span>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}