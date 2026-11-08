// @vitest-environment jsdom
/* Academia · Locker encryption tests
   Written BEFORE the implementation so they all fail until the crypto
   module exists. Requirements:
   - AES-256-GCM via WebCrypto
   - PBKDF2-SHA-256, >=600 000 iterations
   - Random 96-bit IV per document; never reused across 1 000 encryptions
   - .academia-lock binary format: magic header + version + KDF params + salt + IV + ciphertext+tag
   - Wrong passphrase → AuthenticationError (tag mismatch)
   - Flipped ciphertext bit → AuthenticationError
   - Truncated file → FormatError
   - Wrong magic → FormatError
*/
import { describe, it, expect } from "vitest";
import {
  encryptDocument,
  decryptDocument,
  serializeLockFile,
  parseLockFile,
  MAGIC,
  computeSchemaChecksum,
  validateContainerSchema,
  TamperError,
} from "@/engine/locker-crypto";

// ── helpers ────────────────────────────────────────────────────────────────
const enc = new TextEncoder();
const plaintext = enc.encode("Hello Academia — this is a test document payload.");

// ── round-trip ─────────────────────────────────────────────────────────────
describe("round-trip encrypt → decrypt", () => {
  it("decrypts to the original plaintext with the correct passphrase", async () => {
    const blob = await encryptDocument(plaintext, "correct-passphrase");
    const result = await decryptDocument(blob, "correct-passphrase");
    expect(Array.from(result)).toEqual(Array.from(plaintext));
  });

  it("produces a binary file with the magic header", async () => {
    const blob = await encryptDocument(plaintext, "pw");
    const lock = serializeLockFile(blob);
    expect(Array.from(lock.slice(0, MAGIC.length))).toEqual(Array.from(MAGIC));
  });

  it("round-trips through serialize → parse → decrypt", async () => {
    const blob = await encryptDocument(plaintext, "my-secret");
    const bytes = serializeLockFile(blob);
    const parsed = parseLockFile(bytes);
    const result = await decryptDocument(parsed, "my-secret");
    expect(Array.from(result)).toEqual(Array.from(plaintext));
  });
});

// ── wrong passphrase ───────────────────────────────────────────────────────
describe("authentication failures", () => {
  it("throws on wrong passphrase (tag mismatch)", async () => {
    const blob = await encryptDocument(plaintext, "correct");
    await expect(decryptDocument(blob, "wrong")).rejects.toThrow(/auth|decrypt|tag|invalid/i);
  });

  it("throws on flipped ciphertext bit", async () => {
    const blob = await encryptDocument(plaintext, "pw");
    // flip the first byte of ciphertext (after the header fields)
    const tampered = { ...blob, ciphertext: flipBit(blob.ciphertext) };
    await expect(decryptDocument(tampered, "pw")).rejects.toThrow(/auth|decrypt|tag|invalid/i);
  });
});

// ── format errors ──────────────────────────────────────────────────────────
describe("format validation", () => {
  it("throws on wrong magic header", async () => {
    const blob = await encryptDocument(plaintext, "pw");
    const bytes = serializeLockFile(blob);
    const bad = new Uint8Array(bytes);
    bad[0] = 0xff; bad[1] = 0x00; // corrupt the magic
    expect(() => parseLockFile(bad)).toThrow(/magic|format|invalid/i);
  });

  it("throws on truncated file (missing IV)", async () => {
    const blob = await encryptDocument(plaintext, "pw");
    const bytes = serializeLockFile(blob);
    expect(() => parseLockFile(bytes.slice(0, 20))).toThrow(/truncat|short|format|invalid/i);
  });

  it("throws on truncated file (missing ciphertext)", async () => {
    const blob = await encryptDocument(plaintext, "pw");
    const bytes = serializeLockFile(blob);
    // Strip almost everything past the IV so ciphertext < GCM_TAG_LEN+1 bytes.
    // Header is 41 bytes; keep header + 1 byte (less than the 17-byte minimum ciphertext).
    expect(() => parseLockFile(bytes.slice(0, 42))).toThrow(/truncat|short|format|invalid/i);
  });
});

// ── IV uniqueness across 1 000 encryptions ─────────────────────────────────
describe("IV uniqueness", () => {
  it("never reuses a 96-bit IV across 1 000 encryptions", async () => {
    const ivSet = new Set<string>();
    // Use a small plaintext and low iteration count alias to keep the test fast.
    // The real module uses >=600k; here we patch iterations via the optional param.
    for (let i = 0; i < 1000; i++) {
      const blob = await encryptDocument(plaintext, "pw", { iterations: 1000 });
      const ivHex = Array.from(blob.iv).map(b => b.toString(16).padStart(2, "0")).join("");
      expect(ivSet.has(ivHex)).toBe(false);
      ivSet.add(ivHex);
    }
    expect(ivSet.size).toBe(1000);
  });
}, 60_000); // generous timeout for 1 000 PBKDF2 runs

// ── KDF parameter floor ────────────────────────────────────────────────────
describe("KDF parameters", () => {
  it("uses >=600 000 iterations by default", async () => {
    const blob = await encryptDocument(plaintext, "pw");
    expect(blob.iterations).toBeGreaterThanOrEqual(600_000);
  });

  it("stores a 128-bit salt", async () => {
    const blob = await encryptDocument(plaintext, "pw");
    expect(blob.salt.byteLength).toBe(16);
  });

  it("stores a 96-bit IV", async () => {
    const blob = await encryptDocument(plaintext, "pw");
    expect(blob.iv.byteLength).toBe(12);
  });
});

// ── schema validation & integrity sentinel ─────────────────────────────────
describe("schema validator & tamper sentinel", () => {
  it("computes deterministic SHA-256 structural checksum regardless of key order", async () => {
    const objA = { version: 3, id: "123", email: "student@academia.app" };
    const objB = { email: "student@academia.app", version: 3, id: "123" };
    const hashA = await computeSchemaChecksum(objA);
    const hashB = await computeSchemaChecksum(objB);
    expect(hashA).toBe(hashB);
    expect(hashA.length).toBe(64);
  });

  it("validates intact container schema", async () => {
    const validData = { version: 3, flashcards: [], session: { role: "student" } };
    const res = await validateContainerSchema(validData);
    expect(res.valid).toBe(true);
    expect(res.checksum.length).toBe(64);
  });

  it("throws TamperError when prototype polluting keys exist", async () => {
    const tampered = JSON.parse('{"version":3,"__proto__":{"admin":true}}');
    await expect(validateContainerSchema(tampered)).rejects.toThrow(TamperError);
  });

  it("throws TamperError on checksum mismatch", async () => {
    const data = { version: 3, data: "genuine" };
    await expect(validateContainerSchema(data, "0000000000000000000000000000000000000000000000000000000000000000")).rejects.toThrow(TamperError);
  });
});

// ── helper ─────────────────────────────────────────────────────────────────
function flipBit(arr: Uint8Array): Uint8Array {
  const copy = new Uint8Array(arr);
  copy[0] ^= 0x01;
  return copy;
}
