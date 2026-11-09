/* Academia · Phase 2.1 — binder spine + module index + notebook canvas shell */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen, Calculator, CircuitBoard, Flag, Folder, HeartPulse, Home, LayoutGrid, Lock,
  LogOut, Megaphone, Menu, MessageSquareText, Moon, Network, NotebookPen, PanelLeft,
  PenLine, PlaySquare, Presentation, Shield, Sigma, SquareTerminal, Sun, Target, Timer, Users, UsersRound, Workflow, Wrench, X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useApp, verifyAdminClaims } from "@/engine/store";
import { navigate } from "@/engine/router";
import { QuotaPills } from "@/components/ui";
import { AssistantDrawer } from "@/components/chatbot/assistant";
import { CrdtSyncBar } from "@/components/shared/crdt-sync";

export interface ModuleDef { path: string; label: string; icon: ReactNode; group: "Learn" | "Build" | "Track" | "Govern"; badge?: "sandbox" | "portfolio" | "unread" }
export const MODULES: ModuleDef[] = [
  { path: "/dashboard", label: "Dashboard", icon: <Home size={19} />, group: "Learn" },
  { path: "/library", label: "Library", icon: <BookOpen size={19} />, group: "Learn" },
  { path: "/tutor", label: "AI Tutor", icon: <Presentation size={19} />, group: "Learn" },
  { path: "/media", label: "Media", icon: <PlaySquare size={19} />, group: "Learn" },
  { path: "/atlas", label: "Knowledge Atlas", icon: <Network size={19} />, group: "Learn" },
  { path: "/sandbox", label: "Sandbox", icon: <SquareTerminal size={19} />, group: "Build", badge: "sandbox" },
  { path: "/scratchpad", label: "Scratchpad", icon: <PenLine size={19} />, group: "Build" },
  { path: "/numera", label: "Numera Engine", icon: <Sigma size={19} />, group: "Build" },
  { path: "/workbench", label: "Workbench", icon: <CircuitBoard size={19} />, group: "Build" },
  { path: "/catalyst", label: "Catalyst Engine", icon: <Workflow size={19} />, group: "Build" },
  { path: "/inventory", label: "Inventory", icon: <Flag size={19} />, group: "Track" },
  { path: "/portfolio", label: "Portfolio", icon: <Folder size={19} />, group: "Track", badge: "portfolio" },
  { path: "/tally", label: "Tally", icon: <Calculator size={19} />, group: "Track" },
  { path: "/pomodoro", label: "Pomodoro", icon: <Timer size={19} />, group: "Track" },
  { path: "/adoro", label: "Adoro Report", icon: <HeartPulse size={19} />, group: "Track" },
  { path: "/locker", label: "Locker", icon: <Lock size={19} />, group: "Track" },
  { path: "/announcements", label: "Announcements", icon: <Megaphone size={19} />, group: "Track", badge: "unread" },
  { path: "/community", label: "Community", icon: <Users size={19} />, group: "Track" },
  { path: "/admin/dashboard", label: "Admin Telemetry", icon: <Shield size={19} />, group: "Govern" },
  { path: "/admin/students", label: "Student Directory", icon: <UsersRound size={19} />, group: "Govern" },
];
const GROUPS = [
  { key: "Learn", icon: <BookOpen size={20} /> },
  { key: "Build", icon: <Wrench size={20} /> },
  { key: "Track", icon: <Target size={20} /> },
  { key: "Govern", icon: <Shield size={20} /> },
] as const;

export function Shell({ path, children }: { path: string; children: ReactNode }) {
  const { s, up } = useApp();
  const [indexOpen, setIndexOpen] = useState(true);
  const [mobileIndex, setMobileIndex] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const unread = s.announcements.filter(a => !a.read).length;
  const isAdmin = verifyAdminClaims(s.session);
  const active = MODULES.find(m => m.path === path);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenu(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => { setMobileIndex(false); }, [path]);

  const visibleModules = MODULES.filter(m => (m.group !== "Govern" || isAdmin) && (!group || m.group === group));

  const indexList = (
    <nav aria-label="Module index" className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <LayoutGrid size={15} aria-hidden style={{ color: "var(--text-500)" }} />
        <span className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: "var(--text-500)" }}>Module index</span>
        <button className="ml-auto lg:hidden" aria-label="Close index" onClick={() => setMobileIndex(false)}><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {(["Learn", "Build", "Track", "Govern"] as const).map(g => {
          const mods = visibleModules.filter(m => m.group === g);
          if (!mods.length) return null;
          return (
            <div key={g} className="mb-3">
              <p className="px-2 py-1 font-hand text-lg" style={{ color: "var(--accent-500)" }}>{g}</p>
              {mods.map(m => (
                <button key={m.path} onClick={() => navigate(m.path)}
                  aria-current={path === m.path ? "page" : undefined}
                  className={cn("mb-1 flex w-full items-center gap-2.5 rounded-lg border-2 px-2.5 py-2 text-left text-[13px] font-semibold transition-all")}
                  style={path === m.path
                    ? { borderColor: "var(--text-900)", background: "var(--marigold-500)", color: "var(--text-950)", boxShadow: "2px 2px 0 var(--text-950)" }
                    : { borderColor: "transparent", color: "var(--text-700)" }}>
                  <span aria-hidden>{m.icon}</span>
                  <span className="flex-1 truncate">{m.label}</span>
                  {m.badge === "unread" && unread > 0 && <span className="pill !px-2 !py-0 text-[10px]" style={{ background: "var(--accent-500)", color: "#fff", borderColor: "var(--text-900)" }}>{unread}</span>}
                  {m.badge === "sandbox" && <span className="font-mono text-[10px]" style={{ color: path === m.path ? "var(--text-950)" : "var(--text-500)" }}>{s.quotas.sandbox.d}/1</span>}
                  {m.badge === "portfolio" && <span className="font-mono text-[10px]" style={{ color: path === m.path ? "var(--text-950)" : "var(--text-500)" }}>{s.quotas.portfolio.d}/3</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="border-t-2 border-dashed p-3" style={{ borderColor: "var(--background-300)" }}>
        <button className="btn btn-primary w-full" onClick={() => { setAssistantOpen(true); setMobileIndex(false); }}>
          <MessageSquareText size={16} /> Open assistants
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <a href="#main-canvas" className="skip-link btn btn-warn btn-sm" onClick={e => { e.preventDefault(); const m = document.getElementById("main-canvas"); m?.focus(); m?.scrollIntoView(); }}>Skip to content</a>

      {/* binder spine — desktop & tablet */}
      <aside className="spine relative z-40 hidden w-[72px] flex-none flex-col items-center gap-2 border-r-2 py-3 md:flex" style={{ borderColor: "var(--text-950)" }} aria-label="Binder spine">
        <button className="mb-1 grid h-11 w-11 place-items-center rounded-xl border-2" style={{ background: "var(--accent-500)", borderColor: "var(--text-950)", boxShadow: "2px 2px 0 var(--text-950)" }} aria-label="Academia home" onClick={() => navigate("/dashboard")}>
          <NotebookPen size={22} color="#fff" />
        </button>
        <div className="mb-1 flex flex-col gap-2.5" aria-hidden>
          <span className="spine-ring" /><span className="spine-ring" />
        </div>
        {GROUPS.filter(g => g.key !== "Govern" || isAdmin).map(g => (
          <button key={g.key} className={cn("spine-btn", group === g.key && "active")} title={g.key}
            aria-label={`${g.key} modules`} aria-pressed={group === g.key}
            onClick={() => { setGroup(cur => (cur === g.key ? null : g.key)); setIndexOpen(true); }}>
            {g.icon}
          </button>
        ))}
        <div className="mt-auto flex flex-col items-center gap-2.5">
          <span className="spine-ring" aria-hidden />
          <button className="spine-btn" aria-label={s.theme === "paper" ? "Switch to midnight paper" : "Switch to daylight paper"} onClick={() => up(d => { d.theme = d.theme === "paper" ? "midnight" : "paper"; })}>
            {s.theme === "paper" ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </aside>

      {/* collapsible module index — desktop */}
      {indexOpen && (
        <aside className="z-30 hidden w-[240px] flex-none border-r-2 lg:block" style={{ background: "var(--background-50)", borderColor: "var(--text-900)" }}>
          {indexList}
        </aside>
      )}

      {/* mobile / tablet index overlay */}
      {mobileIndex && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="scrim" onClick={() => setMobileIndex(false)} />
          <div className="drawer-panel absolute bottom-0 left-0 top-0 w-[280px] border-r-2" style={{ background: "var(--background-50)", borderColor: "var(--text-900)", animation: "slideLeft .25s var(--ease-out) reverse" }}>
            {indexList}
          </div>
        </div>
      )}

      {/* canvas column */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-[60px] flex-none items-center gap-2 border-b-2 px-3 md:px-5" style={{ background: "var(--background-50)", borderColor: "var(--text-900)" }}>
          <button className="btn btn-ghost btn-icon btn-sm hidden lg:inline-flex" aria-label={indexOpen ? "Collapse module index" : "Expand module index"} onClick={() => setIndexOpen(o => !o)}>
            <PanelLeft size={18} />
          </button>
          <button className="btn btn-ghost btn-icon btn-sm lg:hidden" aria-label="Open module index" onClick={() => setMobileIndex(true)}>
            <Menu size={19} />
          </button>
          <div className="min-w-0">
            <p className="hidden text-[10px] font-bold uppercase tracking-[.16em] md:block" style={{ color: "var(--text-500)" }}>Academia · {active?.group ?? "Workspace"}</p>
            <h1 className="truncate font-display text-base font-bold leading-tight">{active?.label ?? "Workspace"}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden md:block"><QuotaPills module="chat" compact /></span>
            <button className={cn("btn btn-sm", assistantOpen ? "btn-ink" : "btn-warn")} aria-pressed={assistantOpen} onClick={() => setAssistantOpen(o => !o)}>
              <MessageSquareText size={16} /> <span className="hidden sm:inline">Buddy</span>
            </button>
            <div className="relative" ref={menuRef}>
              <button aria-label="Account menu" aria-expanded={userMenu} onClick={() => setUserMenu(o => !o)}
                className="grid h-10 w-10 place-items-center rounded-full border-2 font-display text-sm font-bold"
                style={{ borderColor: "var(--text-900)", background: "var(--cobalt-100)", boxShadow: "2px 2px 0 var(--text-950)" }}>
                {s.session.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
              </button>
              {userMenu && (
                <div className="sheet absolute right-0 top-12 z-50 w-60 p-2" role="menu">
                  <div className="border-b-2 border-dashed px-3 py-2" style={{ borderColor: "var(--background-300)" }}>
                    <p className="text-sm font-bold">{s.session.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-500)" }}>{s.session.email}</p>
                    <span className="pill mt-1.5 !text-[10px]" style={{ background: "var(--forest-100)", borderColor: "var(--forest-500)", color: "var(--forest-700)" }}>{s.session.status} · Tier {s.session.tier}</span>
                  </div>
                  {isAdmin && (
                    <button role="menuitem" className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--background-200)]"
                      style={{ color: "var(--accent-600)" }}
                      onClick={() => {
                        setUserMenu(false);
                        navigate("/admin/console");
                      }}>
                      <Shield size={16} /> Admin Console
                    </button>
                  )}
                  <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--background-200)] md:hidden"
                    onClick={() => up(d => { d.theme = d.theme === "paper" ? "midnight" : "paper"; })}>
                    {s.theme === "paper" ? <Moon size={16} /> : <Sun size={16} />} {s.theme === "paper" ? "Midnight paper" : "Daylight paper"}
                  </button>
                  <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--background-200)]"
                    style={{ color: "var(--accent-600)" }}
                    onClick={() => {
                      up(d => {
                        d.session.authed = false;
                        d.session.role = "student";
                        d.session.tokenClaims = undefined;
                        d.session.accessToken = undefined;
                      });
                      setUserMenu(false);
                      navigate("/");
                    }}>
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="main-canvas" tabIndex={-1} className={cn("relative flex-1 overflow-y-auto pb-24 outline-none md:pb-16", assistantOpen && "xl:pr-[380px]")} style={{ transition: "padding-right .25s var(--ease-out)" }}>
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">{children}</div>
          <CrdtSyncBar />
        </main>

        {/* mobile bottom pill nav */}
        <nav className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border-2 px-2 py-1.5 md:hidden"
          style={{ background: "var(--text-900)", borderColor: "var(--text-950)", boxShadow: "var(--shadow-hard)" }} aria-label="Primary">
          {[MODULES[0], MODULES[1], MODULES[4], MODULES[9]].map(m => (
            <button key={m.path} onClick={() => navigate(m.path)} aria-label={m.label} aria-current={path === m.path ? "page" : undefined}
              className="grid min-h-[48px] min-w-[48px] place-items-center rounded-full transition-colors"
              style={path === m.path ? { background: "var(--marigold-500)", color: "var(--text-950)" } : { color: "var(--background-300)" }}>
              {m.icon}
            </button>
          ))}
          <button onClick={() => setMobileIndex(true)} aria-label="All modules" className="grid min-h-[48px] min-w-[48px] place-items-center rounded-full" style={{ color: "var(--background-300)" }}>
            <Menu size={19} />
          </button>
        </nav>
      </div>

      <AssistantDrawer open={assistantOpen} onClose={() => setAssistantOpen(false)} path={path} />
    </div>
  );
}