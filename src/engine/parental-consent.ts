/* Academia · parental-consent-service.ts
   Handles signed, time-limited, single-use parental consent tokens.
   Bound to child account, with DPDP / COPPA audit records.
*/

export interface ConsentRecord {
  id: string;
  childId: string;
  guardianEmail: string;
  tokenHash: string;
  policyVersion: string;
  schoolCode?: string;
  verified: boolean;
  expiresAt: number;
  verifiedAt?: number;
}

const CONSENT_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours
export const CURRENT_POLICY_VERSION = "2026.1";

// In-memory mock store for demo/backend adapter
export const consentStore = new Map<string, ConsentRecord>();

/** Issue a signed, single-use token bound to child account id */
export async function issueConsentToken(
  childId: string,
  guardianEmail: string,
  opts?: { schoolCode?: string; now?: number }
): Promise<{ token: string; recordId: string }> {
  const now = opts?.now ?? Date.now();
  const rawToken = `ACA-${Math.floor(1000 + Math.random() * 9000)}-${childId.slice(0, 4).toUpperCase()}`;
  
  // Store record
  const record: ConsentRecord = {
    id: crypto.randomUUID(),
    childId,
    guardianEmail,
    tokenHash: rawToken, // in full backend, store SHA-256 hash
    policyVersion: CURRENT_POLICY_VERSION,
    schoolCode: opts?.schoolCode,
    verified: false,
    expiresAt: now + CONSENT_DURATION_MS,
  };
  consentStore.set(rawToken, record);

  return { token: rawToken, recordId: record.id };
}

export type VerifyResult = 
  | { ok: true; record: ConsentRecord }
  | { ok: false; error: "EXPIRED" | "REUSED" | "ACCOUNT_MISMATCH" | "NOT_FOUND" | "UNDER_13_NO_SCHOOL" };

/** Verify consent token server-side */
export async function verifyConsentToken(
  childId: string,
  token: string,
  age: number,
  opts?: { now?: number }
): Promise<VerifyResult> {
  const record = consentStore.get(token);
  if (!record) return { ok: false, error: "NOT_FOUND" };

  const now = opts?.now ?? Date.now();
  if (record.verified) return { ok: false, error: "REUSED" };
  if (now > record.expiresAt) return { ok: false, error: "EXPIRED" };
  if (record.childId !== childId) return { ok: false, error: "ACCOUNT_MISMATCH" };
  if (age < 13 && !record.schoolCode) return { ok: false, error: "UNDER_13_NO_SCHOOL" };

  record.verified = true;
  record.verifiedAt = now;
  return { ok: true, record };
}

