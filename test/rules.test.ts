import { describe, expect, it } from "vitest";
import {
  sm2,
  SM2_LABELS,
  screenText,
  customChatReply,
  tallyBudReply,
  adoroBuddyReply,
  numeraBudReply,
  lockerGuardReply,
  libraryBudReply,
} from "@/engine/rules";
import { seed, dayKey, type Flashcard } from "@/engine/store";

const card = (over: Partial<Flashcard> = {}): Flashcard => ({
  id: "c1", front: "f", back: "b", deck: "D", ef: 2.5, interval: 6, reps: 3, due: 0, ...over,
});

describe("SM-2 scheduling", () => {
  it("grows intervals on successful recall", () => {
    const next = sm2(card({ reps: 2, interval: 6, ef: 2.5 }), 5, 1000);
    expect(next.reps).toBe(3);
    expect(next.interval).toBe(Math.round(6 * 2.5));
    expect(next.due).toBe(1000 + next.interval * 86400000);
  });

  it("first recall → 1 day, second → 6 days", () => {
    expect(sm2(card({ reps: 0, interval: 0 }), 4).interval).toBe(1);
    expect(sm2(card({ reps: 1, interval: 1 }), 4).interval).toBe(6);
  });

  it("a lapse resets reps and interval but leaves EF unchanged", () => {
    const before = card({ ef: 2.5, interval: 10, reps: 4 });
    const next = sm2(before, 1);
    expect(next.reps).toBe(0);
    expect(next.interval).toBe(1);
    expect(next.ef).toBe(2.5); // canonical SM-2: EF untouched on lapse
    expect(next.due).toBeGreaterThan(Date.now());
  });

  it("grades 0,1,2 all count as lapse", () => {
    for (const q of [0, 1, 2]) {
      const next = sm2(card({ ef: 2.5 }), q);
      expect(next.reps).toBe(0);
      expect(next.ef).toBe(2.5);
    }
  });

  it("successful recall still adjusts EF up and down", () => {
    const easy = sm2(card({ ef: 2.5 }), 5);
    expect(easy.ef).toBeGreaterThan(2.5);
    const hard = sm2(card({ ef: 2.5 }), 3);
    expect(hard.ef).toBeLessThan(2.5);
  });

  it("floors EF at 1.3", () => {
    let c = card({ ef: 1.31 });
    for (let i = 0; i < 10; i++) c = sm2(c, 3);
    expect(c.ef).toBeGreaterThanOrEqual(1.3);
  });

  it("clamps out-of-range grades", () => {
    expect(sm2(card(), 9).interval).toBe(sm2(card(), 5).interval);
    expect(sm2(card(), -3).reps).toBe(0);
  });

  it("has six rating labels", () => {
    expect(SM2_LABELS).toHaveLength(6);
  });
});

describe("community charter filter", () => {
  it("flags charter words on word boundaries", () => {
    expect(screenText("you are stupid")).toContain("stupid");
    expect(screenText("total idiot move")).toContain("idiot");
    expect(screenText("shut up now")).toContain("shut up");
  });

  it("does not flag innocent words", () => {
    expect(screenText("a studious student")).toEqual([]);
    expect(screenText("dumbbell workout plan")).toEqual([]);
    expect(screenText("the moron problem in chapter 4")).toContain("moron");
  });
});

describe("assistant intent routing", () => {
  const s = seed();

  it("routes inventory questions to Inventory", () => {
    // "next event" hits the built-in intent table without touching Catalyst keywords
    const r = customChatReply("when is my next event?", s);
    expect(r.rule).toBe("INTENT/INVENTORY");
    expect(r.fsm).toBe("MATCHED");
  });

  it("lets enabled Catalyst rules answer before built-ins", () => {
    const r = customChatReply("when is my next deadline?", s);
    expect(r.rule).toContain("Catalyst rule");
  });

  it("does not fire 'due' inside 'individual'", () => {
    const r = customChatReply("my individual project progress", s);
    expect(r.rule).not.toBe("INTENT/INVENTORY");
  });

  it("does not fire 'run' inside 'truncate'", () => {
    const r = customChatReply("please truncate the log file", s);
    expect(r.rule).not.toBe("INTENT/SANDBOX");
  });

  it("does not fire 'hi' inside 'Delhi' or 'this'", () => {
    expect(customChatReply("I live in Delhi", s).rule).not.toBe("INTENT/GREET");
    expect(customChatReply("this is interesting", s).rule).not.toBe("INTENT/GREET");
  });

  it("greets on a real 'hi'", () => {
    expect(customChatReply("hi there", s).rule).toBe("INTENT/GREET");
    expect(customChatReply("hello!", s).rule).toBe("INTENT/GREET");
  });

  it("matches user Catalyst rules before built-ins, whole-word only", () => {
    const s2 = seed();
    s2.rules.unshift({ id: "u1", trigger: "Keyword match", keywords: ["oracle"], response: "custom oracle reply", enabled: true });
    expect(customChatReply("ask the oracle", s2).lines).toEqual(["custom oracle reply"]);
    // substring inside another word must not fire
    const s3 = seed();
    s3.rules.unshift({ id: "u2", trigger: "Keyword match", keywords: ["run"], response: "custom run reply", enabled: true });
    expect(customChatReply("truncate this please", s3).rule).not.toContain("Catalyst");
  });

  it("ignores disabled Catalyst rules", () => {
    const s2 = seed();
    s2.rules.unshift({ id: "u1", trigger: "Keyword match", keywords: ["event"], response: "x", enabled: false });
    expect(customChatReply("next event please", s2).rule).toBe("INTENT/INVENTORY");
  });

  it("falls back honestly when nothing matches", () => {
    const r = customChatReply("xyzzy plugh", s);
    expect(r.fsm).toBe("FALLBACK");
    expect(r.rule).toBe("NO_RULE_MATCHED");
  });

  it("reports pomodoro minutes for the LOCAL day", () => {
    const s2 = seed();
    s2.pomodoro.sessions = { [dayKey(Date.now())]: 42 };
    const r = customChatReply("how much focus time today?", s2);
    expect(r.rule).toBe("INTENT/POMODORO");
    expect(r.lines[0]).toContain("42");
  });
});

describe("TallyBud", () => {
  const s = seed();

  it("answers required-score queries", () => {
    expect(tallyBudReply("what do I need on the rest?", s).rule).toBe("TALLY/REQUIRED_SCORE");
    expect(tallyBudReply("remaining marks needed", s).rule).toBe("TALLY/REQUIRED_SCORE");
  });

  it("does not fire 'need' inside 'needy'", () => {
    expect(tallyBudReply("my needy schedule", s).rule).not.toBe("TALLY/REQUIRED_SCORE");
  });

  it("answers GPA queries", () => {
    expect(tallyBudReply("current gpa?", s).rule).toBe("TALLY/WEIGHTED_GPA");
  });

  it("falls back with its fixed query list", () => {
    const r = tallyBudReply("tell me a joke", s);
    expect(r.fsm).toBe("FALLBACK");
  });
});

describe("Adoro Buddy", () => {
  const s = seed();

  it("answers readiness queries", () => {
    expect(adoroBuddyReply("am I ready?", s).rule).toBe("ADORO/READINESS_MEAN");
  });

  it("answers weakest-area queries", () => {
    expect(adoroBuddyReply("what are my weak areas", s).rule).toBe("ADORO/WEAK_RANK");
  });

  it("answers plan-for-today queries", () => {
    expect(adoroBuddyReply("give me a plan for today", s).rule).toBe("ADORO/PLAN_25X3");
  });

  it("falls back honestly", () => {
    expect(adoroBuddyReply("what is the meaning of life", s).fsm).toBe("FALLBACK");
  });
});

describe("NumeraBud", () => {
  const s = seed();

  it("answers RREF algorithm queries", () => {
    const r = numeraBudReply("explain RREF steps", s);
    expect(r.rule).toBe("NUMERA/RREF_ALGORITHM");
    expect(r.fsm).toBe("MATCHED");
  });

  it("answers matrix determinant queries", () => {
    const r = numeraBudReply("what is determinant and rank?", s);
    expect(r.rule).toBe("NUMERA/MATRIX_PROPERTIES");
    expect(r.fsm).toBe("MATCHED");
  });

  it("answers derivative calculus queries", () => {
    const r = numeraBudReply("how do I compute derivatives?", s);
    expect(r.rule).toBe("NUMERA/CALCULUS_RULES");
    expect(r.fsm).toBe("MATCHED");
  });

  it("answers limits queries", () => {
    const r = numeraBudReply("how to evaluate limits?", s);
    expect(r.rule).toBe("NUMERA/LIMITS_EVALUATION");
    expect(r.fsm).toBe("MATCHED");
  });

  it("falls back cleanly on unmatched query", () => {
    const r = numeraBudReply("unmatched query", s);
    expect(r.fsm).toBe("FALLBACK");
    expect(r.rule).toBe("NUMERA/NO_MATCH");
  });
});

describe("LockerGuard", () => {
  const s = seed();

  it("answers vault status queries", () => {
    const r = lockerGuardReply("what is my vault status?", s);
    expect(r.rule).toBe("LOCKER/VAULT_STATUS");
    expect(r.fsm).toBe("MATCHED");
  });

  it("answers PBKDF2 iterations queries", () => {
    const r = lockerGuardReply("how many pbkdf2 iterations are used?", s);
    expect(r.rule).toBe("LOCKER/CRYPTO_SPEC");
    expect(r.fsm).toBe("MATCHED");
  });

  it("answers tamper integrity queries", () => {
    const r = lockerGuardReply("check container integrity", s);
    expect(r.rule).toBe("LOCKER/TAMPER_DETECTION");
    expect(r.fsm).toBe("MATCHED");
  });

  it("answers keypair export queries", () => {
    const r = lockerGuardReply("how to export keypair backup?", s);
    expect(r.rule).toBe("LOCKER/BACKUP_PROTOCOL");
    expect(r.fsm).toBe("MATCHED");
  });

  it("falls back cleanly", () => {
    const r = lockerGuardReply("something random", s);
    expect(r.fsm).toBe("FALLBACK");
    expect(r.rule).toBe("LOCKER/NO_MATCH");
  });
});

describe("LibraryBud", () => {
  const s = seed();

  it("answers due cards queries", () => {
    const r = libraryBudReply("how many cards due today?", s);
    expect(r.rule).toBe("LIBRARY/DUE_CARDS");
    expect(r.fsm).toBe("MATCHED");
  });

  it("answers SM-2 algorithm queries", () => {
    const r = libraryBudReply("explain sm2 spacing formula", s);
    expect(r.rule).toBe("LIBRARY/SM2_ALGORITHM");
    expect(r.fsm).toBe("MATCHED");
  });

  it("answers rating scale queries", () => {
    const r = libraryBudReply("what do the rating buttons mean?", s);
    expect(r.rule).toBe("LIBRARY/RATING_SCALE");
    expect(r.fsm).toBe("MATCHED");
  });

  it("answers margin notes queries", () => {
    const r = libraryBudReply("how should I organize margin notes?", s);
    expect(r.rule).toBe("LIBRARY/NOTE_METHODS");
    expect(r.fsm).toBe("MATCHED");
  });

  it("falls back cleanly", () => {
    const r = libraryBudReply("unrelated query", s);
    expect(r.fsm).toBe("FALLBACK");
    expect(r.rule).toBe("LIBRARY/NO_MATCH");
  });
});

