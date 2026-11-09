// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  createInitialUserState,
  validateSchemaStructure,
  checkAccountAccess,
  isValidAccountStatus,
  ACCOUNT_STATUSES,
  QUOTA_MAX,
  type UserRegistrationPayload,
} from "@/engine/store";
import {
  issueConsentToken,
  verifyConsentToken,
  signConsentPayload,
  verifyConsentReceipt,
  consentStore,
  MAX_CONSENT_ATTEMPTS,
} from "@/engine/parental-consent";

describe("Dynamic Onboarding, Tenancy & Identity Lifecycle", () => {
  beforeEach(() => {
    consentStore.clear();
  });

  describe("Phase 1: Dynamic User Records & Metadata Flows", () => {
    it("creates a clean dynamic initial user state with zero hardcoded starter artifacts", () => {
      const payload: UserRegistrationPayload = {
        name: "Devika Sen",
        email: "devika@example.edu",
        role: "student",
        tier: "B",
        status: "ACTIVE",
      };

      const freshState = createInitialUserState(payload);

      // Invariants: zero starter notes, zero flashcards, zero mock proposals, zero mock inventory
      expect(freshState.session.name).toBe("Devika Sen");
      expect(freshState.session.email).toBe("devika@example.edu");
      expect(freshState.session.tier).toBe("B");
      expect(freshState.session.stage).toBe("questionnaire");
      expect(freshState.flashcards).toEqual([]);
      expect(freshState.notes).toEqual([]);
      expect(freshState.inventory).toEqual([]);
      expect(freshState.proposals).toEqual([]);
      expect(freshState.grades).toEqual([]);
      expect(freshState.adoro).toEqual([]);
      expect(freshState.community).toEqual([]);
      expect(freshState.admin.students).toEqual([]);
      expect(freshState.locker.docs).toEqual([]);
      expect(freshState.sandbox.snapshots).toEqual([]);
      expect(freshState.resume.skills).toEqual([]);
      expect(freshState.resume.activities).toEqual([]);

      // Quotas match database defaults
      expect(freshState.quotas.portfolio).toEqual(QUOTA_MAX.portfolio);
      expect(freshState.quotas.sandbox).toEqual(QUOTA_MAX.sandbox);
      expect(freshState.quotas.chat).toEqual(QUOTA_MAX.chat);
    });

    it("strictly rejects registration payloads with missing or invalid fields", () => {
      expect(() => {
        createInitialUserState({
          name: "",
          email: "valid@example.com",
          role: "student",
          tier: "A",
          status: "ACTIVE",
        });
      }).toThrow(/Registration Invariant Breached/);

      expect(() => {
        createInitialUserState({
          name: "Valid Name",
          email: "invalid-email-address",
          role: "student",
          tier: "A",
          status: "ACTIVE",
        });
      }).toThrow(/Registration Invariant Breached/);

      expect(() => {
        createInitialUserState({
          name: "Valid Name",
          email: "valid@example.com",
          role: "student",
          tier: "Z" as never,
          status: "ACTIVE",
        });
      }).toThrow(/Registration Invariant Breached/);

      expect(() => {
        createInitialUserState({
          name: "Valid Name",
          email: "valid@example.com",
          role: "student",
          tier: "A",
          status: "SUSPENDED_UNOFFICIAL" as never,
        });
      }).toThrow(/Registration Invariant Breached/);
    });
  });

  describe("Phase 2: Authentication Gate, Rotation & Dynamic Tokens", () => {
    it("liquidates static test master keys: generated tokens are unique and dynamic", async () => {
      const token1 = await issueConsentToken("child_1", "parent1@test.com");
      const token2 = await issueConsentToken("child_2", "parent2@test.com");

      expect(token1.token).not.toBe("ACA-4821");
      expect(token2.token).not.toBe("ACA-4821");
      expect(token1.token).not.toBe(token2.token);
      expect(token1.token).toMatch(/^ACA-\d{6}-[0-9A-F]{8}$/);
      expect(token2.token).toMatch(/^ACA-\d{6}-[0-9A-F]{8}$/);
    });

    it("verifies and cryptographically signs consent receipts via WebCrypto HMAC-SHA256", async () => {
      const payload = {
        childId: "child_xyz",
        guardianEmail: "guardian@test.com",
        token: "ACA-123456-ABCDEF01",
        expiresAt: Date.now() + 100000,
        policyVersion: "2026.1",
      };

      const receipt = await signConsentPayload(payload);
      expect(receipt.signatureHex).toHaveLength(64); // 32-byte HMAC hex
      expect(receipt.algorithm).toBe("HMAC-SHA256");

      const valid = await verifyConsentReceipt(receipt);
      expect(valid).toBe(true);

      // Tampered payload fails verification
      const tampered = {
        ...receipt,
        payload: { ...payload, childId: "child_tampered" },
      };
      const invalid = await verifyConsentReceipt(tampered);
      expect(invalid).toBe(false);
    });

    it("enforces brute-force lockout after maximum failed attempts", async () => {
      const { token } = await issueConsentToken("child_target", "parent@test.com");

      // 5 failed verification attempts with mismatched child ID
      for (let i = 0; i < MAX_CONSENT_ATTEMPTS; i++) {
        const res = await verifyConsentToken("child_attacker", token, 15);
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error).toBe("ACCOUNT_MISMATCH");
      }

      // Next attempt is permanently locked out
      const lockedRes = await verifyConsentToken("child_target", token, 15);
      expect(lockedRes.ok).toBe(false);
      if (!lockedRes.ok) expect(lockedRes.error).toBe("MAX_ATTEMPTS_EXCEEDED");
    });

    it("enforces student lifecycle boundaries (ACTIVE, INACTIVE, BAN)", () => {
      expect(ACCOUNT_STATUSES).toEqual(["ACTIVE", "INACTIVE", "BAN"]);
      expect(isValidAccountStatus("ACTIVE")).toBe(true);
      expect(isValidAccountStatus("INACTIVE")).toBe(true);
      expect(isValidAccountStatus("BAN")).toBe(true);
      expect(isValidAccountStatus("PENDING")).toBe(false);
      expect(isValidAccountStatus("DELETED")).toBe(false);

      // Access checks
      const activeSession = { status: "ACTIVE" } as never;
      expect(checkAccountAccess(activeSession).allowed).toBe(true);

      const bannedSession = { status: "BAN" } as never;
      const banCheck = checkAccountAccess(bannedSession);
      expect(banCheck.allowed).toBe(false);
      expect(banCheck.reason).toContain("suspended");

      const pausedSession = {
        status: "INACTIVE",
        inactiveUntil: Date.now() + 3600000,
      } as never;
      const pauseCheck = checkAccountAccess(pausedSession);
      expect(pauseCheck.allowed).toBe(false);
      expect(pauseCheck.reason).toContain("paused");

      const expiredPauseSession = {
        status: "INACTIVE",
        inactiveUntil: Date.now() - 1000,
      } as never;
      expect(checkAccountAccess(expiredPauseSession).allowed).toBe(true);
    });
  });

  describe("Phase 3: Database Backend Alignment & Structural Comparison", () => {
    it("gracefully validates schema structures and rejects prototype pollution", () => {
      const template = {
        id: "string",
        count: 0,
        active: true,
        metadata: { tag: "string" },
      };

      const validObj = {
        id: "rec_1",
        count: 10,
        active: false,
        metadata: { tag: "verified" },
      };
      expect(validateSchemaStructure(template, validObj)).toBe(true);

      // Rejects missing keys
      expect(validateSchemaStructure(template, { id: "rec_1", count: 10 })).toBe(false);

      // Rejects type mismatches
      expect(validateSchemaStructure(template, { ...validObj, count: "ten" })).toBe(false);

      // Rejects prototype polluting structures
      const pollutedObj = JSON.parse('{"id":"rec_1","count":1,"active":true,"metadata":{"tag":"ok"},"__proto__":{"admin":true}}');
      expect(validateSchemaStructure(template, pollutedObj)).toBe(false);
    });

    it("verifies initial quota configuration aligns with PostgreSQL table defaults", () => {
      // Database defaults: Portfolio (3/10), Sandbox (1/5), Chat (25/150)
      expect(QUOTA_MAX.portfolio.d).toBe(3);
      expect(QUOTA_MAX.portfolio.w).toBe(10);
      expect(QUOTA_MAX.sandbox.d).toBe(1);
      expect(QUOTA_MAX.sandbox.w).toBe(5);
      expect(QUOTA_MAX.chat.d).toBe(25);
      expect(QUOTA_MAX.chat.w).toBe(150);
    });
  });
});

