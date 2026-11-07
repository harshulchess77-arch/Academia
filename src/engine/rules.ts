/* Academia · deterministic rule tables: SM-2, keystroke charter filter,
   assistant FSM intent routing. Every reply traces to a named rule. */
import type { AppState, Flashcard } from "./store";
import { gpaOf, requiredScore, daysUntil } from "./store";
import { fmt } from "./math";

const DAY = 86400000;

/* ---------- SuperMemo SM-2 ---------- */
export function sm2(card: Flashcard, q: number, now = Date.now()): Flashcard {
  let { ef, interval, reps } = card;
  if (q < 3) { reps = 0; interval = 1; }
  else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef);
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return { ...card, ef: Math.round(ef * 100) / 100, interval, reps, due: now + interval * DAY };
}
export const SM2_LABELS = ["Blackout", "Wrong, felt familiar", "Wrong, easy recall after", "Correct, hard", "Correct, hesitant", "Perfect"];

/* ---------- community charter filter ---------- */
export const CHARTER_WORDS = ["stupid", "idiot", "dumb", "noob", "trash", "shut up", "loser", "moron", "pathetic"];
export function screenText(text: string): string[] {
  const lower = text.toLowerCase();
  return CHARTER_WORDS.filter(w => new RegExp(`(^|[^a-z])${w.replace(" ", "\\s+")}([^a-z]|$)`, "i").test(lower));
}

/* ---------- assistant FSM ---------- */
export interface AssistantReply { fsm: "IDLE" | "PARSING" | "MATCHED" | "FALLBACK"; rule: string; lines: string[] }

function nextDeadline(s: AppState): string {
  const tracked = [...s.inventory].sort((a, b) => a.deadline - b.deadline)[0];
  return tracked ? `${tracked.title} — ${daysUntil(tracked.deadline)} days left (${tracked.org}).` : "No opportunities in Inventory.";
}
function dueCount(s: AppState): number {
  return s.flashcards.filter(f => f.due <= Date.now()).length;
}
function weakest(s: AppState): { subject: string; score: number } {
  return [...s.adoro].sort((a, b) => a.score - b.score)[0];
}

export function customChatReply(text: string, s: AppState): AssistantReply {
  const t = text.toLowerCase();
  // user-defined Catalyst rules first — they are the inspectable rule layer
  for (const r of s.rules.filter(r => r.enabled)) {
    if (r.keywords.some(k => t.includes(k.toLowerCase()))) {
      return { fsm: "MATCHED", rule: `Catalyst rule · ${r.trigger}`, lines: [r.response] };
    }
  }
  const table: { keys: string[]; rule: string; fn: () => string[] }[] = [
    { keys: ["hello", "hi ", "hey", "namaste"], rule: "INTENT/GREET", fn: () => [`Hello ${s.session.name.split(" ")[0]}. I route text through a fixed intent table — ask about deadlines, quota, cards, GPA or focus time.`] },
    { keys: ["deadline", "due date", "next event"], rule: "INTENT/INVENTORY", fn: () => [`Next deadline: ${nextDeadline(s)}`, "Open Inventory for the milestone ladder."] },
    { keys: ["quota", "limit", "runs left"], rule: "INTENT/QUOTA", fn: () => [`Portfolio: ${s.quotas.portfolio.d}/3 daily · ${s.quotas.portfolio.w}/10 weekly.`, `Sandbox: ${s.quotas.sandbox.d}/1 daily · ${s.quotas.sandbox.w}/5 weekly.`] },
    { keys: ["flashcard", "cards", "review", "recall"], rule: "INTENT/LIBRARY", fn: () => [`${dueCount(s)} cards are due now under SM-2.`, "Rate honestly: 0–2 resets the interval, 3–5 grows it by your ease factor."] },
    { keys: ["gpa", "grade", "marks", "score"], rule: "INTENT/TALLY", fn: () => [`Current weighted GPA: ${fmt(gpaOf(s.grades), 3)} / 10.`, "TallyBud tab computes required remaining scores per course."] },
    { keys: ["focus", "pomodoro", "studied", "heatmap"], rule: "INTENT/POMODORO", fn: () => { const today = s.pomodoro.sessions[new Date().toISOString().slice(0, 10)] ?? 0; return [`Logged today: ${today} min of focus.`, "The heatmap is informational — it never nudges or streak-shames."]; } },
    { keys: ["sandbox", "code", "run"], rule: "INTENT/SANDBOX", fn: () => [`Sandbox quota: ${s.quotas.sandbox.d} daily run left, ${s.quotas.sandbox.w} this week.`, "Save a rollback snapshot before experiments."] },
    { keys: ["weak", "improve", "adoro"], rule: "INTENT/ADORO", fn: () => [`Lowest diagnostic: ${weakest(s).subject} at ${weakest(s).score}/100.`, "Adoro Buddy has a rule-based recovery plan."] },
  ];
  for (const row of table) {
    if (row.keys.some(k => t.includes(k))) return { fsm: "MATCHED", rule: row.rule, lines: row.fn() };
  }
  return { fsm: "FALLBACK", rule: "NO_RULE_MATCHED", lines: ["No rule matched that input — nothing is generated or guessed.", "Try: “next deadline”, “quota”, “cards due”, “GPA”, “focus time”, or add your own rule in the Catalyst Engine."] };
}

export function tallyBudReply(text: string, s: AppState): AssistantReply {
  const t = text.toLowerCase();
  if (t.includes("required") || t.includes("need") || t.includes("remaining")) {
    const lines = s.grades.map(g => {
      const r = requiredScore(g);
      return r === null ? `${g.name}: coursework complete.` : `${g.name}: need ${fmt(Math.max(0, r), 4)}% on remaining ${100 - g.done}% to hit ${g.target}.`;
    });
    return { fsm: "MATCHED", rule: "TALLY/REQUIRED_SCORE", lines };
  }
  if (t.includes("weak") || t.includes("lowest") || t.includes("risk")) {
    const risky = [...s.grades].sort((a, b) => (a.score - a.target) - (b.score - b.target))[0];
    return { fsm: "MATCHED", rule: "TALLY/GAP_RANK", lines: [`Largest target gap: ${risky.name} (${risky.score} vs target ${risky.target}).`, "Weight study time by credit hours × gap for best return."] };
  }
  if (t.includes("gpa") || t.includes("current") || t === "" || t.includes("summary")) {
    const credits = s.grades.reduce((a, g) => a + g.credits, 0);
    return { fsm: "MATCHED", rule: "TALLY/WEIGHTED_GPA", lines: [`Weighted GPA: ${fmt(gpaOf(s.grades), 3)} / 10 across ${credits} credits.`, ...s.grades.map(g => `${g.name}: ${g.score}% (${g.credits} cr)`)] };
  }
  return { fsm: "FALLBACK", rule: "TALLY/NO_MATCH", lines: ["TallyBud answers three fixed queries: “current GPA”, “required remaining score”, “weakest course”."] };
}

export function adoroBuddyReply(text: string, s: AppState): AssistantReply {
  const t = text.toLowerCase();
  const w = weakest(s);
  if (t.includes("plan") || t.includes("today") || t.includes("study")) {
    return { fsm: "MATCHED", rule: "ADORO/PLAN_25X3", lines: [`Rule plan for ${w.subject} (${w.score}/100):`, "1 · One 25-min Pomodoro on the linked Library note.", `2 · Rate all due ${w.subject} cards honestly (SM-2).`, "3 · Re-run the diagnostic after 3 sessions — thresholds are fixed, not adaptive."] };
  }
  if (t.includes("weak") || t.includes("worst") || t.includes("low")) {
    const sorted = [...s.adoro].sort((a, b) => a.score - b.score).slice(0, 3);
    return { fsm: "MATCHED", rule: "ADORO/WEAK_RANK", lines: sorted.map((x, i) => `${i + 1}. ${x.subject} — ${x.score}/100 ${x.score < 70 ? "(below 70 threshold)" : ""}`) };
  }
  if (t.includes("ready") || t.includes("score") || t === "" || t.includes("readiness")) {
    const avg = Math.round(s.adoro.reduce((a, x) => a + x.score, 0) / s.adoro.length);
    return { fsm: "MATCHED", rule: "ADORO/READINESS_MEAN", lines: [`Composite readiness: ${avg}/100 (unweighted mean of ${s.adoro.length} diagnostics).`, `Band: ${avg >= 80 ? "APPLICATION READY" : avg >= 65 ? "CONSOLIDATING" : "FOUNDATION"}. Cutoffs: 65 / 80, fixed by rule.`] };
  }
  return { fsm: "FALLBACK", rule: "ADORO/NO_MATCH", lines: ["Adoro Buddy answers: “readiness”, “weakest areas”, “plan for today”."] };
}