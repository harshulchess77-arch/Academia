import { describe, it, expect } from "vitest";
import { verifyAdminClaims, type AppState } from "@/engine/store";
import { isAdminRoute, ADMIN_ROUTES } from "@/engine/router";
import {
  adminUpdateStudentStatus,
  adminCreateAnnouncement,
  adminFetchConsentAuditStream,
} from "@/engine/admin-rpc";

describe("Administrative Isolation & Cryptographic RBAC Gate", () => {
  const baseSession: AppState["session"] = {
    authed: false,
    role: "student",
    name: "Aarav Sharma",
    email: "aarav@academia.app",
    tier: "A",
    stage: "ready",
    status: "ACTIVE",
  };

  it("strictly rejects unauthenticated sessions from administrative clearance", () => {
    const unauthedSession: AppState["session"] = {
      ...baseSession,
      authed: false,
      role: "admin",
      tokenClaims: { role: "academia_admin" },
    };
    expect(verifyAdminClaims(unauthedSession)).toBe(false);
  });

  it("strictly rejects authenticated student sessions from administrative clearance", () => {
    const studentSession: AppState["session"] = {
      ...baseSession,
      authed: true,
      role: "student",
      tokenClaims: undefined,
    };
    expect(verifyAdminClaims(studentSession)).toBe(false);
  });

  it("prevents client-side privilege escalation (role: 'admin' without signed academia_admin token claims)", () => {
    // Client-side attacker attempted mutating session.role to 'admin'
    const tamperedSession: AppState["session"] = {
      ...baseSession,
      authed: true,
      role: "admin",
      tokenClaims: undefined,
    };
    expect(verifyAdminClaims(tamperedSession)).toBe(false);

    // Attacker attempted providing arbitrary custom role claim
    const spoofedClaimSession: AppState["session"] = {
      ...baseSession,
      authed: true,
      role: "admin",
      tokenClaims: { role: "student_editor" },
    };
    expect(verifyAdminClaims(spoofedClaimSession)).toBe(false);
  });

  it("grants administrative clearance ONLY when tokenClaims.role === 'academia_admin'", () => {
    const validAdminSession: AppState["session"] = {
      ...baseSession,
      authed: true,
      role: "admin",
      name: "Governance Administrator",
      email: "governance@academia.app",
      tokenClaims: {
        role: "academia_admin",
        sub: "governance@academia.app",
        iss: "academia_auth_authority",
      },
    };
    expect(verifyAdminClaims(validAdminSession)).toBe(true);
  });

  it("accurately identifies all isolated admin routes", () => {
    expect(isAdminRoute("/admin")).toBe(true);
    expect(isAdminRoute("/admin/console")).toBe(true);
    expect(isAdminRoute("/admin/dashboard")).toBe(true);
    expect(isAdminRoute("/admin/students")).toBe(true);

    expect(isAdminRoute("/dashboard")).toBe(false);
    expect(isAdminRoute("/library")).toBe(false);
    expect(isAdminRoute("/numera")).toBe(false);
    expect(isAdminRoute("/locker")).toBe(false);
    expect(isAdminRoute("/")).toBe(false);
  });

  it("provides comprehensive coverage in ADMIN_ROUTES list", () => {
    expect(ADMIN_ROUTES).toContain("/admin");
    expect(ADMIN_ROUTES).toContain("/admin/console");
    expect(ADMIN_ROUTES).toContain("/admin/dashboard");
    expect(ADMIN_ROUTES).toContain("/admin/students");
  });
});

describe("Admin Governance RPC Bridge & Cryptographic Streams", () => {
  it("executes student lifecycle transitions with mandatory decree reasoning", async () => {
    const res = await adminUpdateStudentStatus(
      "st1",
      "BAN",
      "Academic integrity charter violation detected",
      undefined
    );
    expect(res.ok).toBe(true);
  });

  it("handles temporary pause transitions with inactive duration timestamps", async () => {
    const res = await adminUpdateStudentStatus(
      "st2",
      "INACTIVE",
      "Scheduled parental usage pause",
      Date.now() + 24 * 3600e3
    );
    expect(res.ok).toBe(true);
  });

  it("publishes broadcast announcements into administrative registry", async () => {
    const res = await adminCreateAnnouncement(
      "System Verification Complete",
      "All zero-trust RBAC barriers active across academic clusters.",
      "pinned"
    );
    expect(res.ok).toBe(true);
    expect(res.announcement).toBeDefined();
    expect(res.announcement?.title).toBe("System Verification Complete");
    expect(res.announcement?.priority).toBe("pinned");
  });

  it("streams verifiable parental consent records with cryptographic hash audits", async () => {
    const { records, error } = await adminFetchConsentAuditStream();
    expect(error).toBeUndefined();
    expect(records.length).toBeGreaterThan(0);

    const first = records[0];
    expect(first.child_email).toBeDefined();
    expect(first.guardian_email).toBeDefined();
    expect(first.token_hash).toMatch(/^sha256:/);
    expect(first.sig_valid).toBe(true);
  });
});

