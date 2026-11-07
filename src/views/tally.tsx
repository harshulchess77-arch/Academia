/* Academia · Phase 3.12 — grade table, target GPA sliders, required-score arithmetic */
import { Plus, Trash2 } from "lucide-react";
import { useApp, gpaOf, requiredScore, uid, type Course } from "@/engine/store";
import { fmt } from "@/engine/math";
import { PageHeader, Pill, SectionHead } from "@/components/ui";

export function TallyView() {
  const { s, up, toast } = useApp();
  const gpa = gpaOf(s.grades);
  const targetGpa = s.grades.reduce((a, g) => a + g.target / 10 * g.credits, 0) / Math.max(1, s.grades.reduce((a, g) => a + g.credits, 0));

  const setField = (id: string, patch: Partial<Course>) => up(d => { const g = d.grades.find(x => x.id === id); if (g) Object.assign(g, patch); });
  const setAllTargets = (v: number) => up(d => { d.grades.forEach(g => { g.target = Math.min(100, Math.round(v * 10)); }); });

  const remove = (g: Course) => {
    up(d => { d.grades = d.grades.filter(x => x.id !== g.id); });
    toast(`Removed ${g.name}`, "err", { label: "Undo", fn: () => up(d => { d.grades.push(g); }) });
  };

  return (
    <div>
      <PageHeader kicker="arithmetic, not anxiety" title="Tally"
        desc="Weighted grade ledger with a fixed-formula Required Remaining Score: (target − earned·done) ÷ remaining. No curves, no hope."
        right={<Pill tone="cobalt">{s.grades.reduce((a, g) => a + g.credits, 0)} credits</Pill>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="sheet p-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>Current GPA</p>
          <p className="font-display text-4xl font-black" style={{ color: "var(--cobalt-600)" }}>{fmt(gpa, 3)}</p>
          <p className="font-mono text-[11px]" style={{ color: "var(--text-500)" }}>credit-weighted / 10</p>
        </div>
        <div className="sheet p-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>Target GPA</p>
          <p className="font-display text-4xl font-black" style={{ color: "var(--marigold-900)" }}>{fmt(targetGpa, 3)}</p>
          <input type="range" className="range mt-1" min={6} max={10} step={0.1} value={targetGpa}
            aria-label="Target GPA for all courses" onChange={e => setAllTargets(Number(e.target.value))} />
        </div>
        <div className="sheet p-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>Gap to close</p>
          <p className="font-display text-4xl font-black" style={{ color: targetGpa > gpa ? "var(--accent-600)" : "var(--forest-700)" }}>{fmt(Math.max(0, targetGpa - gpa), 3)}</p>
          <p className="font-mono text-[11px]" style={{ color: "var(--text-500)" }}>{targetGpa > gpa ? "still reachable via remaining work" : "on or above target ✓"}</p>
        </div>
      </div>

      <section className="sheet overflow-x-auto">
        <table className="table-dense min-w-[760px]">
          <thead>
            <tr>
              <th>Course</th><th>Credits</th><th>Score so far</th><th>Work done</th><th>Target</th><th>Required remaining</th><th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {s.grades.map(g => {
              const req = requiredScore(g);
              const impossible = req !== null && req > 100;
              const secured = req !== null && req <= 0;
              return (
                <tr key={g.id}>
                  <td className="font-bold">{g.name}</td>
                  <td>
                    <select className="input !min-h-[34px] !w-16 !px-2 !py-1 font-mono !text-xs" value={g.credits} aria-label={`${g.name} credits`} onChange={e => setField(g.id, { credits: Number(e.target.value) })}>
                      {[1, 2, 3, 4, 5].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} max={100} className="input !min-h-[34px] !w-20 !px-2 !py-1 font-mono !text-xs" value={g.score} aria-label={`${g.name} current score`} onChange={e => setField(g.id, { score: Math.max(0, Math.min(100, Number(e.target.value))) })} />
                      <span className="font-mono text-xs">%</span>
                    </div>
                  </td>
                  <td className="min-w-[130px]">
                    <input type="range" className="range" min={0} max={100} step={5} value={g.done} aria-label={`${g.name} percent of coursework done`} onChange={e => setField(g.id, { done: Number(e.target.value) })} />
                    <span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>{g.done}% graded</span>
                  </td>
                  <td className="min-w-[130px]">
                    <input type="range" className="range" min={50} max={100} value={g.target} aria-label={`${g.name} target score`} onChange={e => setField(g.id, { target: Number(e.target.value) })} />
                    <span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>→ {g.target}%</span>
                  </td>
                  <td>
                    {req === null ? <Pill tone="forest">Complete</Pill>
                      : secured ? <Pill tone="forest">Target secured ✓</Pill>
                      : impossible ? <Pill tone="accent">Not reachable (&gt;100%)</Pill>
                      : <span className="pill quota-pill" style={{ background: req > 90 ? "var(--marigold-100)" : "var(--forest-100)", borderColor: req > 90 ? "var(--marigold-900)" : "var(--forest-500)" }}>{fmt(req, 4)}% needed</span>}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${g.name}`} style={{ color: "var(--accent-600)" }} onClick={() => remove(g)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button className="btn" onClick={() => { up(d => { d.grades.push({ id: uid(), name: `Course ${d.grades.length + 1}`, credits: 3, score: 75, done: 40, target: 85 }); }); toast("Course added", "ok"); }}>
          <Plus size={16} /> Add course
        </button>
        <p className="font-mono text-[11px]" style={{ color: "var(--text-500)" }}>required = (target − score × done/100) ÷ (1 − done/100)</p>
      </div>

      <section className="sheet mt-6 p-5">
        <SectionHead title="Reading the ledger" />
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-700)" }}>
          “Required remaining” is the average you must hold across the <em>ungraded</em> portion to finish exactly on target.
          Above 100% the target is arithmetically out of reach — lower the target or accept the ceiling. TallyBud in the Buddy drawer answers these same queries in plain text.
        </p>
      </section>
    </div>
  );
}