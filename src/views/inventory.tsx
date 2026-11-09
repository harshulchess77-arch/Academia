/* Academia · Phase 3.9 — opportunity inventory + admissions milestone predictor.
   Dynamically binds opportunity tracking and milestone calibration to user records without static mock locks. */
import { useState } from "react";
import { Bookmark, BookmarkCheck, CalendarDays, Flag, Plus, Trash2 } from "lucide-react";
import { useApp, daysUntil, fmtDate, gpaOf, uid, type Opportunity, type Tier } from "@/engine/store";
import { navigate } from "@/engine/router";
import { Gauge, GanttRow, PageHeader, Pill, SectionHead, Tabs, TierPill } from "@/components/ui";

const TARGETS: Record<string, { gpa: number; test: number; research: number; service: number; label: string }> = {
  "Top-tier research (global)": { gpa: 9.2, test: 97, research: 2, service: 80, label: "global top-20" },
  "National flagship": { gpa: 8.6, test: 92, research: 1, service: 50, label: "national top-10" },
  "Strong state university": { gpa: 7.8, test: 85, research: 1, service: 30, label: "state top-25" },
};

export function InventoryView() {
  const { s, up, toast } = useApp();
  const [filter, setFilter] = useState("All");
  const [target, setTarget] = useState("Top-tier research (global)");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newKind, setNewKind] = useState("Contest");
  const [newTier, setNewTier] = useState<Tier>("A");
  const [newDays, setNewDays] = useState("30");

  const t = TARGETS[target] ?? TARGETS["Top-tier research (global)"];

  const list = [...s.inventory].sort((a, b) => a.deadline - b.deadline)
    .filter(o => filter === "All" || (filter === "Tracked" ? o.tracked : o.kind === filter));
  const kinds = ["All", "Tracked", ...Array.from(new Set(s.inventory.map(o => o.kind)))];

  const gpa = gpaOf(s.grades);
  const test = s.adoro.length > 0
    ? Math.round(s.adoro.reduce((a, x) => a + x.score, 0) / s.adoro.length)
    : 0;
  const research = s.proposals.filter(p => p.status !== "Draft").length;
  const service = s.resume.activities.length * 20;

  const benchmarks = [
    { label: `GPA ≥ ${t.gpa}`, pct: t.gpa > 0 ? (gpa / t.gpa) * 100 : 0, color: "var(--chart-1)", actual: gpa > 0 ? gpa.toFixed(2) : "0.00", gap: gpa < t.gpa, to: "/tally" },
    { label: `Test percentile ≥ ${t.test}`, pct: t.test > 0 ? (test / t.test) * 100 : 0, color: "var(--chart-2)", actual: test > 0 ? `${test}th` : "Not sat", gap: test < t.test, to: "/adoro" },
    { label: `Research outputs ≥ ${t.research}`, pct: t.research > 0 ? (research / t.research) * 100 : 0, color: "var(--chart-3)", actual: String(research), gap: research < t.research, to: "/portfolio" },
    { label: `Service hours ≥ ${t.service}`, pct: t.service > 0 ? (service / t.service) * 100 : 0, color: "var(--chart-4)", actual: `${service}h`, gap: service < t.service, to: "/portfolio" },
  ];
  const readiness = Math.round(benchmarks.reduce((a, b) => a + Math.min(100, b.pct), 0) / benchmarks.length);

  const nearestDeadline = s.inventory.length > 0 ? daysUntil(s.inventory[0].deadline) : null;
  const milestones = [
    { label: "Foundations locked", when: "Grade 11 · done", done: true },
    { label: "First opportunity cycle", when: nearestDeadline !== null ? `in ${nearestDeadline}d` : "Set in inventory", done: false, active: true },
    { label: "Research proposal accepted", when: "Grade 11 summer", done: research >= t.research },
    { label: "Test sittings complete", when: "Grade 12 · Aug", done: test >= t.test },
    { label: "Applications submitted", when: "Grade 12 · Nov", done: false },
  ];

  const handleAddOpportunity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newOrg.trim()) return;

    const days = Math.max(1, parseInt(newDays, 10) || 30);
    const item: Opportunity = {
      id: uid(),
      title: newTitle.trim(),
      org: newOrg.trim(),
      deadline: Date.now() + days * 86400000,
      tier: newTier,
      kind: newKind.trim(),
      tracked: true,
    };

    up(d => {
      d.inventory.push(item);
    });

    toast(`Tracked new opportunity: ${item.title}`, "ok");
    setNewTitle("");
    setNewOrg("");
    setShowAddModal(false);
  };

  const removeOpportunity = (id: string) => {
    up(d => {
      d.inventory = d.inventory.filter(x => x.id !== id);
    });
    toast("Opportunity removed from inventory", "info");
  };

  return (
    <div>
      <PageHeader kicker="deadlines are load-bearing" title="Inventory"
        desc="Every opportunity you track feeds the milestone predictor — a fixed benchmark ladder calibrated to your target admit profile."
        right={
          <div className="flex items-center gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              <Plus size={15} /> Add opportunity
            </button>
            <Pill tone="cobalt">{s.inventory.filter(o => o.tracked).length} tracked</Pill>
          </div>
        } />

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="sheet max-w-md w-full p-6 space-y-4 shadow-xl">
            <h2 className="font-display text-xl font-bold">Add Tracked Opportunity</h2>
            <form onSubmit={handleAddOpportunity} className="space-y-3">
              <div>
                <label className="field-label" htmlFor="op-title">Title</label>
                <input id="op-title" className="input" placeholder="e.g. Olympiad, Fellowship, Summer Program" value={newTitle} onChange={e => setNewTitle(e.target.value)} required />
              </div>
              <div>
                <label className="field-label" htmlFor="op-org">Host / Institution</label>
                <input id="op-org" className="input" placeholder="e.g. University, Institute, Foundation" value={newOrg} onChange={e => setNewOrg(e.target.value)} required />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="field-label" htmlFor="op-kind">Type</label>
                  <select id="op-kind" className="input" value={newKind} onChange={e => setNewKind(e.target.value)}>
                    <option value="Contest">Contest</option>
                    <option value="Olympiad">Olympiad</option>
                    <option value="Fellowship">Fellowship</option>
                    <option value="Program">Program</option>
                    <option value="Grant">Grant</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="op-tier">Tier</label>
                  <select id="op-tier" className="input" value={newTier} onChange={e => setNewTier(e.target.value as Tier)}>
                    <option value="A">Tier A</option>
                    <option value="B">Tier B</option>
                    <option value="C">Tier C</option>
                    <option value="D">Tier D</option>
                    <option value="E">Tier E</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="op-days">Days until</label>
                  <input id="op-days" type="number" min="1" max="365" className="input" value={newDays} onChange={e => setNewDays(e.target.value)} required />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save to Ladder</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        {/* opportunities */}
        <section>
          <Tabs tabs={kinds} active={filter} onChange={setFilter} className="mb-4" />
          {list.length === 0 ? (
            <div className="sheet p-8 text-center space-y-3">
              <CalendarDays size={32} className="mx-auto" style={{ color: "var(--text-400)" }} />
              <p className="font-display text-lg font-bold">No opportunities tracked yet</p>
              <p className="text-sm" style={{ color: "var(--text-500)" }}>
                Start tracking academic competitions, summer programs, research grants, or tests to calibrate your admissions milestones.
              </p>
              <button className="btn btn-primary mt-2" onClick={() => setShowAddModal(true)}>
                <Plus size={15} /> Add first opportunity
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {list.map(o => {
                const d = daysUntil(o.deadline);
                return (
                  <article key={o.id} className="sheet sheet-lift flex items-center gap-4 p-4">
                    <div className="grid h-14 w-14 flex-none place-items-center rounded-xl border-2 text-center"
                      style={{ borderColor: "var(--text-900)", background: d <= 7 ? "var(--accent-100)" : d <= 21 ? "var(--marigold-100)" : "var(--forest-100)", boxShadow: "2px 2px 0 var(--text-950)" }}>
                      <div>
                        <p className="font-display text-lg font-black leading-none">{d}</p>
                        <p className="text-[9px] font-bold uppercase">days</p>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-snug">{o.title}</p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--text-500)" }}>{o.org} · due {fmtDate(o.deadline)}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <TierPill tier={o.tier} />
                        <span className="pill !text-[10px]">{o.kind}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button className={`btn btn-sm ${o.tracked ? "btn-ink" : ""}`} aria-pressed={o.tracked}
                        onClick={() => { up(dr => { const x = dr.inventory.find(y => y.id === o.id); if (x) x.tracked = !x.tracked; }); toast(o.tracked ? "Removed from ladder" : "Added to milestone ladder", "info"); }}>
                        {o.tracked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                        <span className="hidden sm:inline">{o.tracked ? "Tracked" : "Track"}</span>
                      </button>
                      <button className="btn btn-ghost btn-sm p-1.5 text-red-600 hover:text-red-700" onClick={() => removeOpportunity(o.id)} title="Delete opportunity">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* predictor */}
        <section className="space-y-6">
          <div className="sheet tape p-5">
            <SectionHead title="University admissions milestone predictor" right={<Flag size={18} style={{ color: "var(--accent-500)" }} />} />
            <label className="field-label" htmlFor="target-uni">Target profile</label>
            <select id="target-uni" className="input" value={target} onChange={e => setTarget(e.target.value)}>
              {Object.keys(TARGETS).map(k => <option key={k}>{k}</option>)}
            </select>
            <div className="mt-5 flex flex-wrap items-center justify-around gap-4">
              <Gauge value={readiness} label={`${t.label} readiness`} size={140} color={readiness >= 85 ? "var(--forest-500)" : "var(--cobalt-500)"} />
              <div className="min-w-[150px] flex-1 space-y-3">
                {benchmarks.map(b => (
                  <button key={b.label} className="block w-full text-left" onClick={() => navigate(b.to)} title={`Open module for ${b.label}`}>
                    <GanttRow label={b.label} pct={b.pct} color={b.color} note={b.actual} />
                  </button>
                ))}
              </div>
            </div>
            <div className="divider-dashed mt-4 pt-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>Gap queue (fixed thresholds)</p>
              <ul className="mt-2 space-y-1 text-sm">
                {benchmarks.filter(b => b.gap).map(b => (
                  <li key={b.label}>
                    <button className="link-ink" onClick={() => navigate(b.to)}>{b.label}</button>
                    <span style={{ color: "var(--text-500)" }}> — currently {b.actual}</span>
                  </li>
                ))}
                {benchmarks.every(b => !b.gap) && <li style={{ color: "var(--forest-700)" }}>All benchmarks met — hold the line.</li>}
              </ul>
            </div>
          </div>

          {/* milestone ladder */}
          <div className="sheet p-5">
            <SectionHead title="Milestone ladder" right={<CalendarDays size={17} style={{ color: "var(--cobalt-500)" }} />} />
            <ol className="relative ml-3 space-y-5 border-l-2 pl-6" style={{ borderColor: "var(--background-300)" }}>
              {milestones.map(m => (
                <li key={m.label} className="relative">
                  <span className={`absolute -left-[31px] top-0.5 grid h-5 w-5 place-items-center rounded-full border-2 ${m.active && !m.done ? "pulse-dot" : ""}`}
                    style={{ borderColor: "var(--text-900)", background: m.done ? "var(--forest-500)" : m.active ? "var(--marigold-500)" : "var(--surface)" }}>
                    {m.done && <span className="text-[9px] font-black text-white">✓</span>}
                  </span>
                  <p className="text-sm font-bold">{m.label}</p>
                  <p className="font-mono text-[11px]" style={{ color: "var(--text-500)" }}>{m.when}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 font-hand text-lg" style={{ color: "var(--text-300)" }}>benchmarks are rules, not vibes — the ladder never flatters you</p>
          </div>
        </section>
      </div>
    </div>
  );
}
