# Academia Architectural Manifesto

> **Comprehensive Technical Architecture, Invariants, State Topology, and Cryptographic Specifications for Academia.**

---

## 1. Architectural Philosophy & Invariants

Academia is built upon uncompromising deterministic engineering principles:

1. **Deterministic Execution**: No probabilistic large language models or black-box generative classifiers touch core state transitions or student evaluation logic. Every schedule, recommendation, AST evaluation, and diagnostic calculation traces to an explicit, human-readable rule or mathematical formula.
2. **Absolute Privacy Sovereignty**: Zero third-party trackers, zero advertising scripts, and full adherence to COPPA, GDPR-K, and India's Digital Personal Data Protection (DPDP) Act 2023. Telemetry egress is architecturally forbidden by construction.
3. **Local-First & Offline Capable**: Zero mandatory network egress. The system defaults to an offline-capable, version-clamped reactive local store (`academia-state-v3`), backed by high-assurance Web Cryptography.
4. **Off-Thread Vectorized Computing**: All computationally intensive graphing, mathematical evaluation, and cryptographic operations are executed in dedicated Web Workers utilizing zero-copy Transferable Typed Arrays, guaranteeing an uninterrupted 60 FPS main UI thread.
5. **Defense in Depth**: Client-side route guards, keystroke filtering, and sanitizers are strictly advisory; all security policies, quotas, and role privileges are formally backed by PostgreSQL Row Level Security (RLS) and serializable stored procedures.

---

## 2. System Architecture & Component Interaction Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 User Browser / Client                                  │
│                                                                                        │
│   ┌─────────────────────┐       ┌──────────────────────┐      ┌────────────────────┐   │
│   │     Hash Router     │──────▶│   View Layer (Lazy)  │─────▶│  Tailwind CSS v4   │   │
│   │   (Security Guards) │       │   (Library, Numera)  │      │   Notebook-Skin    │   │
│   └─────────────────────┘       └──────────────────────┘      └────────────────────┘   │
│              │                             │                                           │
│              ▼                             ▼                                           │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                         App Store (Version 3 Clamped)                          │   │
│   │          useApp() · Immutable up() · Quota Lifecycles · Toast Host             │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
│              │                             │                            │              │
│              ▼                             ▼                            ▼              │
│   ┌─────────────────────┐       ┌──────────────────────┐      ┌────────────────────┐   │
│   │  AST Virtual Machine│       │ Numera Math Worker   │      │ Locker Crypto      │   │
│   │  (acad-vm Engine)   │       │ (2,000 Pts / Float64)│      │ Worker (AES-GCM)   │   │
│   └─────────────────────┘       └──────────────────────┘      └────────────────────┘   │
│              │                             │                            │              │
│              ▼                             ▼                            ▼              │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                   Local Storage Engine (academia-state-v3)                     │   │
│   │            Deep Merge Validation · Prototype Pollution Shield                  │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTPS / WSS (Cookie Auth / JSON API)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Supabase Production BaaS                                 │
│                                                                                        │
│   ┌─────────────────────┐       ┌──────────────────────┐      ┌────────────────────┐   │
│   │ GoTrue Auth         │       │ PostgREST API        │      │ RPC Functions      │   │
│   │ (Secure Cookies)    │       │ (RLS Enforced)       │      │ (consume_quota)    │   │
│   └─────────────────────┘       └──────────────────────┘      └────────────────────┘   │
│                                            │                                           │
│                                            ▼                                           │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              PostgreSQL Database                               │   │
│   │    profiles · quotas · parental_consents · admin_warnings (Serializable RLS)   │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Local-First Reactive State Engine (`src/engine/store.tsx`)

### 3.1. Schema Invariants & Migration Resilience
- **Version Clamping**: Application state is bound to Version 3 (`academia-state-v3`).
- **Deep Structural Merging**: `mergeObject()` executes recursive field validation against a canonical seed state. Any unauthorized, extraneous, or malformed keys are discarded.
- **Prototype Pollution Immunity**: Active rejection of `__proto__`, `constructor`, and `prototype` keys across all input streams.
- **Strict Bounds Clamping**:
  - Enums (`Role`, `AccountStatus`, `CourseWeightTier`, `Theme`) are strictly validated against allowlists.
  - Numbers are clamped to safe ranges (e.g., Ease Factor $\ge 1.3$, quota limits $\ge 0$).
  - Collections (e.g., `cards`, `notes`, `reviewLog`) enforce capacity ceilings to prevent client memory exhaustion.

### 3.2. Local Calendar Quota Lifecycle
- Quotas (e.g., daily reviews, sandbox runs, portfolio items) are calculated against the student's **local calendar timezone** using `dayKey(t)` and `weekKey(t)`.
- Daily limits reset at local midnight; weekly limits reset on local Monday mornings, ensuring fair scheduling irrespective of geographical coordinate offsets.

### 3.3. Credit-Weighted GPA Matrix & Milestone Forecaster
- **Weighted Course Tiers**:
  $$\text{Standard} = +0.0, \quad \text{Honors} = +0.5, \quad \text{AP} = +1.0, \quad \text{Dual Enrollment} = +1.0$$
- **Canonical Weighted GPA Calculation**:
  $$\text{Weighted GPA} = \frac{\sum_{i=1}^{n} \left(\text{BaseGradePts}_i + \text{TierWeight}_i\right) \times \text{Credits}_i}{\sum_{i=1}^{n} \text{Credits}_i}$$
- **Milestone Forecaster**: Deterministic point gap analysis (`forecastMilestones`) calculates the exact target scores required across remaining assignments to hit target grade thresholds.

---

## 4. Off-Thread Vectorized Computing Pipelines

### 4.1. Numera Graphing Worker (`src/engine/numera-worker.ts`)
- **Off-Thread Sampling**: When any formula, slider variable, or coordinate table shifts, the Reverse Polish Notation (RPN) token stream is passed to a background Web Worker.
- **Vectorized Typed Arrays**: The worker calculates exactly 2,000 sampling points across the active viewport bounds ($[X_{\min}, X_{\max}]$) directly into a `Float64Array(4000)`.
- **Zero-Copy Streaming**: Pixel coordinate buffers are streamed to the main thread via Transferable Objects (`points.buffer`), maintaining a locked 60 FPS viewport rendering state without UI frame drops.
- **Mathematical Invariants**:
  - Shunting-Yard parser (`toRpn`) enforces standard algebraic operator precedence: `^` (right-associative) $>$ `*`, `/`, `%` $>$ `+`, `-`.
  - Automatic implicit multiplication expansion (`2x` $\to$ `2 * x`, `4sin(x)` $\to$ `4 * sin(x)`, `2(x+1)` $\to$ `2 * (x+1)`).
  - Absolute value bars normalization (`|x|` $\to$ `abs(x)`).
  - Numerical bisection solvers for zero-crossings (`findRoots`) and curve intersections (`findIntersections`).

### 4.2. Locker WebCrypto Worker (`src/engine/locker-worker.ts`)
- Offloads PBKDF2 key derivation and AES-256-GCM symmetric encryption/decryption routines from the main thread.
- Guarantees that intense cryptographic key stretching (600,000 iterations) never blocks user interactions, scroll events, or animations.

---

## 5. Sealed Document Locker (`src/engine/locker-crypto.ts`)

### 5.1. Cryptographic Suite
- **Symmetric Cipher**: AES-256-GCM (Galois/Counter Mode) via browser `crypto.subtle`.
- **Key Derivation (KDF)**: PBKDF2-SHA-256 using 600,000 iterations and a 128-bit cryptographically secure salt (`crypto.getRandomValues`).
- **Initialization Vector (IV)**: Unique 96-bit random IV generated per encryption. IV reuse is cryptographically impossible.

### 5.2. Binary Wire Container (`.academia-lock`)
```
00-07: Magic ASCII identifier "ACA-LOCK" (8 bytes)
08   : Format Version byte (0x01)
09-12: Big-endian Uint32 PBKDF2 iteration count (e.g. 600,000)
13-28: Salt (16 bytes / 128 bits)
29-40: Nonce / IV (12 bytes / 96 bits)
41-..: Ciphertext + 128-bit GCM Authentication Tag
```

### 5.3. Schema Checksum Sentinel & Tamper Detection
- Document schemas compute a SHA-256 checksum over normalized structural keys (`computeSchemaChecksum`).
- Decryption validates the payload schema (`validateContainerSchema`). Any payload corruption, missing properties, or invalid checksum triggers an immediate `TamperError`.
- **In-Memory Guarantee**: Passphrases and derived keys live exclusively in transient heap memory; never persisted to `localStorage` or disk caches.

---

## 6. Deterministic AST Interpreter (`src/engine/interpreter.ts`)

### 6.1. Runtime Execution (`acad-vm`)
- Executes custom student algorithms in an isolated, pure-function virtual machine environment without relying on browser `eval()` or `new Function()`.
- Implements strict step budgets (default 10,000 instructions) and memory caps to prevent browser thread locking.

### 6.2. Real-Time Pre-Compilation Static Analysis (`analyzeCode`)
- Evaluates code on-the-fly as students type before runtime execution.
- Flags unconditional infinite loops (e.g., `while(true)`), unmutated loop condition variables, unclosed blocks, and instruction budget estimates directly at the source code row level.
- Automated rolling snapshot manager retains up to 10 rolling states in transient session storage.

---

## 7. Hardened Community Charter Filter (`src/engine/charter-filter.ts`)

A 7-stage normalization and anti-evasion pipeline:
1. **Unicode NFKC Normalization**: Strips font styling hacks and normalizes Unicode ligatures.
2. **Confusable Resolution**: Translates homoglyphs across Greek and Cyrillic character sets (e.g., Cyrillic `і` $\to$ Latin `i`).
3. **Zero-Width Stripping**: Eliminates zero-width spaces (`\u200b`), soft hyphens, and word joiners.
4. **Leet-Speak Substitution**: Translates numbers and symbols (`1`$\to$`i`, `0`$\to$`o`, `3`$\to$`e`, `@`$\to$`a`, `$`$\to$`s`, `5`$\to$`s`, `7`$\to$`t`).
5. **Masking & Spacing Collapse**: Collapses letter-spaced words (`s t u p i d` $\to$ `stupid`), intra-word vowel censors (`st*pid`), and duplicate letter runs (3+ reduced to 2).
6. **False-Positive Allowlisting**: Scunthorpe pattern rules preserve academic vocabulary (`dumbbell`, `assess`, `Moran's I test`).
7. **Bilingual Vocabulary**: Isolated dictionary in `charter-filter-words.ts` covering English and romanized Hindi/Hinglish idioms.

---

## 8. App-Wide Performance & Virtualization Architecture

### 8.1. Route-Level Code Splitting
- All top-level views (`Library`, `Locker`, `Numera`, `Sandbox`, `Admin`, `Inventory`, etc.) are partitioned using `React.lazy()` with `<Suspense>` boundaries.
- Module chunks are loaded strictly on demand, minimizing the active memory footprint.

### 8.2. Tailored Skeleton Loading Shells
- Structural skeleton shells (`LibrarySkeleton`, `NumeraSkeleton`, `LockerSkeleton`, `TableSkeleton`, `ViewSkeleton`) eliminate layout shifts.
- Tailwind CSS v4 pulse animations matching `#0B3D91` navy and ivory/paper palettes ensure smooth perceived transitions.

### 8.3. DOM Virtualization & Strict Memoization
- Active-Recall `VirtualCardScroller` in `src/views/library.tsx` strictly limits active DOM nodes to $\le 30$ elements at all times, effortlessly scaling to decks with thousands of cards.
- Interactive rows are wrapped in strict `React.memo` gates with custom comparison predicates (`areVirtualCardPropsEqual`).

---

## 9. Security Headers & Deployment Architecture (`vercel.json`)

Deployment is hardened for high-assurance public hosting on Vercel:
- **Content-Security-Policy (CSP)**:
  `default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src https://www.youtube-nocookie.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:; upgrade-insecure-requests`
- **X-Frame-Options**: `DENY` (eliminating clickjacking).
- **X-Content-Type-Options**: `nosniff` (blocking MIME sniffing).
- **Strict-Transport-Security (HSTS)**: `max-age=63072000; includeSubDomains; preload` (2-year enforced HTTPS).
- **Referrer-Policy**: `strict-origin-when-cross-origin`.
- **Permissions-Policy**: `geolocation=(), camera=(), microphone=(), magnetometer=()` (hardware surveillance lockout).
