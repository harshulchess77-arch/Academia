/* Academia · Phase 4.2 — high-density directory with PROFILE / WARNING / USAGE 3-dot menu */
import { useEffect, useRef, useState } from "react";
import { Ban, ChevronRight, Eye, MoreHorizontal, Search, ShieldAlert, Timer, X, Zap } from "lucide-react";
import { useApp, uid, fmtTime, type StudentRow, type AccountStatus } from "@/engine/store";
import { useModal } from "@/engine/modal";
import { navigate } from "@/engine/router";
import { Avatar, PageHeader, Pill, SectionHead, TierPill } from "@/components/ui";

const HEALTH: Record<StudentRow["quotaHealth"], { bg: string; fg: string }> = {
  Healthy: { bg: "var(--forest-100)", fg: "var(--forest-700)" },
  Watch: { bg: "var(--marigold-100)", fg: "var(--marigold-900)" },
  Exceeded: { bg: "var(--accent-100)", fg: "var(--accent-600)" },
};

export function AdminStudentsView() {
  const { s, up, toast } = useApp();
  const { open, close } = useModal();
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("All");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("Name");
  const [menu, setMenu] = useState<{ id: string; x: number; y: number; usageOpen: boolean } | null>(null);
  const [profile, setProfile] = useState<StudentRow | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(null); setProfile(null); } };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);

  const rows = s.admin.students
    .filter(st => (st.name + st.email + st.module).toLowerCase().includes(query.toLowerCase()))
    .filter(st => tier === "All" || st.tier === tier)
    .filter(st => status === "All" || st.status === status)
    .sort((a, b) => sort === "Name" ? a.name.localeCompare(b.name) : sort === "Flags" ? b.flags - a.flags : a.quotaHealth.localeCompare(b.quotaHealth));

  const isCurrentStudent = (st: StudentRow) =>
    (Boolean(s.session.email) && st.email.toLowerCase() === s.session.email.toLowerCase()) ||
    (Boolean(s.session.name) && st.name.toLowerCase() === s.session.name.toLowerCase());

  const applyUsage = (st: StudentRow, next: AccountStatus, hours?: number) => {
    const until = hours ? Date.now() + hours * 3600e3 : undefined;
    const isTargetingCurrent = isCurrentStudent(st);
    up(d => {
      const row = d.admin.students.find(x => x.id === st.id);
      if (row) {
        row.status = next; row.until = until;
        row.logs.unshift(`${fmtTime(Date.now(), { hour: "2-digit", minute: "2-digit" })} · Usage → ${next}${hours ? ` (${hours}h)` : ""}`);
      }
      // governance acts on the live session FSM when targeting the signed-in account
      if (isTargetingCurrent) {
        d.session.status = next;
        d.session.inactiveUntil = until;
      }
    });
    setMenu(null);
    if (next === "BAN") toast(`${st.name}: session revoked · ACCOUNT_BANNED`, "err");
    else if (next === "INACTIVE") toast(`${st.name}: access paused ${hours}h — timer running`, "warn");
    else toast(`${st.name}: full access restored`, "ok");
    if (isTargetingCurrent && next !== "ACTIVE") navigate(next === "BAN" ? "/banned" : "/inactive");
  };

  const usagePick = (st: StudentRow, target: AccountStatus) => {
    if (target === "ACTIVE") { applyUsage(st, "ACTIVE"); return; }
    if (target === "BAN") {
      open({
        title: `Ban ${st.name}?`,
        body: <p className="text-sm leading-relaxed" style={{ color: "var(--text-700)" }}>This instantly revokes every session, freezes quotas and stamps the account with a red <strong>ACCOUNT_BANNED</strong> lock badge. The student sees the appeal route.</p>,
        footer: <>
          <button className="btn" onClick={() => close()}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { close(); applyUsage(st, "BAN"); }}><Ban size={15} /> Revoke sessions now</button>
        </>,
      });
      return;
    }
    // INACTIVE → duration picker
    let hours = 24;
    open({
      title: `Pause ${st.name} — duration`,
      body: (
        <div className="space-y-3 text-sm">
          <p style={{ color: "var(--text-700)" }}>Access locks immediately and restores automatically when the timer ends.</p>
          <div className="grid grid-cols-3 gap-2">
            {[{ h: 24, l: "24 hours" }, { h: 72, l: "3 days" }, { h: 168, l: "7 days" }].map((o, oi) => (
              <button key={o.h} className={`btn duration-pick ${oi === 0 ? "btn-primary" : ""}`} data-h={o.h} onClick={e => {
                hours = o.h;
                document.querySelectorAll(".duration-pick").forEach(b => b.classList.remove("btn-primary"));
                (e.currentTarget as HTMLElement).classList.add("btn-primary");
              }}>{o.l}</button>
            ))}
          </div>
          <p className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>default: 24 hours</p>
        </div>
      ),
      footer: <>
        <button className="btn" onClick={() => close()}>Cancel</button>
        <button className="btn btn-warn" onClick={() => { close(); applyUsage(st, "INACTIVE", hours); }}><Timer size={15} /> Lock access</button>
      </>,
    });
  };

  const warnModal = (st: StudentRow) => {
    let reason = "";
    open({
      title: `Warning notice → ${st.name}`,
      body: (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--text-700)" }}>The reason is delivered as a real-time in-app notice and queued to the registered email ({st.email}).</p>
          <label className="field-label" htmlFor="warn-reason">Reason (required)</label>
          <textarea id="warn-reason" data-autofocus className="input min-h-[110px]" placeholder="Cite the charter clause and the observed behaviour…" onChange={e => { reason = e.target.value; }} />
        </div>
      ),
      footer: <>
        <button className="btn" onClick={() => close()}>Cancel</button>
        <button className="btn btn-warn" onClick={() => {
          if (reason.trim().length < 8) { toast("Give a substantive reason (8+ chars)", "warn"); return; }
          up(d => {
            d.admin.warnings.unshift({ id: uid(), student: st.name, reason: reason.trim(), ts: Date.now() });
            const row = d.admin.students.find(x => x.id === st.id);
            if (row) { row.flags += 1; row.logs.unshift(`${fmtTime(Date.now(), { hour: "2-digit", minute: "2-digit" })} · Warning issued: ${reason.trim().slice(0, 40)}…`); }
          });
          close();
          toast(`Warning delivered to ${st.name} · email queued`, "ok");
        }}><ShieldAlert size={15} /> Emit warning + email</button>
      </>,
    });
  };

  const menuRow = menu ? s.admin.students.find(x => x.id === menu.id) : null;

  return (
    <div>
      <PageHeader kicker="every account, accountable" title="Student directory"
        desc="High-density roster with the 3-dot governance menu: PROFILE dossier, WARNING notice, USAGE state machine."
        right={<Pill tone="cobalt">{rows.length} of {s.admin.students.length} shown</Pill>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-300)" }} />
          <input className="input !pl-9" placeholder="Search name, email, module…" aria-label="Search students" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <select className="input !w-auto" aria-label="Filter by tier" value={tier} onChange={e => setTier(e.target.value)}>
          {["All", "A", "B", "C", "D", "E"].map(t => <option key={t} value={t}>{t === "All" ? "All tiers" : `Tier ${t}`}</option>)}
        </select>
        <select className="input !w-auto" aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)}>
          {["All", "ACTIVE", "INACTIVE", "BAN"].map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="input !w-auto" aria-label="Sort students" value={sort} onChange={e => setSort(e.target.value)}>
          {["Name", "Flags", "Quota health"].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <section className="sheet overflow-x-auto">
        <table className="table-dense min-w-[860px]">
          <thead>
            <tr><th>Student</th><th>Tier</th><th>Active module</th><th>Quota health</th><th>Usage state</th><th>Flags</th><th>Last seen</th><th className="text-right">⋯</th></tr>
          </thead>
          <tbody>
            {rows.map(st => (
              <tr key={st.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={st.name} hue={st.name.length * 31 % 360} size={32} />
                    <div>
                      <p className="font-bold">{st.name}{isCurrentStudent(st) && <span className="ml-1.5 font-mono text-[9px]" style={{ color: "var(--cobalt-600)" }}>(session)</span>}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-500)" }}>{st.email}</p>
                    </div>
                  </div>
                </td>
                <td><TierPill tier={st.tier} /></td>
                <td className="font-semibold">{st.module}</td>
                <td><span className="pill !text-[10px]" style={{ background: HEALTH[st.quotaHealth].bg, borderColor: HEALTH[st.quotaHealth].fg, color: HEALTH[st.quotaHealth].fg }}>{st.quotaHealth}</span></td>
                <td>
                  {st.status === "ACTIVE" && <span className="pill !text-[10px]" style={{ background: "var(--forest-100)", borderColor: "var(--forest-500)", color: "var(--forest-700)" }}>● ACTIVE</span>}
                  {st.status === "INACTIVE" && <span className="pill !text-[10px]" style={{ background: "var(--marigold-100)", borderColor: "var(--marigold-900)", color: "var(--marigold-900)" }}><Timer size={10} /> INACTIVE{st.until ? ` · ${Math.max(0, Math.round((st.until - Date.now()) / 3600e3))}h` : ""}</span>}
                  {st.status === "BAN" && <span className="pill !text-[10px]" style={{ background: "var(--accent-500)", borderColor: "var(--accent-600)", color: "#fff" }}><Ban size={10} /> ACCOUNT_BANNED</span>}
                </td>
                <td className="font-mono">{st.flags > 0 ? <span style={{ color: st.flags >= 3 ? "var(--accent-600)" : "var(--marigold-900)" }}>⚑ {st.flags}</span> : <span style={{ color: "var(--text-300)" }}>0</span>}</td>
                <td className="font-mono text-[11px]" style={{ color: "var(--text-500)" }}>{st.lastSeen}</td>
                <td className="text-right">
                  <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Actions for ${st.name}`} aria-expanded={menu?.id === st.id}
                    onClick={e => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setMenu(cur => cur?.id === st.id ? null : { id: st.id, x: Math.min(window.innerWidth - 230, r.right - 210), y: Math.min(window.innerHeight - 240, r.bottom + 6), usageOpen: false });
                    }}>
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center font-hand text-xl" style={{ color: "var(--text-300)" }}>no students match those filters</td></tr>}
          </tbody>
        </table>
      </section>

      {/* 3-dot popover */}
      {menu && menuRow && (
        <div ref={menuRef} className="sheet fixed z-[85] w-[220px] p-1.5" style={{ left: menu.x, top: menu.y, animation: "popIn .18s var(--ease-snap)" }} role="menu" aria-label={`Governance actions for ${menuRow.name}`}>
          <button role="menuitem" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-bold hover:bg-[var(--background-200)]" onClick={() => { setProfile(menuRow); setMenu(null); }}>
            <Eye size={15} style={{ color: "var(--cobalt-600)" }} /> PROFILE
          </button>
          <button role="menuitem" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-bold hover:bg-[var(--background-200)]" onClick={() => { setMenu(null); warnModal(menuRow); }}>
            <ShieldAlert size={15} style={{ color: "var(--marigold-900)" }} /> WARNING
          </button>
          <button role="menuitem" aria-expanded={menu.usageOpen} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-bold hover:bg-[var(--background-200)]" onClick={() => setMenu(m => m && ({ ...m, usageOpen: !m.usageOpen }))}>
            <Zap size={15} style={{ color: "var(--forest-700)" }} /> USAGE <ChevronRight size={14} className="ml-auto transition-transform" style={{ transform: menu.usageOpen ? "rotate(90deg)" : undefined }} />
          </button>
          {menu.usageOpen && (
            <div className="ml-4 border-l-2 pl-2" style={{ borderColor: "var(--background-300)" }}>
              {(["ACTIVE", "INACTIVE", "BAN"] as AccountStatus[]).map(u => (
                <button key={u} role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-[var(--background-200)]"
                  style={{ color: u === "BAN" ? "var(--accent-600)" : u === "INACTIVE" ? "var(--marigold-900)" : "var(--forest-700)" }}
                  onClick={() => usagePick(menuRow, u)}>
                  {u === "ACTIVE" ? "●" : u === "INACTIVE" ? "◐" : "✕"} {u}{menuRow.status === u ? " · current" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* profile drawer */}
      {profile && (
        <div className="fixed inset-0 z-[90]">
          <div className="scrim" onClick={() => setProfile(null)} />
          <aside className="drawer-panel absolute bottom-0 right-0 top-0 w-[min(94vw,400px)] overflow-y-auto border-l-2 p-5" style={{ background: "var(--background-50)", borderColor: "var(--text-900)" }} role="dialog" aria-modal="true" aria-label={`Dossier: ${profile.name}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={profile.name} hue={profile.name.length * 31 % 360} size={48} />
                <div>
                  <h2 className="font-display text-xl font-black">{profile.name}</h2>
                  <p className="text-xs" style={{ color: "var(--text-500)" }}>{profile.email}</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" aria-label="Close dossier" onClick={() => setProfile(null)}><X size={17} /></button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <TierPill tier={profile.tier} />
              <span className="pill !text-[10px]" style={{ background: HEALTH[profile.quotaHealth].bg, borderColor: HEALTH[profile.quotaHealth].fg, color: HEALTH[profile.quotaHealth].fg }}>{profile.quotaHealth}</span>
              <Pill>joined {profile.joined}</Pill>
            </div>

            <div className="sheet mt-5 p-4">
              <SectionHead title="Questionnaire letter scale" />
              <div className="flex gap-2">
                {profile.letters.split("·").map((l, i) => (
                  <span key={i} className="letter-key !h-10 !w-10 !text-lg">{l}</span>
                ))}
              </div>
              <p className="mt-2 font-mono text-[10px]" style={{ color: "var(--text-500)" }}>tier · habits · extracurriculars · coding</p>
            </div>

            <div className="sheet mt-4 p-4">
              <SectionHead title="Quota counters" />
              {[{ l: "Portfolio weekly", v: profile.quotaHealth === "Exceeded" ? 100 : profile.quotaHealth === "Watch" ? 78 : 42 }, { l: "Sandbox weekly", v: profile.quotaHealth === "Exceeded" ? 100 : 60 }, { l: "Assistant daily", v: 36 }].map(q => (
                <div key={q.l} className="mb-2">
                  <div className="flex justify-between text-[11px] font-bold"><span>{q.l}</span><span className="font-mono">{q.v}%</span></div>
                  <div className="gantt-track mt-1 !h-2.5"><div className="gantt-bar" style={{ width: `${q.v}%`, background: q.v >= 100 ? "var(--accent-500)" : q.v > 70 ? "var(--marigold-500)" : "var(--forest-500)" }} /></div>
                </div>
              ))}
            </div>

            <div className="sheet mt-4 p-4">
              <SectionHead title="Community flags" right={<span className="font-mono text-sm font-bold" style={{ color: profile.flags ? "var(--accent-600)" : "var(--forest-700)" }}>⚑ {profile.flags}</span>} />
              <p className="text-xs" style={{ color: "var(--text-500)" }}>{profile.flags === 0 ? "Clean record — no charter violations." : "Flags decay after 30 clean days per charter §4."}</p>
            </div>

            <div className="sheet mt-4 p-4">
              <SectionHead title="Access logs" />
              <ul className="space-y-1.5 font-mono text-[11px]" style={{ color: "var(--text-700)" }}>
                {profile.logs.map((l, i) => <li key={i}>▸ {l}</li>)}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}