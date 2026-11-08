import { describe, expect, it } from "vitest";
import { ageOn, isValidDob } from "@/utils/age";

// fixed "today": 7 Nov 2026 (local calendar)
const NOW = new Date(2026, 10, 7);

describe("calendar-date validation", () => {
  it("accepts real dates", () => {
    expect(isValidDob({ d: 29, m: 2, y: 2008 })).toBe(true);   // leap day
    expect(isValidDob({ d: 31, m: 1, y: 2000 })).toBe(true);
    expect(isValidDob({ d: 1, m: 12, y: 2010 })).toBe(true);
  });

  it("rejects impossible dates", () => {
    expect(isValidDob({ d: 31, m: 2, y: 2023 })).toBe(false);  // 31 Feb
    expect(isValidDob({ d: 30, m: 2, y: 2023 })).toBe(false);
    expect(isValidDob({ d: 29, m: 2, y: 2023 })).toBe(false);  // non-leap
    expect(isValidDob({ d: 31, m: 4, y: 2023 })).toBe(false);  // April has 30
    expect(isValidDob({ d: 0, m: 1, y: 2000 })).toBe(false);
    expect(isValidDob({ d: 32, m: 1, y: 2000 })).toBe(false);
    expect(isValidDob({ d: 10, m: 13, y: 2000 })).toBe(false);
    expect(isValidDob({ d: 10, m: 0, y: 2000 })).toBe(false);
  });
});

describe("exact age maths", () => {
  it("counts completed years only", () => {
    expect(ageOn({ d: 7, m: 11, y: 2008 }, NOW)).toBe(18);    // birthday today
    expect(ageOn({ d: 8, m: 11, y: 2008 }, NOW)).toBe(17);    // turns 18 tomorrow
    expect(ageOn({ d: 7, m: 1, y: 2008 }, NOW)).toBe(18);     // birthday passed
  });

  it("the 17→18 boundary is exact, not off by a month", () => {
    // born Dec 2008: on 7 Nov 2026 still 17 — must require parental consent
    expect(ageOn({ d: 1, m: 12, y: 2008 }, NOW)).toBe(17);
    // born Jan 2009: turns 18 in Jan 2027 — still a minor today
    expect(ageOn({ d: 15, m: 1, y: 2009 }, NOW)).toBe(17);
  });

  it("the under-13 boundary is exact", () => {
    // born Dec 2013: turns 13 next month — still under 13 today
    expect(ageOn({ d: 1, m: 12, y: 2013 }, NOW)).toBe(12);
    // born Jan 2014: turns 13 in Jan 2027 — 12 today
    expect(ageOn({ d: 20, m: 1, y: 2014 }, NOW)).toBe(12);
    // born Nov 8 2013: turns 13 tomorrow
    expect(ageOn({ d: 8, m: 11, y: 2013 }, NOW)).toBe(12);
    // born Nov 7 2013: turns 13 today
    expect(ageOn({ d: 7, m: 11, y: 2013 }, NOW)).toBe(13);
  });

  it("rejects impossible dates and future births", () => {
    expect(ageOn({ d: 31, m: 2, y: 2010 }, NOW)).toBeNull();
    expect(ageOn({ d: 1, m: 1, y: 2030 }, NOW)).toBeNull();
  });
});
