/* Academia · Phase 1.1 — public editorial landing page */
import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Cookie, Flag, Lock, NotebookPen, Sigma, SquareTerminal, Workflow } from "lucide-react";
import { useApp } from "@/engine/store";
import { navigate } from "@/engine/router";
import { useModal } from "@/engine/modal";
import { DoodleArrow, DoodleStar, GanttRow, ScribbleUnder } from "@/components/ui";

const ICONS: Record<string, React.ReactNode> = {
  book: <BookOpen size={22} />, terminal: <SquareTerminal size={22} />, sigma: <Sigma size={22} />,
  flag: <Flag size={22} />, lock: <Lock size={22} />, workflow: <Workflow size={22} />,
};

const LEGAL: Record<string, { title: string; body: string[] }> = {
  privacy: { title: "Privacy Policy", body: ["Academia is local-first: notes, flashcards, grades and vault keys live in your browser storage and sync as encrypted CRDT operations.", "We collect first-party usage counters only (module opens, quota consumption). No third-party advertising SDKs run on student routes.", "Media embeds use youtube-nocookie.com and stay blocked until you accept media cookies. Under-18 accounts require a confirmed parental signing token."] },
  terms: { title: "Terms of Service", body: ["Accounts are personal. Quotas (e.g. 1 daily sandbox run) are part of the service and are not transferable.", "The Community Charter prohibits hostile language; the keystroke filter blocks flagged drafts before posting. Repeated violations escalate: warning → usage pause → ban.", "Deterministic engines (SM-2, MNA, AST evaluators) return rule-traced outputs. They are study aids, not certified academic advice."] },
  refund: { title: "Refund Policy", body: ["Paid tiers refund in full within 14 days of purchase, no questions asked.", "After 14 days, refunds are pro-rated for full unused months. Quota purchases are refundable while unconsumed.", "Refunds return to the original payment method within 5–7 working days."] },
  grievance: { title: "Grievance Officer", body: ["Ms. Kavya Raghavan · Grievance Officer, Academia Learning Systems", "Email: grievance@academia.app · Response SLA: 48 hours acknowledgement, 15 days resolution.", "Postal: 4th Floor, Ruled Paper House, 12 Marg Road, Bengaluru 560001, IN."] },
};

export function LandingView() {
  const { s, up } = useApp();
  const { open } = useModal();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const legal = (key: string) => open({
    title: LEGAL[key].title,
    body: <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--text-700)" }}>{LEGAL[key].body.map((p, i) => <p key={i}>{p}</p>)}</div>,
  });
  const cookieSettings = () => open({
    title: "Cookie controls",
    body: (
      <div className="space-y-3 text-sm">
        <p style={{ color: "var(--text-700)" }}>Essential cookies keep your session and local notebook. Media cookies unlock privacy-gated YouTube embeds — nothing else.</p>
        <div className="flex flex-wrap gap-3">
          <button className="btn" onClick={() => { up(d => { d.cookies = { decided: true, media: false }; }); }}>Essential only</button>
          <button className="btn btn-primary" onClick={() => { up(d => { d.cookies = { decided: true, media: true }; }); }}>Accept media cookies</button>
        </div>
      </div>
    ),
  });

  return (
    <div className="min-h-screen">
      {/* fixed nav */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b-2 transition-all"
        style={{ borderColor: scrolled ? "var(--text-900)" : "transparent", background: scrolled ? "var(--background-50)" : "transparent" }}
        aria-label="Landing">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-8">
          <a href="#/" className="flex items-center gap-2 font-display text-xl font-black">
            <span className="grid h-9 w-9 place-items-center rounded-lg border-2" style={{ background: "var(--accent-500)", borderColor: "var(--text-900)", boxShadow: "2px 2px 0 var(--text-950)" }}>
              <NotebookPen size={18} color="#fff" />
            </span>
            Academia
          </a>
          <div className="ml-auto hidden items-center gap-6 text-sm font-semibold md:flex">
            {["offerings", "roadmap", "compliance"].map(sec => (
              <button key={sec} className="capitalize hover:underline underline-offset-4" onClick={() => document.getElementById(sec)?.scrollIntoView({ behavior: "smooth" })}>{sec}</button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm ml-auto md:ml-0" onClick={() => navigate("/auth")}>Access Academia</button>
        </div>
      </nav>

      {/* hero */}
      <header className="relative mx-auto max-w-4xl px-4 pb-16 pt-32 text-center md:pt-40">
        <DoodleStar className="float-slow absolute left-[6%] top-28 hidden h-10 w-10 md:block" />
        <DoodleStar className="float-slow absolute right-[8%] top-44 hidden h-7 w-7 md:block" />
        <div className="float-slow absolute -left-24 top-64 hidden w-44 rotate-[-6deg] xl:block" style={{ "--rot": "-6deg" } as React.CSSProperties}>
          <div className="sheet px-4 py-3 text-left">
            <p className="font-mono text-[10px]" style={{ color: "var(--accent-500)" }}>CARD DUE · SM-2</p>
            <p className="mt-1 text-sm font-bold">Rank–Nullity theorem?</p>
            <p className="font-hand text-lg" style={{ color: "var(--cobalt-500)" }}>ease 2.5 → 6 days</p>
          </div>
        </div>
        <div className="float-slow absolute -right-28 top-72 hidden w-48 rotate-[5deg] xl:block" style={{ "--rot": "5deg", animationDelay: "1.2s" } as React.CSSProperties}>
          <div className="sheet px-4 py-3 text-left">
            <p className="font-mono text-[10px]" style={{ color: "var(--forest-500)" }}>QUOTA HONEST</p>
            <p className="mt-1 font-mono text-sm font-bold">1/1 Daily · 5/5 Weekly</p>
            <div className="gantt-track mt-2"><div className="gantt-bar" style={{ width: "62%", background: "var(--marigold-500)" }} /></div>
          </div>
        </div>

        <p className="fade-up font-hand text-2xl" style={{ color: "var(--accent-500)", "--stagger": 0 } as React.CSSProperties}>for the ones who take notes</p>
        <h1 className="fade-up mt-3 font-display text-5xl font-black leading-[1.05] tracking-tight md:text-7xl" style={{ "--stagger": 1 } as React.CSSProperties}>
          Every mark, <span className="scribble">mapped<ScribbleUnder /></span>.<br />Every rule, readable.
        </h1>
        <p className="fade-up mx-auto mt-6 max-w-xl text-base md:text-lg" style={{ color: "var(--text-500)", "--stagger": 2 } as React.CSSProperties}>
          Academia is a notebook workbench of 18 deterministic modules — recall scheduling, math engines, a sealed vault and an admissions ladder. No black boxes, no streak traps.
        </p>
        <div className="fade-up mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm font-semibold" style={{ "--stagger": 3 } as React.CSSProperties}>
          {["Deterministic engines only", "Local-first encrypted vault", "Quota-honest pacing"].map(t => (
            <span key={t} className="inline-flex items-center gap-2"><CheckCircle2 size={18} style={{ color: "var(--forest-500)" }} />{t}</span>
          ))}
        </div>
        <div className="fade-up relative mt-9 inline-flex flex-wrap justify-center gap-4" style={{ "--stagger": 4 } as React.CSSProperties}>
          <button className="btn btn-primary !min-h-[52px] !px-8 !text-base" onClick={() => navigate("/auth")}>Access Academia</button>
          <button className="btn !min-h-[52px] !px-6 !text-base" onClick={() => document.getElementById("offerings")?.scrollIntoView({ behavior: "smooth" })}>See what's inside</button>
          <DoodleArrow className="absolute -right-24 -top-8 hidden h-14 w-20 rotate-[130deg] lg:block" />
        </div>
      </header>

      {/* stats ribbon */}
      <section className="border-y-2 py-8" style={{ background: "var(--text-900)", borderColor: "var(--text-950)" }} aria-label="Verified platform statistics">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-16 gap-y-6 px-4">
          {s.admin.stats.map(st => (
            <div key={st.label} className="text-center">
              <p className="font-display text-4xl font-black md:text-5xl" style={{ color: "var(--marigold-500)" }}>{st.value}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[.18em]" style={{ color: "var(--background-300)" }}>{st.label}</p>
            </div>
          ))}
          <p className="w-full text-center font-mono text-[10px] uppercase tracking-widest md:w-auto" style={{ color: "var(--text-300)" }}>✓ verified first-party counters</p>
        </div>
      </section>

      {/* bento */}
      <section id="offerings" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 md:px-8">
        <div className="mb-10 text-center">
          <p className="font-hand text-2xl" style={{ color: "var(--cobalt-500)" }}>the full spread</p>
          <h2 className="font-display text-4xl font-black md:text-5xl">What We Give To Students</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {s.admin.features.map((f, i) => (
            <article key={f.id} className={`sheet sheet-lift fade-up relative p-6 ${f.span === 2 ? "lg:col-span-2" : ""}`} style={{ "--stagger": i } as React.CSSProperties}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl border-2" style={{ background: ["var(--cobalt-100)", "var(--accent-100)", "var(--marigold-100)", "var(--forest-100)", "var(--plum-100)", "var(--cobalt-100)"][i % 6], borderColor: "var(--text-900)", boxShadow: "2px 2px 0 var(--text-950)" }}>
                  {ICONS[f.icon] ?? <BookOpen size={22} />}
                </span>
                <span className="pill" style={{ background: "var(--background-100)" }}>{f.badge}</span>
              </div>
              <h3 className="mt-4 font-display text-xl font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-500)" }}>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* roadmap strip */}
      <section id="roadmap" className="mx-auto max-w-4xl scroll-mt-24 px-4 pb-20 md:px-8">
        <div className="sheet tape p-6 md:p-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-hand text-xl" style={{ color: "var(--accent-500)" }}>a semester, to scale</p>
              <h2 className="font-display text-2xl font-black">Your roadmap draws itself</h2>
            </div>
            <span className="pill" style={{ background: "var(--marigold-100)" }}>Gantt · milestone predictor</span>
          </div>
          <div className="space-y-4">
            <GanttRow label="Foundations" pct={100} color="var(--forest-500)" note="done" />
            <GanttRow label="Olympiad prep" pct={64} color="var(--cobalt-500)" note="wk 9/14" />
            <GanttRow label="Research proposal" pct={38} color="var(--marigold-500)" note="wk 5/13" />
            <GanttRow label="Applications" pct={12} color="var(--accent-500)" note="opens soon" />
          </div>
        </div>
      </section>

      {/* footer & compliance */}
      <footer id="compliance" className="scroll-mt-24 border-t-2 py-12" style={{ background: "var(--background-50)", borderColor: "var(--text-900)" }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
          <div>
            <p className="flex items-center gap-2 font-display text-xl font-black"><NotebookPen size={20} /> Academia</p>
            <p className="mt-2 max-w-xs text-sm" style={{ color: "var(--text-500)" }}>A deterministic notebook workbench, built by Academia Learning Systems. Paper first, pixels second.</p>
            <button className="btn btn-sm mt-4" onClick={cookieSettings}><Cookie size={15} /> Cookie controls</button>
          </div>
          <nav aria-label="Legal" className="text-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-[.16em]" style={{ color: "var(--text-500)" }}>Policies</p>
            <ul className="space-y-2.5">
              <li><button className="link-ink" onClick={() => legal("privacy")}>Privacy Policy</button></li>
              <li><button className="link-ink" onClick={() => legal("terms")}>Terms of Service</button></li>
              <li><button className="link-ink" onClick={() => legal("refund")}>Refund Policy</button></li>
            </ul>
          </nav>
          <div className="text-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-[.16em]" style={{ color: "var(--text-500)" }}>Accountability</p>
            <button className="link-ink" onClick={() => legal("grievance")}>Grievance Officer Contact</button>
            <p className="mt-2 text-xs" style={{ color: "var(--text-500)" }}>48h acknowledgement SLA · WCAG 2.2 AA interface</p>
            <div className="mt-4 flex gap-3 text-xs">
              <button className="link-ink" onClick={() => navigate("/404")}>404</button>
              <button className="link-ink" onClick={() => navigate("/500")}>500</button>
            </div>
          </div>
        </div>
        <p className="mt-10 text-center font-hand text-xl" style={{ color: "var(--text-300)" }}>© 2026 Academia Learning Systems — made with ruled paper</p>
      </footer>

      {/* one-click cookie consent */}
      {!s.cookies.decided && (
        <div className="fixed inset-x-3 bottom-3 z-[80] md:left-auto md:right-6 md:w-[420px]" role="region" aria-label="Cookie consent">
          <div className="sheet p-4" style={{ animation: "popIn .3s var(--ease-snap)" }}>
            <p className="flex items-center gap-2 text-sm font-bold"><Cookie size={16} /> Cookies, briefly</p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-500)" }}>Essential cookies run the notebook. Media cookies unlock youtube-nocookie embeds. One click either way — change anytime in the footer.</p>
            <div className="mt-3 flex gap-2">
              <button className="btn btn-sm flex-1" onClick={() => up(d => { d.cookies = { decided: true, media: false }; })}>Essential only</button>
              <button className="btn btn-primary btn-sm flex-1" onClick={() => up(d => { d.cookies = { decided: true, media: true }; })}>Accept all</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}