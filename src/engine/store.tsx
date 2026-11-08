/* Academia · headless local mock store (no server, fully deterministic) */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ENV } from "./env";
import { getSupabaseClient } from "./supabase";

export { ENV, getSupabaseClient };

export type Tier = "A" | "B" | "C" | "D" | "E";
export type Role = "student" | "admin";
export type AccountStatus = "ACTIVE" | "INACTIVE" | "BAN";

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

export interface AppState {
  version: number;
  theme: "paper" | "midnight";
  cookies: { decided: boolean; media: boolean };
  session: {
    authed: boolean; role: Role; name: string; email: string; tier: Tier;
    stage: "questionnaire" | "provisioning" | "ready";
    status: AccountStatus; inactiveUntil?: number;
    parental?: { email: string; token: string | null };
    provisionStart?: number;
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
const seededRand = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
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

/* demo-only privilege shortcuts (demo admin login, governance toggle, parent token).
   Default ON so the demo UI is unchanged; set VITE_DEMO_MODE=false for real deployments. */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";

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

export function seed(): AppState {
  const now = Date.now();
  const sessions: Record<string, number> = {};
  for (let i = 0; i < 140; i++) {
    const r = seededRand(i);
    if (r > 0.3) sessions[dayKey(now - i * DAY)] = Math.round(r * 95 + (i % 7 === 0 ? 30 : 0));
  }
  return {
    version: 3,
    theme: "paper",
    cookies: { decided: false, media: false },
    session: { authed: false, role: "student", name: "Aarav Sharma", email: "aarav@academia.app", tier: "A", stage: "ready", status: "ACTIVE" },
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
      { id: "n1", title: "Row reduction, without tears", subject: "Linear Algebra", body: "RREF recipe: 1) pick leftmost nonzero column, 2) swap a pivot to the top, 3) scale pivot row to 1, 4) clear the column above and below. Pivot columns → basic variables. Free columns → parameters of the null space. Worked example: [[1,2,1],[2,4,3]] → x₁ = −2x₂ − ... keep fractions exact until the end.", updated: now - 2 * DAY },
      { id: "n2", title: "Chain rule pattern bank", subject: "Calculus", body: "Outside-in: d/dx f(g(x)) = f'(g(x))·g'(x). Pattern bank — ln(sin x) → cot x; e^(x²) → 2x·e^(x²); √(1+x²) → x/√(1+x²). When stuck, name the inner function u and rewrite before differentiating.", updated: now - DAY },
      { id: "n3", title: "KCL / KVA loop discipline", subject: "Physics", body: "Node method: choose ground, label node voltages, write KCL at every non-ground node, solve the conductance system G·v = i. A voltage source adds one MNA row (branch current unknown). Sign errors are the only real enemy.", updated: now - 4 * DAY },
      { id: "n4", title: "Binary search invariants", subject: "Algorithms", body: "Invariant: answer always lies in [lo, hi). mid = lo + (hi−lo)//2 avoids overflow. If predicate(mid) true → hi = mid else lo = mid + 1. Loop ends when lo == hi. Prove the invariant before touching the boundary updates.", updated: now - 6 * DAY },
    ],
    videosWatched: [],
    resume: { name: "Aarav Sharma", headline: "Tier A · STEM track · Class of 2027", school: "Meridian Senior Secondary", skills: ["Python", "Linear Algebra", "Circuit Analysis", "Technical Writing"], activities: ["Math circle lead", "Robotics club — power systems", "Peer tutoring (40h)"] },
    proposals: [
      { id: "p1", title: "Low-cost soil moisture mesh for campus garden", abstract: "A 6-node resistive sensor mesh with a shared gateway; calibrating probe decay curves against gravimetric samples.", status: "In review", updated: now - 3 * DAY },
      { id: "p2", title: "Flashcard scheduling: SM-2 vs fixed intervals", abstract: "A controlled two-week study comparing retention under SM-2 against fixed 3-day review cycles.", status: "Draft", updated: now - DAY },
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
      { id: "r1", trigger: "Keyword match", keywords: ["deadline", "due"], response: "Your next Inventory deadline is the Regional Math Olympiad registration. Open Inventory → Milestones to see the full ladder.", enabled: true },
      { id: "r2", trigger: "Study streak break", keywords: ["streak", "missed"], response: "Streaks are informational only. Log one 25-minute Pomodoro today and the heatmap square fills — no penalties apply.", enabled: true },
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
      { id: "a1", title: "Midterm vault maintenance window", body: "The Locker keypair rotation runs Saturday 02:00–02:20 IST. Exports stay available; imports queue locally and sync afterwards. Re-download your .academia-lock file after rotation if a tamper flag appears.", priority: "pinned", tiers: ["A", "B", "C", "D", "E"], read: false, ts: now - 5 * 3600e3, author: "Registrar" },
      { id: "a2", title: "Olympiad Tier A: revised syllabus posted", body: "Number theory weight rises to 30%. The Library deck 'RMO Sprint' has been re-sequenced; your SM-2 progress is preserved.", priority: "high", tiers: ["A"], read: false, ts: now - DAY, author: "Academics Office" },
      { id: "a3", title: "Community charter reminder", body: "The keystroke filter now screens draft text before posting. Rephrasing keeps threads searchable and civil — flags decay after 30 clean days.", priority: "normal", tiers: ["A", "B", "C", "D", "E"], read: false, ts: now - 2 * DAY, author: "Moderation" },
      { id: "a4", title: "Sandbox weekly quota raised to 5 runs", body: "Effective this week, sandbox execution quota moves from 3 to 5 weekly runs for all tiers. Daily cap remains 1.", priority: "normal", tiers: ["A", "B", "C"], read: true, ts: now - 4 * DAY, author: "Platform" },
      { id: "a5", title: "Scratchpad stylus latency fix shipped", body: "Bezier smoothing now samples at pointer rate; strokes on 120Hz tablets no longer show faceting at speed.", priority: "normal", tiers: ["A", "B", "C", "D", "E"], read: true, ts: now - 6 * DAY, author: "Platform" },
    ],
    grades: [
      { id: "g1", name: "Mathematics", credits: 4, score: 88, done: 60, target: 93, tier: "ap" },
      { id: "g2", name: "Physics", credits: 4, score: 81, done: 55, target: 90, tier: "ap" },
      { id: "g3", name: "Computer Science", credits: 3, score: 94, done: 70, target: 95, tier: "honors" },
      { id: "g4", name: "Chemistry", credits: 3, score: 76, done: 50, target: 85, tier: "standard" },
      { id: "g5", name: "English", credits: 2, score: 85, done: 65, target: 88, tier: "standard" },
    ],
    pomodoro: { sessions, focusMin: 25, breakMin: 5 },
    adoro: [
      { subject: "Algebra", score: 86 }, { subject: "Calculus", score: 74 }, { subject: "Mechanics", score: 68 },
      { subject: "Circuits", score: 81 }, { subject: "Algorithms", score: 90 }, { subject: "Writing", score: 62 },
    ],
    community: [
      { id: "t1", author: "Ishita V.", hue: 210, title: "Why does my RREF give a free variable I didn't expect?", body: "Matrix [[1,2,1],[2,4,3]] — I expected two pivots but the second column goes free. Is that because col2 = 2·col1?", tag: "Numera", replies: [{ id: "tr1", author: "Rohan K.", body: "Exactly — column 2 is dependent, so it can't hold a pivot. Pivot columns are 1 and 3; x₂ is your free parameter.", ts: now - 3 * 3600e3 }], ts: now - 6 * 3600e3 },
      { id: "t2", author: "Meera P.", hue: 20, title: "SM-2: what do you press when you *almost* remembered?", body: "I keep debating between 3 and 4 on cards I recalled slowly. What's your rule of thumb?", tag: "Library", replies: [{ id: "tr2", author: "Aarav S.", body: "If you hesitated more than ~5 seconds I press 3. The interval barely grows and the card comes back sooner — which is what I want.", ts: now - 2 * 3600e3 }, { id: "tr3", author: "Ishita V.", body: "Same. 4 is for clean recall with effort, 5 for instant.", ts: now - 3600e3 }], ts: now - DAY },
      { id: "t3", author: "Rohan K.", hue: 130, title: "Study room tonight: KCL problem set (7pm IST)", body: "Bringing the node-voltage worksheet from the Physics notes. Split screen: shared scratch on the left, timer on the right. All tiers welcome.", tag: "Study room", replies: [], ts: now - 2 * DAY },
      { id: "t4", author: "Sana D.", hue: 300, title: "Sandbox quota: save your run for a full program", body: "One run per day means I draft in the editor, dry-trace on paper, then execute once. Rollback snapshots make experiments safe.", tag: "Sandbox", replies: [{ id: "tr4", author: "Meera P.", body: "The snapshot before refactor has saved me twice this week.", ts: now - 2 * DAY }], ts: now - 3 * DAY },
    ],
    room: { notes: "KCL worksheet — node A:\n(vA − 5)/1000 + vA/2000 = 0\n→ vA = 10/3 V ≈ 3.33 V\n\nNext: add the 2mA source at node B.", hands: [] },
    atlasVisited: ["alg-vars", "math-linear"],
    admin: {
      students: [
        { id: "st1", name: "Aarav Sharma", email: "aarav@academia.app", tier: "A", module: "Sandbox", quotaHealth: "Healthy", status: "ACTIVE", flags: 0, letters: "A·B·A·C", joined: "2025-06-12", lastSeen: "2 min ago", logs: ["09:41 · Signed in (paper theme)", "09:44 · Sandbox run #14 executed", "10:02 · 3 flashcards rated (SM-2)", "10:15 · Proposal p1 moved to In review"] },
        { id: "st2", name: "Ishita Verma", email: "ishita.v@academia.app", tier: "A", module: "Numera", quotaHealth: "Healthy", status: "ACTIVE", flags: 0, letters: "A·A·B·B", joined: "2025-06-14", lastSeen: "now", logs: ["09:58 · Matrix RREF computed", "10:11 · Joined study room #3"] },
        { id: "st3", name: "Rohan Kulkarni", email: "rohan.k@academia.app", tier: "B", module: "Workbench", quotaHealth: "Watch", status: "ACTIVE", flags: 1, letters: "B·C·A·B", joined: "2025-07-02", lastSeen: "18 min ago", logs: ["08:50 · MNA solver: singular matrix warning", "09:12 · Snapshot rolled back"] },
        { id: "st4", name: "Meera Pillai", email: "meera.p@academia.app", tier: "A", module: "Library", quotaHealth: "Healthy", status: "ACTIVE", flags: 0, letters: "A·B·B·A", joined: "2025-07-19", lastSeen: "1 h ago", logs: ["08:05 · 22 cards reviewed", "08:40 · Note 'Chain rule' updated"] },
        { id: "st5", name: "Kabir Anand", email: "kabir.a@academia.app", tier: "C", module: "Community", quotaHealth: "Exceeded", status: "ACTIVE", flags: 3, letters: "C·D·C·E", joined: "2025-08-01", lastSeen: "3 h ago", logs: ["07:22 · Keystroke filter: draft blocked", "07:24 · Keystroke filter: draft blocked", "07:31 · Thread posted after rephrase"] },
        { id: "st6", name: "Sana D'Souza", email: "sana.d@academia.app", tier: "B", module: "Portfolio", quotaHealth: "Watch", status: "ACTIVE", flags: 0, letters: "B·B·C·A", joined: "2025-08-11", lastSeen: "26 min ago", logs: ["09:02 · Weekly quota 8/10 consumed"] },
        { id: "st7", name: "Dev Patel", email: "dev.p@academia.app", tier: "D", module: "Media", quotaHealth: "Healthy", status: "INACTIVE", until: now + 2 * DAY, flags: 1, letters: "D·C·D·C", joined: "2025-08-20", lastSeen: "2 d ago", logs: ["Aug 28 · Usage paused 7 days (exam week request)"] },
        { id: "st8", name: "Ananya Iyer", email: "ananya.i@academia.app", tier: "A", module: "Adoro", quotaHealth: "Healthy", status: "ACTIVE", flags: 0, letters: "A·A·A·B", joined: "2025-06-30", lastSeen: "now", logs: ["10:00 · Diagnostic report generated", "10:04 · Weakness map: Mechanics"] },
        { id: "st9", name: "Farhan Ali", email: "farhan.a@academia.app", tier: "C", module: "Tally", quotaHealth: "Watch", status: "ACTIVE", flags: 0, letters: "C·C·B·D", joined: "2025-09-03", lastSeen: "5 h ago", logs: ["06:45 · Target GPA slider → 8.7"] },
        { id: "st10", name: "Priya Nair", email: "priya.n@academia.app", tier: "B", module: "Atlas", quotaHealth: "Healthy", status: "ACTIVE", flags: 0, letters: "B·A·B·C", joined: "2025-07-25", lastSeen: "44 min ago", logs: ["09:30 · Prerequisite path completed: eigenvalues"] },
        { id: "st11", name: "Arjun Mehta", email: "arjun.m@academia.app", tier: "E", module: "Pomodoro", quotaHealth: "Exceeded", status: "BAN", flags: 6, letters: "E·D·E·D", joined: "2025-09-15", lastSeen: "6 d ago", logs: ["Sep 19 · Repeated charter violations", "Sep 20 · ACCOUNT_BANNED issued"] },
        { id: "st12", name: "Lakshmi Rao", email: "lakshmi.r@academia.app", tier: "B", module: "Inventory", quotaHealth: "Healthy", status: "ACTIVE", flags: 0, letters: "B·B·A·C", joined: "2025-08-29", lastSeen: "12 min ago", logs: ["10:01 · Milestone predictor recalculated"] },
      ],
      stats: [
        { label: "Modules", value: "50+" },
        { label: "Students", value: "12K+" },
        { label: "Deterministic", value: "100%" },
      ],
      features: [
        { id: "c1", title: "Active-recall Library", body: "SM-2 scheduled flashcards, margin notes and summaries that resurface exactly when memory decays — never before, never late.", badge: "SM-2 engine", icon: "book", span: 2 },
        { id: "c2", title: "Deterministic Sandbox", body: "A WebAssembly-target editor with daily run quotas and rollback snapshots. Same input, same output — every time.", badge: "1/day · 5/week", icon: "terminal", span: 1 },
        { id: "c3", title: "Numera Math Engine", body: "Scientific, graphical, matrix, geometry and 3D modes with visible parse trees. The working is the answer.", badge: "5 modes", icon: "sigma", span: 1 },
        { id: "c4", title: "Admissions Inventory", body: "Opportunity deadlines on a milestone ladder calibrated to top-tier applications, with Gantt-style roadmaps.", badge: "Milestone predictor", icon: "flag", span: 1 },
        { id: "c5", title: "Sealed Locker", body: "Application documents encrypted to .academia-lock with tamper indicators and manual key re-import. Your vault, your keys.", badge: "Tamper-evident", icon: "lock", span: 1 },
        { id: "c6", title: "Rule-built companions", body: "TallyBud, Adoro Buddy and the Catalyst Engine are inspectable rule machines — every reply traces to a rule you can read.", badge: "No black boxes", icon: "workflow", span: 2 },
      ],
      warnings: [],
      flagsOpen: 4,
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
    return isPlainObject(got) ? mergeObject(seedV, got) : seedV;
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
  // optional fields that exist only in persisted data (e.g. session.parental, session.inactiveUntil)
  // Explicit allowlist prevents arbitrary attacker-controlled keys from being merged
  // into the app state from a tampered localStorage payload.
  const OPTIONAL_SCALAR_KEYS = new Set([
    "inactiveUntil", "provisionStart", "token", "email",
    "clozeIdx", "sourceNoteId", "lapses", "tier",
  ]);
  // Optional sub-objects with a fixed known shape; validated field-by-field.
  const OPTIONAL_OBJECT_EXEMPLARS: Record<string, Record<string, unknown>> = {
    parental: { email: "", token: null }, // { email: string; token: string | null }
  };
  for (const key of Object.keys(got)) {
    if (DANGEROUS_KEYS.has(key) || key in out) continue;
    const v = got[key];
    if (key in OPTIONAL_OBJECT_EXEMPLARS) {
      // Validate the sub-object against its known shape; merge scalars only
      if (!isPlainObject(v)) continue;
      out[key] = mergeObject(OPTIONAL_OBJECT_EXEMPLARS[key], v as Record<string, unknown>);
      continue;
    }
    if (!OPTIONAL_SCALAR_KEYS.has(key)) continue; // drop unknown extra keys
    if (v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && isFinite(v))) out[key] = v;
  }
  return out;
}

const TIERS: Tier[] = ["A", "B", "C", "D", "E"];
const STATUSES: AccountStatus[] = ["ACTIVE", "INACTIVE", "BAN"];
const STAGES = ["questionnaire", "provisioning", "ready"] as const;

/* enum + range clamping on top of the shape merge */
function clampState(s: AppState): AppState {
  s.session.role = s.session.role === "admin" ? "admin" : "student";
  s.session.status = STATUSES.includes(s.session.status) ? s.session.status : "ACTIVE";
  s.session.tier = TIERS.includes(s.session.tier) ? s.session.tier : "A";
  s.session.stage = (STAGES as readonly string[]).includes(s.session.stage) ? s.session.stage : "ready";
  s.theme = s.theme === "midnight" ? "midnight" : "paper";
  for (const key of ["portfolio", "sandbox", "chat"] as const) {
    const max = QUOTA_MAX[key];
    s.quotas[key].d = Math.min(Math.max(0, Math.round(s.quotas[key].d) || 0), max.d);
    s.quotas[key].w = Math.min(Math.max(0, Math.round(s.quotas[key].w) || 0), max.w);
  }
  // Ensure reviewLog is a capped array (5000 max)
  if (!Array.isArray(s.reviewLog)) s.reviewLog = [];
  else if (s.reviewLog.length > 5000) s.reviewLog = s.reviewLog.slice(-5000);

  // Ensure librarySettings exist and are positive
  if (!s.librarySettings || typeof s.librarySettings !== "object") {
    s.librarySettings = { dailyNewLimit: 20, dailyReviewLimit: 100 };
  } else {
    s.librarySettings.dailyNewLimit = Math.max(1, Math.min(200, Math.round(s.librarySettings.dailyNewLimit) || 20));
    s.librarySettings.dailyReviewLimit = Math.max(1, Math.min(1000, Math.round(s.librarySettings.dailyReviewLimit) || 100));
  }

  // Cap per-card history to 50
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

/* refill daily quotas at local midnight, weekly quotas on local Monday,
   and heal states persisted before quotaReset existed. */
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
  const base = seed();
  base.session = {
    authed: false,
    role: "student",
    name: "",
    email: "",
    tier: "A",
    stage: "questionnaire",
    status: "ACTIVE",
  };
  base.admin.students = [];
  base.admin.warnings = [];
  base.flashcards = [];
  base.notes = [];
  base.inventory = [];
  base.announcements = [];
  base.grades = [];
  base.proposals = [];
  base.sandbox.snapshots = [];
  base.locker.docs = [];
  return base;
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
        // states persisted before quotaReset existed get one refill, then stamp normally
        const legacy = !isPlainObject(json) || !isPlainObject((json as Record<string, unknown>).quotaReset);
        return refillQuotas(legacy ? { ...parsed, quotaReset: { daily: "", weekly: "" } } : parsed);
      }
    }
  } catch {
    if (ENV.appEnv === "production" && !ENV.allowMockFallback) {
      throw new Error("Configuration Error: Corrupted state recovery failure. Mock data rollback prohibited in production.");
    }
  }

  if (ENV.appEnv === "production" && !ENV.allowMockFallback) {
    throw new Error("Configuration Error: Unauthenticated mock data rollback prohibited in production environment.");
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

  /* never lose the last <350ms of edits: flush on hide/pagehide */
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

  const up = (fn: (draft: AppState) => void) => {
    setS(prev => {
      const draft = JSON.parse(JSON.stringify(prev)) as AppState;
      fn(draft);
      draft.ops = prev.ops + 1;
      return draft;
    });
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

  return <Ctx.Provider value={{ s, up, toast, toasts, dismiss, resetAll }}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}

export function spendQuota(s: AppState, key: "portfolio" | "sandbox" | "chat"): boolean {
  return s.quotas[key].d > 0 && s.quotas[key].w > 0;
}
export function fmtDate(t: number): string {
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
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
    // Scale bump to 10-point scale: 0.5 on 4-scale = 1.25 on 10-scale
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