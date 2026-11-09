/* Academia · Phase 3.14 — Adoro diagnostic report card: gauges, weakness map, rule-linked recommendations.
   Dynamically binds weakness nodes directly to user notes in local state with zero hardcoded mock shortcuts. */
import { useState } from "react";
import { ArrowRight, HeartPulse, Plus } from "lucide-react";
import { useApp } from "@/engine/store";
import { navigate } from "@/engine/router";
import { t } from "@/engine/i18n";
import { Gauge, PageHeader, Pill, SectionHead } from "@/components/ui";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

export function AdoroView() {
  const { s, up, toast } = useApp();
  const scores = s.adoro;
  const [showAdd, setShowAdd] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newScore, setNewScore] = useState("75");

  const composite = scores.length > 0
    ? Math.round(scores.reduce((a, x) => a + x.score, 0) / scores.length)
    : 0;
  const sorted = [...scores].sort((a, b) => a.score - b.score);
  const weak = sorted.filter(x => x.score < 70);
  const band = scores.length === 0
    ? t("adoro.bands.notEvaluated")
    : composite >= 80
      ? t("adoro.bands.applicationReady")
      : composite >= 65
        ? t("adoro.bands.consolidating")
        : t("adoro.bands.foundation");

  /* hexagonal / dynamic radar weakness map */
  const cx = 170, cy = 150, R = 110;
  const pt = (i: number, r: number) => {
    const total = Math.max(3, scores.length);
    const a = (Math.PI * 2 * i) / total - Math.PI / 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  };
  const poly = scores.map((sc, i) => { const p = pt(i, (sc.score / 100) * R); return `${p.x},${p.y}`; }).join(" ");
  const threshold = scores.map((_, i) => { const p = pt(i, 0.7 * R); return `${p.x},${p.y}`; }).join(" ");

  const handleAddDiagnostic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    const scoreVal = Math.max(0, Math.min(100, parseInt(newScore, 10) || 0));
    up(d => {
      const existing = d.adoro.find(x => x.subject.toLowerCase() === newSubject.trim().toLowerCase());
      if (existing) {
        existing.score = scoreVal;
      } else {
        d.adoro.push({ subject: newSubject.trim(), score: scoreVal });
      }
    });
    toast(`Diagnostic updated: ${newSubject} (${scoreVal}/100)`, "ok");
    setNewSubject("");
    setShowAdd(false);
  };

  return (
    <div>
      <PageHeader
        kicker={t("adoro.kicker")}
        title={t("adoro.title")}
        desc={t("adoro.subtitle")}
        right={
          <div className="flex items-center gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
              <Plus size={15} /> Log diagnostic
            </button>
            <Pill tone={scores.length === 0 ? "neutral" : composite >= 80 ? "forest" : composite >= 65 ? "marigold" : "accent"}>
              {band}
            </Pill>
          </div>
        }
      />

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="sheet max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h2 className="font-display text-xl font-bold">Log Diagnostic Assessment</h2>
            <form onSubmit={handleAddDiagnostic} className="space-y-3">
              <div>
                <label className="field-label" htmlFor="diag-subject">Subject / Domain</label>
                <input id="diag-subject" className="input" placeholder="e.g. Linear Algebra, Mechanics, Writing" value={newSubject} onChange={e => setNewSubject(e.target.value)} required />
              </div>
              <div>
                <label className="field-label" htmlFor="diag-score">Score (0–100)</label>
                <input id="diag-score" type="number" min="0" max="100" className="input" value={newScore} onChange={e => setNewScore(e.target.value)} required />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Diagnostic</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scores.length === 0 ? (
        <div className="sheet p-10 text-center space-y-4">
          <HeartPulse size={36} className="mx-auto" style={{ color: "var(--accent-500)" }} />
          <h2 className="font-display text-xl font-black">No Diagnostic Assessments Recorded</h2>
          <p className="max-w-md mx-auto text-sm" style={{ color: "var(--text-500)" }}>
            {t("adoro.noDiagnostics")}
          </p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Log first diagnostic
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="sheet tape flex flex-col items-center p-6">
              <SectionHead title={t("adoro.compositeReadiness")} />
              <Gauge value={composite} label={band} size={200} color={composite >= 80 ? "var(--forest-500)" : composite >= 65 ? "var(--marigold-500)" : "var(--accent-500)"} />
              <p className="mt-3 text-center font-mono text-[11px]" style={{ color: "var(--text-500)" }}>unweighted mean · {scores.length} diagnostics<br />bands fixed at 65 / 80 — never adaptive</p>
              <div className="mt-4 flex items-center gap-2 font-hand text-xl" style={{ color: "var(--accent-500)" }}>
                <HeartPulse size={18} /> {weak.length} weakness{weak.length === 1 ? "" : "es"} flagged
              </div>
            </section>

            <section className="sheet p-6">
              <SectionHead title={t("adoro.weaknessMap")} right={<span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>dashed = 70 threshold</span>} />
              <svg viewBox="0 0 340 300" className="mx-auto w-full max-w-[340px]" role="img" aria-label={`Radar of scores: ${scores.map(x => `${x.subject} ${x.score}`).join(", ")}`}>
                {[0.25, 0.5, 0.75, 1].map(f => (
                  <polygon key={f} points={scores.map((_, i) => { const p = pt(i, f * R); return `${p.x},${p.y}`; }).join(" ")} fill="none" stroke="var(--background-300)" strokeWidth={1} />
                ))}
                {scores.length >= 3 && <polygon points={threshold} fill="none" stroke="var(--accent-500)" strokeWidth={1.8} strokeDasharray="5 4" />}
                {scores.map((_, i) => { const p = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--background-300)" strokeWidth={1} />; })}
                {scores.length >= 3 && <polygon points={poly} fill="color-mix(in srgb, var(--cobalt-500) 25%, transparent)" stroke="var(--cobalt-500)" strokeWidth={2.5} strokeLinejoin="round" />}
                {scores.map((sc, i) => {
                  const p = pt(i, (sc.score / 100) * R);
                  const lp = pt(i, R + 26);
                  return (
                    <g key={sc.subject}>
                      <circle cx={p.x} cy={p.y} r={5} fill={sc.score < 70 ? "var(--accent-500)" : COLORS[i % COLORS.length]} stroke="var(--text-900)" strokeWidth={1.5} />
                      <text x={lp.x} y={lp.y} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-900)">{sc.subject}</text>
                      <text x={lp.x} y={lp.y + 13} textAnchor="middle" fontSize={10} fontFamily="IBM Plex Mono" fill={sc.score < 70 ? "var(--accent-600)" : "var(--text-500)"}>{sc.score}</text>
                    </g>
                  );
                })}
              </svg>
            </section>

            <section className="sheet p-6">
              <SectionHead title={t("adoro.subjectGauges")} />
              <div className="grid grid-cols-2 gap-x-2 gap-y-4">
                {scores.map((sc, i) => (
                  <Gauge key={sc.subject} value={sc.score} label={sc.subject} size={116} color={sc.score < 70 ? "var(--accent-500)" : COLORS[i % COLORS.length]} />
                ))}
              </div>
            </section>
          </div>

          <section className="mt-6">
            <SectionHead title={t("adoro.recommendations")} right={<span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>rule set ADORO-REC-v2</span>} />
            <div className="grid gap-4 md:grid-cols-3">
              {sorted.slice(0, 3).map(sc => {
                const matchedNote = s.notes.find(n =>
                  n.subject.toLowerCase() === sc.subject.toLowerCase() ||
                  n.title.toLowerCase().includes(sc.subject.toLowerCase())
                );
                return (
                  <article key={sc.subject} className="sheet sheet-lift p-5">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: sc.score < 70 ? "var(--accent-600)" : "var(--marigold-900)" }}>
                      {sc.score < 70 ? "RULE R1 · score < 70" : "RULE R2 · lowest remaining"}
                    </p>
                    <h3 className="mt-1.5 font-display text-lg font-bold">{sc.subject} · {sc.score}/100</h3>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm" style={{ color: "var(--text-700)" }}>
                      <li>One 25-min Pomodoro on {matchedNote ? matchedNote.title : `${sc.subject} study notes`}.</li>
                      <li>Rate every due {sc.subject} card honestly in SM-2.</li>
                      <li>Re-run diagnostics after 3 sessions.</li>
                    </ol>
                    <button className="btn btn-sm mt-4 w-full" onClick={() => navigate(matchedNote ? `/library?note=${matchedNote.id}` : "/library")}>
                      {matchedNote ? `Open Note: ${matchedNote.title}` : `Open Library (${sc.subject})`} <ArrowRight size={14} />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
