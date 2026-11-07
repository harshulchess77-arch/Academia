/* Academia · Phase 4.1 — admin telemetry + landing CMS editor */
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Plus, Send, ShieldAlert, Trash2, Users } from "lucide-react";
import { useApp, QUOTA_MAX, uid } from "@/engine/store";
import { navigate } from "@/engine/router";
import { PageHeader, Pill, SectionHead, Sparkline } from "@/components/ui";

export function AdminDashboardView() {
  const { s, up, toast } = useApp();
  const [live, setLive] = useState({ sessions: 342, series: [280, 296, 310, 301, 322, 330, 318, 336, 342] });
  const [runsSeries] = useState([41, 55, 48, 62, 71, 66, 78, 84, 91]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setLive(v => {
        const next = Math.max(240, Math.min(480, v.sessions + Math.round((Math.random() - 0.48) * 9)));
        return { sessions: next, series: [...v.series.slice(-11), next] };
      });
    }, 2000);
    return () => window.clearInterval(t);
  }, []);

  const burn = (["portfolio", "sandbox", "chat"] as const).map((k, i) => ({
    k, used: 1 - s.quotas[k].w / QUOTA_MAX[k].w, color: `var(--chart-${i + 1})`,
  }));
  const flags = s.admin.flagsOpen + s.admin.warnings.length;

  return (
    <div>
      <PageHeader kicker="governance desk" title="Admin telemetry"
        desc="First-party aggregate counters only. Individual dossiers live in the Student Directory — nothing here profiles a student silently."
        right={<button className="btn btn-sm" onClick={() => navigate("/admin/students")}><Users size={15} /> Student directory</button>} />

      {/* live metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sheet p-5">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}><Activity size={13} /> Active sessions</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="font-display text-4xl font-black tabular-nums">{live.sessions}</p>
            <Sparkline points={live.series} color="var(--chart-1)" />
          </div>
          <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--forest-700)" }}>● live · 2s poll</p>
        </div>
        <div className="sheet p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>Sandbox runs today</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="font-display text-4xl font-black">91</p>
            <Sparkline points={runsSeries} color="var(--chart-3)" />
          </div>
          <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--text-500)" }}>+8.3% vs yesterday</p>
        </div>
        <div className="sheet p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>Quota burn (weekly)</p>
          <div className="mt-2 space-y-2">
            {burn.map(b => (
              <div key={b.k} className="flex items-center gap-2">
                <span className="w-16 text-[10px] font-bold capitalize">{b.k}</span>
                <div className="gantt-track flex-1 !h-2.5"><div className="gantt-bar" style={{ width: `${b.used * 100}%`, background: b.color }} /></div>
                <span className="font-mono text-[10px]">{Math.round(b.used * 100)}%</span>
              </div>
            ))}
          </div>
          <button className="btn btn-sm mt-3 w-full" onClick={() => { up(d => { d.quotas = { portfolio: { d: QUOTA_MAX.portfolio.d, w: QUOTA_MAX.portfolio.w }, sandbox: { d: QUOTA_MAX.sandbox.d, w: QUOTA_MAX.sandbox.w }, chat: { d: QUOTA_MAX.chat.d, w: QUOTA_MAX.chat.w } }; }); toast("Simulated new day — all quotas restored", "ok"); }}>
            Simulate new day · reset quotas
          </button>
        </div>
        <div className="sheet p-5" style={{ background: flags > 4 ? "var(--accent-100)" : undefined }}>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}><ShieldAlert size={13} /> Security flags</p>
          <p className="mt-1 font-display text-4xl font-black" style={{ color: flags > 4 ? "var(--accent-600)" : undefined }}>{flags}</p>
          <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--text-500)" }}>{s.admin.warnings.length} warnings issued this session</p>
        </div>
      </div>

      {/* flags + warnings */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="sheet p-5">
          <SectionHead title="Open flag queue" right={<Pill tone="accent">{s.admin.flagsOpen} open</Pill>} />
          <ul className="space-y-2.5 text-sm">
            {[
              { who: "Kabir Anand", what: "3 keystroke-filter blocks in 10 minutes", tone: "var(--marigold-900)" },
              { who: "Arjun Mehta", what: "Charter escalation ladder exhausted — banned", tone: "var(--accent-600)" },
              { who: "Rohan Kulkarni", what: "MNA solver spam (14 solves/min) — rate-limited", tone: "var(--text-700)" },
              { who: "Locker service", what: "1 checksum mismatch reported (resolved by re-import)", tone: "var(--text-700)" },
            ].map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <AlertTriangle size={15} className="mt-0.5 flex-none" style={{ color: f.tone }} />
                <span><strong>{f.who}</strong> — {f.what}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="sheet p-5">
          <SectionHead title="Warning log (this session)" />
          {s.admin.warnings.length === 0 ? (
            <p className="py-6 text-center font-hand text-xl" style={{ color: "var(--text-300)" }}>no warnings issued — issue one from the directory's ⋯ menu</p>
          ) : (
            <ul className="space-y-2.5">
              {s.admin.warnings.map(w => (
                <li key={w.id} className="rounded-lg border-2 p-3 text-sm" style={{ borderColor: "var(--marigold-500)", background: "var(--marigold-100)" }}>
                  <p className="font-bold">{w.student} · {new Date(w.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--text-700)" }}>{w.reason}</p>
                  <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--forest-700)" }}>✓ in-app notice delivered · ✓ email queued</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* CMS editor */}
      <section className="sheet mt-6 p-5">
        <SectionHead title="Landing CMS · “What We Give To Students”" right={
          <button className="btn btn-primary btn-sm" onClick={() => toast("Published — landing page reads this state live", "ok")}><Send size={14} /> Publish</button>} />
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {s.admin.stats.map((st, i) => (
            <div key={i} className="rounded-xl border-2 p-3" style={{ borderColor: "var(--background-300)" }}>
              <label className="field-label" htmlFor={`stat-v-${i}`}>Verified stat {i + 1}</label>
              <input id={`stat-v-${i}`} className="input mb-2 font-display !text-lg font-bold" value={st.value} onChange={e => up(d => { d.admin.stats[i].value = e.target.value; })} />
              <input className="input" aria-label={`Stat ${i + 1} label`} value={st.label} onChange={e => up(d => { d.admin.stats[i].label = e.target.value; })} />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {s.admin.features.map((f, i) => (
            <div key={f.id} className="rounded-xl border-2 p-4" style={{ borderColor: "var(--text-900)", background: "var(--background-50)", boxShadow: "3px 3px 0 var(--text-950)" }}>
              <div className="flex items-center gap-2">
                <input className="input flex-1 font-bold" aria-label={`Feature ${i + 1} title`} value={f.title} onChange={e => up(d => { d.admin.features[i].title = e.target.value; })} />
                <select className="input !w-24" aria-label="Card span" value={f.span} onChange={e => up(d => { d.admin.features[i].span = Number(e.target.value) as 1 | 2; })}>
                  <option value={1}>1 col</option><option value={2}>2 col</option>
                </select>
                <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Delete feature ${f.title}`} style={{ color: "var(--accent-600)" }}
                  onClick={() => { const copy = f; up(d => { d.admin.features = d.admin.features.filter(x => x.id !== f.id); }); toast("Feature card removed", "err", { label: "Undo", fn: () => up(d => { d.admin.features.splice(i, 0, copy); }) }); }}>
                  <Trash2 size={15} />
                </button>
              </div>
              <input className="input mt-2" aria-label={`Feature ${i + 1} badge`} value={f.badge} onChange={e => up(d => { d.admin.features[i].badge = e.target.value; })} />
              <textarea className="input mt-2 min-h-[70px] !text-sm" aria-label={`Feature ${i + 1} body`} value={f.body} onChange={e => up(d => { d.admin.features[i].body = e.target.value; })} />
            </div>
          ))}
        </div>
        <button className="btn mt-4" onClick={() => { up(d => { d.admin.features.push({ id: uid(), title: "New offering", body: "Describe the deterministic value in one honest paragraph.", badge: "New", icon: "book", span: 1 }); }); toast("Feature card added — edit and publish", "info"); }}>
          <Plus size={16} /> Add feature card
        </button>
      </section>
    </div>
  );
}