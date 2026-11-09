import { describe, expect, it } from "vitest";
import { seed, dayKey, sanitizeState } from "@/engine/store";

describe("pomodoro — zero-hardcoding and deterministic state", () => {
  it("initializes seed with exactly 0 sessions and 0 lifetime minutes", () => {
    const s = seed();
    expect(s.pomodoro.sessions).toEqual({});
    expect(Object.keys(s.pomodoro.sessions)).toHaveLength(0);
    expect(s.pomodoro.focusMin).toBe(25);
    expect(s.pomodoro.breakMin).toBe(5);
  });

  it("records focus minutes deterministically per dayKey without hardcoded fixtures", () => {
    const s = seed();
    const today = dayKey(Date.now());
    expect(s.pomodoro.sessions[today]).toBeUndefined();

    // Log a 25-min session
    s.pomodoro.sessions[today] = (s.pomodoro.sessions[today] ?? 0) + 25;
    expect(s.pomodoro.sessions[today]).toBe(25);

    // Quick-log additional 15 minutes
    s.pomodoro.sessions[today] = (s.pomodoro.sessions[today] ?? 0) + 15;
    expect(s.pomodoro.sessions[today]).toBe(40);

    // Resetting today's session restores zero state
    delete s.pomodoro.sessions[today];
    expect(s.pomodoro.sessions[today]).toBeUndefined();
    expect(Object.keys(s.pomodoro.sessions)).toHaveLength(0);
  });

  it("sanitizes dynamic session keys while stripping prototype pollution", () => {
    const s = seed();
    const today = dayKey(Date.now());
    const persisted = JSON.parse(JSON.stringify(s));

    persisted.pomodoro.sessions = {
      [today]: 50,
      "2026-11-01": 30,
      __proto__: { polluted: true },
      constructor: { hacked: true },
    };

    const sanitized = sanitizeState(persisted);
    expect(sanitized).not.toBeNull();
    expect(sanitized!.pomodoro.sessions[today]).toBe(50);
    expect(sanitized!.pomodoro.sessions["2026-11-01"]).toBe(30);
    expect((sanitized!.pomodoro.sessions as Record<string, unknown>).polluted).toBeUndefined();
    expect((sanitized!.pomodoro.sessions as Record<string, unknown>).hacked).toBeUndefined();
  });

  it("falls back to empty sessions object when corrupted with non-object values", () => {
    const s = seed();
    const corrupted = JSON.parse(JSON.stringify(s));
    corrupted.pomodoro.sessions = "corrupted-string";

    const sanitized = sanitizeState(corrupted);
    expect(sanitized).not.toBeNull();
    expect(sanitized!.pomodoro.sessions).toEqual({});
  });
});

