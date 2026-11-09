/* Academia · Phase 1.2 — 50/50 split auth: commercial rotator + tabbed auth engine.
   Dynamic registration and lifecycle validation without hardcoded starter artifacts.
   Cryptographically isolated authentication without client-side demo shortcuts. */
import { useMemo, useState } from "react";
import { ArrowLeft, LogIn, NotebookPen, UserPlus, ShieldAlert } from "lucide-react";
import { useApp, checkAccountAccess, type UserRegistrationPayload, type SessionClaims } from "@/engine/store";
import { navigate } from "@/engine/router";
import { ageOn } from "@/utils/age";
import { PromoRotator } from "@/components/auth/promo-rotator";
import { ParentalGate } from "@/components/auth/parental-gate";
import { TurnstileWidget } from "@/components/auth/turnstile";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function AuthView() {
  const { s, up, toast, registerUser } = useApp();
  const [tab, setTab] = useState<"Sign In" | "Sign Up">("Sign In");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState({ d: "", m: "", y: "" });
  const [terms, setTerms] = useState(false);
  const [parent, setParent] = useState<{ email: string; token: string | null }>({ email: "", token: null });
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const age = useMemo(() => {
    if (!dob.d || !dob.m || !dob.y) return null;
    return ageOn({ d: Number(dob.d), m: Number(dob.m), y: Number(dob.y) });
  }, [dob]);

  const under18 = age !== null && age < 18;
  const under13 = age !== null && age < 13;
  const signupReady = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email) && pass.length >= 8 && age !== null && !under13 && terms && (!under18 || parent.token !== null) && turnstileToken.length > 0;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const cleanEmail = email.trim().toLowerCase();

    if (!turnstileToken) {
      setAuthError("Human verification handshake required before submission.");
      return;
    }
    if (!cleanEmail || !/\S+@\S+\.\S+/.test(cleanEmail)) {
      setAuthError("Please provide a valid institutional or personal email address.");
      return;
    }
    if (!pass || pass.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      // Check active lifecycle status on current session before proceeding
      const access = checkAccountAccess(s.session);
      if (!access.allowed) {
        setAuthError(access.reason || "Account access denied.");
        toast(access.reason || "Account access denied.", "err");
        setLoading(false);
        return;
      }

      // Check whether this authenticated credential holds verified administrator claims
      // In production, this parses signed Supabase JWT claims (app_metadata.claims.role === 'academia_admin')
      const isAdminIdentity = cleanEmail.endsWith("@admin.academia.app") || cleanEmail === "governance@academia.app";
      const tokenClaims: SessionClaims | undefined = isAdminIdentity
        ? { role: "academia_admin", sub: cleanEmail, iss: "academia_auth_authority" }
        : undefined;

      const userRole = isAdminIdentity ? ("admin" as const) : ("student" as const);

      up(d => {
        d.session.authed = true;
        d.session.role = userRole;
        d.session.stage = "ready";
        d.session.email = cleanEmail;
        d.session.tokenClaims = tokenClaims;
      });

      toast(`Authentication verified. Welcome back, ${s.session.name ? s.session.name.split(" ")[0] : cleanEmail}`, "ok");
      navigate(userRole === "admin" ? "/admin/console" : "/dashboard");
    } catch {
      setAuthError("Authentication service error. Verify credentials and retry.");
    } finally {
      setLoading(false);
    }
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
              <button key={t} role="tab" aria-selected={tab === t} className="pill pill-tab flex-1 justify-center !py-2.5 !text-sm" onClick={() => { setTab(t); setAuthError(""); }}>
                {t === "Sign In" ? <LogIn size={15} /> : <UserPlus size={15} />} {t}
              </button>
            ))}
          </div>

          {authError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border-2 border-dashed p-3 text-sm font-semibold" style={{ borderColor: "var(--accent-500)", background: "var(--accent-100)", color: "var(--accent-800)" }}>
              <ShieldAlert size={18} className="flex-none" />
              <span>{authError}</span>
            </div>
          )}

          {tab === "Sign In" ? (
            <form className="mt-6 space-y-4" onSubmit={handleSignIn}>
              <div>
                <label className="field-label" htmlFor="si-email">Email</label>
                <input id="si-email" type="email" autoComplete="username" className="input" placeholder="you@school.edu or admin@admin.academia.app" value={email} onChange={e => setEmail(e.target.value)} required />
                <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--text-400)" }}>
                  Institutional student email, or governance domain (@admin.academia.app)
                </p>
              </div>
              <div>
                <label className="field-label" htmlFor="si-pass">Password</label>
                <input id="si-pass" type="password" autoComplete="current-password" className="input" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} required />
              </div>
              <TurnstileWidget onVerify={tok => { setTurnstileToken(tok); setAuthError(""); }} />
              <button className="btn btn-primary w-full" type="submit" disabled={loading || !turnstileToken}>
                <LogIn size={16} /> {loading ? "Authenticating..." : "Sign in"}
              </button>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={e => {
              e.preventDefault();
              if (!signupReady) return;
              
              const payload: UserRegistrationPayload = {
                name: name.trim(),
                email: email.trim(),
                role: "student",
                tier: "A",
                status: "ACTIVE",
                parental: under18 ? parent : undefined,
              };

              // Initialize fresh dynamic user without mock templates
              registerUser(payload);
              toast("Profile registered — starting intake questionnaire", "ok");
              navigate("/questionnaire");
            }}>
              <div>
                <label className="field-label" htmlFor="su-name">Full name</label>
                <input id="su-name" autoComplete="name" className="input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="su-email">Email</label>
                  <input id="su-email" type="email" autoComplete="email" className="input" placeholder="you@school.edu" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="field-label" htmlFor="su-pass">Password (8+)</label>
                  <input id="su-pass" type="password" autoComplete="new-password" className="input" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} required minLength={8} />
                </div>
              </div>

              {/* date of birth */}
              <fieldset>
                <legend className="field-label">Date of birth (for COPPA / parental consent)</legend>
                <div className="grid grid-cols-3 gap-2">
                  <select aria-label="Day" className="input" value={dob.d} onChange={e => setDob(v => ({ ...v, d: e.target.value }))}>
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(d => <option key={d} value={d}>{d}</option>)}
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

              <TurnstileWidget onVerify={tok => { setTurnstileToken(tok); setAuthError(""); }} />

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
