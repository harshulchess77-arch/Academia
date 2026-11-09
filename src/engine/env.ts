/* Academia · env.ts
   Strict environment configuration loader, schema validator, and invariant enforcer.
   Protects production deployments against missing credentials, insecure protocols,
   and unauthorized sandbox/mock rollbacks without leaking internal stack traces. */

export type AppEnv = "production" | "development" | "test";
export type ComplianceJurisdiction = "IN-DPDP" | "EU-GDPR" | "US-COPPA";

export interface EnvConfig {
  appEnv: AppEnv;
  allowMockFallback: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  cryptoMinPbkdf2Iterations: number;
  complianceJurisdiction: ComplianceJurisdiction;
  cloudflareTurnstileSiteKey: string;
}

/** Pure validator that inspects raw environment variables and enforces production invariants. */
export function validateEnvironment(raw: Record<string, string | undefined>): EnvConfig {
  const rawEnv = raw.VITE_APP_ENV?.trim().toLowerCase();
  const appEnv: AppEnv = rawEnv === "production"
    ? "production"
    : rawEnv === "development"
      ? "development"
      : rawEnv === "test" || (typeof process !== "undefined" && process.env?.NODE_ENV === "test")
        ? "test"
        : "development";

  // When undefined in development or test, allowMockFallback defaults to true.
  // In production, it defaults to false unless explicitly overridden for sandbox testing.
  const rawMock = raw.VITE_ALLOW_MOCK_FALLBACK?.trim().toLowerCase();
  const allowMockFallback = rawMock !== undefined
    ? rawMock === "true" || rawMock === "1"
    : appEnv !== "production";

  const supabaseUrl = raw.VITE_SUPABASE_URL?.trim() || "";
  const supabaseAnonKey = raw.VITE_SUPABASE_ANON_KEY?.trim() || "";

  // Cryptographic iterations: floor enforced at 600,000 for high-assurance standards.
  const parsedIter = parseInt(raw.VITE_CRYPTO_MIN_PBKDF2_ITERATIONS || "600000", 10);
  const cryptoMinPbkdf2Iterations = Number.isFinite(parsedIter) && parsedIter >= 600000
    ? parsedIter
    : 600000;

  const validJurisdictions: readonly ComplianceJurisdiction[] = ["IN-DPDP", "EU-GDPR", "US-COPPA"];
  const rawJurisdiction = raw.VITE_DEFAULT_COMPLIANCE_JURISDICTION?.trim();
  const complianceJurisdiction: ComplianceJurisdiction = (validJurisdictions as readonly string[]).includes(rawJurisdiction ?? "")
    ? (rawJurisdiction as ComplianceJurisdiction)
    : "IN-DPDP";

  // Production environment validation matrix
  if (appEnv === "production") {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Configuration Error: Production environment configuration invariants breached. Missing verified backend service credentials.");
    }
    if (!supabaseUrl.startsWith("https://")) {
      throw new Error("Configuration Error: Production environment configuration invariants breached. Insecure transport scheme specified for backend service.");
    }
  }

  const cloudflareTurnstileSiteKey = raw.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY?.trim() || "";

  return {
    appEnv,
    allowMockFallback,
    supabaseUrl,
    supabaseAnonKey,
    cryptoMinPbkdf2Iterations,
    complianceJurisdiction,
    cloudflareTurnstileSiteKey,
  };
}

/** Loads and validates current environment safely across browser and test harnesses. */
function getRuntimeEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  if (typeof import.meta !== "undefined" && import.meta.env) {
    for (const [k, v] of Object.entries(import.meta.env)) {
      if (typeof v === "string") env[k] = v;
      else if (typeof v === "boolean" || typeof v === "number") env[k] = String(v);
    }
  }
  if (typeof process !== "undefined" && process.env) {
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === "string" && !(k in env)) env[k] = v;
    }
  }
  return env;
}

export const ENV: EnvConfig = validateEnvironment(getRuntimeEnv());
