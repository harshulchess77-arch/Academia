/* Academia · Phase 3.4 — resume builder + proposal desk with live quotas */
import { useState } from "react";
import { Download, FileText, Plus, Send, Trash2, X } from "lucide-react";
import { useApp, spendQuota, uid, fmtDate, type Proposal } from "@/engine/store";
import { PageHeader, Pill, QuotaPills, SectionHead, Tabs } from "@/components/ui";

const STATUS_TONE: Record<Proposal["status"], string> = { Draft: "var(--text-500)", Submitted: "var(--cobalt-500)", "In review": "var(--marigold-900)", Accepted: "var(--forest-700)" };

export function PortfolioView() {
  const { s, up, toast } = useApp();
  const [tab, setTab] = useState("Proposals");
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [skill, setSkill] = useState("");
  const [activity, setActivity] = useState("");

  const consume = (): boolean => {
    if (!spendQuota(s, "portfolio")) { toast("Portfolio quota exhausted — 3/day · 10/weekly. Drafts still save.", "warn"); return false; }
    up(d => { d.quotas.portfolio.d -= 1; d.quotas.portfolio.w -= 1; });
    return true;
  };

  const submitProposal = () => {
    if (!title.trim() || abstract.trim().length < 20) { toast("Give the proposal a title and a 20+ character abstract", "warn"); return; }
    if (!consume()) return;
    up(d => { d.proposals.unshift({ id: uid(), title: title.trim(), abstract: abstract.trim(), status: "Submitted", updated: Date.now() }); });
    setTitle(""); setAbstract("");
    toast("Proposal submitted to review queue", "ok");
  };

  const removeProposal = (p: Proposal) => {
    up(d => { d.proposals = d.proposals.filter(x => x.id !== p.id); });
    toast(`Deleted “${p.title.slice(0, 28)}…”`, "err", { label: "Undo", fn: () => up(d => { d.proposals.unshift(p); }) });
  };

  const exportResume = () => {
    const r = s.resume;
    const text = [`${r.name}`, r.headline, r.school, "", "SKILLS", ...r.skills.map(x => `• ${x}`), "", "ACTIVITIES", ...r.activities.map(x => `• ${x}`), "", "Exported from Academia · deterministic resume builder"].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = "academia-resume.txt"; a.click();
    URL.revokeObjectURL(url);
    toast("Resume exported (quota-free)", "ok");
  };

  return (
    <div>
      <PageHeader kicker="show your working" title="Portfolio"
        desc="Resume builder and project proposal desk. Submissions spend quota; drafts and exports never do."
        right={<QuotaPills module="portfolio" />} />
      {/* persistent quota header pills */}
      <div className="sticky top-0 z-20 -mx-1 mb-5 flex items-center gap-3 border-b-2 px-1 py-2.5" style={{ background: "var(--background-100)", borderColor: "var(--background-300)" }}>
        <Tabs tabs={["Proposals", "Resume builder"]} active={tab} onChange={setTab} />
        <span className="ml-auto hidden sm:block"><QuotaPills module="portfolio" /></span>
      </div>

      {tab === "Proposals" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            {s.proposals.map(p => (
              <article key={p.id} className="sheet sheet-lift p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-bold leading-snug">{p.title}</h3>
                    <p className="mt-1 text-xs font-mono" style={{ color: "var(--text-500)" }}>updated {fmtDate(p.updated)}</p>
                  </div>
                  <span className="pill" style={{ borderColor: STATUS_TONE[p.status], color: STATUS_TONE[p.status] }}>{p.status}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-700)" }}>{p.abstract}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.status === "Draft" && (
                    <button className="btn btn-primary btn-sm" onClick={() => { if (!consume()) return; up(d => { const x = d.proposals.find(y => y.id === p.id); if (x) { x.status = "Submitted"; x.updated = Date.now(); } }); toast("Draft submitted — 1 quota spent", "ok"); }}>
                      <Send size={14} /> Submit for review
                    </button>
                  )}
                  {p.status === "Submitted" && (
                    <button className="btn btn-sm" onClick={() => { up(d => { const x = d.proposals.find(y => y.id === p.id); if (x) { x.status = "In review"; x.updated = Date.now(); } }); toast("Reviewer picked it up", "info"); }}>
                      Simulate reviewer pickup
                    </button>
                  )}
                  <button className="btn btn-sm" style={{ color: "var(--accent-600)" }} onClick={() => removeProposal(p)}><Trash2 size={14} /> Delete</button>
                </div>
              </article>
            ))}
            {s.proposals.length === 0 && <p className="sheet p-8 text-center font-hand text-2xl" style={{ color: "var(--text-300)" }}>the proposal desk is empty — pitch something →</p>}
          </section>

          <aside className="sheet h-fit p-5">
            <SectionHead title="New proposal" right={<Pill tone="marigold">−1 quota</Pill>} />
            <label className="field-label" htmlFor="prop-title">Title</label>
            <input id="prop-title" className="input" placeholder="e.g. Rain-gauge calibration study" value={title} onChange={e => setTitle(e.target.value)} />
            <label className="field-label mt-4" htmlFor="prop-abs">Abstract</label>
            <textarea id="prop-abs" className="input min-h-[130px]" placeholder="What will you build or test, and how will you measure it?" value={abstract} onChange={e => setAbstract(e.target.value)} />
            <p className="mt-1 text-right font-mono text-[10px]" style={{ color: "var(--text-500)" }}>{abstract.length} chars</p>
            <button className="btn btn-primary mt-3 w-full" onClick={submitProposal}><Plus size={16} /> Submit proposal</button>
            <button className="btn mt-2 w-full" onClick={() => {
              if (!title.trim()) { toast("Name the draft first", "warn"); return; }
              up(d => { d.proposals.unshift({ id: uid(), title: title.trim(), abstract: abstract.trim() || "Draft — abstract pending.", status: "Draft", updated: Date.now() }); });
              setTitle(""); setAbstract(""); toast("Draft saved (no quota spent)", "ok");
            }}><FileText size={15} /> Save as draft</button>
          </aside>
        </div>
      )}

      {tab === "Resume builder" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="sheet p-5">
            <SectionHead title="Edit fields" right={<button className="btn btn-sm" onClick={exportResume}><Download size={14} /> Export .txt</button>} />
            <div className="space-y-4">
              {(["name", "headline", "school"] as const).map(k => (
                <div key={k}>
                  <label className="field-label" htmlFor={`resume-${k}`}>{k}</label>
                  <input id={`resume-${k}`} className="input" value={s.resume[k]} onChange={e => up(d => { d.resume[k] = e.target.value; })} />
                </div>
              ))}
              <div>
                <label className="field-label" htmlFor="resume-skill">Skills</label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {s.resume.skills.map(sk => (
                    <span key={sk} className="pill">{sk}
                      <button aria-label={`Remove skill ${sk}`} onClick={() => up(d => { d.resume.skills = d.resume.skills.filter(x => x !== sk); })}><X size={12} /></button>
                    </span>
                  ))}
                </div>
                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (!skill.trim()) return; up(d => { d.resume.skills.push(skill.trim()); }); setSkill(""); }}>
                  <input id="resume-skill" className="input" placeholder="Add a skill…" value={skill} onChange={e => setSkill(e.target.value)} />
                  <button className="btn btn-icon" type="submit" aria-label="Add skill"><Plus size={16} /></button>
                </form>
              </div>
              <div>
                <label className="field-label" htmlFor="resume-act">Activities</label>
                <ul className="mb-2 space-y-1.5">
                  {s.resume.activities.map(a => (
                    <li key={a} className="flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-1.5 text-sm" style={{ borderColor: "var(--background-300)" }}>
                      {a}
                      <button aria-label={`Remove activity ${a}`} onClick={() => up(d => { d.resume.activities = d.resume.activities.filter(x => x !== a); })}><X size={14} /></button>
                    </li>
                  ))}
                </ul>
                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (!activity.trim()) return; up(d => { d.resume.activities.push(activity.trim()); }); setActivity(""); }}>
                  <input id="resume-act" className="input" placeholder="Add an activity…" value={activity} onChange={e => setActivity(e.target.value)} />
                  <button className="btn btn-icon" type="submit" aria-label="Add activity"><Plus size={16} /></button>
                </form>
              </div>
            </div>
          </section>

          {/* live paper preview */}
          <section aria-label="Resume preview" className="sheet tape h-fit px-8 py-8" style={{ background: "var(--surface-raised)" }}>
            <p className="text-center font-display text-2xl font-black">{s.resume.name || "Your name"}</p>
            <p className="mt-1 text-center text-sm font-semibold" style={{ color: "var(--cobalt-600)" }}>{s.resume.headline}</p>
            <p className="text-center text-xs" style={{ color: "var(--text-500)" }}>{s.resume.school}</p>
            <div className="divider-dashed my-4" />
            <p className="text-xs font-bold uppercase tracking-[.18em]" style={{ color: "var(--accent-500)" }}>Skills</p>
            <p className="mt-1.5 text-sm leading-relaxed">{s.resume.skills.join(" · ") || "—"}</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-[.18em]" style={{ color: "var(--accent-500)" }}>Activities</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
              {s.resume.activities.map(a => <li key={a}>{a}</li>)}
            </ul>
            <p className="mt-6 text-center font-hand text-lg" style={{ color: "var(--text-300)" }}>live preview — updates as you type</p>
          </section>
        </div>
      )}
    </div>
  );
}