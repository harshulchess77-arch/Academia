/* Academia · Phase 3.10 — admin broadcast feed with pins, tiers, read receipts */
import { useState } from "react";
import { Check, CheckCheck, ChevronDown, Pin } from "lucide-react";
import { useApp, type Tier } from "@/engine/store";
import { PageHeader, Pill } from "@/components/ui";
import { cn } from "@/utils/cn";

const PRIORITY = {
  pinned: { label: "PINNED", bg: "var(--accent-500)", fg: "#fff" },
  high: { label: "HIGH", bg: "var(--marigold-500)", fg: "var(--text-950)" },
  normal: { label: "NOTICE", bg: "var(--cobalt-100)", fg: "var(--cobalt-600)" },
};

export function AnnouncementsView() {
  const { s, up, toast } = useApp();
  const [tier, setTier] = useState<"All" | Tier>("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const order = { pinned: 0, high: 1, normal: 2 };
  const list = [...s.announcements]
    .sort((a, b) => order[a.priority] - order[b.priority] || b.ts - a.ts)
    .filter(a => tier === "All" || a.tiers.includes(tier));
  const unread = s.announcements.filter(a => !a.read).length;

  const toggle = (id: string) => {
    setOpenId(cur => (cur === id ? null : id));
    up(d => { const a = d.announcements.find(x => x.id === id); if (a) a.read = true; });
  };

  return (
    <div>
      <PageHeader kicker="from the registrar's desk" title="Announcements"
        desc="Admin broadcasts with priority pins and tier targeting. Opening a notice signs its read receipt."
        right={<>
          <Pill tone={unread ? "accent" : "forest"}>{unread} unread</Pill>
          <button className="btn btn-sm" onClick={() => { up(d => { d.announcements.forEach(a => { a.read = true; }); }); toast("All receipts signed", "ok"); }}>
            <CheckCheck size={14} /> Mark all read
          </button>
        </>} />

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by tier">
        {(["All", "A", "B", "C", "D", "E"] as const).map(t => (
          <button key={t} className="pill pill-tab" aria-pressed={tier === t}
            style={tier === t && t !== "All" ? { background: `var(--tier-${t.toLowerCase()})`, color: "#fff", borderColor: "var(--text-900)" } : undefined}
            onClick={() => setTier(t)}>
            {t === "All" ? "All tiers" : `Tier ${t}`}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {list.map((a, i) => {
          const p = PRIORITY[a.priority];
          const open = openId === a.id;
          return (
            <article key={a.id} className={cn("sheet fade-up overflow-hidden", !a.read && "border-l-8")}
              style={{ "--stagger": i, borderLeftColor: !a.read ? "var(--accent-500)" : undefined } as React.CSSProperties}>
              <button className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left" onClick={() => toggle(a.id)} aria-expanded={open}>
                <span className="pill !text-[10px]" style={{ background: p.bg, color: p.fg, borderColor: "var(--text-900)" }}>
                  {a.priority === "pinned" && <Pin size={11} />} {p.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px] leading-snug", a.read ? "font-semibold" : "font-black")}>{a.title}</span>
                  <span className="mt-0.5 block text-xs" style={{ color: "var(--text-500)" }}>
                    {a.author} · {new Date(a.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
                <span className="hidden gap-1 sm:flex" aria-label={`Targets tiers ${a.tiers.join(", ")}`}>
                  {a.tiers.map(t => <span key={t} className="pill !px-2 !text-[10px]" style={{ borderColor: `var(--tier-${t.toLowerCase()})`, color: `var(--tier-${t.toLowerCase()})` }}>{t}</span>)}
                </span>
                <span className="flex items-center gap-1 font-mono text-[10px]" style={{ color: a.read ? "var(--forest-700)" : "var(--text-500)" }}>
                  {a.read ? <><CheckCheck size={14} /> READ</> : <><Check size={14} /> DELIVERED</>}
                </span>
                <ChevronDown size={17} className="transition-transform" style={{ transform: open ? "rotate(180deg)" : undefined }} aria-hidden />
              </button>
              {open && (
                <div className="border-t-2 border-dashed px-5 py-4" style={{ borderColor: "var(--background-300)", animation: "slideDown .2s var(--ease-out)" }}>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-700)" }}>{a.body}</p>
                  <p className="mt-3 font-mono text-[10px]" style={{ color: "var(--forest-700)" }}>✓ read receipt signed {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · receipt id rcpt_{a.id}</p>
                </div>
              )}
            </article>
          );
        })}
        {list.length === 0 && <p className="sheet p-10 text-center font-hand text-2xl" style={{ color: "var(--text-300)" }}>no broadcasts target Tier {tier} yet</p>}
      </div>
    </div>
  );
}