/* Academia · error / banned / inactive / locker-locked states.
   Assistant UI is fully unmounted on these routes (strict exclusion guard). */
import { ArrowLeft, KeyRound, Lock, Mail, NotebookPen } from "lucide-react";
import { useApp } from "@/engine/store";
import { navigate } from "@/engine/router";
import { DoodleStar } from "@/components/ui";

const COPY: Record<string, { code: string; title: string; body: string; tone: string }> = {
  "/404": { code: "404", title: "This page fell out of the binder", body: "The route you followed isn't in the module index. Nothing was lost — your local notebook state is intact.", tone: "var(--cobalt-500)" },
  "/500": { code: "500", title: "The press jammed", body: "A rendering fault interrupted this sheet. Your CRDT log is safe locally; retry, or return to the dashboard.", tone: "var(--marigold-500)" },
  "/banned": { code: "LOCKED", title: "ACCOUNT_BANNED", body: "Access has been revoked by the governance desk. All sessions were invalidated and quota counters frozen. You may appeal to the grievance officer.", tone: "var(--accent-500)" },
  "/inactive": { code: "PAUSED", title: "Account temporarily inactive", body: "A usage pause is active on this account. Access restores automatically when the timer ends — your notes, cards and vault are untouched.", tone: "var(--marigold-500)" },
  "/locker-locked": { code: "SEALED", title: "Locker tamper-lock engaged", body: "A checksum mismatch was detected on your vault keypair. The Locker is sealed until you re-import a valid .academia-lock file.", tone: "var(--accent-500)" },
};

export function StatusView({ kind }: { kind: string }) {
  const { s, up, resetAll } = useApp();
  const c = COPY[kind] ?? COPY["/404"];
  const banned = kind === "/banned";
  const inactive = kind === "/inactive";
  const until = s.session.inactiveUntil;

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="sheet tape relative w-full max-w-lg px-8 py-10 text-center fade-up">
        <DoodleStar className="absolute -left-4 -top-4 h-10 w-10" />
        <p className="stamp text-2xl" style={{ color: c.tone }}>{c.code}</p>
        <h1 className="mt-5 font-display text-3xl font-black">{c.title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: "var(--text-500)" }}>{c.body}</p>
        {banned && (
          <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-lg border-2 px-4 py-2 font-mono text-xs font-bold"
            style={{ borderColor: "var(--accent-600)", background: "var(--accent-100)", color: "var(--accent-600)" }}>
            <Lock size={14} /> ACCOUNT_BANNED · session revoked
          </p>
        )}
        {inactive && until && (
          <p className="mt-4 font-mono text-sm">Restores {new Date(until).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
        )}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {kind === "/locker-locked" ? (
            <button className="btn btn-primary" onClick={() => navigate("/locker")}><KeyRound size={16} /> Re-import vault key</button>
          ) : banned || inactive ? (
            <>
              <a className="btn" href="mailto:grievance@academia.app?subject=Access%20appeal"><Mail size={16} /> Appeal to grievance officer</a>
              <button className="btn btn-warn" onClick={() => { up(d => { d.session.status = "ACTIVE"; d.session.inactiveUntil = undefined; }); navigate("/dashboard"); }}>
                Restore demo session
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" onClick={() => navigate(s.session.authed ? "/dashboard" : "/")}><ArrowLeft size={16} /> {s.session.authed ? "Back to dashboard" : "Back to landing"}</button>
              {kind === "/500" && <button className="btn" onClick={() => navigate("/dashboard")}>Retry render</button>}
            </>
          )}
        </div>
        {(banned || inactive) && (
          <button className="link-ink mt-5 text-xs" onClick={() => { resetAll(); navigate("/"); }}>Reset the entire demo notebook</button>
        )}
        <p className="mt-8 flex items-center justify-center gap-1.5 font-hand text-lg" style={{ color: "var(--text-300)" }}>
          <NotebookPen size={15} /> the margins are always yours
        </p>
      </div>
    </div>
  );
}