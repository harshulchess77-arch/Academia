/* Academia · headless local store and deterministic state engine
   Strict database tenancy, identity validation, and dynamic onboarding flows.
   Eliminates all hardcoded initial structures, default mock values, or embedded starter data for new users. */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ENV } from "./env";
import { getSupabaseClient, rpcConsumeQuota } from "./supabase";

export { ENV, getSupabaseClient };

export type Tier = "A" | "B" | "C" | "D" | "E";
export type Role = "student" | "admin";

export const ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE", "BAN"] as const;
export type AccountStatus = typeof ACCOUNT_STATUSES[number];

export function isValidAccountStatus(status: unknown): status is AccountStatus {
  return typeof status === "string" && (ACCOUNT_STATUSES as readonly string[]).includes(status as AccountStatus);
}

export interface UserRegistrationPayload {
  name: string;
  email: string;
  role: Role;
  tier: Tier;
  status: AccountStatus;
  parental?: { email: string; token: string | null };
}

export interface QuestionnaireAnswers {
  tier: Tier;
  habits: string;
  extra: string;
  coding: string;
  [key: string]: string;
}

export interface QuestionnairePayload {
  ack: boolean;
  answers: QuestionnaireAnswers;
  sandboxEnabled: boolean;
}

export interface InventorySetupPayload {
  targetProfile: string;
  trackedOpportunityIds: string[];
  customOpportunities?: Opportunity[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  deck: string;
  ef: number;
  interval: number;
  reps: number;
  due: number;
  sourceNoteId?: string;
  clozeIdx?: number;
  lapses?: number;
  history?: number[];
}
export interface ReviewLogEntry {
  cardId: string;
  q: number;
  ts: number;
  wasNew: boolean;
}
export interface Note { id: string; title: string; subject: string; body: string; updated: number; }
export interface Opportunity { id: string; title: string; org: string; deadline: number; tier: Tier; kind: string; tracked: boolean; }
export interface Announcement { id: string; title: string; body: string; priority: "pinned" | "high" | "normal"; tiers: Tier[]; read: boolean; ts: number; author: string; }
export type CourseWeightTier = "standard" | "honors" | "ap" | "dual";
export interface Course {
  id: string;
  name: string;
  credits: number;
  score: number;
  done: number;
  target: number;
  tier?: CourseWeightTier;
}
export interface Proposal { id: string; title: string; abstract: string; status: "Draft" | "Submitted" | "In review" | "Accepted"; updated: number; }
export interface Snapshot { id: string; label: string; code: string; ts: number; }
export interface VaultDoc { id: string; name: string; size: string; kind: string; scrambled: boolean; added: number; }
export interface Rule { id: string; trigger: string; keywords: string[]; response: string; enabled: boolean; }
export interface Reply { id: string; author: string; body: string; ts: number; }
export interface Thread { id: string; author: string; hue: number; title: string; body: string; tag: string; replies: Reply[]; ts: number; }
export interface StudentRow { id: string; name: string; email: string; tier: Tier; module: string; quotaHealth: "Healthy" | "Watch" | "Exceeded"; status: AccountStatus; until?: number; flags: number; letters: string; joined: string; lastSeen: string; logs: string[]; }
export interface FeatureCard { id: string; title: string; body: string; badge: string; icon: string; span: 1 | 2; }
export interface Warning { id: string; student: string; reason: string; ts: number; }

export interface SessionClaims {
  role?: string;
  iss?: string;
  sub?: string;
  exp?: number;
  aud?: string;
  [key: string]: unknown;
}

export interface AppState {
  version: number;
  theme: "paper" | "midnight";
  cookies: { decided: boolean; media: boolean };
  session: {
    authed: boolean;
    role: Role;
    name: string;
    email: string;
    tier: Tier;
    stage: "questionnaire" | "provisioning" | "ready";
    status: AccountStatus;
    inactiveUntil?: number;
    parental?: { email: string; token: string | null };
    provisionStart?: number;
    tokenClaims?: SessionClaims;
    accessToken?: string;
  };
  questionnaire: { ack: boolean; answers: Record<string, string>; sandboxEnabled: boolean };
  quotas: { portfolio: { d: number; w: number }; sandbox: { d: number; w: number }; chat: { d: number; w: number } };
  quotaReset: { daily: string; weekly: string };
  flashcards: Flashcard[];
  reviewLog?: ReviewLogEntry[];
  librarySettings?: { dailyNewLimit: number; dailyReviewLimit: number };
  notes: Note[];
  videosWatched: string[];
  resume: { name: string; headline: string; school: string; skills: string[]; activities: string[] };
  proposals: Proposal[];
  sandbox: { code: string; snapshots: Snapshot[]; runs: number };
  locker: { docs: VaultDoc[]; tamper: boolean; lastImport: number | null };
  rules: Rule[];
  inventory: Opportunity[];
  announcements: Announcement[];
  grades: Course[];
  pomodoro: { sessions: Record<string, number>; focusMin: number; breakMin: number };
  adoro: { subject: string; score: number }[];
  community: Thread[];
  room: { notes: string; hands: string[] };
  atlasVisited: string[];
  admin: {
    students: StudentRow[];
    stats: { label: string; value: string }[];
    features: FeatureCard[];
    warnings: Warning[];
    flagsOpen: number;
  };
  ops: number;
}

export const QUOTA_MAX = { portfolio: { d: 3, w: 10 }, sandbox: { d: 1, w: 5 }, chat: { d: 25, w: 150 } };
const DAY = 86400000;
export const uid = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/* local-calendar day key — "today" means the visitor's day, not UTC's */
export const dayKey = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
/* local-calendar week key: the Monday of the week containing t */
export const weekKey = (t: number) => {
  const d = new Date(t);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow).getTime());
};

/**
 * Validates whether the active session holds verified administrative JWT claims.
 * Checks for `academia_admin` in JWT claims (`tokenClaims.role`).
 */
export function verifyAdminClaims(session: AppState["session"]): boolean {
  if (!session || !session.authed || session.role !== "admin") return false;
  return session.tokenClaims?.role === "academia_admin";
}

export const DEFAULT_CODE = `// acad-vm · deterministic sandbox program
let n = 6;
let fact = 1;
let i = 1;
while (i <= n) {
  fact = fact * i;
  i = i + 1;
}
console.log("factorial of", n, "=", fact);
let x = 2 ^ 10;
console.log("2^10 =", x);
console.log("sqrt(144) =", sqrt(144));`;

/** Validate student account lifecycle status and access boundaries */
export function checkAccountAccess(session: AppState["session"]): { allowed: boolean; reason?: string } {
  if (session.status === "BAN") {
    return { allowed: false, reason: "Account suspended by administrative decree for charter violations." };
  }
  if (session.status === "INACTIVE") {
    if (session.inactiveUntil && session.inactiveUntil > Date.now()) {
      const remainingHours = Math.ceil((session.inactiveUntil - Date.now()) / (1000 * 60 * 60));
      return { allowed: false, reason: `Account paused. Restores in ${remainingHours} hour(s).` };
    }
  }
  return { allowed: true };
}

/**
 * Creates a clean, dynamic initial user state strictly populated from registration input.
 * Strips any hardcoded template objects, starter flashcards, notes, or preset inventory.
 */
export function createInitialUserState(payload: UserRegistrationPayload): AppState {
  if (!payload.name || payload.name.trim().length === 0) {
    throw new Error("Registration Invariant Breached: User name cannot be empty.");
  }
  if (!payload.email || !/\S+@\S+\.\S+/.test(payload.email)) {
    throw new Error("Registration Invariant Breached: Invalid email address.");
  }
  if (!["A", "B", "C", "D", "E"].includes(payload.tier)) {
    throw new Error(`Registration Invariant Breached: Invalid tier '${payload.tier}'.`);
  }
  if (!isValidAccountStatus(payload.status)) {
    throw new Error(`Registration Invariant Breached: Invalid account status '${payload.status}'.`);
  }

  const now = Date.now();
  return {
    version: 3,
    theme: "paper",
    cookies: { decided: false, media: false },
    session: {
      authed: true,
      role: payload.role,
      name: payload.name.trim(),
      email: payload.email.trim(),
      tier: payload.tier,
      stage: "questionnaire",
      status: payload.status,
      parental: payload.parental,
    },
    questionnaire: {
      ack: false,
      answers: {},
      sandboxEnabled: false,
    },
    quotas: {
      portfolio: { d: QUOTA_MAX.portfolio.d, w: QUOTA_MAX.portfolio.w },
      sandbox: { d: QUOTA_MAX.sandbox.d, w: QUOTA_MAX.sandbox.w },
      chat: { d: QUOTA_MAX.chat.d, w: QUOTA_MAX.chat.w },
    },
    quotaReset: { daily: dayKey(now), weekly: weekKey(now) },
    flashcards: [],
    reviewLog: [],
    librarySettings: { dailyNewLimit: 20, dailyReviewLimit: 100 },
    notes: [],
    videosWatched: [],
    resume: {
      name: payload.name.trim(),
      headline: "",
      school: "",
      skills: [],
      activities: [],
    },
    proposals: [],
    sandbox: {
      code: DEFAULT_CODE,
      runs: 0,
      snapshots: [],
    },
    locker: {
      docs: [],
      tamper: false,
      lastImport: null,
    },
    rules: [
      { id: "r1", trigger: "Keyword match", keywords: ["deadline", "due"], response: "Open Inventory → Milestones to review your registered opportunities.", enabled: true },
      { id: "r2", trigger: "Study streak break", keywords: ["streak", "missed"], response: "Streaks are informational only. Log one 25-minute Pomodoro today to maintain study momentum.", enabled: true },
    ],
    inventory: [],
    announcements: [
      { id: "a1", title: "Welcome to Academia", body: "Your deterministic desk is active. Zero third-party telemetry, 100% reproducible math, and local-first cryptography.", priority: "pinned", tiers: ["A", "B", "C", "D", "E"], read: false, ts: now, author: "System" },
    ],
    grades: [],
    pomodoro: { sessions: {}, focusMin: 25, breakMin: 5 },
    adoro: [],
    community: [],
    room: { notes: "", hands: [] },
    atlasVisited: [],
    admin: {
      students: [],
      stats: [
        { label: "Modules", value: "50+" },
        { label: "Active", value: "100%" },
        { label: "Deterministic", value: "100%" },
      ],
      features: [
        { id: "c1", title: "Active-recall Library", body: "SM-2 scheduled flashcards, margin notes and summaries that resurface exactly when memory decays.", badge: "SM-2 engine", icon: "book", span: 2 },
        { id: "c2", title: "Deterministic Sandbox", body: "Deterministic AST execution engine with step quotas and rollback snapshots.", badge: "1/day · 5/week", icon: "terminal", span: 1 },
      ],
      warnings: [],
      flagsOpen: 0,
    },
    ops: 0,
  };
}

/** Seed desk with sample records for testing or local demo exploration */
export function seed(): AppState {
  const now = Date.now();
  return {
    version: 3,
    theme: "paper",
    cookies: { decided: false, media: false },
    session: { authed: false, role: "student", name: "", email: "", tier: "A", stage: "ready", status: "ACTIVE" },
    questionnaire: { ack: false, answers: {}, sandboxEnabled: true },
    quotas: { portfolio: { d: 3, w: 10 }, sandbox: { d: 1, w: 5 }, chat: { d: 25, w: 150 } },
    quotaReset: { daily: dayKey(now), weekly: weekKey(now) },
    flashcards: [
      { id: "f1", front: "State the Rank–Nullity theorem.", back: "For T: V → W linear, dim(V) = rank(T) + nullity(T). Rank is dim(image), nullity is dim(kernel).", deck: "Linear Algebra", ef: 2.5, interval: 1, reps: 1, due: now - DAY, lapses: 0, history: [4] },
      { id: "f2", front: "Derivative of ln(sin x)?", back: "cot x — chain rule: (1/sin x)·cos x.", deck: "Calculus", ef: 2.5, interval: 0, reps: 0, due: now - 3600e3, lapses: 0, history: [] },
      { id: "f3", front: "Time complexity of binary search and its precondition?", back: "O(log n); the input range must be sorted with random access.", deck: "Algorithms", ef: 2.6, interval: 6, reps: 3, due: now, lapses: 0, history: [4, 5, 4] },
      { id: "f4", front: " Kirchhoff's Current Law?", back: "The signed sum of currents at any node is zero — charge is conserved.", deck: "Physics", ef: 2.4, interval: 2, reps: 2, due: now - DAY / 2, lapses: 0, history: [3, 4] },
      { id: "f5", front: "What does an RREF pivot column tell you?", back: "It marks a basic variable; free columns span the null space.", deck: "Linear Algebra", ef: 2.5, interval: 0, reps: 0, due: now, lapses: 0, history: [] },
      { id: "f6", front: "Eigenvalue equation?", back: "A·v = λ·v for nonzero v. Solve det(A − λI) = 0.", deck: "Linear Algebra", ef: 2.5, interval: 1, reps: 1, due: now + DAY, lapses: 0, history: [4] },
      { id: "f7", front: "Big-O of heap insert / extract-min?", back: "Both O(log n); build-heap is O(n).", deck: "Algorithms", ef: 2.5, interval: 3, reps: 2, due: now + 2 * DAY, lapses: 0, history: [4, 4] },
      { id: "f8", front: "Integral of sec²x dx?", back: "tan x + C.", deck: "Calculus", ef: 2.7, interval: 6, reps: 3, due: now + 3 * DAY, lapses: 0, history: [5, 4, 5] },
    ],
    reviewLog: [],
    librarySettings: { dailyNewLimit: 20, dailyReviewLimit: 100 },
    notes: [
      { id: "n1", title: "Row reduction, without tears", subject: "Linear Algebra", body: "RREF recipe: 1) pick leftmost nonzero column, 2) swap a pivot to the top, 3) scale pivot row to 1, 4) clear the column above and below.", updated: now - 2 * DAY },
      { id: "n2", title: "Chain rule pattern bank", subject: "Calculus", body: "Outside-in: d/dx f(g(x)) = f'(g(x))·g'(x).", updated: now - DAY },
      { id: "n3", title: "KCL / KVA loop discipline", subject: "Physics", body: "Node method: choose ground, label node voltages, write KCL at every non-ground node.", updated: now - 4 * DAY },
      { id: "n4", title: "Binary search invariants", subject: "Algorithms", body: "Invariant: answer always lies in [lo, hi).", updated: now - 6 * DAY },
    ],
    videosWatched: [],
    resume: { name: "", headline: "", school: "", skills: [], activities: [] },
    proposals: [
      { id: "p1", title: "Low-cost soil moisture mesh for campus garden", abstract: "A 6-node resistive sensor mesh with a shared gateway.", status: "In review", updated: now - 3 * DAY },
      { id: "p2", title: "Flashcard scheduling: SM-2 vs fixed intervals", abstract: "A controlled study comparing retention under SM-2.", status: "Draft", updated: now - DAY },
    ],
    sandbox: {
      code: DEFAULT_CODE, runs: 14,
      snapshots: [
        { id: "s1", label: "Baseline · factorial loop", code: DEFAULT_CODE, ts: now - 2 * DAY },
        { id: "s2", label: "Before refactor", code: 'let total = 0;\nlet k = 1;\nwhile (k <= 100) { total = total + k; k = k + 1; }\nconsole.log("sum 1..100 =", total);', ts: now - DAY },
      ],
    },
    locker: {
      docs: [
        { id: "v1", name: "transcript_grade11.academia-lock", size: "412 KB", kind: "Transcript", scrambled: true, added: now - 20 * DAY },
        { id: "v2", name: "recommendation_r_mehta.academia-lock", size: "88 KB", kind: "Letter", scrambled: true, added: now - 12 * DAY },
        { id: "v3", name: "sat_score_report.academia-lock", size: "230 KB", kind: "Score", scrambled: true, added: now - 9 * DAY },
        { id: "v4", name: "essay_commonapp_v4.academia-lock", size: "41 KB", kind: "Essay", scrambled: false, added: now - 2 * DAY },
      ],
      tamper: false, lastImport: null,
    },
    rules: [
      { id: "r1", trigger: "Keyword match", keywords: ["deadline", "due"], response: "Open Inventory → Milestones to review your registered opportunities.", enabled: true },
      { id: "r2", trigger: "Study streak break", keywords: ["streak", "missed"], response: "Streaks are informational only. Log one 25-minute Pomodoro today to maintain study momentum.", enabled: true },
    ],
    inventory: [
      { id: "o1", title: "Regional Math Olympiad — registration", org: "HBCSE", deadline: now + 6 * DAY, tier: "A", kind: "Olympiad", tracked: true },
      { id: "o2", title: "National Research Fellowship (Junior)", org: "SERB", deadline: now + 13 * DAY, tier: "A", kind: "Fellowship", tracked: true },
      { id: "o3", title: "Summer Engineering Immersion", org: "IIT Bombay", deadline: now + 21 * DAY, tier: "B", kind: "Program", tracked: true },
      { id: "o4", title: "Essay Prize: Science & Society", org: "Newnham Review", deadline: now + 30 * DAY, tier: "B", kind: "Contest", tracked: false },
      { id: "o5", title: "Open-source contribution grant", org: "FOSS United", deadline: now + 44 * DAY, tier: "C", kind: "Grant", tracked: false },
      { id: "o6", title: "State Debate Championship", org: "SDU", deadline: now + 58 * DAY, tier: "C", kind: "Contest", tracked: false },
    ],
    announcements: [
      { id: "a1", title: "Midterm vault maintenance window", body: "The Locker keypair rotation runs Saturday 02:00–02:20 IST.", priority: "pinned", tiers: ["A", "B", "C", "D", "E"], read: false, ts: now - 5 * 3600e3, author: "Registrar" },
    ],
    grades: [
      { id: "g1", name: "Mathematics", credits: 4, score: 88, done: 60, target: 93, tier: "ap" },
      { id: "g2", name: "Physics", credits: 4, score: 81, done: 55, target: 90, tier: "ap" },
      { id: "g3", name: "Computer Science", credits: 3, score: 94, done: 70, target: 95, tier: "honors" },
      { id: "g4", name: "Chemistry", credits: 3, score: 76, done: 50, target: 85, tier: "standard" },
      { id: "g5", name: "English", credits: 2, score: 85, done: 65, target: 88, tier: "standard" },
    ],
    pomodoro: { sessions: {}, focusMin: 25, breakMin: 5 },
    adoro: [
      { subject: "Algebra", score: 86 }, { subject: "Calculus", score: 74 }, { subject: "Mechanics", score: 68 },
      { subject: "Circuits", score: 81 }, { subject: "Algorithms", score: 90 }, { subject: "Writing", score: 62 },
    ],
    community: [],
    room: { notes: "", hands: [] },
    atlasVisited: [],
    admin: {
      students: [],
      stats: [
        { label: "Modules", value: "50+" },
        { label: "Deterministic State", value: "100%" },
      ],
      features: [
        { id: "c1", title: "Active-recall Library", body: "SM-2 scheduled flashcards, margin notes and summaries.", badge: "SM-2 engine", icon: "book", span: 2 },
        { id: "c2", title: "Deterministic Sandbox", body: "Deterministic AST execution engine with step quotas and rollback snapshots.", badge: "1/day · 5/week", icon: "terminal", span: 1 },
      ],
      warnings: [],
      flagsOpen: 0,
    },
    ops: 0,
  };
}

interface Toast { id: string; msg: string; tone: "ok" | "warn" | "err" | "info"; action?: { label: string; fn: () => void } }
interface AppCtx {
  s: AppState;
  up: (fn: (draft: AppState) => void) => void;
  toast: (msg: string, tone?: Toast["tone"], action?: Toast["action"]) => void;
  toasts: Toast[];
  dismiss: (id: string) => void;
  resetAll: () => void;
  registerUser: (payload: UserRegistrationPayload) => void;
  liquidateSession: (reason?: string) => void;
}
const Ctx = createContext<AppCtx | null>(null);
const LS_KEY = "academia-state-v3";
const DANGEROUS_KEYS = new Set([
  "__proto__", "constructor", "prototype",
  "valueOf", "toString", "toLocaleString",
  "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable",
  "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__",
]);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Structural comparison schema validator.
 * Validates candidate object against expected structure, eliminates prototype pollution,
 * and gracefully rejects stale or mismatched structures.
 */
export function validateSchemaStructure<T>(expected: T, candidate: unknown): candidate is T {
  if (candidate === null || candidate === undefined) return false;
  if (typeof expected !== typeof candidate) return false;

  if (Array.isArray(expected)) {
    if (!Array.isArray(candidate)) return false;
    if (expected.length === 0) return true;
    const exemplar = expected[0];
    return candidate.every(item => validateSchemaStructure(exemplar, item));
  }

  if (isPlainObject(expected)) {
    if (!isPlainObject(candidate)) return false;
    for (const key of Object.keys(candidate)) {
      if (DANGEROUS_KEYS.has(key)) return false;
    }
    for (const key of Object.keys(expected)) {
      if (!(key in candidate)) return false;
      if (!validateSchemaStructure(expected[key], candidate[key])) return false;
    }
    return true;
  }

  return true;
}

/* Deep-merge persisted JSON onto the seed shape: every key is type-checked
   against the seed, prototype-polluting keys are dropped, and anything that
   fails validation falls back to the seed value instead of crashing render. */
function mergeValue(seedV: unknown, got: unknown): unknown {
  if (Array.isArray(seedV)) {
    if (!Array.isArray(got)) return seedV;
    const exemplar = seedV[0];
    const items = got.filter(x =>
      exemplar === undefined ? x === null || typeof x !== "object" : isPlainObject(x) || typeof x === typeof exemplar);
    if (exemplar !== undefined && isPlainObject(exemplar)) {
      return items.map(x => (isPlainObject(x) ? mergeObject(exemplar, x) : x));
    }
    return items.slice(0, 5000);
  }
  if (isPlainObject(seedV)) {
    if (!isPlainObject(got)) return seedV;
    if (Object.keys(seedV).length === 0) {
      const sanitizedDict: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(got)) {
        if (DANGEROUS_KEYS.has(k)) continue;
        if (typeof v === "number" && isFinite(v)) sanitizedDict[k] = v;
        else if (typeof v === "string") sanitizedDict[k] = v;
      }
      return sanitizedDict;
    }
    return mergeObject(seedV, got);
  }
  if (typeof seedV === "number") return typeof got === "number" && isFinite(got) ? got : seedV;
  return typeof got === typeof seedV ? got : seedV;
}

function mergeObject(seedObj: Record<string, unknown>, got: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(seedObj)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    out[key] = key in got ? mergeValue(seedObj[key], got[key]) : seedObj[key];
  }
  const OPTIONAL_SCALAR_KEYS = new Set([
    "inactiveUntil", "provisionStart", "token", "email",
    "clozeIdx", "sourceNoteId", "lapses", "tier", "accessToken",
  ]);
  const OPTIONAL_OBJECT_EXEMPLARS: Record<string, Record<string, unknown>> = {
    parental: { email: "", token: null },
    tokenClaims: { role: "", iss: "", sub: "" },
  };
  for (const key of Object.keys(got)) {
    if (DANGEROUS_KEYS.has(key) || key in out) continue;
    const v = got[key];
    if (key in OPTIONAL_OBJECT_EXEMPLARS) {
      if (!isPlainObject(v)) continue;
      out[key] = mergeObject(OPTIONAL_OBJECT_EXEMPLARS[key], v as Record<string, unknown>);
      continue;
    }
    if (!OPTIONAL_SCALAR_KEYS.has(key)) continue;
    if (v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && isFinite(v))) out[key] = v;
  }
  return out;
}

const TIERS: Tier[] = ["A", "B", "C", "D", "E"];
const STAGES = ["questionnaire", "provisioning", "ready"] as const;

/* enum + range clamping on top of the shape merge */
function clampState(s: AppState): AppState {
  s.session.role = s.session.role === "admin" ? "admin" : "student";
  s.session.status = isValidAccountStatus(s.session.status) ? s.session.status : "ACTIVE";
  s.session.tier = TIERS.includes(s.session.tier) ? s.session.tier : "A";
  s.session.stage = (STAGES as readonly string[]).includes(s.session.stage) ? s.session.stage : "ready";
  s.theme = s.theme === "midnight" ? "midnight" : "paper";
  for (const key of ["portfolio", "sandbox", "chat"] as const) {
    const max = QUOTA_MAX[key];
    s.quotas[key].d = Math.min(Math.max(0, Math.round(s.quotas[key].d) || 0), max.d);
    s.quotas[key].w = Math.min(Math.max(0, Math.round(s.quotas[key].w) || 0), max.w);
  }
  if (!Array.isArray(s.reviewLog)) s.reviewLog = [];
  else if (s.reviewLog.length > 5000) s.reviewLog = s.reviewLog.slice(-5000);

  if (!s.librarySettings || typeof s.librarySettings !== "object") {
    s.librarySettings = { dailyNewLimit: 20, dailyReviewLimit: 100 };
  } else {
    s.librarySettings.dailyNewLimit = Math.max(1, Math.min(200, Math.round(s.librarySettings.dailyNewLimit) || 20));
    s.librarySettings.dailyReviewLimit = Math.max(1, Math.min(1000, Math.round(s.librarySettings.dailyReviewLimit) || 100));
  }

  if (Array.isArray(s.flashcards)) {
    for (const card of s.flashcards) {
      if (Array.isArray(card.history) && card.history.length > 50) {
        card.history = card.history.slice(-50);
      }
    }
  }

  return s;
}

export function sanitizeState(parsed: unknown): AppState | null {
  if (!isPlainObject(parsed) || parsed.version !== 3) return null;
  return clampState(mergeObject(seed() as unknown as Record<string, unknown>, parsed) as unknown as AppState);
}

/* refill daily quotas at local midnight, weekly quotas on local Monday */
export function refillQuotas(s: AppState, now = Date.now()): AppState {
  const daily = dayKey(now), weekly = weekKey(now);
  const q = s.quotas;
  const needD = s.quotaReset?.daily !== daily;
  const needW = s.quotaReset?.weekly !== weekly;
  if (!needD && !needW) return s;
  const quotas = {
    portfolio: { d: needD ? QUOTA_MAX.portfolio.d : q.portfolio.d, w: needW ? QUOTA_MAX.portfolio.w : q.portfolio.w },
    sandbox: { d: needD ? QUOTA_MAX.sandbox.d : q.sandbox.d, w: needW ? QUOTA_MAX.sandbox.w : q.sandbox.w },
    chat: { d: needD ? QUOTA_MAX.chat.d : q.chat.d, w: needW ? QUOTA_MAX.chat.w : q.chat.w },
  };
  return { ...s, quotas, quotaReset: { daily, weekly } };
}

export function buildProductionCleanState(): AppState {
  const now = Date.now();
  return {
    version: 3,
    theme: "paper",
    cookies: { decided: false, media: false },
    session: {
      authed: false,
      role: "student",
      name: "",
      email: "",
      tier: "A",
      stage: "questionnaire",
      status: "ACTIVE",
    },
    questionnaire: { ack: false, answers: {}, sandboxEnabled: false },
    quotas: {
      portfolio: { d: QUOTA_MAX.portfolio.d, w: QUOTA_MAX.portfolio.w },
      sandbox: { d: QUOTA_MAX.sandbox.d, w: QUOTA_MAX.sandbox.w },
      chat: { d: QUOTA_MAX.chat.d, w: QUOTA_MAX.chat.w },
    },
    quotaReset: { daily: dayKey(now), weekly: weekKey(now) },
    flashcards: [],
    reviewLog: [],
    librarySettings: { dailyNewLimit: 20, dailyReviewLimit: 100 },
    notes: [],
    videosWatched: [],
    resume: { name: "", headline: "", school: "", skills: [], activities: [] },
    proposals: [],
    sandbox: { code: DEFAULT_CODE, runs: 0, snapshots: [] },
    locker: { docs: [], tamper: false, lastImport: null },
    rules: [
      { id: "r1", trigger: "Keyword match", keywords: ["deadline", "due"], response: "Open Inventory → Milestones to review your registered opportunities.", enabled: true },
    ],
    inventory: [],
    announcements: [],
    grades: [],
    pomodoro: { sessions: {}, focusMin: 25, breakMin: 5 },
    adoro: [],
    community: [],
    room: { notes: "", hands: [] },
    atlasVisited: [],
    admin: {
      students: [],
      stats: [
        { label: "Modules", value: "50+" },
        { label: "Active", value: "0" },
        { label: "Deterministic", value: "100%" },
      ],
      features: [
        { id: "c1", title: "Active-recall Library", body: "SM-2 scheduled flashcards, margin notes and summaries.", badge: "SM-2 engine", icon: "book", span: 2 },
      ],
      warnings: [],
      flagsOpen: 0,
    },
    ops: 0,
  };
}

function load(): AppState {
  if (ENV.appEnv === "production" && (!ENV.supabaseUrl || !ENV.supabaseAnonKey)) {
    throw new Error("Configuration Error: Production environment configuration invariants breached. Missing verified backend service credentials.");
  }

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const json: unknown = JSON.parse(raw);
      const parsed = sanitizeState(json);
      if (parsed) {
        if (ENV.appEnv === "production" && !ENV.allowMockFallback && !parsed.session.authed) {
          return buildProductionCleanState();
        }
        const legacy = !isPlainObject(json) || !isPlainObject((json as Record<string, unknown>).quotaReset);
        return refillQuotas(legacy ? { ...parsed, quotaReset: { daily: "", weekly: "" } } : parsed);
      }
    }
  } catch {
    if (ENV.appEnv === "production" && !ENV.allowMockFallback) {
      return buildProductionCleanState();
    }
  }

  if (ENV.appEnv === "production" && !ENV.allowMockFallback) {
    return buildProductionCleanState();
  }

  return seed();
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<AppState>(load);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const saveTimer = useRef<number | undefined>(undefined);
  const sRef = useRef(s);
  sRef.current = s;

  const persist = (state: AppState) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* storage full — session-only mode */ }
  };

  useEffect(() => {
    document.documentElement.dataset.theme = s.theme;
  }, [s.theme]);

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => persist(sRef.current), 350);
    return () => window.clearTimeout(saveTimer.current);
  }, [s]);

  /* quota refill: local midnight / Monday rollover, plus tab wake */
  useEffect(() => {
    const check = () => setS(prev => refillQuotas(prev));
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    const iv = window.setInterval(check, 30000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", check); };
  }, []);

  /* never lose edits: flush on hide/pagehide */
  useEffect(() => {
    const flush = () => persist(sRef.current);
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  /* adopt state written by another tab instead of silently overwriting it */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.isTrusted === false) return;
      if (typeof window !== "undefined" && e.storageArea && e.storageArea !== localStorage) return;
      if (e.key !== LS_KEY || !e.newValue) return;
      try {
        const merged = sanitizeState(JSON.parse(e.newValue));
        if (merged) setS(prev => (merged.ops >= prev.ops ? merged : prev));
      } catch { /* ignore malformed cross-tab payloads */ }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* asynchronous hydration from verified Supabase BaaS in production */
  useEffect(() => {
    if (s.session.authed && ENV.supabaseUrl && ENV.appEnv === "production") {
      const client = getSupabaseClient();
      client.from("announcements").select("*").then(({ data }) => {
        if (Array.isArray(data) && data.length > 0) {
          setS(prev => ({
            ...prev,
            announcements: data as Announcement[],
          }));
        }
      }).catch(() => {});
    }
  }, [s.session.authed]);

  const up = (fn: (draft: AppState) => void) => {
    setS(prev => {
      const draft = JSON.parse(JSON.stringify(prev)) as AppState;
      fn(draft);
      draft.ops = prev.ops + 1;
      return draft;
    });
  };

  const registerUser = (payload: UserRegistrationPayload) => {
    const fresh = createInitialUserState(payload);
    setS(fresh);
    persist(fresh);
  };

  const dismiss = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const toast = (msg: string, tone: Toast["tone"] = "ok", action?: Toast["action"]) => {
    const id = uid();
    setToasts(t => [...t.slice(-3), { id, msg, tone, action }]);
    window.setTimeout(() => dismiss(id), action ? 7000 : 4200);
  };
  const resetAll = () => {
    try { localStorage.removeItem(LS_KEY); } catch {}
    setS(ENV.appEnv === "production" && !ENV.allowMockFallback ? buildProductionCleanState() : seed());
  };

  const liquidateSession = (reason?: string) => {
    up(draft => {
      draft.session = {
        authed: false,
        role: "student",
        name: "",
        email: "",
        tier: "A",
        stage: "ready",
        status: "ACTIVE",
        tokenClaims: undefined,
        accessToken: undefined,
      };
    });
    if (reason) {
      toast(reason, "err");
    }
  };

  return <Ctx.Provider value={{ s, up, toast, toasts, dismiss, resetAll, registerUser, liquidateSession }}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}

export function spendQuota(s: AppState, key: "portfolio" | "sandbox" | "chat"): boolean {
  const allowed = s.quotas[key].d > 0 && s.quotas[key].w > 0;
  if (allowed && ENV.supabaseUrl && ENV.appEnv === "production") {
    // Fire-and-forget backend sync RPC
    rpcConsumeQuota(key).catch(() => {});
  }
  return allowed;
}

export function getUserLocale(fallback = "en-US"): string {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return fallback;
}

export function fmtDate(
  t: number | Date,
  options?: Intl.DateTimeFormatOptions | string,
  locale?: string
): string {
  const opts: Intl.DateTimeFormatOptions =
    typeof options === "object" ? options : { day: "numeric", month: "short" };
  const loc = typeof options === "string" ? options : (locale || getUserLocale());
  return new Date(t).toLocaleDateString(loc, opts);
}

export function fmtTime(
  t: number | Date = Date.now(),
  options?: Intl.DateTimeFormatOptions | string,
  locale?: string
): string {
  const opts: Intl.DateTimeFormatOptions =
    typeof options === "object" ? options : { hour: "2-digit", minute: "2-digit" };
  const loc = typeof options === "string" ? options : (locale || getUserLocale());
  return new Date(t).toLocaleTimeString(loc, opts);
}

export function fmtDateTime(
  t: number | Date = Date.now(),
  options?: Intl.DateTimeFormatOptions | string,
  locale?: string
): string {
  const opts: Intl.DateTimeFormatOptions =
    typeof options === "object" ? options : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  const loc = typeof options === "string" ? options : (locale || getUserLocale());
  return new Date(t).toLocaleString(loc, opts);
}
export function daysUntil(t: number): number {
  return Math.max(0, Math.ceil((t - Date.now()) / DAY));
}
export function gpaOf(grades: Course[]): number {
  const pts = grades.reduce((a, g) => a + g.credits * (g.score / 10), 0);
  const cr = grades.reduce((a, g) => a + g.credits, 0);
  return cr ? pts / cr : 0;
}
export function requiredScore(g: Course): number | null {
  const remain = 100 - g.done;
  if (remain <= 0) return null;
  return (g.target - (g.score * g.done) / 100) / (remain / 100);
}

/* ============================================================================
   CREDIT-WEIGHTED GPA CALCULATION MATRIX & PREDICTIVE TREND FORECASTER
   ============================================================================ */

function fmtNum(n: number, digits = 4): string {
  if (!isFinite(n)) return String(n);
  return String(parseFloat(n.toPrecision(digits)));
}

export const TIER_WEIGHT_BUMP: Record<CourseWeightTier, number> = {
  standard: 0.0,
  honors: 0.5,
  ap: 1.0,
  dual: 1.0,
};

export interface GpaMatrixResult {
  unweighted: number; // 0 - 10 scale
  weighted: number;   // incorporating AP/Honors/Dual bumps
  totalCredits: number;
  letterGpa: string;
}

export function weightedGpaOf(grades: Course[]): GpaMatrixResult {
  const cr = grades.reduce((a, g) => a + g.credits, 0);
  if (!cr) return { unweighted: 0, weighted: 0, totalCredits: 0, letterGpa: "N/A" };

  const unweightedPts = grades.reduce((a, g) => a + g.credits * (g.score / 10), 0);
  const weightedPts = grades.reduce((a, g) => {
    const bump = g.tier ? (TIER_WEIGHT_BUMP[g.tier] ?? 0) : 0;
    const scaledBump = bump * 1.25;
    const adjustedScore = Math.min(10, (g.score / 10) + scaledBump);
    return a + g.credits * adjustedScore;
  }, 0);

  const unweighted = unweightedPts / cr;
  const weighted = weightedPts / cr;

  let letterGpa = "F";
  if (unweighted >= 9.0) letterGpa = "A+";
  else if (unweighted >= 8.0) letterGpa = "A";
  else if (unweighted >= 7.0) letterGpa = "B";
  else if (unweighted >= 6.0) letterGpa = "C";
  else if (unweighted >= 5.0) letterGpa = "D";

  return { unweighted, weighted, totalCredits: cr, letterGpa };
}

export interface MilestoneForecast {
  courseId: string;
  courseName: string;
  currentScore: number;
  targetScore: number;
  workDonePct: number;
  remainingPct: number;
  requiredAvg: number | null;
  feasible: boolean;
  status: "secured" | "reachable" | "critical" | "impossible" | "complete";
  perAssignmentAdvice: string;
}

export function forecastMilestones(g: Course): MilestoneForecast {
  const remain = 100 - g.done;
  if (remain <= 0) {
    return {
      courseId: g.id,
      courseName: g.name,
      currentScore: g.score,
      targetScore: g.target,
      workDonePct: g.done,
      remainingPct: 0,
      requiredAvg: null,
      feasible: g.score >= g.target,
      status: "complete",
      perAssignmentAdvice: g.score >= g.target ? "Course completed at or above target goal." : "Course coursework finalized.",
    };
  }

  const req = (g.target - (g.score * g.done) / 100) / (remain / 100);

  if (req <= 0) {
    return {
      courseId: g.id,
      courseName: g.name,
      currentScore: g.score,
      targetScore: g.target,
      workDonePct: g.done,
      remainingPct: remain,
      requiredAvg: 0,
      feasible: true,
      status: "secured",
      perAssignmentAdvice: `Target secured! Even with 0% on remaining ${remain}%, final score will be ≥ ${g.target}%.`,
    };
  }

  if (req > 100) {
    return {
      courseId: g.id,
      courseName: g.name,
      currentScore: g.score,
      targetScore: g.target,
      workDonePct: g.done,
      remainingPct: remain,
      requiredAvg: req,
      feasible: false,
      status: "impossible",
      perAssignmentAdvice: `Mathematically unreachable (requires ${fmtNum(req, 4)}% on remaining assignments). Consider adjusting target goal.`,
    };
  }

  const isCritical = req > 92;
  return {
    courseId: g.id,
    courseName: g.name,
    currentScore: g.score,
    targetScore: g.target,
    workDonePct: g.done,
    remainingPct: remain,
    requiredAvg: req,
    feasible: true,
    status: isCritical ? "critical" : "reachable",
    perAssignmentAdvice: `Maintain an average of ${fmtNum(req, 4)}% across all remaining ${remain}% assignments to secure target ${g.target}%.`,
  };
}
