// @vitest-environment jsdom
import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "@/App";
import { seed } from "@/engine/store";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/* Node 25 ships a partial built-in localStorage that shadows jsdom's —
   install a deterministic in-memory Storage for the whole file. */
const mem = new Map<string, string>();
const memStorage: Storage = {
  getItem: k => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k, v) => void mem.set(k, String(v)),
  removeItem: k => void mem.delete(k),
  clear: () => mem.clear(),
  key: i => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
Object.defineProperty(globalThis, "localStorage", { value: memStorage, configurable: true });

/* jsdom has no canvas implementation — stub a no-op 2D context so views
   that paint on mount (Scratchpad, Numera graph) render their DOM. */
beforeAll(() => {
  const ctx2d = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === "getImageData") return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      if (prop === "canvas") return null;
      return () => undefined;
    },
    set: () => true,
  });
  HTMLCanvasElement.prototype.getContext = function () { return ctx2d as never; };
});

const LS_KEY = "academia-state-v3";
let root: Root | null = null;
let host: HTMLDivElement;

function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => { root = createRoot(host); root!.render(<App />); });
}
function unmount() {
  act(() => root?.unmount());
  host?.remove();
  root = null;
}
function setHash(h: string) {
  act(() => { window.location.hash = h; });
}
function text() { return host.textContent ?? ""; }

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "";
});

const STUDENT_ROUTES = ["/dashboard", "/library", "/media", "/portfolio", "/sandbox", "/locker", "/catalyst", "/scratchpad", "/inventory", "/announcements", "/numera", "/tally", "/pomodoro", "/adoro", "/workbench", "/community", "/atlas"];
const ADMIN_ROUTES = ["/admin/dashboard", "/admin/students"];

function persistState(mutate: (s: ReturnType<typeof seed>) => void) {
  const s = seed();
  mutate(s);
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

describe("route smoke — signed out", () => {
  it("renders the landing page at /", () => {
    mount();
    expect(text()).toContain("Academia");
    unmount();
  });

  it("renders auth at /auth", () => {
    setHash("/auth");
    mount();
    expect(text()).toMatch(/Sign In|Sign Up/);
    unmount();
  });

  it("guards app routes to /auth when signed out", () => {
    persistState(s => { s.session.authed = false; });
    setHash("/dashboard");
    mount();
    expect(text()).toMatch(/Sign In|Sign Up/);
    unmount();
  });

  it("renders banned status for banned sessions", () => {
    persistState(s => { s.session.authed = true; s.session.status = "BAN"; });
    setHash("/dashboard");
    mount();
    expect(text().toLowerCase()).toMatch(/banned|locked|appeal/);
    unmount();
  });
});

describe("route smoke — student", () => {
  beforeEach(() => persistState(s => { s.session.authed = true; s.session.role = "student"; }));

  for (const route of STUDENT_ROUTES) {
    it(`mounts ${route} without crashing`, () => {
      setHash(route);
      mount();
      expect(host.querySelector("#main-canvas")).toBeTruthy();
      unmount();
    });
  }

  it("redirects admin routes away from students", () => {
    persistState(s => { s.session.authed = true; s.session.role = "student"; });
    setHash("/admin/dashboard");
    mount();
    expect(host.querySelector("#main-canvas")).toBeTruthy();
    expect(window.location.hash).not.toContain("/admin");
    unmount();
  });
});

describe("route smoke — admin", () => {
  beforeEach(() => persistState(s => { s.session.authed = true; s.session.role = "admin"; }));

  for (const route of ADMIN_ROUTES) {
    it(`mounts ${route} without crashing`, () => {
      setHash(route);
      mount();
      expect(host.querySelector("#main-canvas")).toBeTruthy();
      unmount();
    });
  }
});
