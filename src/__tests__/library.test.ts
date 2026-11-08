/* Academia · library.test.ts
   Unit tests for:
   1. SM-2 scheduler invariants over 10k random grade sequences
   2. Cloze parser edge cases and sibling ID scheme
   3. Review analytics, review log, and leech detector
   4. CSV & JSON import/export with formula injection defense and prototype pollution guard
*/

import { describe, it, expect } from "vitest";
import { sm2 } from "@/engine/rules";
import {
  parseCloze,
  syncClozeSiblings,
  makeSiblingId,
  isClozeSibling,
  getParentId,
} from "@/engine/cloze";
import {
  computeDeckAnalytics,
  detectLeeches,
  forecastDueCards,
} from "@/engine/library-analytics";
import {
  exportDeckToCSV,
  importDeckFromCSV,
  importDeckFromJSON,
} from "@/engine/library-io";
import type { Flashcard, ReviewLogEntry } from "@/engine/store";

const createCard = (over: Partial<Flashcard> = {}): Flashcard => ({
  id: "test-card",
  front: "Front",
  back: "Back",
  deck: "Test Deck",
  ef: 2.5,
  interval: 1,
  reps: 1,
  due: Date.now(),
  lapses: 0,
  history: [],
  ...over,
});

// ── 1. SM-2 Scheduler Invariants (10k randomized runs) ────────────────────────
describe("SM-2 Invariants (10k randomized sequences)", () => {
  it("never lets EF drop below 1.3 across 10,000 random grade sequences", () => {
    let card = createCard({ ef: 2.5, reps: 0, interval: 0 });
    for (let i = 0; i < 10_000; i++) {
      const grade = Math.floor(Math.sin(i * 997 + 13) * 3 + 3); // 0..5
      const clampedGrade = Math.max(0, Math.min(5, grade));
      card = sm2(card, clampedGrade, 100000);
      expect(card.ef).toBeGreaterThanOrEqual(1.3);
    }
  });

  it("ensures intervals grow monotonically on successful reviews (grades 3-5)", () => {
    let card = createCard({ ef: 2.5, reps: 2, interval: 6 });
    for (let i = 0; i < 50; i++) {
      const prevInterval = card.interval;
      const grade = 3 + (i % 3); // 3, 4, 5
      card = sm2(card, grade, 100000);
      expect(card.interval).toBeGreaterThanOrEqual(prevInterval);
    }
  });

  it("resets interval to 1 on lapse while preserving EF exactly", () => {
    const origEf = 2.45;
    let card = createCard({ ef: origEf, reps: 5, interval: 30 });
    card = sm2(card, 1);
    expect(card.reps).toBe(0);
    expect(card.interval).toBe(1);
    expect(card.ef).toBe(origEf);
  });
});

// ── 2. Cloze Parser Edge Cases & Sibling Management ───────────────────────────
describe("Cloze Parser & Sibling Resync", () => {
  it("parses single cloze deletion", () => {
    const text = "The capital of France is {{c1::Paris}}.";
    const clozes = parseCloze(text);
    expect(clozes).toHaveLength(1);
    expect(clozes[0]).toEqual({ index: 1, answer: "Paris", hint: undefined });
  });

  it("parses cloze deletion with hint", () => {
    const text = "{{c1::Mitochondria::organelle}} is the powerhouse of the cell.";
    const clozes = parseCloze(text);
    expect(clozes).toHaveLength(1);
    expect(clozes[0]).toEqual({ index: 1, answer: "Mitochondria", hint: "organelle" });
  });

  it("handles sibling id scheme <parentId>#c<idx>", () => {
    const parentId = "card-123";
    const siblingId = makeSiblingId(parentId, 2);
    expect(siblingId).toBe("card-123#c2");
    expect(isClozeSibling(siblingId)).toBe(true);
    expect(getParentId(siblingId)).toBe("card-123");
  });

  it("resyncs siblings keeping scheduling for existing cloze indices", () => {
    const parentId = "card-template";
    const oldText = "{{c1::Red}} and {{c2::Blue}}";
    const existing = syncClozeSiblings(parentId, oldText, "Art", undefined, []);
    expect(existing).toHaveLength(2);

    // Simulate review on c1
    existing[0].interval = 14;
    existing[0].reps = 3;

    // Edit template: c1 kept, c2 removed, c3 added
    const newText = "{{c1::Red}} and {{c3::Green}}";
    const resynced = syncClozeSiblings(parentId, newText, "Art", undefined, existing);

    expect(resynced).toHaveLength(2);
    // c1 preserved interval
    const c1 = resynced.find(c => c.clozeIdx === 1);
    expect(c1?.interval).toBe(14);
    expect(c1?.reps).toBe(3);

    // c3 is fresh
    const c3 = resynced.find(c => c.clozeIdx === 3);
    expect(c3?.interval).toBe(0);
    expect(c3?.reps).toBe(0);
  });
});

// ── 3. Review Analytics, Review Log & Leech Detector ──────────────────────────
describe("Library Analytics & Leech Engine", () => {
  const sampleCards: Flashcard[] = [
    createCard({ id: "1", deck: "Math", ef: 2.6, lapses: 0, history: [4, 5, 4] }),
    createCard({ id: "2", deck: "Math", ef: 2.2, lapses: 1, history: [2, 3, 4] }),
    createCard({ id: "3", deck: "Physics", ef: 1.4, lapses: 5, history: [1, 1, 2, 1, 1] }),
  ];

  it("computes retention rate from reviewLog ring buffer", () => {
    const now = Date.now();
    const reviewLog: ReviewLogEntry[] = [
      { cardId: "1", q: 5, ts: now, wasNew: true },
      { cardId: "2", q: 4, ts: now, wasNew: false },
      { cardId: "3", q: 1, ts: now, wasNew: false },
      { cardId: "3", q: 2, ts: now, wasNew: false },
    ];
    const analytics = computeDeckAnalytics(sampleCards, reviewLog, now);
    // 2 out of 4 successful (>=3) = 50%
    expect(analytics.retentionRate).toBe(0.5);
    expect(analytics.todayReviews).toBe(4);
    expect(analytics.todayNew).toBe(1);
  });

  it("detects leeches (lapses >= 4) with rule-traced reason", () => {
    const leeches = detectLeeches(sampleCards);
    expect(leeches).toHaveLength(1);
    expect(leeches[0].card.id).toBe("3");
    expect(leeches[0].ruleId).toBe("LEECH/LAPSE_GTE_4");
    expect(leeches[0].suggestion).toContain("Break into smaller cloze cards");
  });

  it("forecasts cards due over next 14 days", () => {
    const now = Date.now();
    const day = 86400000;
    const cards = [
      createCard({ due: now }),
      createCard({ due: now + day }),
      createCard({ due: now + 3 * day }),
    ];
    const forecast = forecastDueCards(cards, now);
    expect(forecast).toHaveLength(14);
    expect(forecast[0].count).toBe(1); // today
    expect(forecast[1].count).toBe(1); // tomorrow
  });
});

// ── 4. CSV & JSON Import/Export ───────────────────────────────────────────────
describe("Deck Import / Export (CSV & JSON)", () => {
  it("neutralizes formula injection on CSV export", () => {
    const cards: Flashcard[] = [
      createCard({ id: "vuln-1", front: "=cmd|' /C calc'!A0", back: "+SUM(1,2)", deck: "-Admin" }),
    ];
    const csv = exportDeckToCSV(cards);
    expect(csv).toContain("\"'=cmd");
    expect(csv).toContain("\"'+SUM");
    expect(csv).toContain("\"'-Admin");
  });

  it("sanitizes CSV import and enforces bounds", () => {
    const rawCsv = `ID,Front,Back,Deck,EF,Interval,Reps,Due
c1,"Hello","World","General",9.9,99999,99999,1000`;
    const cards = importDeckFromCSV(rawCsv);
    expect(cards).toHaveLength(1);
    expect(cards[0].ef).toBeLessThanOrEqual(4.0); // clamped
    expect(cards[0].ef).toBeGreaterThanOrEqual(1.3);
  });

  it("protects against prototype pollution in JSON import", () => {
    const maliciousJson = `[
      {
        "id": "c1",
        "front": "Safe Front",
        "back": "Safe Back",
        "__proto__": { "polluted": true },
        "constructor": { "prototype": { "polluted": true } }
      }
    ]`;
    const cards = importDeckFromJSON(maliciousJson);
    expect(cards).toHaveLength(1);
    expect((cards[0] as unknown as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
