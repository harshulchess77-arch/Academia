# Academia Architecture Specification

This document details the architectural principles, data flows, state invariants, cryptographic specifications, security boundaries, and backend integration design for **Academia**.

---

## 1. Architectural Philosophy

Academia operates under strict, non-negotiable architectural tenets:
1. **Deterministic Execution**: No generative models or probabilistic classifiers touch core logic. State transitions, recommendations, and schedules are 100% reproducible and inspectable.
2. **Local-First with Zero Mandatory Egress**: The application functions completely offline in `DEMO_MODE` using local storage with deep shape validation and sanitization.
3. **Defense in Depth**: Client-side route guards, keystroke filtering, and sanitizers are strictly advisory; all security policies, quotas, and role privileges are formally backed by server-side verification and PostgreSQL Row Level Security (RLS).
4. **Child Safety by Design**: Compliant with COPPA, GDPR-K, and India's DPDP Act 2023. Explicit parental consent validation, zero third-party behavioral profiling, and strict data minimization.

---

## 2. System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          User Browser / Client                         │
│                                                                        │
│   ┌───────────────────┐    ┌────────────────────┐    ┌─────────────┐   │
│   │   Hash Router     │───▶│   View Layer       │───▶│ UI Tokens   │   │
│   │  (Route Guards)   │    │  (Library, Locker) │    │ & Skin (CSS)│   │
│   └───────────────────┘    └────────────────────┘    └─────────────┘   │
│             │                        │                                 │
│             ▼                        ▼                                 │
│   ┌─────────────────────────────────────────────┐                      │
│   │            App Store (Version 3)            │                      │
│   │   useApp() · Immutable up() · Toasts Host   │                      │
│   └─────────────────────────────────────────────┘                      │
│             │                        │                                 │
│             ▼                        ▼                                 │
│   ┌───────────────────┐    ┌────────────────────┐                      │
│   │ Engine & Pure     │    │ WebCrypto Engine   │                      │
│   │ Rules / Interpreters   │ (AES-256-GCM / PBKDF2)                    │
│   └───────────────────┘    └────────────────────┘                      │
│             │                                                          │
│             ▼                                                          │
│   ┌─────────────────────────────────────────────┐                      │
│   │ Local Storage Layer (Version 3 Clamped)     │                      │
│   └─────────────────────────────────────────────┘                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (Cookie Auth / JSON API)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Supabase Backend Service                        │
│                                                                        │
│   ┌───────────────────┐    ┌────────────────────┐    ┌─────────────┐   │
│   │ GoTrue Auth       │    │ PostgREST API      │    │ Functions   │   │
│   │ (Secure Cookies)  │    │ (RLS Enforced)     │    │ (Consent)   │   │
│   └───────────────────┘    └────────────────────┘    └─────────────┘   │
│                                      │                                 │
│                                      ▼                                 │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      PostgreSQL Database                       │   │
│   │   profiles · quotas · parental_consents · admin_warnings       │   │
│   │   Stored Procedures: consume_quota(key) [Atomic Rollover]      │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Engine Components

### 3.1. Local Reactive Store (`src/engine/store.tsx`)
- **Versioned State**: Schema is pinned to Version 3 (`academia-state-v3`).
- **Resilience Against Corruption**:
  - `mergeObject()` performs deep structural merging against a canonical seed.
  - Rejects prototype pollution payloads (`__proto__`, `constructor`, `prototype`).
  - Clamps numerical ranges, enums (`Role`, `AccountStatus`, `Tier`), and sanitizes array lengths to prevent memory exhaustion attacks.
- **Quota Lifecycles**:
  - Enforces daily limits (`portfolio: 3`, `sandbox: 1`, `chat: 25`) and weekly limits (`portfolio: 10`, `sandbox: 5`, `chat: 150`).
  - Rollover logic uses `dayKey(t)` and `weekKey(t)` calculated against the user's **local calendar timezone** (not UTC), resetting daily counts at local midnight and weekly counts on local Mondays.

### 3.2. Locker WebCrypto Engine (`src/engine/locker-crypto.ts`)
- **Cipher Suite**: AES-256-GCM (Galois/Counter Mode) via browser `crypto.subtle`.
- **Key Derivation (KDF)**: PBKDF2-SHA-256 using 600,000 iterations and a 128-bit cryptographically secure random salt.
- **Nonce/IV**: 96-bit random IV generated per document via `crypto.getRandomValues()`. Never reused across encryptions.
- **Wire Format (`.academia-lock`)**:
  ```
  00-07: Magic ASCII string "ACA-LOCK" (8 bytes)
  08   : Format Version (0x01)
  09-12: Big-endian Uint32 PBKDF2 Iteration Count
  13-28: Salt (16 bytes / 128 bits)
  29-40: Nonce / IV (12 bytes / 96 bits)
  41-..: Ciphertext + 128-bit GCM Authentication Tag
  ```
- **In-Memory Guarantee**: Passphrases and derived keys live exclusively in component/heap memory. Never persisted to `localStorage` or session tokens.

### 3.3. Hardened Community Charter Filter (`src/engine/charter-filter.ts`)
Multi-stage normalization pipeline to prevent evasion:
1. **Unicode NFKC Normalization**: Eliminates fullwidth fonts and compatibility ligatures.
2. **Confusable Resolution**: Maps lookalike Greek and Cyrillic glyphs (e.g. Cyrillic `і` → `i`).
3. **Zero-Width Stripping**: Removes zero-width spaces (`\u200b`), soft hyphens, and invisible joiners.
4. **Leet-Speak Substitution**: Translates numeric and symbolic leet encodings (`1`→`i`, `3`→`e`, `0`→`o`, `@`→`a`, `$`→`s`, `5`→`s`, `7`→`t`).
5. **Masking & Spacing Collapse**:
   - Letter-spacing evasion (e.g. `s t u p i d` → `stupid`).
   - Intra-word vowel censors (e.g. `st*pid` matches through term regex expansion).
   - Collapse 3+ consecutive duplicate characters down to 2.
6. **False-Positive Suppression**: Scunthorpe patterns allow legitimate vocabulary (e.g. `dumbbell`, `Moran's I test`, `assess`).
7. **Bilingual Vocabulary**: Isolated dictionary in `charter-filter-words.ts` supporting English and romanized Hindi/Hinglish terms.

### 3.4. SuperMemo SM-2 & Cloze Engine (`src/engine/cloze.ts` & `src/engine/library-analytics.ts`)
- **Canonical Algorithm**:
  $$\text{Interval}(1) = 1, \quad \text{Interval}(2) = 6, \quad \text{Interval}(n) = \text{Interval}(n-1) \times \text{EF}$$
  $$\text{EF}' = \max\left(1.3, \, \text{EF} + \left(0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02)\right)\right)$$
  - Lapses ($q < 3$) reset reps to 0 and interval to 1 day while leaving EF strictly unchanged.
- **Review Log Ring Buffer**: `reviewLog` stores up to 5,000 entries of `{ cardId, q, ts, wasNew }` for daily limit enforcement and retention rate calculation.
- **Cloze Hierarchy**: Cloze templates generate virtual cards under the `<parentId>#c<index>` namespace, cascading deletions and retaining scheduling state when re-editing.

---

## 4. Backend & Security Architecture

### 4.1. Supabase PostgreSQL Schema
All administrative operations, role enforcement, and parental consents are executed within PostgreSQL with Row Level Security enabled:
- **`public.profiles`**: Contains system roles (`student`, `admin`) and statuses (`ACTIVE`, `INACTIVE`, `BAN`). RLS policies prevent users from upgrading their own privileges.
- **`public.quotas`**: Handled via PostgreSQL stored function `consume_quota(target_key)` inside serializable transactions to prevent race conditions or request replay attacks.
- **`public.parental_consents`**: Verifiable audit records with child account binding, expiration timestamps, and policy versions.

### 4.2. Security Headers & Deployment
Configured via `vercel.json`:
- `Content-Security-Policy`: Disallows unauthorized external script domains; restricts frames to youtube-nocookie; restricts connections to origin.
- `X-Frame-Options: DENY` & `frame-ancestors 'none'`: Mitigates clickjacking.
- `Strict-Transport-Security`: Enforces 2-year HSTS with subdomains and preload.
- `Permissions-Policy`: Disables camera, microphone, and geolocation.
- `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing exploits.

---

## 5. Data Flow & Authentication Lifecycle

```
[User Registration (Under 18)]
              │
              ▼
    [ParentalGate Component]
              │
              ├──▶ Server generates single-use signed token (48h expiry)
              ├──▶ Guardian receives email verification
              └──▶ Guardian submits token; Server validates childId binding
                        │
                        ▼
            [Profile Activated as Student]
                        │
       ┌────────────────┴────────────────┐
       ▼                                 ▼
[Student Session]                 [Admin Session]
   - Advisory Route Guard            - Full Route Access
   - Client Cache in LocalStore      - Ban / Unban Students
   - Local Quota Checks              - Quota Overrides
   - Server RPC Quota Deduction      - Audit Trail Review
```

