// @vitest-environment jsdom
/* Stronger route test. The original smoke test only checks that the SHELL (#main-canvas) exists; since views became
   React.lazy that is just the loading skeleton, so a view that throws on mount still passed (coverage showed
   community/locker/sandbox/dashboard/students at 0%). This waits for each lazy view and asserts it really rendered. */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "@/App";
import { seed } from "@/engine/store";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const mem = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null), setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; } } });

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, p) => (p === "getImageData" ? () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }) : p === "canvas" ? null : p === "measureText" ? () => ({ width: 8 }) : () => undefined), set: () => true });
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
  window.scrollTo = (() => undefined) as never; Element.prototype.scrollTo = (() => undefined) as never;
  (globalThis as Record<string, unknown>).ResizeObserver ??= class { observe() { } unobserve() { } disconnect() { } };
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; mem.clear(); });

const STUDENT = ["/dashboard", "/library", "/tutor", "/media", "/portfolio", "/sandbox", "/locker", "/catalyst", "/scratchpad", "/inventory", "/announcements", "/numera", "/tally", "/pomodoro", "/adoro", "/workbench", "/community", "/atlas"];
const ADMIN = ["/admin/dashboard", "/admin/students"];

async function open(route: string, role: "student" | "admin") {
  const s = seed(); s.session.authed = true; s.session.role = role; s.session.stage = "ready"; s.session.status = "ACTIVE"; s.cookies = { decided: true, media: false };
  if (role === "admin") s.session.tokenClaims = { role: "academia_admin" };
  mem.set("academia-state-v3", JSON.stringify(s));
  window.location.hash = route;
  const el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
  await act(async () => { root!.render(<App />); });
  for (let i = 0; i < 150 && !el.querySelector("#main-canvas h1"); i++) await act(async () => { await new Promise(r => setTimeout(r, 20)); });
  return el;
}

describe("every route's VIEW actually renders (not just the shell)", () => {
  for (const r of STUDENT) it(`student ${r}`, async () => {
    const el = await open(r, "student");
    const h1 = el.querySelector("#main-canvas h1");
    expect(h1, "view never rendered its header (stuck on skeleton or crashed)").toBeTruthy();
    expect(h1!.textContent!.trim().length).toBeGreaterThan(1);
    expect(el.textContent).not.toContain("Something broke while rendering");
    expect(el.querySelector("#main-canvas .animate-pulse")).toBeNull();     // skeleton is gone
  });
  for (const r of ADMIN) it(`admin ${r}`, async () => {
    const el = await open(r, "admin");
    expect(el.querySelector("#main-canvas h1")).toBeTruthy();
    expect(el.textContent).not.toContain("Something broke while rendering");
  });
});
