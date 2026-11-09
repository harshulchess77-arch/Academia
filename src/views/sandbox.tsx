/* Academia · Phase 3.5 — deterministic sandbox: acad-vm editor, wasm runner, rollback snapshots.
   Enhanced with real-time predictive shallow parsing, automated rolling snapshot manager,
   and infinite loop / step budget pre-execution diagnostics. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, History, Play, SquareTerminal, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";
import { useApp, spendQuota, uid, fmtDate, fmtTime } from "@/engine/store";
import { runProgram, analyzeCode, type RunResult, type CodeDiagnostic } from "@/engine/interpreter";
import { PageHeader, QuotaPills, Toggle } from "@/components/ui";

export function SandboxView() {
  const { s, up, toast } = useApp();
  const [result, setResult] = useState<RunResult | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [snapId, setSnapId] = useState(s.sandbox.snapshots[0]?.id ?? "");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef(0);
  const autoSnapRef = useRef<NodeJS.Timeout | null>(null);

  const code = s.sandbox.code;
  const enabled = s.questionnaire.sandboxEnabled;
  const lineCount = code.split("\n").length;

  // 1. Live Pre-Compilation Predictive Diagnostics
  const diagnostics = useMemo<CodeDiagnostic[]>(() => {
    return analyzeCode(code);
  }, [code]);

  const hasBlockingErrors = diagnostics.some(d => d.severity === "error");

  const setCode = (v: string) => {
    up(d => { d.sandbox.code = v; });
  };

  // 2. Automated Session Snapshot Rolling Manager
  // Debounced auto-snapshot (every 30 seconds of active editing, keeps up to 10 rolling snapshots)
  useEffect(() => {
    if (autoSnapRef.current) clearTimeout(autoSnapRef.current);
    autoSnapRef.current = setTimeout(() => {
      if (!code.trim() || s.sandbox.snapshots.some(sn => sn.code === code)) return;
      const timeStr = fmtTime(Date.now(), { hour: "2-digit", minute: "2-digit" });
      const autoSnap = {
        id: uid(),
        label: `Auto-save · ${timeStr}`,
        code,
        ts: Date.now(),
      };
      up(d => {
        // Roll snapshots: keep at most 10 recent snapshots
        d.sandbox.snapshots = [autoSnap, ...d.sandbox.snapshots.slice(0, 9)];
      });
    }, 15000);

    return () => {
      if (autoSnapRef.current) clearTimeout(autoSnapRef.current);
    };
  }, [code, s.sandbox.snapshots, up]);

  const run = () => {
    if (!enabled) {
      toast("Sandbox disabled by your questionnaire (sandbox_enabled=false)", "warn");
      return;
    }
    if (hasBlockingErrors) {
      toast("Cannot execute: fix pre-compilation errors highlighted below", "err");
      return;
    }
    if (!spendQuota(s, "sandbox")) {
      toast("Run quota spent — 1/day · 5/weekly. Trace on paper until reset.", "warn");
      return;
    }
    up(d => { d.quotas.sandbox.d -= 1; d.quotas.sandbox.w -= 1; });
    setCompiling(true);
    setResult(null);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const r = runProgram(code);
      setResult(r);
      setCompiling(false);
      up(d => { d.sandbox.runs += 1; });
      toast(r.ok ? `exit 0 · ${r.steps} ops · ${r.ms.toFixed(1)}ms` : "exit 1 — see terminal", r.ok ? "ok" : "err");
    }, 450);
  };

  const rollback = () => {
    const snap = s.sandbox.snapshots.find(x => x.id === snapId);
    if (!snap) { toast("Pick a snapshot first", "warn"); return; }
    const prev = code;
    setCode(snap.code);
    setResult(null);
    toast(`Rolled back to “${snap.label}”`, "info", { label: "Undo", fn: () => setCode(prev) });
  };

  const saveSnapshot = () => {
    const label = `Manual Snapshot · ${fmtTime(Date.now(), { hour: "2-digit", minute: "2-digit" })}`;
    up(d => {
      d.sandbox.snapshots.unshift({ id: uid(), label, code, ts: Date.now() });
    });
    toast("Rollback snapshot saved to session wallet", "ok");
  };

  return (
    <div>
      <PageHeader
        kicker="same input, same output"
        title="Sandbox"
        desc="Deterministic acad-vm virtual machine executing bounded ASTs without eval(). Pre-compilation static checks eliminate infinite loops and step budget exhausts before execution."
        right={<QuotaPills module="sandbox" />}
      />

      {!enabled && (
        <div className="warn-slide mb-5 flex flex-wrap items-center gap-3 rounded-xl border-2 px-4 py-3" style={{ borderColor: "var(--marigold-500)", background: "var(--marigold-100)" }}>
          <p className="flex-1 text-sm font-semibold" style={{ color: "var(--marigold-900)" }}>
            Your questionnaire set <code className="font-mono">sandbox_enabled = false</code>. You can opt in — execution stays quota-bound.
          </p>
          <Toggle on={enabled} label="Enable sandbox" onChange={v => up(d => { d.questionnaire.sandboxEnabled = v; })} />
        </div>
      )}

      {/* Toolbar with Automated Rolling Snapshot Manager */}
      <div className="sheet mb-5 flex flex-wrap items-center gap-3 p-3">
        <span className="pill" style={{ background: "var(--cobalt-100)" }}>
          <History size={13} /> Rolling Snapshots ({s.sandbox.snapshots.length})
        </span>
        <select
          className="input !min-h-[38px] !w-auto max-w-[260px] flex-1 !py-1.5 !text-[13px]"
          aria-label="Rollback snapshot selector"
          value={snapId}
          onChange={e => setSnapId(e.target.value)}
        >
          {s.sandbox.snapshots.map(sn => (
            <option key={sn.id} value={sn.id}>
              {sn.label} · {fmtDate(sn.ts)}
            </option>
          ))}
        </select>
        <button className="btn btn-warn btn-sm" onClick={rollback}>⟲ Rollback</button>
        <button className="btn btn-sm" onClick={saveSnapshot}><Camera size={14} /> Save snapshot</button>
        <span className="ml-auto font-mono text-[11px]" style={{ color: "var(--text-500)" }}>
          run #{s.sandbox.runs + 1}
        </span>
        <button
          className="btn btn-primary"
          onClick={run}
          disabled={compiling || !enabled || hasBlockingErrors}
          title={hasBlockingErrors ? "Fix syntax/loop errors before running" : "Execute program"}
        >
          <Play size={16} /> {compiling ? "Compiling…" : "Run (−1 quota)"}
        </button>
      </div>

      {/* Real-Time Pre-Compilation Predictive Diagnostics Banner */}
      {diagnostics.length > 0 && (
        <div
          className="mb-4 rounded-xl border-2 p-3 text-xs leading-relaxed transition-all"
          style={{
            borderColor: hasBlockingErrors ? "var(--accent-600)" : "var(--marigold-900)",
            background: hasBlockingErrors ? "var(--accent-100)" : "var(--marigold-100)",
            color: hasBlockingErrors ? "var(--accent-600)" : "var(--marigold-900)",
          }}
        >
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider mb-1">
            {hasBlockingErrors ? <XCircle size={15} /> : <AlertTriangle size={15} />}
            <span>Pre-Compilation Static Analysis ({diagnostics.length} issue{diagnostics.length > 1 ? "s" : ""})</span>
          </div>
          <ul className="space-y-1 font-mono text-[11px]">
            {diagnostics.map((d, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="font-bold">Line {d.line}:</span>
                <span>{d.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnostics.length === 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 font-mono text-xs" style={{ borderColor: "var(--forest-500)", background: "var(--forest-100)", color: "var(--forest-700)" }}>
          <ShieldCheck size={14} />
          <span>Pre-compilation checks clean: no infinite iterations or budget exhausts detected.</span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        {/* Editor */}
        <div className="code-area relative overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: "#3a3226" }}>
            <span className="font-mono text-[11px]" style={{ color: "#9a8f75" }}>main.acad · acad-vm v1.4</span>
            <span className="font-mono text-[10px]" style={{ color: "#6d6450" }}>{lineCount} lines · UTF-8</span>
          </div>
          <div className="flex">
            <div aria-hidden className="select-none px-3 py-4 text-right font-mono text-[13px] leading-[1.7]" style={{ color: "#5c5340", background: "rgba(255,255,255,.03)" }}>
              {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <textarea
              ref={taRef}
              className="min-h-[380px] flex-1 resize-y bg-transparent p-4 font-mono text-[13px] leading-[1.7] outline-none"
              style={{ color: "#e8e0cd", caretColor: "var(--marigold-500)" }}
              spellCheck={false}
              aria-label="Sandbox code editor"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const ta = taRef.current!;
                  const { selectionStart: a, selectionEnd: b } = ta;
                  const next = code.slice(0, a) + "  " + code.slice(b);
                  setCode(next);
                  requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = a + 2; });
                }
              }}
            />
          </div>
        </div>

        {/* Terminal */}
        <div className="code-area flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: "#3a3226" }}>
            <span className="flex items-center gap-2 font-mono text-[11px]" style={{ color: "#9a8f75" }}><SquareTerminal size={13} /> wasm runner · stdout</span>
            {result && (
              <span className="pill !py-0 font-mono !text-[10px]" style={{ background: result.ok ? "var(--forest-500)" : "var(--accent-500)", color: "#fff", borderColor: "transparent" }}>
                exit {result.ok ? 0 : 1}
              </span>
            )}
          </div>
          <div className="min-h-[380px] flex-1 overflow-y-auto p-4" aria-live="polite">
            {compiling && <p className="terminal-line blink-cursor" style={{ color: "#9a8f75" }}>compiling main.acad → wasm32 …</p>}
            {!compiling && !result && (
              <div className="terminal-line" style={{ color: "#6d6450" }}>
                <p>$ acad-vm --profile wasm32 --deterministic</p>
                <p className="mt-2">runner idle. Output is a pure function of your program —</p>
                <p>no network, no clock, no randomness.</p>
                <p className="mt-2">supported: let · while · if/else · console.log · ^ % comparisons</p>
              </div>
            )}
            {result?.lines.map((l, i) => (
              <p key={i} className="terminal-line" style={{ color: l.kind === "err" ? "#ff8a7a" : l.kind === "sys" ? "#8d8368" : "#d6f5d6" }}>{l.text}</p>
            ))}
          </div>
          {result && (
            <div className="border-t px-4 py-2 font-mono text-[10px]" style={{ borderColor: "#3a3226", color: "#8d8368" }}>
              ops {result.steps} · wall {result.ms.toFixed(2)}ms · step budget 20 000 · seedless
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 font-mono text-[11px]" style={{ color: "var(--text-500)" }}>
        tip: draft here all day, dry-trace on paper, then spend your single daily run on the full program.
      </p>
    </div>
  );
}
