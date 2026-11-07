/* Academia · COPPA / under-18 parental consent gate.
   Registration stays locked until a signed parent token is confirmed. */
import { useState } from "react";
import { MailCheck, ShieldCheck, Send } from "lucide-react";

const DEMO_TOKEN = "ACA-4821";

export function ParentalGate({ age, onConfirm }: { age: number; onConfirm: (email: string, token: string | null) => void }) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"idle" | "sent" | "confirmed">("idle");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (age < 13) {
    return (
      <div className="warn-slide rounded-xl border-2 px-4 py-3 text-sm" style={{ borderColor: "var(--accent-600)", background: "var(--accent-100)" }}>
        <p className="font-bold" style={{ color: "var(--accent-600)" }}>COPPA notice</p>
        <p className="mt-1" style={{ color: "var(--text-700)" }}>Under-13 accounts are provisioned only through a school invite. Ask your school administrator for a managed Academia seat.</p>
      </div>
    );
  }

  return (
    <div className="warn-slide space-y-3 rounded-xl border-2 p-4" style={{ borderColor: "var(--marigold-500)", background: "var(--marigold-100)" }}>
      <p className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--marigold-900)" }}>
        <ShieldCheck size={16} /> Parental consent required (under 18)
      </p>
      {phase === "idle" && (
        <>
          <label className="field-label" htmlFor="parent-email">Parent / guardian email</label>
          <div className="flex gap-2">
            <input id="parent-email" type="email" className="input" placeholder="guardian@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            <button type="button" className="btn btn-warn" disabled={!valid}
              onClick={() => { setPhase("sent"); onConfirm(email, null); }}>
              <Send size={15} /> Send
          </button>
          </div>
          <p className="text-xs" style={{ color: "var(--text-500)" }}>We email a one-time signing token. Registration stays disabled until the signed token returns.</p>
        </>
      )}
      {phase === "sent" && (
        <>
          <p className="text-xs font-semibold" style={{ color: "var(--text-700)" }}>Token sent to {email}. Enter the signed token to confirm.</p>
          <div className="flex gap-2">
            <input className="input font-mono" aria-label="Signed parent token" placeholder="ACA-····" value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setErr(""); }} />
            <button type="button" className="btn btn-primary" disabled={code.length < 6}
              onClick={() => {
                if (code.trim() === DEMO_TOKEN) { setPhase("confirmed"); onConfirm(email, DEMO_TOKEN); }
                else setErr("Token mismatch — check the parent email and retry.");
              }}>
              Verify
            </button>
          </div>
          {err && <p className="text-xs font-bold" style={{ color: "var(--accent-600)" }}>{err}</p>}
          <p className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>demo parent inbox → token: {DEMO_TOKEN}</p>
        </>
      )}
      {phase === "confirmed" && (
        <p className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--forest-700)" }}>
          <MailCheck size={16} /> Signed parent token {DEMO_TOKEN} confirmed for {email}
        </p>
      )}
    </div>
  );
}