/* Academia · headless local mock store (no server, fully deterministic) */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type Tier = "A" | "B" | "C" | "D" | "E";
export type Role = "student" | "admin";
export type AccountStatus = "ACTIVE" | "INACTIVE" | "BAN";

export interface Flashcard { id: string; front: string; back: string; deck: string; ef: number; interval: number; reps: number; due: number; }
export interface Note { id: string; title: string; subject: string; body: string; updated: number; }
export interface Opportunity { id: string; title: string; org: string; deadline: number; tier: Tier; kind: string; tracked: boolean; }
export interface Announcement { id: string; title: string; body: string; priority: "pinned" | "high" | "normal"; tiers: Tier[]; read: boolean; ts: number; author: string; }
export interface Course { id: string; name: string; credits: number; score: number; done: number; target: number; }
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
  flashcards: Flashcard[];
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
export const uid = () => Math.random().toString(36).slice(2, 9);
const seededRand = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

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

function seed(): AppState {
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
    flashcards: [
      { id: "f1", front: "State the Rank–Nullity theorem.", back: "For T: V → W linear, dim(V) = rank(T) + nullity(T). Rank is dim(image), nullity is dim(kernel).", deck: "Linear Algebra", ef: 2.5, interval: 1, reps: 1, due: now - DAY },
      { id: "f2", front: "Derivative of ln(sin x)?", back: "cot x — chain rule: (1/sin x)·cos x.", deck: "Calculus", ef: 2.5, interval: 0, reps: 0, due: now - 3600e3 },
      { id: "f3", front: "Time complexity of binary search and its precondition?", back: "O(log n); the input range must be sorted with random access.", deck: "Algorithms", ef: 2.6, interval: 6, reps: 3, due: now },
      { id: "f4", front: " Kirchhoff's Current Law?", back: "The signed sum of currents at any node is zero — charge is conserved.", deck: "Physics", ef: 2.4, interval: 2, reps: 2, due: now - DAY / 2 },
      { id: "f5", front: "What does an RREF pivot column tell you?", back: "It marks a basic variable; free columns span the null space.", deck: "Linear Algebra", ef: 2.5, interval: 0, reps: 0, due: now },
      { id: "f6", front: "Eigenvalue equation?", back: "A·v = λ·v for nonzero v. Solve det(A − λI) = 0.", deck: "Linear Algebra", ef: 2.5, interval: 1, reps: 1, due: now + DAY },
      { id: "f7", front: "Big-O of heap insert / extract-min?", back: "Both O(log n); build-heap is O(n).", deck: "Algorithms", ef: 2.5, interval: 3, reps: 2, due: now + 2 * DAY },
      { id: "f8", front: "Integral of sec²x dx?", back: "tan x + C.", deck: "Calculus", ef: 2.7, interval: 6, reps: 3, due: now + 3 * DAY },
    ],
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
      { id: "g1", name: "Mathematics", credits: 4, score: 88, done: 60, target: 93 },
      { id: "g2", name: "Physics", credits: 4, score: 81, done: 55, target: 90 },
      { id: "g3", name: "Computer Science", credits: 3, score: 94, done: 70, target: 95 },
      { id: "g4", name: "Chemistry", credits: 3, score: 76, done: 50, target: 85 },
      { id: "g5", name: "English", credits: 2, score: 85, done: 65, target: 88 },
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

function load(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === 3) return { ...seed(), ...parsed };
    }
  } catch { /* corrupted local state falls back to seed */ }
  return seed();
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<AppState>(load);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.documentElement.dataset.theme = s.theme;
  }, [s.theme]);

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* storage full — session-only mode */ }
    }, 350);
    return () => window.clearTimeout(saveTimer.current);
  }, [s]);

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
  const resetAll = () => { localStorage.removeItem(LS_KEY); setS(seed()); };

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