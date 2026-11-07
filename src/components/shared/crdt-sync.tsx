/* Academia · Phase 3.18 — CRDT offline sync footer pill (local-first, IndexedDB lane) */
import { useEffect, useRef, useState } from "react";
import { CloudOff, Database, RefreshCw } from "lucide-react";
import { useApp } from "@/engine/store";

export function CrdtSyncBar() {
  const { s } = useApp();
  const [online, setOnline] = useState(navigator.onLine);
  const [simOffline, setSimOffline] = useState(false);
  const [synced, setSynced] = useState(s.ops);
  const [flushing, setFlushing] = useState(false);
  const timer = useRef<number>(0);
  const effectiveOnline = online && !simOffline;
  const pending = Math.max(0, s.ops - synced);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!effectiveOnline || pending === 0) return;
    setFlushing(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setSynced(s.ops); setFlushing(false); }, 1100);
    return () => window.clearTimeout(timer.current);
  }, [s.ops, effectiveOnline, pending]);

  return (
    <div className="pointer-events-none fixed bottom-[84px] left-1/2 z-30 -translate-x-1/2 md:bottom-4 md:left-auto md:right-4 md:translate-x-0">
      <button
        onClick={() => setSimOffline(o => !o)}
        title={simOffline ? "Simulated offline — click to reconnect" : "Local-first CRDT lane. Click to simulate offline."}
        className="pill pointer-events-auto !gap-2 !py-1.5 cursor-pointer"
        style={{
          background: effectiveOnline ? "var(--surface)" : "var(--accent-100)",
          borderColor: effectiveOnline ? "var(--text-900)" : "var(--accent-600)",
          boxShadow: "3px 3px 0 var(--text-950)",
        }}
        aria-label={`Sync status: ${effectiveOnline ? (pending ? `${pending} local operations pending` : "synced") : "offline, changes held locally"}. Toggle simulated offline.`}
      >
        {effectiveOnline
          ? (flushing ? <RefreshCw size={13} className="animate-spin" style={{ color: "var(--cobalt-500)" }} /> : <Database size={13} style={{ color: "var(--forest-500)" }} />)
          : <CloudOff size={13} style={{ color: "var(--accent-600)" }} />}
        <span className="font-mono text-[11px] font-semibold">
          {effectiveOnline
            ? (flushing ? `merging ${pending} op${pending === 1 ? "" : "s"}…` : pending ? `${pending} op${pending === 1 ? "" : "s"} queued` : "IndexedDB · synced")
            : `offline · ${pending} op${pending === 1 ? "" : "s"} held locally`}
        </span>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: effectiveOnline ? "var(--forest-500)" : "var(--accent-500)" }} />
      </button>
    </div>
  );
}