// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import {
  encryptDocument,
  parseLockFile,
  serializeLockFile,
  timingSafeEqualHex,
  validateContainerSchema,
  TamperError,
  MIN_ALLOWED_ITERATIONS,
  MAX_ALLOWED_ITERATIONS,
} from "@/engine/locker-crypto";
import { toRpn, evalRpn } from "@/engine/math";
import { exportDeckToCSV, importDeckFromCSV } from "@/engine/library-io";
import { runProgram } from "@/engine/interpreter";
import {
  issueConsentToken,
  verifyConsentToken,
  consentStore,
  MAX_CONSENT_ATTEMPTS,
} from "@/engine/parental-consent";
import { sanitizeHtml } from "@/engine/sanitize";

describe("Security Audit Remediation Suite", () => {
  describe("VULN-01: Bounded PBKDF2 Iteration Enforcement (CWE-326 / CWE-400)", () => {
    it("rejects crafted .academia-lock container with dangerously low iterations (< 100,000)", async () => {
      const blob = await encryptDocument(new Uint8Array([1, 2, 3]), "pass", { iterations: 1000 });
      const bytes = serializeLockFile(blob);
      // bytes offset 9..12 is big-endian iteration count
      // Tamper iterations to 1
      const tampered = new Uint8Array(bytes);
      new DataView(tampered.buffer).setUint32(9, 1, false);

      expect(() => parseLockFile(tampered)).toThrow(/outside acceptable bounds/i);
    });

    it("rejects crafted .academia-lock container with DoS-inducing iterations (> 5,000,000)", async () => {
      const blob = await encryptDocument(new Uint8Array([1, 2, 3]), "pass", { iterations: 1000 });
      const bytes = serializeLockFile(blob);
      const tampered = new Uint8Array(bytes);
      new DataView(tampered.buffer).setUint32(9, 10_000_000, false);

      expect(() => parseLockFile(tampered)).toThrow(/outside acceptable bounds/i);
    });

    it("accepts valid container within allowed bounds", async () => {
      const blob = await encryptDocument(new Uint8Array([1, 2, 3]), "pass", { iterations: 150_000 });
      const bytes = serializeLockFile(blob);
      const parsed = parseLockFile(bytes);
      expect(parsed.iterations).toBe(150_000);
    });
  });

  describe("VULN-02: Prototype Method Confusion Defense in RPN Evaluator (CWE-1321)", () => {
    it("rejects Object.prototype methods as unknown functions", () => {
      // Trying to invoke toString as a mathematical function
      expect(() => evalRpn([{ t: "CALL", name: "toString", args: 1 }])).toThrow(/Unknown function "toString"/i);
      expect(() => evalRpn([{ t: "CALL", name: "valueOf", args: 1 }])).toThrow(/Unknown function "valueOf"/i);
      expect(() => evalRpn([{ t: "CALL", name: "constructor", args: 1 }])).toThrow(/Unknown function "constructor"/i);
    });
  });

  describe("VULN-03: Formula Injection Bypass via Leading Whitespace (CWE-1236)", () => {
    it("neutralizes formula cells with leading spaces, tabs, or carriage returns", () => {
      const cards = [
        {
          id: "fc-card-1",
          front: "   =cmd|' /C calc'!A0",
          back: "\t@SUM(1,2)",
          deck: "  -2+3",
          ef: 2.5,
          interval: 1,
          reps: 1,
          due: Date.now(),
        },
      ];

      const csv = exportDeckToCSV(cards);
      expect(csv).toContain("\"'   =cmd|' /C calc'!A0\"");
      expect(csv).toContain("\"'\t@SUM(1,2)\"");
      expect(csv).toContain("\"'  -2+3\"");

      // Round-trip safely unescapes
      const imported = importDeckFromCSV(csv);
      expect(imported[0].front).toBe("   =cmd|' /C calc'!A0");
      expect(imported[0].back).toBe("\t@SUM(1,2)");
      expect(imported[0].deck).toBe("  -2+3");
    });
  });

  describe("VULN-04: Resource Exhaustion Defense in VM String Concatenation (CWE-400)", () => {
    it("throws error when string concatenation exceeds MAX_STR memory ceiling", () => {
      // Loop that tries to double string size past 100k
      const code = `
let s = "abcdefghij"
let i = 0
while (i < 15) {
  s = s + s
  i = i + 1
}
`;
      const result = runProgram(code);
      expect(result.ok).toBe(false);
      expect(result.lines.some(l => l.text.includes("string length limit exceeded"))).toBe(true);
    });
  });

  describe("VULN-05: Rate Limiting & High-Entropy Parental Consent (CWE-307 / CWE-330)", () => {
    beforeEach(() => {
      consentStore.clear();
    });

    it("issues high-entropy consent token with prefix and random suffix", async () => {
      const { token } = await issueConsentToken("child-secure", "guardian@example.com");
      expect(token).toMatch(/^ACA-\d{6}-[0-9A-F]{8}$/);
    });

    it("locks token after 5 consecutive failed verification attempts", async () => {
      const { token } = await issueConsentToken("child-target", "guardian@example.com");

      // 5 failed verification attempts with wrong childId
      for (let i = 0; i < MAX_CONSENT_ATTEMPTS; i++) {
        const attempt = await verifyConsentToken("wrong-child", token, 15);
        expect(attempt.ok).toBe(false);
        if (!attempt.ok) expect(attempt.error).toBe("ACCOUNT_MISMATCH");
      }

      // 6th attempt even with correct childId is locked out
      const lockedAttempt = await verifyConsentToken("child-target", token, 15);
      expect(lockedAttempt.ok).toBe(false);
      if (!lockedAttempt.ok) expect(lockedAttempt.error).toBe("MAX_ATTEMPTS_EXCEEDED");
    });
  });

  describe("VULN-06: DOM Clobbering Defense in HTML Sanitizer (CWE-79 / CWE-80)", () => {
    it("handles markup designed to clobber document.body without throwing", () => {
      const maliciousHtml = '<form id="body"><input id="childNodes" value="clobbered"></form><p>Safe content</p>';
      const cleaned = sanitizeHtml(maliciousHtml);
      expect(cleaned).toContain("<p>Safe content</p>");
      expect(cleaned).not.toContain("<form");
    });
  });

  describe("VULN-07: Timing-Safe Checksum Comparison (CWE-208)", () => {
    it("verifies matching strings in constant time and rejects mismatches", () => {
      expect(timingSafeEqualHex("abcdef123456", "abcdef123456")).toBe(true);
      expect(timingSafeEqualHex("abcdef123456", "abcdef123457")).toBe(false);
      expect(timingSafeEqualHex("short", "longerstring")).toBe(false);
    });

    it("rejects tampered container schema checksum", async () => {
      const data = { sample: "value" };
      await expect(validateContainerSchema(data, "0000000000000000000000000000000000000000000000000000000000000000")).rejects.toThrow(TamperError);
    });
  });
});
