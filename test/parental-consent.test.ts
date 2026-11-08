// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { issueConsentToken, verifyConsentToken, consentStore } from "@/engine/parental-consent";

describe("Parental Consent Service", () => {
  beforeEach(() => {
    consentStore.clear();
  });

  it("issues a valid single-use token bound to child", async () => {
    const { token } = await issueConsentToken("child-123", "guardian@example.com");
    expect(token).toContain("ACA-");

    const res = await verifyConsentToken("child-123", token, 15);
    expect(res.ok).toBe(true);
  });

  it("fails on expired token", async () => {
    const start = Date.now();
    const { token } = await issueConsentToken("child-123", "guardian@example.com", { now: start });

    // 49 hours later
    const future = start + 49 * 60 * 60 * 1000;
    const res = await verifyConsentToken("child-123", token, 15, { now: future });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("EXPIRED");
  });

  it("fails on reused token", async () => {
    const { token } = await issueConsentToken("child-123", "guardian@example.com");

    const first = await verifyConsentToken("child-123", token, 15);
    expect(first.ok).toBe(true);

    const second = await verifyConsentToken("child-123", token, 15);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("REUSED");
  });

  it("fails on token for another account", async () => {
    const { token } = await issueConsentToken("child-123", "guardian@example.com");

    const res = await verifyConsentToken("child-other", token, 15);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("ACCOUNT_MISMATCH");
  });

  it("fails when under 13 without school invite code", async () => {
    const { token } = await issueConsentToken("child-under13", "guardian@example.com");

    const res = await verifyConsentToken("child-under13", token, 12);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("UNDER_13_NO_SCHOOL");
  });

  it("succeeds when under 13 WITH validated school invite code", async () => {
    const { token } = await issueConsentToken("child-under13", "guardian@example.com", { schoolCode: "SCH-9988" });

    const res = await verifyConsentToken("child-under13", token, 12);
    expect(res.ok).toBe(true);
  });
});

