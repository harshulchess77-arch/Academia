/* Academia · Phase 3.1 — unified dashboard.
   Dynamic time-of-day greeting, localized copy, and live state resolution with zero hardcoded telemetry shortcuts. */
import { ArrowRight, BookOpen, Flag, Folder, Megaphone, Pin, SquareTerminal, Timer } from "lucide-react";
import { useApp, daysUntil, dayKey } from "@/engine/store";
import { navigate } from "@/engine/router";
import { t } from "@/engine/i18n";
import { Gauge, PageHeader, QuotaPills, SectionHead, TierPill } from "@/components/ui";

export function DashboardView() {
  const { s, up } = useApp();
  const now = Date.now();
  const due = s.flashcards.filter(f => f.due <= now).length;
  const deadlines = [...s.inventory].filter(o => o.tracked).sort((a, b) => a.deadline - b.deadline).slice(0, 4);
  const unread = s.announcements.filter(a => !a.read);
  const todayMin = s.pomodoro.sessions[dayKey(now)] ?? 0;
  const week = Array.from({ length: 7 }, (_, i) => s.pomodoro.sessions[dayKey(now - i * 86400000)] ?? 0);
  const weekTotal = week.reduce((a, b) => a + b, 0);

  const readiness = s.adoro.length > 0
    ? Math.round(s.adoro.reduce((a, x) => a + x.score, 0) / s.adoro.length)
    : 0;
  const weakest = s.adoro.length > 0
    ? [...s.adoro].sort((a, b) => a.score - b.score)[0]
    : null;

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? t("dashboard.goodMorning") : hour < 17 ? t("dashboard.goodAfternoon") : t("dashboard.goodEvening");
  const studentFirst = s.session.name.trim() ? s.session.name.trim().split(" ")[0].toLowerCase() : "scholar";
  const kicker = `${timeOfDay}, ${studentFirst}`;

  return (
    <div>
      <PageHeader
        kicker={kicker}
        title={t("dashboard.title")}
        desc={new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        right={<><TierPill tier={s.session.tier} /><QuotaPills module="portfolio" /></>}
      />

      {/* quota strip */}
      <div className="fade-up mb-6 flex flex-wrap items-center gap-3" style={{ "--stagger": 1 } as React.CSSProperties}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-500)" }}>{t("dashboard.quotas")}</span>
        <span className="inline-flex items-center gap-2 text-xs font-semibold"><Folder size={14} /> <QuotaPills module="portfolio" /></span>
        <span className="inline-flex items-center gap-2 text-xs font-semibold"><SquareTerminal size={14} /> <QuotaPills module="sandbox" /></span>
        <span className="inline-flex items-center gap-2 text-xs font-semibold"><BookOpen size={14} /> {due} {t("dashboard.cardsDue")}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* deadlines */}
          <section className="sheet fade-up p-5" style={{ "--stagger": 2 } as React.CSSProperties}>
            <SectionHead title={t("dashboard.upcomingDeadlines")} right={<button className="btn btn-sm" onClick={() => navigate("/inventory")}>Inventory <ArrowRight size={14} /></button>} />
            {deadlines.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-sm" style={{ color: "var(--text-500)" }}>{t("dashboard.noDeadlines")}</p>
                <button className="btn btn-primary btn-sm" onClick={() => navigate("/inventory")}>Track Deadlines</button>
              </div>
            ) : (
              <div className="space-y-3">
                {deadlines.map(o => {
                  const d = daysUntil(o.deadline);
                  const urgency = Math.max(6, 100 - d * 2.2);
                  return (
                    <div key={o.id} className="grid grid-cols-[1fr_auto] items-center gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{o.title}</p>
                        <div className="gantt-track mt-1.5 !h-2.5">
                          <div className="gantt-bar" style={{ width: `${urgency}%`, background: d <= 7 ? "var(--accent-500)" : d <= 21 ? "var(--marigold-500)" : "var(--forest-500)" }} />
                        </div>
                      </div>
                      <span className="pill quota-pill" style={d <= 7 ? { background: "var(--accent-100)", borderColor: "var(--accent-600)", color: "var(--accent-600)" } : undefined}>
                        {d}d left
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* announcements */}
          <section className="sheet fade-up p-5" style={{ "--stagger": 3 } as React.CSSProperties}>
            <SectionHead title={`${t("dashboard.unreadAnnouncements")} (${unread.length})`} right={<button className="btn btn-sm" onClick={() => navigate("/announcements")}><Megaphone size={14} /> All</button>} />
            {unread.length === 0 ? (
              <p className="py-4 text-center font-hand text-xl" style={{ color: "var(--text-300)" }}>{t("dashboard.allAnnouncementsRead")}</p>
            ) : (
              <ul className="space-y-3">
                {unread.slice(0, 3).map(a => (
                  <li key={a.id} className="flex items-start gap-3">
                    {a.priority === "pinned" ? <Pin size={16} className="mt-0.5 flex-none" style={{ color: "var(--accent-500)" }} /> : <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: a.priority === "high" ? "var(--marigold-500)" : "var(--cobalt-500)" }} />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-snug">{a.title}</p>
                      <p className="text-xs" style={{ color: "var(--text-500)" }}>{a.author} · {a.priority}</p>
                    </div>
                    <button className="btn btn-sm flex-none" onClick={() => up(d => { const item = d.announcements.find(x => x.id === a.id); if (item) item.read = true; })}>Mark read</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* quick actions */}
          <section className="fade-up grid grid-cols-2 gap-4 sm:grid-cols-4" style={{ "--stagger": 4 } as React.CSSProperties}>
            {[
              { label: `${t("dashboard.reviewCards")} (${due})`, icon: <BookOpen size={20} />, to: "/library", bg: "var(--cobalt-100)" },
              { label: t("dashboard.runSandbox"), icon: <SquareTerminal size={20} />, to: "/sandbox", bg: "var(--marigold-100)" },
              { label: t("dashboard.newProposal"), icon: <Folder size={20} />, to: "/portfolio", bg: "var(--forest-100)" },
              { label: t("dashboard.trackDeadline"), icon: <Flag size={20} />, to: "/inventory", bg: "var(--plum-100)" },
            ].map(q => (
              <button key={q.to} className="sheet sheet-lift flex flex-col items-center gap-2 px-3 py-5 text-sm font-bold" style={{ background: q.bg }} onClick={() => navigate(q.to)}>
                {q.icon}{q.label}
              </button>
            ))}
          </section>
        </div>

        <div className="space-y-6">
          {/* pomodoro */}
          <section className="sheet fade-up p-5" style={{ "--stagger": 3 } as React.CSSProperties}>
            <SectionHead title={t("dashboard.focusTotals")} right={<Timer size={18} style={{ color: "var(--accent-500)" }} />} />
            <p className="font-display text-4xl font-black">{todayMin}<span className="text-lg font-bold" style={{ color: "var(--text-500)" }}> {t("dashboard.minToday")}</span></p>
            <p className="mt-1 font-mono text-xs" style={{ color: "var(--text-500)" }}>{weekTotal} {t("dashboard.minThisWeek")}</p>
            <div className="mt-4 flex gap-1.5" aria-label="7-day focus activity">
              {week.slice().reverse().map((m, idx) => (
                <div key={idx} className="flex-1 rounded" style={{ height: 32, background: m === 0 ? "var(--background-200)" : m < 30 ? "var(--forest-100)" : m < 60 ? "var(--forest-300)" : "var(--forest-500)" }} title={`${m} min`} />
              ))}
            </div>
            <button className="btn btn-sm mt-4 w-full" onClick={() => navigate("/pomodoro")}>Start focus session</button>
          </section>

          {/* adoro readiness */}
          <section className="sheet fade-up p-5" style={{ "--stagger": 4 } as React.CSSProperties}>
            <SectionHead title="Diagnostic Readiness" />
            <div className="flex items-center justify-around gap-4">
              <Gauge value={readiness} label={readiness >= 80 ? "READY" : readiness >= 65 ? "CONSOLIDATING" : readiness > 0 ? "FOUNDATION" : "NO DATA"} size={130} color={readiness >= 80 ? "var(--forest-500)" : readiness >= 65 ? "var(--marigold-500)" : "var(--accent-500)"} />
              <div className="text-right">
                <p className="font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-500)" }}>Weakest domain</p>
                <p className="font-display text-lg font-black">{weakest ? weakest.subject : "Unsat"}</p>
                <p className="font-mono text-xs" style={{ color: "var(--accent-500)" }}>{weakest ? `${weakest.score}/100` : "—"}</p>
              </div>
            </div>
            <button className="btn btn-sm mt-4 w-full" onClick={() => navigate("/adoro")}>Open report card</button>
          </section>
        </div>
      </div>
    </div>
  );
}
