# Academia

> **The Deterministic Student Notebook & Workbench**  
> Built with React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4, and standard Web APIs. Zero opaque algorithms. Zero runtime LLM dependencies. 100% reproducible execution loops.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.3-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Security](https://img.shields.io/badge/WebCrypto-AES--256--GCM-success.svg)](https://w3c.github.io/webcrypto/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](#license)

---

## 📖 Overview

**Academia** is a deterministic, privacy-first academic workspace engineered for secondary and collegiate students pursuing STEM, higher mathematics, college admissions prep, active recall, and software modeling.

Unlike conventional educational platforms that rely on probabilistic language model hallucinations, black-box diagnostic scores, or invasive telemetry beacons, Academia operates on uncompromising **deterministic engineering principles**:

1. **Deterministic Execution**: Every schedule, recommendation, calculation, and diagnostic evaluation traces to an explicit, human-readable rule or mathematical formula. No probabilistic AI heuristics touch core application state.
2. **Privacy Sovereignty by Construction**: Zero third-party trackers, zero advertising scripts, and full adherence to COPPA, GDPR-K, and India's Digital Personal Data Protection (DPDP) Act 2023.
3. **Local-First & Offline Capable**: Zero mandatory network egress. Functions completely offline via a version-clamped reactive local store (`academia-state-v3`), backed by high-assurance Web Cryptography.
4. **Off-Thread Vectorized Computing**: Computationally heavy graphing and cryptographic pipelines run in background Web Workers with zero-copy `Transferable` Typed Arrays, maintaining a locked 60 FPS user experience.
5. **Defense in Depth**: Client-side route guards, keystroke filtering, and sanitizers are strictly advisory; all security policies, quotas, and role privileges are backed by PostgreSQL Row Level Security (RLS) and serializable transactions.

---

## 🚀 Core Modules & Technical Capabilities

| Module | Core Capabilities |
| :--- | :--- |
| **🧑🏫 AI Tutor** | Whiteboard tutor that draws every step (Topic / Exam Prep / Homework, 11 languages). Built-in deterministic equation solver (free, offline), or connect your own provider (Gemini, Groq, OpenRouter, local Ollama). Lessons are validated data rendered as SVG; plots are computed; homework answers are checked deterministically; quizzes save to Library. See [`docs/TUTOR.md`](docs/TUTOR.md). |
| **📚 Library** | Canonical **SuperMemo SM-2** spaced repetition scheduler ($\text{EF} \ge 1.3$), Markdown-lite rendering, inline math parsing, cloze hierarchy (`{{c1::term::hint}}`), note-to-card linking, 14-day queue forecasts, leech detection, formula-neutralized CSV/JSON import/export, and **DOM virtualization** ($\le 30$ active nodes). |
| **🔐 Locker** | Sealed document vault using browser WebCrypto **AES-256-GCM** with PBKDF2-SHA-256 (600,000 iterations, 128-bit salt, 96-bit unique IV). Offloaded to background Web Worker (`locker-worker.ts`). Enforces `.academia-lock` binary containers with SHA-256 schema checksums and immediate `TamperError` tripwires. |
| **🧮 Numera** | High-performance Desmos-class graphing platform. Shunting-Yard parser supporting implicit multiplication (`2x`, `4sin(x)`, `2(x+1)`), absolute value bars (`\|x\|`), RPN compilation, interactive parse tree inspector, and bisection root/intersection finders. Vectorized background Web Worker (`numera-worker.ts`) streaming 2,000 points over `Float64Array` at 60 FPS. |
| **💻 Sandbox** | Bounded AST virtual machine (`acad-vm`). Features real-time pre-compilation static analysis (`analyzeCode`) flagging infinite loops (`while(true)`), unmutated loop condition variables, and step budget limits before execution. Includes automated 10-slot rolling snapshot history. |
| **📊 Tally & Pomodoro** | Credit-weighted GPA matrix supporting Standard (+0.0), Honors (+0.5), AP (+1.0), and Dual Enrollment (+1.0) course tiers. Deterministic milestone forecaster providing exact assignment target gap advice. Local calendar-aware focus sessions and streak-free informational heatmaps. |
| **⚡ Catalyst Engine** | Pure rule engine evaluating user-defined conditional triggers (keyword matching, milestone events) with completely inspectable, reproducible output. |
| **🛡️ Community & Charter** | Multi-stage anti-evasion moderation pipeline: Unicode NFKC normalization, Greek/Cyrillic homoglyph resolution, zero-width space stripping, leet-speak translation, intra-word vowel censorship expansion (`st*pid`), and bilingual English/Hinglish vocabulary moderation with Scunthorpe allowlists. |
| **🧭 Admissions Inventory & Atlas** | Prerequisite skill trees, deadline countdowns, milestone ladders, and collegiate admissions dossier curation. |
| **👔 Admin Console** | Verifiable parental consent audit logging, student account lifecycle management (`ACTIVE`, `INACTIVE`, `BAN`), and append-only administrative governance actions. |

---

## 🛠️ Technology Stack

- **Frontend Framework**: React 19 (`react` & `react-dom` 19.2)
- **Language**: TypeScript 5.9 (Strict mode enabled)
- **Build Tool**: Vite 7 + `vite-plugin-singlefile` (portable standalone compilation)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) with custom `notebook-skin` token design system (Paper & Midnight palettes)
- **Concurrency**: Dedicated Web Workers (`numera-worker.ts`, `locker-worker.ts`) with zero-copy Transferable Objects (`ArrayBuffer`, `Float64Array`)
- **Cryptography**: Web Cryptography API (`crypto.subtle` for AES-256-GCM and PBKDF2)
- **Testing Engine**: Vitest 4 + JSDOM (`npm run check` runs typecheck, test suite, and build)
- **Backend / BaaS**: Supabase (PostgreSQL with Row Level Security, RPC stored procedures, and audit logs)
- **Deployment**: Vercel (hardened with strict CSP, HSTS, and HTTP security headers)

---

## 🏃 Getting Started

### Prerequisites

- **Node.js**: `>= 20.x`
- **npm**: `>= 10.x`

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/academia.git
cd academia

# Install dependencies cleanly
npm install
```

### Local Development

Start the Vite development server:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### Verification & Testing Gate

Every pull request and release is verified through our strict three-stage quality gate:

```bash
# Execute typecheck, test suite (255+ tests), and production build
npm run check

# Run Vitest test suite directly
npm run test

# Run TypeScript compiler typecheck
npm run typecheck

# Build singlefile production bundle
npm run build
```

---

## 📁 Repository Structure

```
├── .gitignore                     # Airtight git exclusion rules
├── vercel.json                    # Enterprise deployment headers & CSP
├── vite.config.ts                 # Singlefile bundler & ES Worker configuration
├── package.json                   # Clean dependency matrix
├── public/                        # Static assets, sitemap & discovery manifests
│   ├── sitemap.xml                # Production XML sitemap
│   ├── robots.txt                 # Search engine & AI crawler access rules
│   ├── llms.txt                   # AI context index (llmstxt.org standard)
│   ├── llms-full.txt              # Exhaustive AI architecture specification
│   └── BingSiteAuth.xml           # Bing Webmaster verification token
├── src/
│   ├── App.tsx                    # Route-level code-splitting with React.lazy
│   ├── components/                # Reusable UI primitives, auth gates, navigation
│   │   ├── auth/                  # Consent gates & authentication rotator
│   │   ├── chatbot/               # Rule-traced assistant drawer
│   │   ├── navigation/            # Topbar & sidebar notebook spine
│   │   └── ui.tsx                 # Core UI tokens & tailored skeleton loading shells
│   ├── engine/                    # Deterministic business logic & background workers
│   │   ├── card-render.tsx        # Pure React markdown-lite & math tokenizer
│   │   ├── charter-filter.ts      # Multi-stage text moderation filter
│   │   ├── charter-filter-words.ts# Moderation vocabulary definitions
│   │   ├── cloze.ts               # Cloze deletion parser & sibling generator
│   │   ├── interpreter.ts         # Deterministic VM engine & pre-compilation analyzer
│   │   ├── library-analytics.ts   # SM-2 retention & forecast pure functions
│   │   ├── library-io.ts          # Safe CSV & JSON deck import/export
│   │   ├── locker-crypto.ts       # WebCrypto AES-256-GCM vault & checksum validator
│   │   ├── locker-worker.ts       # Background Web Worker for AES-256-GCM operations
│   │   ├── math.ts                # Shunting-Yard parser, RPN evaluator & bisection solvers
│   │   ├── numera-worker.ts       # Vectorized TypedArray sampling Web Worker (2,000 pts)
│   │   ├── parental-consent.ts    # Single-use signed guardian token service
│   │   ├── router.tsx             # Hash-based routing & security guards
│   │   ├── rules.ts               # SM-2 scheduler & Catalyst rule table
│   │   ├── sanitize.ts            # HTML tag allowlist sanitizer
│   │   └── store.tsx              # Version 3 local-first reactive store & GPA calculator
│   ├── styles/                    # Color tokens, themes (paper/midnight), typography
│   └── views/                     # Route-level views (Library, Numera, Locker, Sandbox, etc.)
├── supabase/                      # PostgreSQL RLS & Schema migrations
│   └── migrations/
└── test/                          # Unit, integration, and security test suites
```

---

## 🔒 Security & Privacy Posture

- **Zero Third-Party Telemetry**: No Google Analytics, no Meta Pixels, no telemetry pings.
- **Content Security Policy (CSP)**: `default-src 'self'`; scripts restricted to self; external network egress strictly constrained to authenticated Supabase BaaS endpoints (`https://*.supabase.co wss://*.supabase.co`).
- **Key Isolation**: Passphrases and derived cryptographic keys exist exclusively in transient component memory; never written to disk, local storage, or telemetry logs.
- **Prototype Pollution Immunity**: Deep recursive state mappers validate every field against explicit seeds, actively rejecting `__proto__`, `constructor`, and `prototype` keys.

---

## 📄 License

Proprietary & Confidential — All rights reserved by Academia.
