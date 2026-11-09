// @vitest-environment jsdom
import { describe, expect, it, beforeEach, beforeAll, afterAll } from "vitest";
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
const origError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && (args[0].includes("was not wrapped in act(...)") || args[0].includes("pingSuspendedRoot"))) return;
    origError(...args);
  };
  window.scrollTo = () => {};
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

afterAll(async () => {
  await act(async () => {
    await new Promise(r => setTimeout(r, 150));
  });
  console.error = origError;
});

const LS_KEY = "academia-state-v3";
let root: Root | null = null;
let host: HTMLDivElement;

async function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    root = createRoot(host);
    root!.render(<App />);
  });
}
async function unmount() {
  await act(async () => {
    root?.unmount();
  });
  host?.remove();
  root = null;
}
async function setHash(h: string) {
  await act(async () => {
    window.location.hash = h;
  });
}
function text() { return host.textContent ?? ""; }

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "";
});

const STUDENT_ROUTES = ["/dashboard", "/library", "/media", "/portfolio", "/sandbox", "/locker", "/catalyst", "/scratchpad", "/inventory", "/announcements", "/numera", "/tally", "/pomodoro", "/adoro", "/workbench", "/community", "/atlas", "/tutor"];
const ADMIN_ROUTES = ["/admin/console", "/admin/dashboard", "/admin/students"];

function persistState(mutate: (s: ReturnType<typeof seed>) => void) {
  const s = seed();
  mutate(s);
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

describe("route smoke — signed out", () => {
  it("renders the landing page at /", async () => {
    await mount();
    expect(text()).toContain("Academia");
    await unmount();
  });

  it("renders auth at /auth", async () => {
    await setHash("/auth");
    await mount();
    expect(text()).toMatch(/Sign In|Sign Up/);
    await unmount();
  });

  it("guards app routes to /auth when signed out", async () => {
    persistState(s => { s.session.authed = false; });
    await setHash("/dashboard");
    await mount();
    expect(text()).toMatch(/Sign In|Sign Up/);
    await unmount();
  });

  it("renders banned status for banned sessions", async () => {
    persistState(s => { s.session.authed = true; s.session.status = "BAN"; });
    await setHash("/dashboard");
    await mount();
    expect(text().toLowerCase()).toMatch(/banned|locked|appeal/);
    await unmount();
  });
});

async function waitForView() {
  for (let i = 0; i < 30; i++) {
    await act(async () => {
      await new Promise(r => setTimeout(r, 20));
    });
    const canvas = host.querySelector("#main-canvas");
    if (canvas && !host.querySelector("[aria-label='Loading view...']")) {
      break;
    }
  }
}

describe("route smoke — student", () => {
  beforeEach(() => persistState(s => { s.session.authed = true; s.session.role = "student"; }));

  for (const route of STUDENT_ROUTES) {
    it(`mounts and fully renders ${route} without crashing`, async () => {
      await setHash(route);
      await mount();
      await waitForView();
      const canvas = host.querySelector("#main-canvas");
      expect(canvas).toBeTruthy();
      expect(canvas!.textContent?.trim().length).toBeGreaterThan(0);
      await unmount();
    });
  }

  it("evicts admin routes away from unverified students with session liquidation", async () => {
    persistState(s => { s.session.authed = true; s.session.role = "student"; });
    await setHash("/admin/dashboard");
    await mount();
    expect(window.location.hash).not.toContain("/admin");
    await unmount();
  });
});

describe("route smoke — admin", () => {
  beforeEach(() => persistState(s => {
    s.session.authed = true;
    s.session.role = "admin";
    s.session.tokenClaims = { role: "academia_admin" };
  }));

  for (const route of ADMIN_ROUTES) {
    it(`mounts and fully renders ${route} without crashing`, async () => {
      await setHash(route);
      await mount();
      await waitForView();
      const canvas = host.querySelector("#main-canvas");
      expect(canvas).toBeTruthy();
      expect(canvas!.textContent?.trim().length).toBeGreaterThan(0);
      await unmount();
    });
  }
});
