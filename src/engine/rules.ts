/* Academia · deterministic rule tables: SM-2, keystroke charter filter,
   assistant FSM intent routing. Every reply traces to a named rule. */
import type { AppState, Flashcard } from "./store";
import { gpaOf, requiredScore, daysUntil, dayKey } from "./store";
import { fmt } from "./math";
import { hasKeyword } from "@/utils/keywords";

const DAY = 86400000;

/* ---------- SuperMemo SM-2 ---------- */
export function sm2(card: Flashcard, q: number, now = Date.now()): Flashcard {
  const grade = Math.max(0, Math.min(5, Math.round(q)));
  let { ef, interval, reps } = card;
  if (grade < 3) {
    reps = 0; interval = 1;
    // canonical SM-2: a lapse resets reps/interval but leaves EF unchanged
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef);
    ef = Math.max(1.3, ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  }
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
  if (s.adoro.length === 0) {
    return { subject: "Diagnostics unrecorded", score: 0 };
  }
  return [...s.adoro].sort((a, b) => a.score - b.score)[0];
}

export function customChatReply(text: string, s: AppState): AssistantReply {
  const t = text.toLowerCase();
  // user-defined Catalyst rules first — they are the inspectable rule layer
  for (const r of s.rules.filter(r => r.enabled)) {
    if (hasKeyword(t, r.keywords)) {
      return { fsm: "MATCHED", rule: `Catalyst rule · ${r.trigger}`, lines: [r.response] };
    }
  }
  const studentName = s.session.name.trim() ? s.session.name.split(" ")[0] : "scholar";
  const table: { keys: string[]; rule: string; fn: () => string[] }[] = [
    { keys: ["hello", "hi", "hey", "namaste"], rule: "INTENT/GREET", fn: () => [`Hello ${studentName}. I route text through a fixed intent table — ask about deadlines, quota, cards, GPA or focus time.`] },
    { keys: ["deadline", "due date", "next event"], rule: "INTENT/INVENTORY", fn: () => [`Next deadline: ${nextDeadline(s)}`, "Open Inventory for the milestone ladder."] },
    { keys: ["quota", "limit", "runs left"], rule: "INTENT/QUOTA", fn: () => [`Portfolio: ${s.quotas.portfolio.d}/3 daily · ${s.quotas.portfolio.w}/10 weekly.`, `Sandbox: ${s.quotas.sandbox.d}/1 daily · ${s.quotas.sandbox.w}/5 weekly.`] },
    { keys: ["flashcard", "cards", "review", "recall"], rule: "INTENT/LIBRARY", fn: () => [`${dueCount(s)} cards are due now under SM-2.`, "Rate honestly: 0–2 resets the interval, 3–5 grows it by your ease factor."] },
    { keys: ["gpa", "grade", "marks", "score"], rule: "INTENT/TALLY", fn: () => [`Current weighted GPA: ${fmt(gpaOf(s.grades), 3)} / 10.`, "TallyBud tab computes required remaining scores per course."] },
    { keys: ["focus", "pomodoro", "studied", "heatmap"], rule: "INTENT/POMODORO", fn: () => { const today = s.pomodoro.sessions[dayKey(Date.now())] ?? 0; return [`Logged today: ${today} min of focus.`, "The heatmap is informational — it never nudges or streak-shames."]; } },
    { keys: ["sandbox", "code", "run"], rule: "INTENT/SANDBOX", fn: () => [`Sandbox quota: ${s.quotas.sandbox.d} daily run left, ${s.quotas.sandbox.w} this week.`, "Save a rollback snapshot before experiments."] },
    { keys: ["weak", "improve", "adoro"], rule: "INTENT/ADORO", fn: () => {
      const w = weakest(s);
      return [`Lowest diagnostic: ${w.subject} at ${w.score}/100.`, "Adoro Buddy has a rule-based recovery plan."];
    }},
  ];
  for (const row of table) {
    if (hasKeyword(t, row.keys)) return { fsm: "MATCHED", rule: row.rule, lines: row.fn() };
  }
  return { fsm: "FALLBACK", rule: "NO_RULE_MATCHED", lines: ["No rule matched that input — nothing is generated or guessed.", "Try: “next deadline”, “quota”, “cards due”, “GPA”, “focus time”, or add your own rule in the Catalyst Engine."] };
}

export function tallyBudReply(text: string, s: AppState): AssistantReply {
  const t = text.toLowerCase();
  if (s.grades.length === 0) {
    return { fsm: "MATCHED", rule: "TALLY/EMPTY", lines: ["No courses recorded yet in Tally. Add courses to calculate required scores and weighted GPA."] };
  }
  if (hasKeyword(t, ["required", "need", "remaining"])) {
    const lines = s.grades.map(g => {
      const r = requiredScore(g);
      return r === null ? `${g.name}: coursework complete.` : `${g.name}: need ${fmt(Math.max(0, r), 4)}% on remaining ${100 - g.done}% to hit ${g.target}.`;
    });
    return { fsm: "MATCHED", rule: "TALLY/REQUIRED_SCORE", lines };
  }
  if (hasKeyword(t, ["weak", "lowest", "risk"])) {
    const risky = [...s.grades].sort((a, b) => (a.score - a.target) - (b.score - b.target))[0];
    return { fsm: "MATCHED", rule: "TALLY/GAP_RANK", lines: [`Largest target gap: ${risky.name} (${risky.score} vs target ${risky.target}).`, "Weight study time by credit hours × gap for best return."] };
  }
  if (hasKeyword(t, ["gpa", "current", "summary"]) || t === "") {
    const credits = s.grades.reduce((a, g) => a + g.credits, 0);
    return { fsm: "MATCHED", rule: "TALLY/WEIGHTED_GPA", lines: [`Weighted GPA: ${fmt(gpaOf(s.grades), 3)} / 10 across ${credits} credits.`, ...s.grades.map(g => `${g.name}: ${g.score}% (${g.credits} cr)`)] };
  }
  return { fsm: "FALLBACK", rule: "TALLY/NO_MATCH", lines: ["TallyBud answers three fixed queries: “current GPA”, “required remaining score”, “weakest course”."] };
}

export function adoroBuddyReply(text: string, s: AppState): AssistantReply {
  const t = text.toLowerCase();
  if (s.adoro.length === 0) {
    return { fsm: "MATCHED", rule: "ADORO/EMPTY", lines: ["No diagnostics logged yet in Adoro. Complete a diagnostic assessment to generate weakness maps and rule plans."] };
  }
  const w = weakest(s);
  if (hasKeyword(t, ["plan", "today", "study"])) {
    return { fsm: "MATCHED", rule: "ADORO/PLAN_25X3", lines: [`Rule plan for ${w.subject} (${w.score}/100):`, "1 · One 25-min Pomodoro on the linked Library note.", `2 · Rate all due ${w.subject} cards honestly (SM-2).`, "3 · Re-run the diagnostic after 3 sessions — thresholds are fixed, not adaptive."] };
  }
  if (hasKeyword(t, ["weak", "worst", "low"])) {
    const sorted = [...s.adoro].sort((a, b) => a.score - b.score).slice(0, 3);
    return { fsm: "MATCHED", rule: "ADORO/WEAK_RANK", lines: sorted.map((x, i) => `${i + 1}. ${x.subject} — ${x.score}/100 ${x.score < 70 ? "(below 70 threshold)" : ""}`) };
  }
  if (hasKeyword(t, ["ready", "score", "readiness"]) || t === "") {
    const avg = Math.round(s.adoro.reduce((a, x) => a + x.score, 0) / s.adoro.length);
    return { fsm: "MATCHED", rule: "ADORO/READINESS_MEAN", lines: [`Composite readiness: ${avg}/100 (unweighted mean of ${s.adoro.length} diagnostics).`, `Band: ${avg >= 80 ? "APPLICATION READY" : avg >= 65 ? "CONSOLIDATING" : "FOUNDATION"}. Cutoffs: 65 / 80, fixed by rule.`] };
  }
  return { fsm: "FALLBACK", rule: "ADORO/NO_MATCH", lines: ["Adoro Buddy answers: “readiness”, “weakest areas”, “plan for today”."] };
}

export function numeraBudReply(text: string, _s: AppState): AssistantReply {
  const t = text.toLowerCase();
  if (hasKeyword(t, ["rref", "gaussian", "row reduction", "elimination"])) {
    return {
      fsm: "MATCHED",
      rule: "NUMERA/RREF_ALGORITHM",
      lines: [
        "Gaussian Elimination (RREF) Recipe:",
        "1 · Pivot Selection: Find the leftmost column with a non-zero entry and swap it to the pivot row.",
        "2 · Normalization: Scale the pivot row so the leading coefficient equals 1.",
        "3 · Elimination: Subtract multiples of the pivot row from all other rows to eliminate column entries above and below.",
        "4 · Recursion: Repeat for remaining submatrices. Free variables indicate infinite solutions (null space)."
      ]
    };
  }
  if (hasKeyword(t, ["determinant", "matrix", "rank", "invertible"])) {
    return {
      fsm: "MATCHED",
      rule: "NUMERA/MATRIX_PROPERTIES",
      lines: [
        "Matrix Invariants:",
        "• Determinant: det(A) ≠ 0 if and only if A is invertible and full rank.",
        "• Rank-Nullity Theorem: rank(A) + nullity(A) = n (number of columns).",
        "• Eigenvalues: Solve det(A - λI) = 0 to extract characteristic roots."
      ]
    };
  }
  if (hasKeyword(t, ["derivative", "calculus", "slope", "chain rule"])) {
    return {
      fsm: "MATCHED",
      rule: "NUMERA/CALCULUS_RULES",
      lines: [
        "Deterministic Differential Calculus:",
        "• Chain Rule: d/dx f(g(x)) = f'(g(x)) · g'(x)",
        "• Product Rule: (f · g)' = f' · g + f · g'",
        "• Quotient Rule: (f / g)' = (f'·g - f·g') / g²",
        "Slopes render in real-time on Numera's 60fps canvas plotter."
      ]
    };
  }
  if (hasKeyword(t, ["limit", "limits", "approaches", "l'hopital"])) {
    return {
      fsm: "MATCHED",
      rule: "NUMERA/LIMITS_EVALUATION",
      lines: [
        "Limit Resolution Invariants:",
        "1 · Direct Substitution: Evaluate f(c). If finite and continuous, result is verified.",
        "2 · Indeterminate Forms (0/0, ∞/∞): Apply algebraic factoring, rationalization, or L'Hôpital's rule.",
        "3 · Squeeze Theorem: Bound g(x) ≤ f(x) ≤ h(x) where lim g(x) = lim h(x)."
      ]
    };
  }
  return {
    fsm: "FALLBACK",
    rule: "NUMERA/NO_MATCH",
    lines: [
      "NumeraBud answers math engine queries: “RREF steps”, “matrix determinant”, “calculus derivatives”, or “limits”."
    ]
  };
}

export function lockerGuardReply(text: string, s: AppState): AssistantReply {
  const t = text.toLowerCase();
  const docCount = s.locker.docs.length;
  const encryptedCount = s.locker.docs.filter(d => d.scrambled).length;

  if (hasKeyword(t, ["status", "vault", "files", "documents"])) {
    return {
      fsm: "MATCHED",
      rule: "LOCKER/VAULT_STATUS",
      lines: [
        `Locker Vault Audit: ${docCount} documents recorded.`,
        `• Encrypted containers: ${encryptedCount} / ${docCount} sealed with AES-256-GCM.`,
        `• Tamper status: ${s.locker.tamper ? "WARNING: Signature mismatch detected!" : "VERIFIED CLEAN — zero hash anomalies."}`,
        "• Verification is 100% client-side; keys never leave this device."
      ]
    };
  }
  if (hasKeyword(t, ["pbkdf2", "iterations", "key", "encryption", "cipher", "aes"])) {
    return {
      fsm: "MATCHED",
      rule: "LOCKER/CRYPTO_SPEC",
      lines: [
        "Cryptographic Specification:",
        "• Cipher: AES-256-GCM with 96-bit unique IV per file (zero reuse invariant).",
        "• KDF: PBKDF2-HMAC-SHA256 with 600,000 minimum iterations.",
        "• Salt: 128-bit cryptographically secure random bytes via Web Crypto API.",
        "• Authentication Tag: 128-bit GCM tag ensures integrity and tamper-proofing."
      ]
    };
  }
  if (hasKeyword(t, ["tamper", "integrity", "hash", "signature"])) {
    return {
      fsm: "MATCHED",
      rule: "LOCKER/TAMPER_DETECTION",
      lines: [
        `Container Integrity: ${s.locker.tamper ? "Tampering detected" : "All signatures intact"}.`,
        "Every .academia-lock container embeds a SHA-256 payload checksum. A single bit-flip causes decryption to abort with AuthenticationError."
      ]
    };
  }
  if (hasKeyword(t, ["export", "backup", "download", "keypair"])) {
    return {
      fsm: "MATCHED",
      rule: "LOCKER/BACKUP_PROTOCOL",
      lines: [
        "Keypair Export Protocol:",
        "1 · Open Locker → Re-import or Export Key container.",
        "2 · Your .academia-lock file stores encrypted document manifests and keys.",
        "3 · Keep your vault passphrase memorized; without it, data is mathematically unrecoverable."
      ]
    };
  }
  return {
    fsm: "FALLBACK",
    rule: "LOCKER/NO_MATCH",
    lines: [
      "LockerGuard audits: “vault status”, “PBKDF2 iterations”, “tamper report”, or “keypair backup”."
    ]
  };
}

export function libraryBudReply(text: string, s: AppState): AssistantReply {
  const t = text.toLowerCase();
  const due = s.flashcards.filter(f => f.due <= Date.now()).length;
  const totalCards = s.flashcards.length;

  if (hasKeyword(t, ["due", "cards", "review", "schedule", "today"])) {
    const decks = [...new Set(s.flashcards.map(f => f.deck))];
    return {
      fsm: "MATCHED",
      rule: "LIBRARY/DUE_CARDS",
      lines: [
        `Active Recall Status: ${due} of ${totalCards} flashcards are due for review.`,
        decks.length > 0 ? `Active decks: ${decks.join(", ")}.` : "No decks created yet.",
        "Reviews follow the SuperMemo SM-2 spacing curve to optimize memory retention."
      ]
    };
  }
  if (hasKeyword(t, ["sm2", "algorithm", "spacing", "formula", "interval"])) {
    return {
      fsm: "MATCHED",
      rule: "LIBRARY/SM2_ALGORITHM",
      lines: [
        "SuperMemo SM-2 Interval Function:",
        "• First repetition: I(1) = 1 day",
        "• Second repetition: I(2) = 6 days",
        "• n-th repetition: I(n) = I(n-1) × EF",
        "• EF formula: EF' = max(1.3, EF + (0.1 - (5-q)·(0.08 + (5-q)·0.02)))",
        "Lapses (grades 0–2) reset repetitions to 0 and interval to 1 day."
      ]
    };
  }
  if (hasKeyword(t, ["rating", "grade", "scale", "button", "buttons"])) {
    return {
      fsm: "MATCHED",
      rule: "LIBRARY/RATING_SCALE",
      lines: [
        "SM-2 Rating Scale (0 to 5):",
        "0 · Blackout (complete failure to recall)",
        "1 · Wrong, felt familiar upon seeing answer",
        "2 · Wrong, but seemed easy to remember",
        "3 · Correct, but recalled with significant difficulty",
        "4 · Correct, recalled with momentary hesitation",
        "5 · Perfect, immediate effortless recall"
      ]
    };
  }
  if (hasKeyword(t, ["notes", "margin", "summaries", "cloze"])) {
    return {
      fsm: "MATCHED",
      rule: "LIBRARY/NOTE_METHODS",
      lines: [
        `You have ${s.notes.length} margin notes stored.`,
        "Optimal recall strategy: distill each lecture into 3 core invariants, then create 2–4 targeted cloze or question-answer cards linked to the note."
      ]
    };
  }
  return {
    fsm: "FALLBACK",
    rule: "LIBRARY/NO_MATCH",
    lines: [
      "LibraryBud answers: “cards due”, “SM-2 algorithm”, “rating scale”, or “margin notes”."
    ]
  };
}
