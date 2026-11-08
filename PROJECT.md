# Academia — Project Master Blueprint (PROJECT.md)

> Consolidated project documentation uniting the Project Overview, Technical Specifications, Architectural Blueprints, Security Controls, and Roadmap.

---

## Part I: Product Blueprint & Vision

### 1. Executive Summary
**Academia** is a deterministic, notebook-style workspace engineered for secondary and collegiate students pursuing STEM, mathematics, and high-stakes admissions preparation. Unlike conventional educational platforms that rely on non-deterministic LLM generations, opaque ranking heuristics, or invasive user tracking, Academia is built on three core pillars:
1. **Mathematical & Algorithmic Determinism**: Every response, schedule, diagnostic band, and virtual machine run is 100% reproducible and cites its exact rule or formula.
2. **Absolute Privacy Sovereignty**: Zero third-party trackers, zero advertising scripts, and full adherence to COPPA, GDPR-K, and India's DPDP Act 2023.
3. **Local-First Resilience**: Full operational capability offline through a version-clamped local store, backed by high-assurance WebCrypto cryptography.

---

### 2. User Experience & Design Identity
Academia implements the **Notebook-Skin** design language, reminiscent of tactile physical stationery (ink borders, paper neutrals, margin rulings, and cobalt ballpoint accents).

#### Design Tokens (`src/styles/tokens.css`):
- **Paper Palette**: Soft warm backgrounds (`--background-50: #fdfaf1`, `--background-100: #f6efe0`, `--surface: #fffdf6`), rich heading ink (`--text-900: #241c14`), and hard tactile shadows (`--shadow-hard: 4px 4px 0px #17110b`).
- **Midnight Palette**: High-contrast, fatigue-free dark mode for extended study sessions.
- **Typography**:
  - Display: *Fraunces* (Editorial serif)
  - Body: *Space Grotesk* (Clean technical sans)
  - Handwriting: *Caveat* (Margin notes & personal annotations)
  - Monospace: *IBM Plex Mono* (Calculations, code, and execution traces)

---

## Part II: Functional Module Specifications

### 1. Active-Recall Library (`src/views/library.tsx`)
- **Canonical SM-2 Scheduler**:
  - Implements canonical SuperMemo-2 interval growth with a strict floor on Ease Factor ($\text{EF} \ge 1.3$).
  - Quality ratings (0 to 5) adjust future review intervals; ratings below 3 count as lapses (reps reset to 0, interval resets to 1 day, EF remains unchanged).
- **Cloze Deletion Hierarchy**:
  - Syntax: `{{c1::answer::hint}}`.
  - Child cards adopt the `<parentId>#c<index>` identifier format.
  - Editing preserves scheduling for persistent indices while cascading deletion cleanly.
- **Review Log Ring Buffer**:
  - Ring buffer capped at 5,000 entries tracking `{ cardId, q, ts, wasNew }`.
  - Enforces daily review and new-card limits calculated via local calendar midnight boundaries (`dayKey`).
- **Leech Detection**:
  - Identifies chronically difficult cards (lapses $\ge 4$) under `LEECH/LAPSE_GTE_4` and provides actionable structural remediation suggestions.
- **Safe Deck Portability**:
  - CSV export neutralizes spreadsheet formula injection by prepending `'` to leading `=`, `+`, `-`, or `@`.
  - Import verifies a 2MB cap, 5,000-row limit, clamps EF to $[1.3, 4.0]$, and protects against prototype pollution.

### 2. Sealed Document Locker (`src/views/locker.tsx`)
- **WebCrypto AES-256-GCM Vault**:
  - Zero external npm dependencies. Uses standard `crypto.subtle`.
  - Keys derived via PBKDF2-SHA-256 with 600,000 iterations and a 128-bit random salt.
  - Unique 96-bit random IV per document.
- **Binary Wire Container (`.academia-lock`)**:
  - Begins with magic header `ACA-LOCK` (version byte `0x01`).
  - Serializes iterations, salt, IV, and ciphertext with a 128-bit authentication tag.
  - Tampered ciphertext or incorrect passphrases automatically trip the system's `TAMPER-LOCK` defensive state.
- **Zero Disk Exposure**:
  - Passphrases and derived cryptographic keys exist solely in transient memory; never written to `localStorage`.

### 3. Community Moderation & Charter Filter (`src/engine/charter-filter.ts`)
- Multi-tier evasion-resistant text moderation:
  - Unicode NFKC normalization.
  - Cyrillic/Greek homoglyph confusable translation (e.g. Cyrillic `і` $\to$ Latin `i`).
  - Zero-width character stripping.
  - Leet-speak normalization (`1` $\to$ `i`, `0` $\to$ `o`, `3` $\to$ `e`, `@` $\to$ `a`, `$` $\to$ `s`).
  - Letter-spacing collapse (e.g., `s t u p i d` $\to$ `stupid`).
  - Vowel censor expansion (e.g., `st*pid` flagged accurately).
  - Bilingual moderation covering English and romanized Hindi/Hinglish idioms.
  - Scunthorpe allow-list patterns protecting innocent vocabulary (`dumbbell`, `assess`, `Moran's I test`).

### 4. Deterministic Virtual Machine (`src/engine/interpreter.ts`)
- `acad-vm`: A bounded, deterministic AST interpreter executing without browser `eval()` or `new Function()`.
- Supports loops, variable assignments, standard mathematical operations, and snapshot rollbacks.
- Strict step budget guarantees termination and prevents infinite execution stalls.

---

## Part III: Technical Architecture & Systems Engineering

### 1. State Management & Offline Resilience (`src/engine/store.tsx`)
- Single source of truth managed via `AppState` (Version 3).
- **Prototype Pollution Prevention**: `mergeObject()` validates all properties against seed models, explicitly discarding `__proto__`, `constructor`, and `prototype`.
- **Clamping**: Rigid bounds checking for user roles, account statuses, and quota limits.
- **Cross-Tab Synchronization**: Real-time multi-tab consistency managed through storage event listeners and monotonic operation counters (`ops`).

### 2. Backend & Database Specification (Supabase / PostgreSQL)
- **Migrations & Schemas (`supabase/migrations/20261107_init.sql`)**:
  - `public.profiles`: Stores user identity, RBAC (`student`, `admin`), and account status (`ACTIVE`, `INACTIVE`, `BAN`).
  - `public.quotas`: Backed by PostgreSQL serializable transactions via `consume_quota(target_key)`.
  - `public.parental_consents`: Tracks verifiable guardian consent tokens bound to child profiles, single-use validation, and 48-hour expiration limits.
  - `public.admin_warnings`: Append-only governance audit log.
- **Row Level Security (RLS)**:
  - Prevents students from reading foreign profiles or elevating their privileges.
  - Enforces that administrative operations are restricted to authenticated admin profiles.

### 3. Production Deployment & Security Headers (`vercel.json`)
- `Content-Security-Policy`:
  - `default-src 'self'`.
  - `script-src 'self' 'unsafe-inline'` (evaluated for hash-based hardening).
  - `style-src 'self' 'unsafe-inline'`.
  - `font-src 'self'`.
  - `frame-ancestors 'none'` (disallows framing everywhere).
  - `connect-src 'self'`.
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`.
- `X-Frame-Options`: `DENY`.
- `X-Content-Type-Options`: `nosniff`.
- `Referrer-Policy`: `strict-origin-when-cross-origin`.
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`.

---

## Part IV: Verification, Testing & Compliance

### 1. Automated Test Suites
Vitest suites located in `src/__tests__/` and `test/`:
- `test/locker-crypto.test.ts`: Round-trip AES-256-GCM encryption/decryption, binary format parsing, authentication tag tampering rejection, wrong passphrase rejection, and 1,000 IV uniqueness.
- `test/charter-filter.test.ts`: 53+ test scenarios covering evasion normalizations, leetspeak, Hinglish vocabulary, Scunthorpe false-positive prevention, and severity output.
- `test/parental-consent.test.ts`: Validates single-use parental tokens, 48h expiration, account mismatch rejections, and under-13 school code enforcement.
- `src/__tests__/library.test.ts`: 10,000 randomized SM-2 review fuzzing, cloze sibling synchronization, ring-buffer review log analytics, CSV formula injection defense, and prototype pollution immunity.
- `test/store.test.ts` & `test/smoke.test.tsx`: Component mounting, route transitions, and localStorage corruption recovery.

### 2. Legal Questions Checklist for Minor Data Protection (DPDP Act & COPPA)
*Operational checklist to review with qualified legal counsel:*
1. **Verifiable Parental Consent (VPC)**: Sufficiency of signed token email loops under DPDP Act 2023 regulations vs. prospective government-mandated ID verification methods (e.g. DigiLocker).
2. **School Authorization Exemption**: Legal status of institutional school administrators acting as surrogate consenters for under-13 student provisioning.
3. **Behavioral Profiling Restrictions**: Analysis of diagnostic weakness mapping and focus timers under DPDP Section 9(2) prohibiting tracking or behavioral monitoring of children.
4. **Data Retention & Right to Erasure**: Statutory timelines for executing parental deletion requests against academic dossiers, audit flags, and financial records.
5. **Data Localization**: Compliance requirements governing hosting minor data inside India's geographic territory (AWS Mumbai / GCP Mumbai).

