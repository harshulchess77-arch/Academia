/* Academia · locker-worker.ts
   Off-thread background cryptography worker for AES-256-GCM / PBKDF2-SHA-256.
   Eliminates main-thread lag when locking or unlocking heavy .academia-lock binaries. */

import {
  encryptDocument,
  decryptDocument,
  parseLockFile,
  serializeLockFile,
} from "./locker-crypto";

export interface CryptoWorkerRequest {
  id: string;
  action: "ENCRYPT" | "DECRYPT";
  bytes: Uint8Array;
  passphrase: string;
  iterations?: number;
}

export interface CryptoWorkerResponse {
  id: string;
  success: boolean;
  bytes?: Uint8Array;
  error?: string;
  durationMs: number;
}

if (typeof self !== "undefined" && typeof (self as unknown as Worker).postMessage === "function" && typeof window === "undefined") {
  self.onmessage = async (e: MessageEvent<CryptoWorkerRequest>) => {
    const t0 = performance.now();
    const { id, action, bytes, passphrase, iterations } = e.data;

    try {
      if (action === "ENCRYPT") {
        const lockBlob = await encryptDocument(bytes, passphrase, { iterations });
        const serialized = serializeLockFile(lockBlob);
        const durationMs = performance.now() - t0;
        const res: CryptoWorkerResponse = {
          id,
          success: true,
          bytes: serialized,
          durationMs,
        };
        (self as unknown as Worker).postMessage(res, [serialized.buffer]);
      } else if (action === "DECRYPT") {
        const lockBlob = parseLockFile(bytes);
        const plaintext = await decryptDocument(lockBlob, passphrase);
        const durationMs = performance.now() - t0;
        const res: CryptoWorkerResponse = {
          id,
          success: true,
          bytes: plaintext,
          durationMs,
        };
        (self as unknown as Worker).postMessage(res, [plaintext.buffer]);
      }
    } catch (err) {
      const durationMs = performance.now() - t0;
      const res: CryptoWorkerResponse = {
        id,
        success: false,
        error: (err as Error).message,
        durationMs,
      };
      (self as unknown as Worker).postMessage(res);
    }
  };
}

