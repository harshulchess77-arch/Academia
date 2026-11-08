/* Academia · Phase 3.12 — Tally: Credit-weighted grade ledger,
   multi-tier GPA matrix (AP, Honors, Dual, Standard), and predictive trend forecaster. */

import { Plus, Trash2, TrendingUp } from "lucide-react";
import {
  useApp, gpaOf, requiredScore, weightedGpaOf, forecastMilestones,
  uid, type Course, type CourseWeightTier
} from "@/engine/store";
import { fmt } from "@/engine/math";
import { PageHeader, Pill, SectionHead } from "@/components/ui";

const TIERS: { key: CourseWeightTier; label: string; bump: string }[] = [
  { key: "standard", label: "Standard", bump: "+0.0" },
  { key: "honors", label: "Honors", bump: "+0.5" },
  { key: "ap", label: "AP", bump: "+1.0" },
  { key: "dual", label: "Dual Enrollment", bump: "+1.0" },
];

export function TallyView() {
  const { s, up, toast } = useApp();
  const unweightedGpa = gpaOf(s.grades);
  const matrix = weightedGpaOf(s.grades);
  const targetGpa = s.grades.reduce((a, g) => a + (g.target / 10) * g.credits, 0) / Math.max(1, s.grades.reduce((a, g) => a + g.credits, 0));

  const setField = (id: string, patch: Partial<Course>) => {
    up(d => {
      const g = d.grades.find(x => x.id === id);
      if (g) Object.assign(g, patch);
    });
  };

  const setAllTargets = (v: number) => {
    up(d => {
      d.grades.forEach(g => {
        g.target = Math.min(100, Math.round(v * 10));
      });
    });
  };

  const remove = (g: Course) => {
    up(d => {
      d.grades = d.grades.filter(x => x.id !== g.id);
    });
    toast(`Removed ${g.name}`, "err", { label: "Undo", fn: () => up(d => { d.grades.push(g); }) });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="arithmetic, not anxiety"
        title="Tally GPA Engine"
        desc="Credit-weighted GPA calculation matrix supporting AP, Honors, and Dual Enrollment tier bumps alongside predictive milestone trend forecasting."
        right={
          <div className="flex items-center gap-2">
            <Pill tone="cobalt">{matrix.totalCredits} credits</Pill>
            <Pill tone="forest">Standing: {matrix.letterGpa}</Pill>
          </div>
        }
      />

      {/* GPA CALCULATION MATRIX SUMMARY */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sheet p-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>Unweighted GPA</p>
          <p className="font-display text-4xl font-black" style={{ color: "var(--cobalt-600)" }}>{fmt(unweightedGpa, 3)}</p>
          <p className="font-mono text-[11px]" style={{ color: "var(--text-500)" }}>standard / 10 scale</p>
        </div>
        <div className="sheet p-5 text-center" style={{ borderColor: "var(--cobalt-600)", boxShadow: "3px 3px 0 var(--cobalt-600)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--cobalt-600)" }}>Weighted GPA (Tiered)</p>
          <p className="font-display text-4xl font-black" style={{ color: "var(--cobalt-600)" }}>{fmt(matrix.weighted, 3)}</p>
          <p className="font-mono text-[11px]" style={{ color: "var(--cobalt-600)" }}>AP / Honors / Dual bumps</p>
        </div>
        <div className="sheet p-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>Target Goal</p>
          <p className="font-display text-4xl font-black" style={{ color: "var(--marigold-900)" }}>{fmt(targetGpa, 3)}</p>
          <input
            type="range"
            className="range mt-1"
            min={6}
            max={10}
            step={0.1}
            value={targetGpa}
            aria-label="Target GPA for all courses"
            onChange={e => setAllTargets(Number(e.target.value))}
          />
        </div>
        <div className="sheet p-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>Gap to Target</p>
          <p className="font-display text-4xl font-black" style={{ color: targetGpa > unweightedGpa ? "var(--accent-600)" : "var(--forest-700)" }}>
            {fmt(Math.max(0, targetGpa - unweightedGpa), 3)}
          </p>
          <p className="font-mono text-[11px]" style={{ color: "var(--text-500)" }}>
            {targetGpa > unweightedGpa ? "reachable via remaining work" : "on or above target ✓"}
          </p>
        </div>
      </div>

      {/* INTERACTIVE COURSE MATRIX TABLE */}
      <section className="sheet overflow-x-auto">
        <table className="table-dense min-w-[840px]">
          <thead>
            <tr>
              <th>Course</th>
              <th>Tier Weight</th>
              <th>Credits</th>
              <th>Score so far</th>
              <th>Work done</th>
              <th>Target</th>
              <th>Required remaining</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {s.grades.map(g => {
              const req = requiredScore(g);
              const impossible = req !== null && req > 100;
              const secured = req !== null && req <= 0;
              const currentTier = g.tier ?? "standard";

              return (
                <tr key={g.id}>
                  <td className="font-bold">{g.name}</td>
                  <td>
                    <select
                      className="input !min-h-[34px] !w-32 !px-2 !py-1 font-mono !text-xs"
                      value={currentTier}
                      aria-label={`${g.name} weighting tier`}
                      onChange={e => setField(g.id, { tier: e.target.value as CourseWeightTier })}
                    >
                      {TIERS.map(t => (
                        <option key={t.key} value={t.key}>
                          {t.label} ({t.bump})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="input !min-h-[34px] !w-16 !px-2 !py-1 font-mono !text-xs"
                      value={g.credits}
                      aria-label={`${g.name} credits`}
                      onChange={e => setField(g.id, { credits: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5, 6].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="input !min-h-[34px] !w-20 !px-2 !py-1 font-mono !text-xs"
                        value={g.score}
                        aria-label={`${g.name} current score`}
                        onChange={e => setField(g.id, { score: Math.max(0, Math.min(100, Number(e.target.value))) })}
                      />
                      <span className="font-mono text-xs">%</span>
                    </div>
                  </td>
                  <td className="min-w-[130px]">
                    <input
                      type="range"
                      className="range"
                      min={0}
                      max={100}
                      step={5}
                      value={g.done}
                      aria-label={`${g.name} percent of coursework done`}
                      onChange={e => setField(g.id, { done: Number(e.target.value) })}
                    />
                    <span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>{g.done}% graded</span>
                  </td>
                  <td className="min-w-[130px]">
                    <input
                      type="range"
                      className="range"
                      min={50}
                      max={100}
                      value={g.target}
                      aria-label={`${g.name} target score`}
                      onChange={e => setField(g.id, { target: Number(e.target.value) })}
                    />
                    <span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>→ {g.target}%</span>
                  </td>
                  <td>
                    {req === null ? (
                      <Pill tone="forest">Complete</Pill>
                    ) : secured ? (
                      <Pill tone="forest">Target secured ✓</Pill>
                    ) : impossible ? (
                      <Pill tone="accent">Not reachable (&gt;100%)</Pill>
                    ) : (
                      <span
                        className="pill quota-pill"
                        style={{
                          background: req > 90 ? "var(--marigold-100)" : "var(--forest-100)",
                          borderColor: req > 90 ? "var(--marigold-900)" : "var(--forest-500)",
                        }}
                      >
                        {fmt(req, 4)}% needed
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      aria-label={`Remove ${g.name}`}
                      style={{ color: "var(--accent-600)" }}
                      onClick={() => remove(g)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="btn btn-primary"
          onClick={() => {
            up(d => {
              d.grades.push({
                id: uid(),
                name: `Course ${d.grades.length + 1}`,
                credits: 3,
                score: 80,
                done: 40,
                target: 90,
                tier: "standard",
              });
            });
            toast("Course added to matrix ledger", "ok");
          }}
        >
          <Plus size={16} /> Add Course
        </button>
        <p className="font-mono text-[11px]" style={{ color: "var(--text-500)" }}>
          Required score formula: (target − score × done/100) ÷ (1 − done/100)
        </p>
      </div>

      {/* PREDICTIVE TREND FORECASTER & ASSIGNMENT THRESHOLD ADVICE */}
      <section className="sheet p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} style={{ color: "var(--cobalt-600)" }} />
          <SectionHead title="Predictive Milestone Forecaster" />
        </div>
        <p className="text-xs" style={{ color: "var(--text-500)" }}>
          Real-time trajectory analysis calculating the precise average grade threshold required on future assignments to hit each course's target milestone:
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {s.grades.map(g => {
            const forecast = forecastMilestones(g);
            return (
              <div
                key={g.id}
                className="rounded-xl border-2 p-3 space-y-2"
                style={{
                  borderColor: forecast.status === "impossible"
                    ? "var(--accent-600)"
                    : forecast.status === "critical"
                    ? "var(--marigold-900)"
                    : "var(--background-300)",
                  background: "var(--background-50)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-sm">{g.name}</span>
                  {forecast.status === "secured" || forecast.status === "complete" ? (
                    <Pill tone="forest">Secured</Pill>
                  ) : forecast.status === "impossible" ? (
                    <Pill tone="accent">At Risk</Pill>
                  ) : forecast.status === "critical" ? (
                    <Pill tone="marigold">Critical</Pill>
                  ) : (
                    <Pill tone="cobalt">On Track</Pill>
                  )}
                </div>
                <div className="flex justify-between font-mono text-[11px]" style={{ color: "var(--text-500)" }}>
                  <span>Current: {g.score}%</span>
                  <span>Target: {g.target}%</span>
                </div>
                <div className="gantt-track !h-2">
                  <div
                    className="gantt-bar"
                    style={{
                      width: `${g.done}%`,
                      background: forecast.feasible ? "var(--forest-500)" : "var(--accent-500)",
                    }}
                  />
                </div>
                <p className="text-[11px] leading-snug" style={{ color: "var(--text-700)" }}>
                  {forecast.perAssignmentAdvice}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
