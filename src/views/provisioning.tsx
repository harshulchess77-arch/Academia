/* Academia · Phase 1.4 — account provisioning: SLA countdown + dynamic stage roadmap.
   Dynamically binds provisioning sequences to the authenticated user's actual profile and state. */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, KeyRound, Library, Target } from "lucide-react";
import { useApp } from "@/engine/store";
import { navigate } from "@/engine/router";
import { cn } from "@/utils/cn";

const STAGES = [
  { label: "Indexing Library", icon: <Library size={18} />, at: 0, done: 3 },
  { label: "Matching Opportunities", icon: <Target size={18} />, at: 3, done: 6.5 },
  { label: "Encrypting Vault Keypair", icon: <KeyRound size={18} />, at: 6.5, done: 9 },
];

function fmtClock(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), ss = sec % 60;
  return [h, m, ss].map(x => String(x).padStart(2, "0")).join(":");
}

export function ProvisioningView() {
  const { s, up, toast } = useApp();
  const start = s.session.provisionStart ?? Date.now();
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - start) / 1000));

  useEffect(() => {
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => window.clearInterval(t);
  }, [start]);

  const ready = elapsed >= 9;
  const sla = Math.max(0, 3600 - elapsed);
  const pct = Math.min(100, (elapsed / 9) * 100);

  const userSlug = useMemo(() => {
    const raw = s.session.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    return raw || "student";
  }, [s.session.name]);

  const dynamicLogs: [number, string][] = useMemo(() => [
    [0.4, "mounting local notebook volume… ok"],
    [1.2, `indexing ${s.flashcards.length} flashcard(s) · ${s.notes.length} note(s) · SM-2 state calibrated`],
    [2.6, `library index sealed (tier ${s.session.tier})`],
    [3.6, `academic standing Tier ${s.session.tier} applied: calibrating opportunity ladder`],
    [5.2, `${s.inventory.length} opportunities indexed · ${s.inventory.filter(o => o.tracked).length} tracked`],
    [6.8, "generating vault keypair (AES-256-GCM / WebCrypto, local only)…"],
    [8.4, `keypair sealed → ${userSlug}.academia-lock`],
    [9.0, `provisioning READY — deterministic desk online for ${s.session.name || "student"}`],
  ], [s.flashcards.length, s.notes.length, s.session.tier, s.inventory.length, userSlug, s.session.name]);

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="sheet tape w-full max-w-2xl px-6 py-9 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-hand text-2xl" style={{ color: "var(--accent-500)" }}>binding your notebook</p>
            <h1 className="font-display text-3xl font-black">Provisioning account</h1>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[.16em]" style={{ color: "var(--text-500)" }}>SLA window</p>
            <p className="font-mono text-3xl font-semibold tabular-nums" aria-live="off">{fmtClock(sla)}</p>
            <p className="text-[10px] font-mono" style={{ color: "var(--text-500)" }}>guaranteed under 01:00:00</p>
          </div>
        </div>

        {/* SLA bar */}
        <div className="gantt-track mt-5 !h-4" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Provisioning progress">
          <div className={cn("gantt-bar", !ready && "gantt-hatch")} style={{ width: `${pct}%`, background: ready ? "var(--forest-500)" : "var(--cobalt-500)" }} />
        </div>

        {/* horizontal stage roadmap */}
        <ol className="mt-7 grid grid-cols-3 gap-2" aria-label="Provisioning stages">
          {STAGES.map((st, i) => {
            const done = elapsed >= st.done;
            const active = !done && elapsed >= st.at;
            return (
              <li key={st.label} className="flex flex-col items-center gap-2 text-center">
                <span className={cn("grid h-12 w-12 place-items-center rounded-full border-2 transition-all", active && "pulse-dot")}
                  style={{
                    borderColor: "var(--text-900)",
                    background: done ? "var(--forest-500)" : active ? "var(--marigold-500)" : "var(--background-200)",
                    color: done ? "#fff" : "var(--text-900)",
                    boxShadow: "2px 2px 0 var(--text-950)",
                  }}>
                  {done ? <CheckCircle2 size={20} /> : st.icon}
                </span>
                <span className="text-[11px] font-bold leading-tight sm:text-xs">{i + 1}. {st.label}</span>
                <span className="font-mono text-[10px]" style={{ color: done ? "var(--forest-700)" : "var(--text-500)" }}>{done ? "complete" : active ? "running…" : "queued"}</span>
              </li>
            );
          })}
        </ol>

        {/* provisioning log */}
        <div className="code-area mt-7 max-h-40 overflow-y-auto p-4" aria-live="polite">
          {dynamicLogs.filter(([t]) => elapsed >= t).map(([t, line], i) => (
            <p key={i} className="terminal-line" style={{ color: line.includes("READY") ? "var(--marigold-500)" : "#cfc6ae" }}>
              <span style={{ color: "#7a715c" }}>[{t.toFixed(1)}s]</span> {line}
            </p>
          ))}
          {!ready && <p className="terminal-line blink-cursor" style={{ color: "#7a715c" }} />}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
          {ready
            ? <span className="stamp text-lg" style={{ color: "var(--forest-500)" }}>Ready</span>
            : <span className="font-hand text-xl" style={{ color: "var(--text-500)" }}>usually done before the kettle boils…</span>}
          <button className="btn btn-primary !min-h-[52px] !px-8 !text-base" disabled={!ready}
            onClick={() => {
              up(d => { d.session.stage = "ready"; });
              toast("Account activated — welcome to your desk", "ok");
              navigate("/dashboard");
            }}>
            Access Account <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
