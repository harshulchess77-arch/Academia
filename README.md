# Academia

> **The Deterministic Student Notebook & Workbench**  
> Built with React 19, TypeScript, Vite 7, Tailwind CSS v4, and standard Web APIs. Zero opaque algorithms. Zero black boxes.

---

## 📖 Overview

**Academia** is an inspectable, privacy-first academic workspace crafted specifically for rigorous student workflows (STEM, mathematics, college admissions prep, active recall, and software modeling). 

Unlike standard modern SaaS platforms, Academia adheres to strict **deterministic engineering principles**:
- **No LLM Guesswork**: Every reply, recommendation, schedule, and diagnostic report traces to an explicit, human-readable rule or mathematical formula.
- **Privacy by Construction**: No third-party tracking, no Google Analytics, no telemetry beacons. Compliant with COPPA, GDPR-K, and India's Digital Personal Data Protection (DPDP) Act 2023.
- **Local-First & Offline Capable**: Zero mandatory network egress. Local mock store defaults with complete state migration resilience (Version 3) and Supabase production integration.
- **True In-Memory Cryptography**: High-assurance client-side encryption via WebCrypto AES-256-GCM with PBKDF2 key derivation (600,000+ iterations).

---

## 🚀 Key Modules & Capabilities

| Module | Core Capabilities |
| :--- | :--- |
| **📚 Library** | Canonical **SuperMemo SM-2** scheduler, Markdown-lite rendering, inline math support, cloze cards (`{{c1::term::hint}}`), note-to-card linking, 14-day queue forecasts, leech detection, formula-neutralized CSV/JSON import/export, and daily review limit enforcement. |
| **🔐 Locker** | Sealed document vault using WebCrypto **AES-256-GCM**, 96-bit unique IVs, 128-bit salts, and `.academia-lock` binary containers (`ACA-LOCK` magic header). Complete tamper-lock detection upon checksum or authentication tag failure. |
| **🧮 Numera** | Deterministic mathematical calculation and graphing engine. Visible parse trees, matrix row reduction (RREF), step-by-step working, and geometric inspection. |
| **💻 Sandbox** | Deterministic bounded virtual machine (`acad-vm`). Pure execution environment with line tracking, strict step budgets, rollback snapshots, and daily quota limits. |
| **⚡ Catalyst Engine** | Rule machine that inspects user-defined conditional triggers (keyword matching, streak events) and generates inspectable responses without generative AI. |
| **🛡️ Community & Charter** | Harassment & abuse filtering with Unicode NFKC normalization, homoglyph translation, zero-width space stripping, vowel censor extraction (`st*pid`), leetspeak mapping, and Hindi/Hinglish vocabulary moderation. |
| **⏱️ Pomodoro & Tally** | Local calendar-aware focus sessions, credit-weighted GPA calculation, target gap projections, and streak-free informational heatmaps. |
| **🧭 Admissions Inventory & Atlas** | Milestone ladder tracking, deadline countdowns, prerequisite skill graphs, and admissions portfolio curation. |
| **👔 Admin Console** | Verifiable parental consent audit logging, student status enforcement (`ACTIVE`, `INACTIVE`, `BAN`), and administrative warning actions. |

---

## 🛠️ Technology Stack

- **Frontend Framework**: React 19 (React DOM 19)
- **Language**: TypeScript 5.9
- **Build Tool**: Vite 7 + `vite-plugin-singlefile` (portable standalone compilation)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) + bespoke `notebook-skin` CSS token design system
- **Iconography**: Lucide React
- **Cryptography**: Web Cryptography API (`crypto.subtle`)
- **Testing Engine**: Vitest 4 + JSDOM
- **Backend / BaaS**: Supabase (PostgreSQL with Row Level Security, RPC functions, and migrations)
- **Hosting Target**: Vercel (with enterprise-grade HTTP security headers in `vercel.json`)

---

## 🏃 Getting Started

### Prerequisites

- Node.js >= 20.x
- npm >= 10.x

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/academia.git
cd academia

# Install dependencies
npm install
```

### Development Server

Start Vite in local development mode:

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Verification & Testing

Every change is verified through strict quality gates:

```bash
# Run full suite: TypeScript typechecking, Vitest tests, and Vite build
npm run check

# Run tests in watch mode
npm run test

# Run typecheck only
npm run typecheck

# Production build
npm run build
```

---

## 📦 Repository Structure

```
├── .gitignore                     # Git ignore specifications
├── vercel.json                    # Enterprise deployment headers & CSP
├── docs/                          # OpenAPI schemas and architecture docs
├── supabase/migrations/           # PostgreSQL RLS & Schema migrations
├── public/                        # Static assets & sitemap
│   └── sitemap.xml
├── src/
│   ├── __tests__/                 # Vitest test suites (library, crypto, rules, etc.)
│   ├── components/                # Reusable UI primitives, parental gate, navigation
│   │   ├── auth/                  # Consent gates & auth rotator
│   │   ├── chatbot/               # Rule-traced assistant drawer
│   │   ├── navigation/            # Topbar & sidebar notebook spine
│   │   └── ui.tsx                 # Core UI tokens (sheets, pills, buttons, tabs)
│   ├── engine/                    # Core deterministic business logic
│   │   ├── card-render.tsx        # Pure React markdown-lite & math tokenizer
│   │   ├── charter-filter.ts      # Multi-stage text moderation filter
│   │   ├── charter-filter-words.ts# Moderation vocabulary definitions
│   │   ├── cloze.ts               # Cloze deletion parser & sibling generator
│   │   ├── interpreter.ts         # Deterministic VM engine (acad-vm)
│   │   ├── library-analytics.ts   # SM-2 retention & forecast pure functions
│   │   ├── library-io.ts          # Safe CSV & JSON deck import/export
│   │   ├── locker-crypto.ts       # WebCrypto AES-256-GCM vault implementation
│   │   ├── math.ts                # Mathematical parser & linear algebra solvers
│   │   ├── parental-consent.ts    # Single-use signed guardian token service
│   │   ├── router.tsx             # Hash-based routing & security guards
│   │   ├── rules.ts               # SM-2 scheduler & Catalyst rule table
│   │   ├── sanitize.ts            # HTML tag allowlist sanitizer
│   │   └── store.tsx              # Local-first reactive state store (Version 3)
│   ├── styles/                    # Color tokens, themes (paper/midnight), typography
│   └── views/                     # Route-level views (Library, Locker, Admin, etc.)
└── test/                          # Legacy and smoke integration tests
```

---

## 📄 License

Proprietary & Confidential — All rights reserved by Academia App.

