/* Academia · Phase 3.1 — unified dashboard */
import { ArrowRight, BookOpen, Flag, Folder, Megaphone, Pin, SquareTerminal, Timer } from "lucide-react";
import { useApp, daysUntil, dayKey } from "@/engine/store";
import { navigate } from "@/engine/router";
import { Gauge, PageHeader, Pill, QuotaPills, SectionHead, TierPill } from "@/components/ui";

export function DashboardView() {
  const { s, up } = useApp();
  const now = Date.now();
  const due = s.flashcards.filter(f => f.due <= now).length;
  const deadlines = [...s.inventory].filter(o => o.tracked).sort((a, b) => a.deadline - b.deadline).slice(0, 4);
  const unread = s.announcements.filter(a => !a.read);
  const today = s.pomodoro.sessions[dayKey(now)] ?? 0;
  const week = Array.from({ length: 7 }, (_, i) => s.pomodoro.sessions[dayKey(now - i * 86400000)] ?? 0);
  const weekTotal = week.reduce((a, b) => a + b, 0);
  const readiness = Math.round(s.adoro.reduce((a, x) => a + x.score, 0) / s.adoro.length);
  const weakest = [...s.adoro].sort((a, b) => a.score - b.score)[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  return (
    <div>
      <PageHeader
        kicker={`good ${greet}, ${s.session.name.split(" ")[0].toLowerCase()}`}
        title="Today's desk"
        desc={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        right={<><TierPill tier={s.session.tier} /><QuotaPills module="portfolio" /></>}
      />

      {/* quota strip */}
      <div className="fade-up mb-6 flex flex-wrap items-center gap-3" style={{ "--stagger": 1 } as React.CSSProperties}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-500)" }}>Quotas</span>
        <span className="inline-flex items-center gap-2 text-xs font-semibold"><Folder size={14} /> <QuotaPills module="portfolio" /></span>
        <span className="inline-flex items-center gap-2 text-xs font-semibold"><SquareTerminal size={14} /> <QuotaPills module="sandbox" /></span>
        <span className="inline-flex items-center gap-2 text-xs font-semibold"><BookOpen size={14} /> {due} cards due</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* deadlines */}
          <section className="sheet fade-up p-5" style={{ "--stagger": 2 } as React.CSSProperties}>
            <SectionHead title="Upcoming Inventory deadlines" right={<button className="btn btn-sm" onClick={() => navigate("/inventory")}>Inventory <ArrowRight size={14} /></button>} />
            <div className="space-y-3">
              {deadlines.map(o => {
                const d = daysUntil(o.deadline);
                const urgency = Math.max(6, 100 - d * 2.2);
                return (
                  <div key={o.id} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{o.title}</p>
                      <div className="gantt-track mt-1.5 !h-2.5"><div className="gantt-bar" style={{ width: `${urgency}%`, background: d <= 7 ? "var(--accent-500)" : d <= 21 ? "var(--marigold-500)" : "var(--forest-500)" }} /></div>
                    </div>
                    <span className="pill quota-pill" style={d <= 7 ? { background: "var(--accent-100)", borderColor: "var(--accent-600)", color: "var(--accent-600)" } : undefined}>{d}d left</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* announcements */}
          <section className="sheet fade-up p-5" style={{ "--stagger": 3 } as React.CSSProperties}>
            <SectionHead title={`Unread announcements (${unread.length})`} right={<button className="btn btn-sm" onClick={() => navigate("/announcements")}><Megaphone size={14} /> All</button>} />
            {unread.length === 0 ? (
              <p className="py-4 text-center font-hand text-xl" style={{ color: "var(--text-300)" }}>nothing unread — margins clean</p>
            ) : (
              <ul className="space-y-3">
                {unread.slice(0, 3).map(a => (
                  <li key={a.id} className="flex items-start gap-3">
                    {a.priority === "pinned" ? <Pin size={16} className="mt-0.5 flex-none" style={{ color: "var(--accent-500)" }} /> : <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: a.priority === "high" ? "var(--marigold-500)" : "var(--cobalt-500)" }} />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-snug">{a.title}</p>
                      <p className="text-xs" style={{ color: "var(--text-500)" }}>{a.author} · {a.priority}</p>
                    </div>
                    <button className="btn btn-sm flex-none" onClick={() => up(d => { const t = d.announcements.find(x => x.id === a.id); if (t) t.read = true; })}>Mark read</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* quick actions */}
          <section className="fade-up grid grid-cols-2 gap-4 sm:grid-cols-4" style={{ "--stagger": 4 } as React.CSSProperties}>
            {[
              { label: `Review ${due} cards`, icon: <BookOpen size={20} />, to: "/library", bg: "var(--cobalt-100)" },
              { label: "Run sandbox", icon: <SquareTerminal size={20} />, to: "/sandbox", bg: "var(--marigold-100)" },
              { label: "New proposal", icon: <Folder size={20} />, to: "/portfolio", bg: "var(--forest-100)" },
              { label: "Track deadline", icon: <Flag size={20} />, to: "/inventory", bg: "var(--plum-100)" },
            ].map(q => (
              <button key={q.label} className="sheet sheet-lift flex flex-col items-center gap-2 px-3 py-5 text-sm font-bold" style={{ background: q.bg }} onClick={() => navigate(q.to)}>
                {q.icon}{q.label}
              </button>
            ))}
          </section>
        </div>

        <div className="space-y-6">
          {/* pomodoro */}
          <section className="sheet fade-up p-5" style={{ "--stagger": 3 } as React.CSSProperties}>
            <SectionHead title="Focus totals" right={<Timer size={18} style={{ color: "var(--accent-500)" }} />} />
            <p className="font-display text-4xl font-black">{today}<span className="text-lg font-bold" style={{ color: "var(--text-500)" }}> min today</span></p>
            <p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-500)" }}>{weekTotal} min this week · no streak pressure</p>
            <div className="mt-3 flex gap-1" aria-label="Last 7 days of focus">
              {[...week].reverse().map((m, i) => (
                <div key={i} className="heat-cell flex-1" title={`${m} min`} style={{ height: 22, background: m === 0 ? "var(--background-200)" : m < 30 ? "color-mix(in srgb, var(--forest-500) 35%, var(--surface))" : m < 60 ? "color-mix(in srgb, var(--forest-500) 65%, var(--surface))" : "var(--forest-500)" }} />
              ))}
            </div>
            <button className="btn btn-warn mt-4 w-full" onClick={() => navigate("/pomodoro")}>Start a Pomodoro</button>
          </section>

          {/* adoro readiness */}
          <section className="sheet fade-up p-5 text-center" style={{ "--stagger": 4 } as React.CSSProperties}>
            <SectionHead title="Adoro readiness" />
            <Gauge value={readiness} label={readiness >= 80 ? "Application ready" : readiness >= 65 ? "Consolidating" : "Foundation"} color={readiness >= 80 ? "var(--forest-500)" : readiness >= 65 ? "var(--marigold-500)" : "var(--accent-500)"} />
            <p className="mt-2 text-xs" style={{ color: "var(--text-500)" }}>Weakest: <strong>{weakest.subject} · {weakest.score}</strong></p>
            <button className="btn mt-3 w-full" onClick={() => navigate("/adoro")}>Open report card</button>
          </section>

          <div className="fade-up flex flex-wrap gap-2" style={{ "--stagger": 5 } as React.CSSProperties}>
            <Pill tone="forest">CRDT local-first</Pill>
            <Pill tone="cobalt">SM-2 v1987</Pill>
            <Pill tone="marigold">100% rule-traced</Pill>
          </div>
        </div>
      </div>
    </div>
  );
}