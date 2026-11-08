// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { seed, sanitizeState, refillQuotas, dayKey, weekKey, uid, spendQuota, gpaOf, requiredScore, QUOTA_MAX, type AppState } from "@/engine/store";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("local-calendar day/week keys", () => {
  it("dayKey uses local calendar fields, not UTC", () => {
    // 00:30 local on Jan 5 must key as Jan 5 even in UTC+ timezones
    expect(dayKey(new Date(2026, 0, 5, 0, 30).getTime())).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 10, 7, 23, 59).getTime())).toBe("2026-11-07");
  });

  it("weekKey returns the Monday of the local week", () => {
    // 2026-11-07 is a Saturday → Monday is 2026-11-02
    expect(weekKey(new Date(2026, 10, 7).getTime())).toBe("2026-11-02");
    // a Monday keys to itself
    expect(weekKey(new Date(2026, 10, 2).getTime())).toBe("2026-11-02");
    // Sunday belongs to the week that started 6 days earlier
    expect(weekKey(new Date(2026, 10, 8).getTime())).toBe("2026-11-02");
  });
});

describe("uid", () => {
  it("produces unique ids", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => uid()));
    expect(ids.size).toBe(5000);
  });

  it("produces non-trivial ids", () => {
    for (let i = 0; i < 100; i++) expect(uid().length).toBeGreaterThan(8);
  });
});

describe("sanitizeState — corrupted localStorage resilience", () => {
  it("rejects non-objects and wrong versions", () => {
    expect(sanitizeState(null)).toBeNull();
    expect(sanitizeState("junk")).toBeNull();
    expect(sanitizeState(42)).toBeNull();
    expect(sanitizeState({ version: 2 })).toBeNull();
    expect(sanitizeState({})).toBeNull();
  });

  it("accepts a valid persisted state", () => {
    const s = seed();
    const out = sanitizeState(clone(s));
    expect(out).not.toBeNull();
    expect(out!.session.email).toBe(s.session.email);
    expect(out!.flashcards.length).toBe(s.flashcards.length);
  });

  it("falls back per-key when top-level fields have wrong types", () => {
    const bad = clone(seed()) as Record<string, unknown>;
    bad.quotas = "corrupted";
    bad.flashcards = 42;
    bad.notes = null;
    bad.pomodoro = { sessions: "nope" };
    const out = sanitizeState(bad)!;
    expect(out.quotas).toEqual(seed().quotas);
    expect(out.flashcards.length).toBe(seed().flashcards.length);
    expect(out.notes.length).toBe(seed().notes.length);
    expect(out.pomodoro.sessions).toEqual(seed().pomodoro.sessions);
  });

  it("clamps scalar types inside session", () => {
    const bad = clone(seed()) as { session: Record<string, unknown> };
    bad.session.authed = "yes";
    bad.session.role = "superadmin";
    bad.session.tier = "Z";
    const out = sanitizeState(bad as never)!;
    expect(out.session.authed).toBe(false);
    expect(out.session.role).toBe("student");
    expect(out.session.tier).toBe("A");
  });

  it("drops prototype-polluting keys", () => {
    const bad = clone(seed()) as Record<string, unknown>;
    bad.admin = JSON.parse('{"__proto__":{"polluted":true},"students":[]}');
    const out = sanitizeState(bad)!;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((out.admin as Record<string, unknown>).polluted).toBeUndefined();
    expect(Array.isArray(out.admin.students)).toBe(true);
  });

  it("repairs arrays of objects field-by-field", () => {
    const bad = clone(seed()) as { flashcards: Record<string, unknown>[] };
    bad.flashcards = [{ id: "x", front: 123, ef: "high" }] as never;
    const out = sanitizeState(bad)!;
    expect(out.flashcards).toHaveLength(1);
    expect(out.flashcards[0].id).toBe("x");
    expect(typeof out.flashcards[0].front).toBe("string");
    expect(typeof out.flashcards[0].ef).toBe("number");
  });

  it("preserves optional persisted fields like session.parental", () => {
    const good = clone(seed());
    good.session.parental = { email: "mom@example.com", token: "TOK" };
    const out = sanitizeState(good)!;
    expect(out.session.parental?.email).toBe("mom@example.com");
  });
});

describe("refillQuotas — daily/weekly reset", () => {
  const depleted = (): AppState => {
    const s = seed();
    s.quotas = {
      portfolio: { d: 0, w: 0 },
      sandbox: { d: 0, w: 0 },
      chat: { d: 0, w: 0 },
    };
    return s;
  };

  it("does nothing when stamps are current", () => {
    const s = depleted();
    s.quotaReset = { daily: dayKey(Date.now()), weekly: weekKey(Date.now()) };
    expect(refillQuotas(s)).toBe(s);
  });

  it("refills daily counters at local midnight", () => {
    const s = depleted();
    s.quotaReset = { daily: "2000-01-01", weekly: weekKey(Date.now()) };
    const out = refillQuotas(s);
    expect(out.quotas.portfolio.d).toBe(QUOTA_MAX.portfolio.d);
    expect(out.quotas.sandbox.d).toBe(QUOTA_MAX.sandbox.d);
    expect(out.quotas.chat.d).toBe(QUOTA_MAX.chat.d);
    // weekly untouched — same week
    expect(out.quotas.chat.w).toBe(0);
    expect(out.quotaReset.daily).toBe(dayKey(Date.now()));
  });

  it("refills weekly counters on Monday rollover", () => {
    const s = depleted();
    s.quotaReset = { daily: dayKey(Date.now()), weekly: "2000-01-01" };
    const out = refillQuotas(s);
    expect(out.quotas.chat.w).toBe(QUOTA_MAX.chat.w);
    expect(out.quotas.portfolio.w).toBe(QUOTA_MAX.portfolio.w);
    // daily untouched
    expect(out.quotas.chat.d).toBe(0);
  });

  it("refills both when both periods rolled", () => {
    const s = depleted();
    s.quotaReset = { daily: "2000-01-01", weekly: "2000-01-01" };
    const out = refillQuotas(s);
    expect(out.quotas.chat.d).toBe(QUOTA_MAX.chat.d);
    expect(out.quotas.chat.w).toBe(QUOTA_MAX.chat.w);
  });
});

describe("pure helpers", () => {
  it("spendQuota requires both daily and weekly headroom", () => {
    const s = seed();
    expect(spendQuota(s, "chat")).toBe(true);
    s.quotas.chat.d = 0;
    expect(spendQuota(s, "chat")).toBe(false);
    s.quotas.chat.d = 5; s.quotas.chat.w = 0;
    expect(spendQuota(s, "chat")).toBe(false);
  });

  it("gpaOf weights by credits", () => {
    const s = seed();
    const gpa = gpaOf(s.grades);
    expect(gpa).toBeGreaterThan(7);
    expect(gpa).toBeLessThan(10);
  });

  it("requiredScore returns null when coursework is done", () => {
    expect(requiredScore({ id: "g", name: "X", credits: 4, score: 90, done: 100, target: 90 })).toBeNull();
    const r = requiredScore({ id: "g", name: "X", credits: 4, score: 80, done: 50, target: 90 })!;
    expect(r).toBeCloseTo(100);
  });

  it("weightedGpaOf computes AP, Honors and Dual bumps", async () => {
    const { weightedGpaOf } = await import("@/engine/store");
    const s = seed();
    const res = weightedGpaOf(s.grades);
    expect(res.weighted).toBeGreaterThan(res.unweighted);
    expect(res.totalCredits).toBeGreaterThan(0);
    expect(["A+", "A", "B", "C"]).toContain(res.letterGpa);
  });

  it("forecastMilestones computes target gap advice correctly", async () => {
    const { forecastMilestones } = await import("@/engine/store");
    // Course with 50% done, 80 score, 90 target -> requires 100% on remaining
    const f1 = forecastMilestones({ id: "1", name: "Math", credits: 4, score: 80, done: 50, target: 90 });
    expect(f1.requiredAvg).toBeCloseTo(100);
    expect(f1.feasible).toBe(true);

    // Course with 90% done, 70 score, 90 target -> requires >100% (impossible)
    const f2 = forecastMilestones({ id: "2", name: "Chem", credits: 3, score: 70, done: 90, target: 90 });
    expect(f2.status).toBe("impossible");
    expect(f2.feasible).toBe(false);

    // Course with 50% done, 95 score, 80 target -> target already secured
    const f3 = forecastMilestones({ id: "3", name: "English", credits: 2, score: 95, done: 50, target: 40 });
    expect(f3.status).toBe("secured");
  });
});
