/* Academia · Phase 2.2 — docked Buddy drawer: Custom Chat / TallyBud / Adoro Buddy.
   Deterministic FSM interfaces — every answer cites the rule that produced it. */
import { useEffect, useRef, useState } from "react";
import { Bot, Calculator, HeartPulse, Send, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { useApp } from "@/engine/store";
import { isExcludedRoute } from "@/engine/router";
import { customChatReply, tallyBudReply, adoroBuddyReply, type AssistantReply } from "@/engine/rules";
import { QuotaPills } from "@/components/ui";

type TabKey = "Custom Chat" | "TallyBud" | "Adoro Buddy";
interface Msg { id: number; who: "you" | "engine"; text?: string; reply?: AssistantReply }
const TAB_META: Record<TabKey, { icon: React.ReactNode; engine: string; chips: string[] }> = {
  "Custom Chat": { icon: <Bot size={15} />, engine: "intent-table v3 + Catalyst rules", chips: ["Next deadline", "My quota", "Cards due", "Focus time"] },
  "TallyBud": { icon: <Calculator size={15} />, engine: "grade-arithmetic ruleset", chips: ["Current GPA", "Required remaining score", "Weakest course"] },
  "Adoro Buddy": { icon: <HeartPulse size={15} />, engine: "diagnostic threshold FSM", chips: ["Readiness", "Weakest areas", "Plan for today"] },
};
let msgId = 1;

export function AssistantDrawer({ open, onClose, path }: { open: boolean; onClose: () => void; path: string }) {
  const { s, up, toast } = useApp();
  const [tab, setTab] = useState<TabKey>("Custom Chat");
  const [input, setInput] = useState("");
  const [fsm, setFsm] = useState<AssistantReply["fsm"]>("IDLE");
  const [threads, setThreads] = useState<Record<TabKey, Msg[]>>({
    "Custom Chat": [{ id: msgId++, who: "engine", reply: { fsm: "MATCHED", rule: "SYS/BOOT", lines: ["Custom Chat online. I match your text against a fixed intent table plus your Catalyst rules — nothing is generated."] } }],
    TallyBud: [{ id: msgId++, who: "engine", reply: { fsm: "MATCHED", rule: "SYS/BOOT", lines: ["TallyBud reads your Tally grade table directly. Ask for GPA, required scores, or the weakest course."] } }],
    "Adoro Buddy": [{ id: msgId++, who: "engine", reply: { fsm: "MATCHED", rule: "SYS/BOOT", lines: ["Adoro Buddy applies fixed thresholds to your diagnostic scores. Ask about readiness or a plan for today."] } }],
  });
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>(0);

  useEffect(() => { listRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, [threads, tab, fsm]);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  /* Strict route-exclusion guard: unmount the whole assistant surface */
  if (isExcludedRoute(path)) return null;
  if (!open) return null;

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || fsm === "PARSING") return;
    if (s.quotas.chat.d <= 0 || s.quotas.chat.w <= 0) { toast("Assistant quota exhausted — resets at midnight", "warn"); return; }
    up(d => { d.quotas.chat.d -= 1; d.quotas.chat.w -= 1; });
    setThreads(t => ({ ...t, [tab]: [...t[tab], { id: msgId++, who: "you", text: trimmed }] }));
    setInput("");
    setFsm("PARSING");
    timerRef.current = window.setTimeout(() => {
      const reply = tab === "Custom Chat" ? customChatReply(trimmed, s) : tab === "TallyBud" ? tallyBudReply(trimmed, s) : adoroBuddyReply(trimmed, s);
      setThreads(t => ({ ...t, [tab]: [...t[tab], { id: msgId++, who: "engine", reply }] }));
      setFsm(reply.fsm);
    }, 420);
  };

  const meta = TAB_META[tab];
  const fsmColor = fsm === "MATCHED" ? "var(--forest-500)" : fsm === "FALLBACK" ? "var(--marigold-500)" : fsm === "PARSING" ? "var(--cobalt-500)" : "var(--text-300)";

  return (
    <>
      <div className="scrim xl:hidden" onClick={onClose} />
      <aside className="drawer-panel fixed bottom-0 right-0 top-0 z-[95] flex w-[min(94vw,380px)] flex-col border-l-2"
        style={{ background: "var(--background-50)", borderColor: "var(--text-900)" }}
        role="complementary" aria-label="Assistant drawer">
        <div className="flex items-center gap-2 border-b-2 px-4 py-3" style={{ borderColor: "var(--text-900)" }}>
          <span className="font-display text-lg font-bold">Buddy drawer</span>
          <span className="pill !text-[10px]" style={{ borderColor: fsmColor, color: fsmColor }}>
            <span className={cn("inline-block h-2 w-2 rounded-full", fsm === "PARSING" && "pulse-dot")} style={{ background: fsmColor }} />
            FSM · {fsm}
          </span>
          <button className="btn btn-ghost btn-icon btn-sm ml-auto" aria-label="Close assistant drawer" onClick={onClose}><X size={18} /></button>
        </div>

        <div role="tablist" aria-label="Assistant engines" className="flex gap-1.5 border-b-2 border-dashed px-3 py-2.5" style={{ borderColor: "var(--background-300)" }}>
          {(Object.keys(TAB_META) as TabKey[]).map(k => (
            <button key={k} role="tab" aria-selected={tab === k} className="pill pill-tab !px-2.5 !text-[11px]" onClick={() => { setTab(k); setFsm("IDLE"); }}>
              {TAB_META[k].icon}{k}
            </button>
          ))}
        </div>
        <p className="px-4 pt-2 font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--text-500)" }}>engine: {meta.engine}</p>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {threads[tab].map(m => m.who === "you" ? (
            <div key={m.id} className="ml-8 rounded-xl border-2 px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--text-900)", background: "var(--cobalt-100)", boxShadow: "2px 2px 0 var(--text-950)" }}>{m.text}</div>
          ) : (
            <div key={m.id} className="mr-4 rounded-xl border-2 px-3 py-2.5" style={{ borderColor: "var(--text-900)", background: "var(--surface)", boxShadow: "2px 2px 0 var(--text-950)" }}>
              <p className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: m.reply!.fsm === "FALLBACK" ? "var(--marigold-900)" : "var(--forest-700)" }}>▸ {m.reply!.rule}</p>
              {m.reply!.lines.map((l, i) => <p key={i} className="text-[13px] leading-relaxed">{l}</p>)}
            </div>
          ))}
          {fsm === "PARSING" && <p className="terminal-line blink-cursor" style={{ color: "var(--text-500)" }}>matching rules</p>}
        </div>

        <div className="border-t-2 px-3 py-2.5" style={{ borderColor: "var(--text-900)" }}>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {meta.chips.map(c => (
              <button key={c} className="pill pill-tab !min-h-[30px] !px-2.5 !text-[11px]" onClick={() => send(c)}>{c}</button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); send(input); }}>
            <input className="input !min-h-[42px] flex-1" placeholder={`Ask ${tab}…`} aria-label={`Message ${tab}`} value={input} onChange={e => setInput(e.target.value)} />
            <button className="btn btn-primary btn-icon" type="submit" aria-label="Send message" disabled={!input.trim() || fsm === "PARSING"}><Send size={17} /></button>
          </form>
          <div className="mt-2 flex items-center justify-between">
            <QuotaPills module="chat" />
            <span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>rule-traced replies</span>
          </div>
        </div>
      </aside>
    </>
  );
}