# Academia — Master Project Blueprint (PROJECT.md)

> **Consolidated Master Specification uniting Project Vision, Functional Specifications, Architecture, Security Controls, and Quality Gates.**

---

## Part I: Product Blueprint & Vision

### 1. Executive Summary
**Academia** is a deterministic, notebook-style workspace engineered for secondary and collegiate students pursuing STEM, mathematics, and high-stakes admissions preparation. Unlike conventional educational platforms that rely on non-deterministic LLM generations, opaque ranking heuristics, or invasive user tracking, Academia is built on three core pillars:
1. **Mathematical & Algorithmic Determinism**: Every response, schedule, diagnostic band, and virtual machine run is 100% reproducible and cites its exact rule or formula.
2. **Absolute Privacy Sovereignty**: Zero third-party trackers, zero advertising scripts, and full adherence to COPPA, GDPR-K, and India's DPDP Act 2023.
3. **Local-First Resilience**: Full operational capability offline through a version-clamped local store (`academia-state-v3`), backed by high-assurance WebCrypto cryptography.

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
- **DOM Virtualization**:
  - `VirtualCardScroller` strictly limits active DOM nodes to $\le 30$ elements at all times, scaling to decks with thousands of cards.
- **Safe Deck Portability**:
  - CSV export neutralizes spreadsheet formula injection by prepending `'` to leading `=`, `+`, `-`, or `@`.
  - Lean JSON export (`exportDeckToJSONStripped`) omits large historical review logs for portable deck distribution.

### 2. Sealed Document Locker (`src/views/locker.tsx`)
- **WebCrypto AES-256-GCM Vault**:
  - Zero external npm dependencies. Uses standard `crypto.subtle`.
  - Keys derived via PBKDF2-SHA-256 with 600,000 iterations and a 128-bit random salt.
  - Unique 96-bit random IV per document.
- **Background Web Worker**:
  - Offloads PBKDF2 key derivation and AES-256-GCM routines to `src/engine/locker-worker.ts`.
- **Binary Wire Container (`.academia-lock`)**:
  - Begins with magic header `ACA-LOCK` (version byte `0x01`).
  - Serializes iterations, salt, IV, and ciphertext with a 128-bit authentication tag.
  - Payload schema is protected by SHA-256 checksum sentinels (`validateContainerSchema`); tampering immediately throws `TamperError`.
- **Zero Disk Exposure**:
  - Passphrases and derived cryptographic keys exist solely in transient memory; never written to `localStorage`.

### 3. Numera Graphing Engine (`src/views/numera.tsx`)
- **Interactive Multi-Node Model**: Supports 5 interactive row variants: `EQUATION`, `SLIDER`, `TABLE`, `MATRIX`, `TEXT`.
- **Deterministic Shunting-Yard Parser (`src/engine/math.ts`)**:
  - Automatic implicit multiplication expansion (`2x` $\to$ `2 * x`, `4sin(x)` $\to$ `4 * sin(x)`).
  - Absolute value bars normalization (`|x|` $\to$ `abs(x)`).
  - Reverse Polish Notation (RPN) compilation with strict operator precedence.
  - Structural human-readable parse trees (`buildParseTree`) for algebraic step-by-step inspection.
  - Numerical bisection solvers for zero-crossings (`findRoots`) and curve intersections (`findIntersections`).
- **Vectorized Web Worker (`src/engine/numera-worker.ts`)**:
  - Evaluates 2,000 sampling points per expression onto `Float64Array(4000)`.
  - Streams pixel coordinate sets via zero-copy Transferable Objects for a locked 60 FPS viewport.

### 4. Deterministic Virtual Machine (`src/engine/interpreter.ts`)
- `acad-vm`: A bounded, deterministic AST interpreter executing without browser `eval()` or `new Function()`.
- **Pre-Compilation Static Analysis (`analyzeCode`)**:
  - Detects infinite loops (`while(true)`), unmutated loop condition variables, unclosed blocks, and instruction budget limits before execution.
  - Automated session rolling snapshot manager retaining up to 10 historical snapshots.

### 5. Tally & Pomodoro (`src/views/tally.tsx`)
- **Credit-Weighted GPA Matrix**:
  - Supports Standard (+0.0), Honors (+0.5), AP (+1.0), and Dual Enrollment (+1.0) course tiers.
  - Calculates collegiate-standard unweighted and weighted GPA.
- **Milestone Forecaster**:
  - Forward-looking grade target gap analyzer (`forecastMilestones`) calculating exact assignment target scores for target letter grades.

### 6. Community Moderation & Charter Filter (`src/engine/charter-filter.ts`)
- Multi-tier evasion-resistant text moderation:
  - Unicode NFKC normalization.
  - Cyrillic/Greek homoglyph confusable translation (e.g. Cyrillic `і` $\to$ Latin `i`).
  - Zero-width character stripping.
  - Leet-speak normalization (`1` $\to$ `i`, `0` $\to$ `o`, `3` $\to$ `e`, `@` $\to$ `a`, `$` $\to$ `s`).
  - Letter-spacing collapse (e.g., `s t u p i d` $\to$ `stupid`).
  - Intra-word vowel censor expansion (e.g., `st*pid` flagged accurately).
  - Bilingual moderation covering English and romanized Hindi/Hinglish idioms.
  - Scunthorpe allow-list patterns protecting innocent academic vocabulary (`dumbbell`, `assess`, `Moran's I test`).

---

## Part III: Systems Engineering & Production Infrastructure

### 1. State Management & Offline Resilience (`src/engine/store.tsx`)
- Single source of truth managed via `AppState` (Version 3).
- **Prototype Pollution Prevention**: `mergeObject()` validates all properties against seed models, explicitly discarding `__proto__`, `constructor`, and `prototype`.
- **Clamping**: Rigid bounds checking for user roles, account statuses, and quota limits.
- **Local Calendar Lifecycles**: Rollover logic calculated against the user's local timezone midnight and local Monday boundaries.

### 2. Production Deployment & Security Headers (`vercel.json`)
- `Content-Security-Policy`:
  - `default-src 'self'`.
  - `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`.
  - `style-src 'self' 'unsafe-inline'`.
  - `font-src 'self' data:`.
  - `img-src 'self' data:`.
  - `connect-src 'self' https://*.supabase.co wss://*.supabase.co`.
  - `frame-src https://www.youtube-nocookie.com`.
  - `frame-ancestors 'none'`.
  - `object-src 'none'`.
  - `base-uri 'self'`.
  - `form-action 'self'`.
  - `worker-src 'self' blob:`.
  - `upgrade-insecure-requests`.
- `X-Frame-Options`: `DENY`.
- `X-Content-Type-Options`: `nosniff`.
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`.
- `Referrer-Policy`: `strict-origin-when-cross-origin`.
- `Permissions-Policy`: `geolocation=(), camera=(), microphone=(), magnetometer=()`.

---

## Part IV: Verification, Testing & Compliance

### 1. Automated Test Suites
255+ automated Vitest tests across 13 test files:
- `test/math.test.ts`: Shunting-Yard RPN compilation, implicit multiplication, absolute values, parse tree builder, bisection root and intersection solvers.
- `test/interpreter.test.ts`: AST evaluation, loop execution, step budget clamps, and `analyzeCode` static infinite loop detection.
- `test/locker-crypto.test.ts`: WebCrypto AES-256-GCM round-trip, binary container parsing, schema checksum verification, IV uniqueness, and `TamperError` verification.
- `test/seo-discovery.test.ts`: Search console meta tags, Open Graph / Twitter tags, Bing validation, `sitemap.xml`, and `llms.txt` specifications.
- `test/store.test.ts`: Version 3 state hydration, weighted GPA calculations, milestone forecasting, and prototype pollution immunity.
- `test/charter-filter.test.ts`: 53+ evasion test cases across Unicode normalizations, homoglyphs, and bilingual vocabularies.
- `test/smoke.test.tsx`: Route mounting smoke tests for student and administrator roles with lazy-loaded Suspense boundaries.
- `src/__tests__/library.test.ts`: 10,000-iteration SM-2 fuzzing, cloze sibling derivation, and formula injection defenses.
