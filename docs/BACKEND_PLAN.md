# ACADEMIA — BACKEND ARCHITECTURAL PLAN & SPECIFICATION
**Version**: 1.0.0 (Phase 0 Baseline)  
**Author**: Staff Principal Backend & Security Architect  
**Status**: Pending Gate 0 Approval  

---

## 1. Executive Summary & Core Invariant
Academia transitions from a client-side simulated security layer (`localStorage`) to an authoritative, server-enforced architecture built on **Supabase (PostgreSQL 16 + GoTrue Auth + Edge Functions)**.

### Core Architectural Axiom: Server Authoritative & Fail-Closed
1. **Server Authority**: No client token, `localStorage` flag, or frontend parameter can grant roles (`admin`), alter account status (`ACTIVE`, `INACTIVE`, `BAN`, `PENDING_CONSENT`), inflate quotas, or bypass parental verification. PostgreSQL Row-Level Security (RLS) and `SECURITY DEFINER` functions with fixed search paths are the single source of truth.
2. **Fail-Closed Principle**: If backend services are unreachable, misconfigured, or experiencing network partitions in backend mode, all privileged actions and quota consumptions are strictly **DENIED**; the system never falls back to silent client grants.
3. **Local-First & Offline Preservation**: A clean separation is established between `LocalBackend` (for offline demos and deterministic unit test environments) and `SupabaseBackend` (production).

---

## 2. System Architecture

```
+-----------------------------------------------------------------------------------------+
|                                    BROWSER CLIENT                                       |
|  +-------------------+  +-------------------------+  +-------------------------------+  |
|  |   React 19 Views  |  |     Zustand / Store     |  | Backend Interface Layer       |  |
|  |  (Learn, Govern)  |  |  (Optimistic Cache/UI)  |  | (LocalBackend / Supabase)     |  |
|  +-------------------+  +-------------------------+  +-------------------------------+  |
+--------------------------------------------|--------------------------------------------+
                                             | HTTPS / WSS
                                             | (Exact Project Pinning, No Wildcards)
                                             v
+-----------------------------------------------------------------------------------------+
|                                   SUPABASE PLATFORM                                     |
|                                                                                         |
|  +-----------------------------------------------------------------------------------+  |
|  |  KONG REVERSE PROXY & WAF (Strict CORS, Rate Limiting, CSP origin alignment)      |  |
|  +-----------------------------------------------------------------------------------+  |
|             |                                                  |                        |
|             v                                                  v                        |
|  +-----------------------+                         +---------------------------------+  |
|  |   GOTRUE AUTH SERVICE |                         |      EDGE FUNCTIONS (Deno)      |  |
|  |  - JWT Issuance       |                         |  - consent-issue (hash + mail)  |  |
|  |  - Password Hashing   |                         |  - consent-verify (48h timing)  |  |
|  |  - Email Verification |                         |  - consent-revoke               |  |
|  +-----------------------+                         |  - account-deletion (cascade)   |  |
|             |                                      +---------------------------------+  |
|             | (auth.users)                                             |                |
|             v                                                          v (Service Role) |
|  +-----------------------------------------------------------------------------------+  |
|  |                             POSTGRESQL 16 ENGINE                                  |  |
|  |                                                                                   |  |
|  |  [Triggers]                                                                       |  |
|  |  - handle_new_user() (Server-assigned status: ACTIVE vs PENDING_CONSENT)          |  |
|  |  - enforce_protected_profile_columns() (Rejects client role/tier tampering)       |  |
|  |  - enforce_append_only_audit() (Blocks UPDATE/DELETE on admin_audit)              |  |
|  |                                                                                   |  |
|  |  [Row Level Security (RLS)]                                                       |  |
|  |  - profiles: Read own (admins: all); student update limited to name/tz            |  |
|  |  - quotas: Read own; updates strictly through consume_quota() RPC                 |  |
|  |  - parental_consents: Read status only; no token hashes exposed to child          |  |
|  |  - user_state: Read/Write own row with versioned optimistic locking               |  |
|  |  - admin_audit: Read for active admins; append-only via admin RPCs                |  |
|  |                                                                                   |  |
|  |  [Security Definer RPCs (search_path = '')]                                       |  |
|  |  - consume_quota(key): Per-user IANA timezone resets, status checks, concurrency  |  |
|  |  - admin_set_status(), admin_warn(), admin_override_quota()                       |  |
|  +-----------------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Data Model (Text ERD)

```
===========================================================================================
auth.users (Supabase Managed Engine)
-------------------------------------------------------------------------------------------
id                     UUID PRIMARY KEY
email                  TEXT UNIQUE NOT NULL
raw_user_meta_data     JSONB (Contains age_band, tz, guardian_email; NEVER trusted for role)
created_at             TIMESTAMPTZ

      | 1
      |
      | 1
      v
public.profiles
-------------------------------------------------------------------------------------------
id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
email                  TEXT NOT NULL
name                   TEXT NOT NULL
role                   user_role NOT NULL DEFAULT 'student' ('student', 'admin')
tier                   tier_code NOT NULL DEFAULT 'A' ('A', 'B', 'C', 'D', 'E')
status                 account_status NOT NULL DEFAULT 'ACTIVE' 
                       ('ACTIVE', 'INACTIVE', 'BAN', 'PENDING_CONSENT')
age_band               TEXT NOT NULL ('under13', '13-17', 'adult')  -- NO DOB STORED
tz                     TEXT NOT NULL DEFAULT 'UTC' (Validated against pg_timezone_names)
inactive_until         TIMESTAMPTZ
flags                  INTEGER NOT NULL DEFAULT 0
created_at             TIMESTAMPTZ NOT NULL
updated_at             TIMESTAMPTZ NOT NULL

      | 1                    | 1                     | 1                     | 1
      |                      |                       |                       |
      v 1                    v 1                     v 0..*                  v 0..*
public.quotas          public.user_state       public.parental_consents public.admin_audit
-------------------    -------------------     -----------------------  ------------------
user_id UUID PK        user_id UUID PK         id UUID PK               id UUID PK
portfolio_daily INT    state JSONB (<= 2MB)    child_id UUID FK         actor_id UUID FK
portfolio_weekly INT   version INT             guardian_email TEXT      action TEXT
sandbox_daily INT      updated_at TIMESTAMPTZ  token_hash TEXT UNIQUE   target_id UUID FK
sandbox_weekly INT                             attempts INT DEFAULT 0   reason TEXT
chat_daily INT                                 expires_at TIMESTAMPTZ   before JSONB
chat_weekly INT                                verified_at TIMESTAMPTZ  after JSONB
last_daily_reset DATE                          used BOOLEAN             ts TIMESTAMPTZ
last_weekly_reset DATE                         policy_version TEXT
                                               school_code TEXT

===========================================================================================
public.quota_limits (Reference Table — Single Source of Truth)
-------------------------------------------------------------------------------------------
key                    TEXT PRIMARY KEY ('portfolio', 'sandbox', 'chat', 'tutor')
daily_limit            INTEGER NOT NULL
weekly_limit           INTEGER NOT NULL

===========================================================================================
public.consent_revocations (Audit Trail)
-------------------------------------------------------------------------------------------
id                     UUID PRIMARY KEY DEFAULT gen_random_uuid()
consent_id             UUID REFERENCES public.parental_consents(id)
guardian_email         TEXT NOT NULL
reason                 TEXT
revoked_at             TIMESTAMPTZ NOT NULL DEFAULT now()

===========================================================================================
public.deletion_requests (Account Deletion & Data Erasure Compliance)
-------------------------------------------------------------------------------------------
id                     UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id                UUID NOT NULL
status                 TEXT NOT NULL DEFAULT 'PENDING' ('PENDING', 'PROCESSING', 'COMPLETED')
requested_by           TEXT NOT NULL ('self', 'guardian', 'admin')
requested_at           TIMESTAMPTZ NOT NULL DEFAULT now()
executed_at            TIMESTAMPTZ
```

---

## 4. Key Authentication & Lifecycle Flows

### Flow 1: Signup & Role Segregation
1. **Client Submits**: `email`, `password`, `name`, `age_band` (`under13`, `13-17`, `adult`), `guardian_email` (if minor), `school_code` (if under-13), `tz` (browser IANA string).
2. **GoTrue Trigger**: `handle_new_user()` fires as `SECURITY DEFINER`:
   - Role is **hardcoded to `'student'`** (client metadata claiming `role: "admin"` is ignored).
   - If `age_band IN ('under13', '13-17')`, status is set to `'PENDING_CONSENT'`.
   - If `age_band = 'adult'`, status is set to `'ACTIVE'`.
   - Quotas row is automatically provisioned linked to `profiles.id` with defaults from `quota_limits`.
3. **If `PENDING_CONSENT`**: Edge Function `consent-issue` generates a cryptographically secure 256-bit entropy token, stores its SHA-256 hash in `parental_consents`, and dispatches an email to `guardian_email`. The minor is placed in restricted read-only or onboarding-only mode.

### Flow 2: Guardian Verification
1. Guardian clicks email link: `https://app.academia.edu/guardian/consent?token=<raw_token>`.
2. Browser calls Edge Function `consent-verify(raw_token)`:
   - Hashes raw token with SHA-256.
   - Looks up `token_hash` in `parental_consents` with constant-time equality.
   - Verifies `expires_at > now()`, `used = false`, and `attempts < 5`.
   - If valid: marks `used = true`, `verified_at = now()`, updates child's profile to `status = 'ACTIVE'`, and logs verification in `admin_audit`.

### Flow 3: Authoritative Quota Consumption
1. Student triggers action (e.g., Run Sandbox Code).
2. Client executes `supabase.rpc('consume_quota', { target_key: 'sandbox' })`.
3. In Postgres `consume_quota(target_key)`:
   - Verifies `caller = auth.uid()` and caller's `status = 'ACTIVE'`. Non-active accounts are rejected immediately.
   - Looks up user's local timezone from `profiles.tz`. Calculates current local date and current local Monday.
   - Resets daily counters if local date has advanced; resets weekly counters if local Monday has advanced.
   - Row-locks `quotas` for `user_id`. Checks remaining quota against `quota_limits`.
   - If quota > 0, decrements both daily and weekly counters and returns `{ ok: true, remaining_daily, remaining_weekly, resets_at }`.
   - If exhausted, returns `{ ok: false, error: 'QUOTA_EXHAUSTED' }`.

---

## 5. Threat Model (STRIDE Matrix)

| Threat Category | Potential Attack Vector | Architectural Mitigation |
| :--- | :--- | :--- |
| **Spoofing** | Student alters JWT or simulates admin role in `localStorage` | Server checks `auth.uid()` and queries `profiles.role` / JWT claims server-side. RLS enforces that claims are backed by DB records. |
| **Tampering** | Student directly updates `profiles.role = 'admin'` or edits quotas | `profiles` RLS restricts student updates to non-sensitive columns (`name`, `tz`) via a `BEFORE UPDATE` trigger that blocks role/status/tier mutation. Quotas table denies direct UPDATE; mutations allowed only via `consume_quota()`. |
| **Repudiation** | Admin claims they did not ban a student or erase data | Immutable `admin_audit` table. Triggers explicitly raise exceptions on any `UPDATE` or `DELETE`, ensuring an append-only verifiable audit trail. |
| **Information Disclosure** | IDOR to read other students' flashcards, notes, or consent tokens | RLS policies enforce `auth.uid() = user_id`. `parental_consents` token hash is never returned to the child user. |
| **Denial of Service** | Calling `consume_quota` 1,000 times concurrently to exceed limits | Postgres `SELECT ... FOR UPDATE` row-level locking ensures atomic serialized decrements. Abuse rate-limiting table on RPC endpoints. |
| **Elevation of Privilege** | `search_path` injection on `SECURITY DEFINER` functions | Every function strictly declares `SET search_path = ''` and uses fully-qualified table names (`public.profiles`, `auth.uid()`). `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon`. |
| **Data Exfiltration** | Broad CSP allows connection to attacker-controlled Supabase project | CSP `connect-src` pinned to the **exact project origin** in both `index.html` and `vercel.json`; wildcards (`*.supabase.co`) eliminated. |

---

## 6. Decision Table (§4 Decisions with Recommendations)

| # | Topic | Options | Recommendation & Rationale | Trade-offs & Considerations |
| :---: | :--- | :--- | :--- | :--- |
| **D1** | **Provider & Region** | • AWS Mumbai (`ap-south-1`)<br>• AWS Frankfurt (`eu-central-1`)<br>• AWS US East | **Recommend: AWS Mumbai (`ap-south-1`)** if student demographic is primarily India/Asia, or Frankfurt for EU GDPR stringency. Verified nearest compliant low-latency node. | Cross-border transfer assessments required if EU students use Mumbai region or vice versa. |
| **D2** | **Email Provider** | • Resend<br>• AWS SES<br>• Postmark | **Recommend: Resend** (simple Deno Edge Function SDK, dedicated IP options, excellent deliverability for transactional tokens, EU data processing addendum available). | AWS SES is cheaper at massive scale (>100k MAU) but requires high ops overhead for DNS/warmup. |
| **D3** | **Session Storage** | • `localStorage` (default `supabase-js`)<br>• Cookie-based (`@supabase/ssr`) | **Recommend: Cookie-based `HttpOnly`, `Secure`, `SameSite=Strict` sessions via lightweight proxy / Edge Function**. Mitigates XSS token exfiltration. | Requires Vercel Serverless / Edge routing for auth token exchange rather than 100% pure static singlefile SPA. Fallback for pure static: `localStorage` with strict CSP, short JWT life (15 min), and rotating refresh tokens. |
| **D4** | **Minors & Consent Model** | • Full block until consent<br>• Limited sandbox until consent<br>• School-code exemption | **Recommend: `PENDING_CONSENT` state**. Minor can log in to view static onboarding and read-only educational guides, but cannot run AI tutor, post in community, or execute external scripts until guardian verified. Under-13 requires verified school code or verifiable parental consent. | Requires clear educational notice explaining why interactive features are temporarily locked. |
| **D5** | **Quota Time Zone** | • Fixed UTC<br>• Fixed `Asia/Kolkata`<br>• Per-user IANA timezone | **Recommend: Per-user IANA timezone (`profiles.tz`)** validated against `pg_timezone_names`. Resets occur at the student's actual local midnight and local Monday. | Edge cases: Daylight Saving Time shifts and time zone updates. Handled by checking `(now() AT TIME ZONE tz)::date`. |
| **D6** | **Server Data Storage** | • Entire state JSONB (`user_state`)<br>• Fully normalized relational tables | **Recommend: Hybrid Approach — JSONB `user_state` for Phase 1-5, followed by normalized tables in Phase 6+**. Allows instant state sync without breaking version 3 schema, with a 2MB size cap and optimistic concurrency. | State-blob conflicts require client resolution logic; normalized tables allow granular sub-entity syncing later. |
| **D7** | **Password & Abuse Controls** | • Min 8 chars<br>• Min 10 chars + HaveIBeenPwned check<br>• CAPTCHA + lockout | **Recommend: Min 10 characters, zxcvbn entropy check, Cloudflare Turnstile verification on signup/reset, exponential backoff lockout (5 failed attempts = 15m timeout)**. | Breached-password API check introduces external latency; enforce locally or via Supabase Auth native HIBP toggle if on Pro plan. |
| **D8** | **Server Moderation** | • Phase 6 server-side Charter filter: Yes vs No | **Recommend: YES**. Client-side Charter filter is purely advisory. Community submissions must execute `charter-filter.ts` in an Edge Function / Postgres RPC prior to persistence. | Minor execution latency on community posts (typically <15ms). |
| **D9** | **Cost & Scale Estimates** | • 1k MAU: Free Tier ($0/mo)<br>• 10k MAU: Supabase Pro ($25/mo) + Resend ($20/mo)<br>• 100k MAU: Enterprise ($599+/mo) | **Pro Tier ($25/mo) is optimal for launch** (includes daily backups, 8GB DB, 100k monthly active users, 250k Edge Function invocations, and custom domain SSL). | Estimates exclude high-volume third-party LLM inference tokens if BYO keys are not used. |
| **D10**| **Data Retention** | • Consent logs: 3 yrs vs permanent<br>• Audit logs: 1 yr vs 7 yrs<br>• Tombstones: 30 days | **Recommend: Retain consent receipts and audit logs for 3 years (statute of limitations for regulatory audits); deleted user tombstones purged after 30 days; immediate soft-delete cascade**. | Subject to final counsel review under DPDP Act 2023 / GDPR Art 17. |

---

## 7. Migration Plan & Sequence
1. **`20261107_init.sql`**: Preserved as historical record (DO NOT EDIT).
2. **`20261109_foundation.sql`**:
   - `account_status` enum alter (`PENDING_CONSENT`).
   - `handle_new_user()` trigger on `auth.users`.
   - `quota_limits` reference table.
   - `consume_quota(key)` v2 with IANA time zone support and account status checks.
   - `admin_audit` table with immutable append-only trigger.
   - `profiles` RLS hardening and column-protection trigger.
   - `parental_consents` token hash redesign.
   - `user_state` sync table with optimistic locking.

