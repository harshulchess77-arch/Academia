/* Academia · Phase 3.7 — Catalyst Engine: drag-and-drop deterministic rule builder */
import { useState } from "react";
import { ArrowRight, Filter, GripVertical, MessageSquare, Play, Plus, Trash2, X, Zap } from "lucide-react";
import { useApp, uid } from "@/engine/store";
import { PageHeader, Pill, SectionHead, Toggle } from "@/components/ui";
import { cn } from "@/utils/cn";

const TRIGGERS = ["Keyword match", "Quota threshold", "Study streak break", "Deadline proximity"];
const TEMPLATES = [
  "Open Inventory → Milestones to see your next deadline ladder.",
  "Log one 25-minute Pomodoro; the heatmap square fills, no penalties.",
  "Rate your due Library cards — SM-2 will reschedule automatically.",
  "Save a rollback snapshot before your next sandbox run.",
];

export function CatalystView() {
  const { s, up, toast } = useApp();
  const [trigger, setTrigger] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kw, setKw] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const onDrop = (slot: "trigger" | "response") => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const kind = e.dataTransfer.getData("text/kind");
    const value = e.dataTransfer.getData("text/plain");
    if (slot === "trigger" && kind === "trigger") setTrigger(value);
    else if (slot === "response" && kind === "template") { setResponse(value); setCustom(value); }
    else toast(`That node doesn't fit the ${slot} slot`, "warn");
  };
  const dragProps = (kind: string, value: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData("text/plain", value); e.dataTransfer.setData("text/kind", kind); },
  });

  const ready = trigger && keywords.length > 0 && (custom.trim().length > 0);
  const save = () => {
    if (!ready) return;
    up(d => { d.rules.unshift({ id: uid(), trigger: trigger!, keywords: [...keywords], response: custom.trim(), enabled: true }); });
    setTrigger(null); setKeywords([]); setResponse(null); setCustom("");
    toast("Rule compiled into the engine — live in Custom Chat", "ok");
  };

  const runTest = () => {
    const t = testInput.toLowerCase();
    const hit = s.rules.find(r => r.enabled && r.keywords.some(k => t.includes(k.toLowerCase())));
    setTestResult(hit ? `RULE ${hit.id} · ${hit.trigger} → ${hit.response}` : "NO_RULE_MATCHED — engine stays silent (nothing is generated).");
  };

  const slotCls = (name: string) => cn("min-h-[86px] rounded-xl border-2 border-dashed p-3 transition-all", dragOver === name && "scale-[1.02]");

  return (
    <div>
      <PageHeader kicker="if this, then exactly this" title="Catalyst Engine"
        desc="Assemble trigger → keyword → response rules by drag-and-drop. Compiled rules run inside Custom Chat ahead of the built-in intent table."
        right={<Pill tone="forest">{s.rules.filter(r => r.enabled).length} rules live</Pill>} />

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        {/* palette */}
        <aside className="space-y-5">
          <section className="sheet p-4">
            <SectionHead title="Trigger pills" />
            <div className="flex flex-wrap gap-2">
              {TRIGGERS.map(t => (
                <button key={t} {...dragProps("trigger", t)} className="pill pill-tab cursor-grab active:cursor-grabbing"
                  onClick={() => setTrigger(t)} aria-label={`Trigger ${t} — drag or click to place`}>
                  <GripVertical size={12} /> <Zap size={12} style={{ color: "var(--marigold-900)" }} /> {t}
                </button>
              ))}
            </div>
          </section>
          <section className="sheet p-4">
            <SectionHead title="Response blocks" />
            <div className="space-y-2">
              {TEMPLATES.map(t => (
                <button key={t} {...dragProps("template", t)} onClick={() => { setResponse(t); setCustom(t); }}
                  className="w-full cursor-grab rounded-lg border-2 px-3 py-2 text-left text-xs font-medium leading-relaxed active:cursor-grabbing"
                  style={{ borderColor: "var(--text-900)", background: "var(--background-50)", boxShadow: "2px 2px 0 var(--text-950)" }}>
                  <MessageSquare size={12} className="mb-1" style={{ color: "var(--cobalt-500)" }} /> {t}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <div className="space-y-6">
          {/* assembly line */}
          <section className="sheet sheet-dotted p-5">
            <SectionHead title="Rule assembly line" right={<span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>drag nodes into slots (or click)</span>} />
            <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1.3fr]">
              <div className={slotCls("trigger")} style={{ borderColor: trigger ? "var(--forest-500)" : "var(--text-300)", background: trigger ? "var(--forest-100)" : "var(--surface)" }}
                onDragOver={e => { e.preventDefault(); setDragOver("trigger"); }} onDragLeave={() => setDragOver(null)} onDrop={onDrop("trigger")}
                aria-label="Trigger slot">
                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}><Zap size={11} /> WHEN trigger</p>
                {trigger ? <span className="pill" style={{ background: "var(--surface)" }}>{trigger} <button aria-label="Remove trigger" onClick={() => setTrigger(null)}><X size={12} /></button></span>
                  : <p className="text-xs" style={{ color: "var(--text-300)" }}>drop a trigger pill here</p>}
              </div>
              <ArrowRight className="hidden self-center md:block" size={20} aria-hidden />
              <div className={slotCls("keywords")} style={{ borderColor: keywords.length ? "var(--forest-500)" : "var(--text-300)", background: keywords.length ? "var(--cobalt-100)" : "var(--surface)" }} aria-label="Keyword filter node">
                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}><Filter size={11} /> IF keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map(k => <span key={k} className="pill !text-[11px]">{k}<button aria-label={`Remove keyword ${k}`} onClick={() => setKeywords(x => x.filter(y => y !== k))}><X size={11} /></button></span>)}
                </div>
                <form onSubmit={e => { e.preventDefault(); if (kw.trim() && !keywords.includes(kw.trim())) setKeywords(x => [...x, kw.trim()]); setKw(""); }} className="mt-1.5 flex gap-1.5">
                  <input className="input !min-h-[32px] !py-1 !text-xs" placeholder="add keyword…" aria-label="Add keyword" value={kw} onChange={e => setKw(e.target.value)} />
                  <button className="btn btn-sm btn-icon" type="submit" aria-label="Add keyword"><Plus size={13} /></button>
                </form>
              </div>
              <ArrowRight className="hidden self-center md:block" size={20} aria-hidden />
              <div className={slotCls("response")} style={{ borderColor: response ? "var(--forest-500)" : "var(--text-300)", background: response ? "var(--marigold-100)" : "var(--surface)" }}
                onDragOver={e => { e.preventDefault(); setDragOver("response"); }} onDragLeave={() => setDragOver(null)} onDrop={onDrop("response")}
                aria-label="Response slot">
                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}><MessageSquare size={11} /> THEN respond</p>
                <textarea className="input min-h-[64px] !text-xs" placeholder="drop a template block, or write the exact reply…" aria-label="Rule response text" value={custom} onChange={e => { setCustom(e.target.value); setResponse(e.target.value || null); }} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[11px]" style={{ color: "var(--text-500)" }}>
                compile: {trigger ?? "—"} ∧ [{keywords.join(", ") || "—"}] → {custom ? `${custom.slice(0, 34)}…` : "—"}
              </p>
              <button className="btn btn-primary" disabled={!ready} onClick={save}><Plus size={16} /> Compile rule</button>
            </div>
          </section>

          {/* test console */}
          <section className="sheet p-5">
            <SectionHead title="Deterministic test console" />
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); runTest(); }}>
              <input className="input" placeholder="type a sample student message…" aria-label="Test message" value={testInput} onChange={e => setTestInput(e.target.value)} />
              <button className="btn btn-warn" type="submit"><Play size={15} /> Evaluate</button>
            </form>
            {testResult && (
              <p className="mt-3 rounded-lg border-2 p-3 font-mono text-xs leading-relaxed" style={{ borderColor: testResult.startsWith("NO_RULE") ? "var(--marigold-500)" : "var(--forest-500)", background: "var(--background-50)" }}>
                {testResult}
              </p>
            )}
          </section>

          {/* compiled rules */}
          <section className="sheet p-5">
            <SectionHead title={`Compiled rules (${s.rules.length})`} />
            <ul className="space-y-3">
              {s.rules.map(r => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border-2 p-3" style={{ borderColor: "var(--text-900)", background: r.enabled ? "var(--surface)" : "var(--background-200)", opacity: r.enabled ? 1 : 0.65 }}>
                  <span className="pill !text-[10px]" style={{ background: "var(--marigold-100)" }}>{r.trigger}</span>
                  <span className="font-mono text-[11px]" style={{ color: "var(--cobalt-600)" }}>[{r.keywords.join(", ")}]</span>
                  <p className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--text-700)" }}>→ {r.response}</p>
                  <Toggle on={r.enabled} label={`Rule ${r.id} enabled`} onChange={v => up(d => { const x = d.rules.find(y => y.id === r.id); if (x) x.enabled = v; })} />
                  <button className="btn btn-ghost btn-icon btn-sm" aria-label="Delete rule" style={{ color: "var(--accent-600)" }}
                    onClick={() => { up(d => { d.rules = d.rules.filter(y => y.id !== r.id); }); toast("Rule deleted", "err", { label: "Undo", fn: () => up(d => { d.rules.unshift(r); }) }); }}>
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}