/* Academia · locker-crypto.ts
   Real AES-256-GCM encryption via WebCrypto only — no external deps.
   KDF: PBKDF2-SHA-256, default 600 000 iterations.
   IV: 96-bit random per document, never reused.

   .academia-lock binary layout (all big-endian):
   ┌──────────────────────────────────────────────────────────────┐
   │  Offset  │ Len │ Field                                       │
   ├──────────────────────────────────────────────────────────────┤
   │       0  │  8  │ Magic: ACA-LOCK                             │
   │       8  │  1  │ Version: 0x01                               │
   │       9  │  4  │ PBKDF2 iterations (uint32)                  │
   │      13  │ 16  │ Salt (128-bit)                              │
   │      29  │ 12  │ IV (96-bit)                                 │
   │      41  │  *  │ Ciphertext + 128-bit GCM tag                │
   └──────────────────────────────────────────────────────────────┘
   Minimum valid file size = 41 + 16 (tag) + 1 (1 byte plaintext) = 58 bytes.
*/

export const MAGIC = new Uint8Array([0x41, 0x43, 0x41, 0x2d, 0x4c, 0x4f, 0x43, 0x4b]); // "ACA-LOCK"
const VERSION = 0x01;
const DEFAULT_ITERATIONS = 600_000;
const SALT_LEN = 16;   // 128 bits
const IV_LEN = 12;     // 96 bits
const HEADER_LEN = MAGIC.length + 1 + 4 + SALT_LEN + IV_LEN; // 41
const GCM_TAG_LEN = 16; // 128-bit tag appended by SubtleCrypto

export interface LockBlob {
  /** PBKDF2 iterations used */
  iterations: number;
  /** 128-bit random salt */
  salt: Uint8Array;
  /** 96-bit random IV */
  iv: Uint8Array;
  /** AES-256-GCM ciphertext including 128-bit tag */
  ciphertext: Uint8Array;
}

export class FormatError extends Error { constructor(msg: string) { super(msg); this.name = "FormatError"; } }
export class AuthenticationError extends Error { constructor(msg: string) { super(msg); this.name = "AuthenticationError"; } }

/** Derive a 256-bit AES key from a passphrase + salt via PBKDF2-SHA-256. */
async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as Uint8Array<ArrayBuffer>, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt plaintext with AES-256-GCM. Returns a LockBlob. */
export async function encryptDocument(
  plaintext: Uint8Array,
  passphrase: string,
  opts?: { iterations?: number },
): Promise<LockBlob> {
  const iterations = opts?.iterations ?? DEFAULT_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(passphrase, salt, iterations);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as Uint8Array<ArrayBuffer> },
    key,
    plaintext as Uint8Array<ArrayBuffer>,
  );
  return { iterations, salt, iv, ciphertext: new Uint8Array(cipherBuf) };
}

/** Decrypt a LockBlob. Throws AuthenticationError on tag mismatch / wrong key. */
export async function decryptDocument(blob: LockBlob, passphrase: string): Promise<Uint8Array> {
  const { iterations, salt, iv, ciphertext } = blob;
  const key = await deriveKey(passphrase, salt, iterations);
  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as Uint8Array<ArrayBuffer> },
      key,
      ciphertext as Uint8Array<ArrayBuffer>,
    );
    return new Uint8Array(plainBuf);
  } catch {
    throw new AuthenticationError("AES-GCM authentication failed — wrong passphrase or tampered ciphertext");
  }
}

/** Serialize a LockBlob to the .academia-lock binary wire format. */
export function serializeLockFile(blob: LockBlob): Uint8Array {
  const { iterations, salt, iv, ciphertext } = blob;
  const out = new Uint8Array(HEADER_LEN + ciphertext.length);
  const view = new DataView(out.buffer);
  let off = 0;
  out.set(MAGIC, off); off += MAGIC.length;
  out[off++] = VERSION;
  view.setUint32(off, iterations, false /* big-endian */); off += 4;
  out.set(salt, off); off += SALT_LEN;
  out.set(iv, off); off += IV_LEN;
  out.set(ciphertext, off);
  return out;
}

/** Parse a .academia-lock binary blob back into a LockBlob.
    Throws FormatError on bad magic, version mismatch, or truncation. */
export function parseLockFile(bytes: Uint8Array): LockBlob {
  // Magic check
  if (bytes.length < MAGIC.length) throw new FormatError("Invalid .academia-lock: too short for magic header");
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) throw new FormatError("Invalid .academia-lock: magic header mismatch");
  }
  // Minimum length: header + at least 1 byte ciphertext + 16 byte tag
  if (bytes.length < HEADER_LEN + GCM_TAG_LEN + 1) {
    throw new FormatError(`Invalid .academia-lock: file is truncated (got ${bytes.length} bytes, need ≥${HEADER_LEN + GCM_TAG_LEN + 1})`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = MAGIC.length;
  const version = bytes[off++];
  if (version !== VERSION) throw new FormatError(`Invalid .academia-lock: unsupported version 0x${version.toString(16)}`);
  const iterations = view.getUint32(off, false); off += 4;
  const salt = bytes.slice(off, off + SALT_LEN); off += SALT_LEN;
  const iv = bytes.slice(off, off + IV_LEN); off += IV_LEN;
  const ciphertext = bytes.slice(off);
  if (ciphertext.length < GCM_TAG_LEN + 1) {
    throw new FormatError(`Invalid .academia-lock: ciphertext too short (${ciphertext.length} bytes)`);
  }
  return { iterations, salt, iv, ciphertext };
}

