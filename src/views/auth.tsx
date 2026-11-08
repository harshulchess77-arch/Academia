/* Academia · Phase 1.2 — 50/50 split auth: commercial rotator + tabbed auth engine */
import { useMemo, useState } from "react";
import { ArrowLeft, LogIn, NotebookPen, UserPlus } from "lucide-react";
import { useApp, DEMO_MODE } from "@/engine/store";
import { navigate } from "@/engine/router";
import { ageOn } from "@/utils/age";
import { PromoRotator } from "@/components/auth/promo-rotator";
import { ParentalGate } from "@/components/auth/parental-gate";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function AuthView() {
  const { s, up, toast } = useApp();
  const [tab, setTab] = useState<"Sign In" | "Sign Up">("Sign In");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState({ d: "", m: "", y: "" });
  const [terms, setTerms] = useState(false);
  const [parent, setParent] = useState<{ email: string; token: string | null }>({ email: "", token: null });

  const age = useMemo(() => {
    if (!dob.d || !dob.m || !dob.y) return null;
    return ageOn({ d: Number(dob.d), m: Number(dob.m), y: Number(dob.y) });
  }, [dob]);

  const under18 = age !== null && age < 18;
  const under13 = age !== null && age < 13;
  const signupReady = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email) && pass.length >= 8 && age !== null && !under13 && terms && (!under18 || parent.token !== null);

  const signIn = (role: "student" | "admin", demoEmail?: string) => {
    up(d => {
      d.session.authed = true; d.session.role = role; d.session.status = "ACTIVE"; d.session.stage = "ready";
      if (demoEmail) d.session.email = demoEmail;
      else if (email) d.session.email = email;
    });
    toast(`Welcome back, ${s.session.name.split(" ")[0]} — session restored`, "ok");
    navigate(role === "admin" ? "/admin/dashboard" : "/dashboard");
  };

  const years = Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() - 8 - i));

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* left · commercial rotator */}
      <div className="relative hidden border-r-2 lg:block" style={{ borderColor: "var(--text-900)" }}>
        <PromoRotator />
      </div>

      {/* right · auth engine */}
      <div className="flex flex-col px-5 py-8 md:px-12">
        <div className="flex items-center justify-between">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}><ArrowLeft size={15} /> Landing</button>
          <span className="flex items-center gap-2 font-display text-lg font-black"><NotebookPen size={18} /> Academia</span>
        </div>

        <div className="mx-auto w-full max-w-md flex-1 py-10">
          <p className="font-hand text-2xl" style={{ color: "var(--accent-500)" }}>open your binder</p>
          <h1 className="font-display text-3xl font-black">Welcome to the desk</h1>

          <div role="tablist" aria-label="Authentication mode" className="mt-6 flex gap-2">
            {(["Sign In", "Sign Up"] as const).map(t => (
              <button key={t} role="tab" aria-selected={tab === t} className="pill pill-tab flex-1 justify-center !py-2.5 !text-sm" onClick={() => setTab(t)}>
                {t === "Sign In" ? <LogIn size={15} /> : <UserPlus size={15} />} {t}
              </button>
            ))}
          </div>

          {tab === "Sign In" ? (
            <form className="mt-6 space-y-4" onSubmit={e => { e.preventDefault(); signIn("student"); }}>
              <div>
                <label className="field-label" htmlFor="si-email">Email</label>
                <input id="si-email" type="email" className="input" placeholder="you@school.edu" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="field-label" htmlFor="si-pass">Password</label>
                <input id="si-pass" type="password" className="input" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} required />
              </div>
              <button className="btn btn-primary w-full" type="submit"><LogIn size={16} /> Sign in</button>
              {DEMO_MODE && (
                <div className="divider-dashed pt-4">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-500)" }}>seeded demo desks</p>
                  <div className="flex gap-3">
                    <button type="button" className="btn flex-1" onClick={() => signIn("student", "aarav@academia.app")}>Demo student</button>
                    <button type="button" className="btn btn-ink flex-1" onClick={() => signIn("admin", "registrar@academia.app")}>Demo admin</button>
                  </div>
                </div>
              )}
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={e => {
              e.preventDefault();
              if (!signupReady) return;
              up(d => {
                d.session = { ...d.session, authed: true, role: "student", status: "ACTIVE", stage: "questionnaire", name: name.trim(), email: email.trim(), parental: under18 ? parent : undefined };
              });
              navigate("/questionnaire");
            }}>
              <div>
                <label className="field-label" htmlFor="su-name">Full name</label>
                <input id="su-name" className="input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="su-email">Email</label>
                  <input id="su-email" type="email" className="input" placeholder="you@school.edu" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="field-label" htmlFor="su-pass">Password (8+)</label>
                  <input id="su-pass" type="password" className="input" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} />
                </div>
              </div>
              <fieldset>
                <legend className="field-label">Date of birth</legend>
                <div className="grid grid-cols-3 gap-2">
                  <select aria-label="Day" className="input" value={dob.d} onChange={e => setDob(v => ({ ...v, d: e.target.value }))}>
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </select>
                  <select aria-label="Month" className="input" value={dob.m} onChange={e => setDob(v => ({ ...v, m: e.target.value }))}>
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <select aria-label="Year" className="input" value={dob.y} onChange={e => setDob(v => ({ ...v, y: e.target.value }))}>
                    <option value="">Year</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                {age !== null && !under18 && <p className="mt-1.5 text-xs font-semibold" style={{ color: "var(--forest-700)" }}>Age {age} — standard registration.</p>}
              </fieldset>

              {under18 && <ParentalGate age={age} onConfirm={(em, tok) => setParent({ email: em, token: tok })} />}

              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="checkbox mt-0.5" checked={terms} onChange={e => setTerms(e.target.checked)} />
                <span style={{ color: "var(--text-700)" }}>I accept the Terms of Service and the Community Charter, and I understand quotas are part of the pacing design.</span>
              </label>
              <button className="btn btn-primary w-full" type="submit" disabled={!signupReady}>
                <UserPlus size={16} /> {under18 && !parent.token ? "Locked — awaiting parent token" : "Create account"}
              </button>
            </form>
          )}
        </div>
        <p className="text-center font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-300)" }}>local-first · no third-party trackers on auth</p>
      </div>
    </div>
  );
}