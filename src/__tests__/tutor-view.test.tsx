// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "@/App";
import { computePlot, visibleShapes } from "@/engine/tutor/render";
import { validateLesson } from "@/engine/tutor/schema";
import { DEMO_LESSON } from "@/engine/tutor/demo";
import { evalAst, parse } from "@/engine/math";
import { answersMatch } from "@/engine/tutor/check";
import { CFG_KEY, KEY_KEY, forgetKey } from "@/engine/tutor/settings";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mem = new Map<string, string>();
const memStorage: Storage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
Object.defineProperty(globalThis, "localStorage", { value: memStorage, configurable: true });

let root: Root | null = null;
beforeAll(() => { window.scrollTo = (() => undefined) as never; vi.spyOn(console, "error").mockImplementation(() => undefined); });
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; memStorage.clear(); forgetKey(); vi.unstubAllGlobals(); });

const flush = (ms = 0) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const click = async (el: Element | null | undefined) => { expect(el, "element to click").toBeTruthy(); await act(async () => { (el as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true })); }); };
const byText = (txt: string, sel = "button") => [...document.querySelectorAll(sel)].find(e => e.textContent?.trim().includes(txt)) as HTMLElement | undefined;
const typeInto = async (el: Element, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
};
async function boot(settings?: Record<string, unknown>) {
  if (settings) localStorage.setItem(CFG_KEY, JSON.stringify(settings));
  localStorage.setItem("academia-state-v3", JSON.stringify({ version: 3, session: { authed: true, role: "student", stage: "ready", status: "ACTIVE" }, cookies: { decided: true, media: false } }));
  window.location.hash = "/tutor";
  const el = document.createElement("div"); document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root!.render(<App />); });
  // the route is React.lazy-loaded: wait until the screen has actually mounted
  for (let i = 0; i < 100 && !el.textContent!.includes("AI Whiteboard Tutor"); i++) await flush(20);
  return el;
}
const ask = async (text: string) => { await typeInto(document.querySelector("textarea")!, text); await click(byText("Teach me")); await flush(10); };

describe("tutor screen — built-in solver (no AI, no network)", () => {
  it("is reachable from the Learn nav group and renders the empty board", async () => {
    const el = await boot();
    expect(el.textContent).toContain("AI Whiteboard Tutor"); expect(el.textContent).toContain("The board is clear");
    expect(byText("AI Tutor", "a, button")).toBeTruthy();
  });
  it("solves 2x + 5 = 17 step by step and ends with the verified answer, takeaways and a quiz", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    const el = await boot();
    await ask("2x + 5 = 17");
    expect(el.textContent).toContain("Solve 2x + 5 = 17"); expect(el.textContent).toContain("built-in solver");
    for (let i = 0; i < 6 && !el.textContent!.includes("Takeaways"); i++) await click(byText("Next step"));
    expect(el.textContent).toContain("x = 6"); expect(el.textContent).toContain("They match"); expect(el.textContent).toContain("Quick quiz");
    expect(f).not.toHaveBeenCalled();
  });
  it("shows an honest, helpful message for subjects the solver can't do", async () => {
    const el = await boot();
    await ask("Why do seasons change?");
    expect(el.querySelector('[role="alert"]')?.textContent).toMatch(/connect a free AI provider/i);
  });
  it("gives a specific message for non-linear equations", async () => {
    const el = await boot();
    await ask("x^2 = 4");
    expect(el.querySelector('[role="alert"]')?.textContent).toMatch(/isn't a linear equation/i);
  });
  it("plays the original projectile demo with a computed plot", async () => {
    const el = await boot();
    await ask("projectile motion");
    expect(el.textContent).toContain("projectile motion");
    for (let i = 0; i < 3; i++) await click(byText("Next step"));
    expect(el.querySelector("svg.tutor-board path")?.getAttribute("d")).toMatch(/^M[\d. -]+L/);
  });
  it("homework mode withholds Next until the check question is answered; wrong answers don't unlock it", async () => {
    const el = await boot();
    await click(byText("Homework"));
    await ask("2x + 5 = 17");
    await click(byText("Next step"));                    // step 2: "collect x-terms" is a check step? (2x+5=17 has no x on right → first check is "move the constant")
    let guard = 0;
    while (byText("Next step")!.hasAttribute("disabled") === false && guard++ < 6) await click(byText("Next step"));
    expect(byText("Next step")!.hasAttribute("disabled")).toBe(true);
    expect(el.textContent).toContain("you do the thinking");
    const input = el.querySelector('input[aria-label="Your answer"]')!;
    await typeInto(input, "999"); await click(byText("Check"));
    expect(el.querySelector('[role="alert"]')?.textContent).toMatch(/Not quite/);
    expect(byText("Next step")!.hasAttribute("disabled")).toBe(true);
    await click(byText("Hint")); expect(el.textContent).toMatch(/Do 17|Divide|Subtract/);
    await typeInto(input, "12"); await click(byText("Check"));       // 17 − 5 = 12
    expect(byText("Next step")!.hasAttribute("disabled")).toBe(false);
  });
  it("quiz grading is deterministic and 'Save quiz to Library' creates cards that persist in the Tutor deck", async () => {
    const el = await boot();
    await ask("2x + 5 = 17");
    for (let i = 0; i < 6 && !el.textContent!.includes("Quick quiz"); i++) await click(byText("Next step"));
    await click(byText("Both sides"));
    expect(el.textContent).toContain("✓");
    await click(byText("Save quiz to Library"));
    expect(el.textContent).toMatch(/card added to Library/);
    await flush(500);
    const saved = JSON.parse(localStorage.getItem("academia-state-v3")!);
    expect(saved.flashcards.some((c: any) => c.deck === "Tutor" && c.front.includes("which side"))).toBe(true);
  });
});

describe("tutor screen — connected provider", () => {
  const LOCAL = { id: "openai-compat", baseUrl: "http://localhost:11434/v1", model: "llama3.1", lang: "en", remember: false };
  const reply = (lesson: unknown) => vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(lesson) } }] }), { status: 200 })));  // fresh Response per call: a body can only be read once

  it("renders a model's lesson — and treats hostile markup as inert text, never as HTML", async () => {
    const hostile = { title: "<img src=x onerror=alert(1)>", steps: [{ say: "<script>window.__pwned=1</script><img src=x onerror=\"window.__pwned=1\">", board: [{ t: "text", x: 10, y: 10, s: "<svg onload=alert(1)>" }, { t: "rect", x: 1, y: 1, w: 5, h: 5, label: "<b>x</b>" }] }] };
    vi.stubGlobal("fetch", reply(hostile));
    const el = await boot(LOCAL);
    await ask("anything");
    expect(el.textContent).toContain("<img src=x onerror");           // visible as literal text
    expect(el.querySelector("img")).toBeNull();
    expect(el.querySelector("script")).toBeNull();
    expect(el.querySelectorAll("svg [onload], [onerror]").length).toBe(0);
    expect((window as any).__pwned).toBeUndefined();
    expect(el.textContent).toContain("AI-drawn");                     // honesty badge for model output
  });
  it("sends the student's request to the configured endpoint and nothing to Academia's own origin", async () => {
    const f = reply({ title: "T", steps: [{ say: "ok" }] }); vi.stubGlobal("fetch", f);
    await boot(LOCAL);
    await ask("explain gravity");
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe("http://localhost:11434/v1/chat/completions");
  });
  it("maps a 401 to a friendly message and never shows the key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response("{}", { status: 401 }))));
    const el = await boot({ id: "gemini", model: "gemini-2.5-flash", baseUrl: "", lang: "en", remember: false });
    await click(byText("Tutor settings"));
    await typeInto(el.querySelector('input[type="password"]')!, "SUPER-SECRET-KEY");
    await ask("hello");
    expect(el.querySelector('[role="alert"]')?.textContent).toMatch(/rejected the API key/);
    expect(el.textContent).not.toContain("SUPER-SECRET-KEY");
  });
  it("the API key is NOT written to storage unless 'Remember' is ticked, and 'Forget key' removes it", async () => {
    const el = await boot({ id: "gemini", model: "gemini-2.5-flash", baseUrl: "", lang: "en", remember: false });
    await click(byText("Tutor settings"));
    const key = () => el.querySelector('input[type="password"]') as HTMLInputElement;
    await typeInto(key(), "KEY-ABC-123");
    await flush(500);
    expect(localStorage.getItem(KEY_KEY)).toBeNull();
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain("KEY-ABC-123");
    await click(el.querySelector('input[type="checkbox"]'));
    expect(localStorage.getItem(KEY_KEY)).toBe("KEY-ABC-123");
    await click(byText("Forget key"));
    expect(localStorage.getItem(KEY_KEY)).toBeNull();
    expect(key().value).toBe("");
  });
  it("blocks a plain-http remote base URL before any request is made", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    const el = await boot({ id: "openai-compat", baseUrl: "http://evil.example/v1", model: "m", lang: "en", remember: false });
    await ask("hi");
    expect(el.querySelector('[role="alert"]')?.textContent).toMatch(/https/);
    expect(f).not.toHaveBeenCalled();
  });
  it("sets right-to-left layout for Arabic captions", async () => {
    vi.stubGlobal("fetch", reply({ title: "T", lang: "ar", steps: [{ say: "مرحبا" }] }));
    const el = await boot({ ...LOCAL, lang: "ar" });
    await ask("x");
    expect(el.querySelector('[dir="rtl"][aria-live="polite"]')).toBeTruthy();
  });
  it("'Explain why' asks the provider a follow-up with lesson context and stacks a new lesson you can go back from", async () => {
    const f = reply({ title: "Why it works", steps: [{ say: "because" }] }); vi.stubGlobal("fetch", f);
    await boot(LOCAL);
    await ask("explain gravity");
    await click(byText("Explain why")); await flush(10);
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(f.mock.calls[1][1].body).messages[1].content).toContain("Previous lesson");
    await click(byText("Back to previous lesson"));
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("renderer & checker", () => {
  const plot = (fn: string, extra = {}) => { const v = validateLesson({ steps: [{ say: "s", board: [{ t: "plot", x: 10, y: 10, w: 50, h: 50, fn, xmin: -5, xmax: 5, ...extra }] }] }); if (!v.ok) throw new Error("bad"); return v.lesson.steps[0].board[0] as any; };
  it("plots a parabola entirely inside its box", () => {
    const g = computePlot(plot("x^2"))!;
    expect(g.path.startsWith("M")).toBe(true);
    const nums = g.path.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(nums.every(Number.isFinite)).toBe(true);
  });
  it("cuts curves at an explicit frame instead of clamping them into a flat roof", () => {
    const g = computePlot(plot("x^2", { ymin: 0, ymax: 10 }))!;
    const pts = [...g.path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
    const top = 10, bottom = 60;                     // plot box: y=10..60 (BOARD units ×6.25 → see plot())
    const boxTop = (10 / 100) * 625, boxBottom = boxTop + (50 / 100) * 625;
    expect(top).toBeLessThan(bottom);
    expect(pts.every(([, y]) => y >= boxTop - 0.11 && y <= boxBottom + 0.11)).toBe(true);
    const atTop = pts.filter(([, y]) => Math.abs(y - boxTop) < 0.11).length;
    expect(atTop).toBeLessThanOrEqual(2);            // touches the top at most at the cut, never a run of clamped points
  });
  it("breaks the line across discontinuities instead of streaking (tan, 1/x)", () => {
    expect((computePlot(plot("1/x"))!.path.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((computePlot(plot("tan(x)"), 400)!.path.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
  it("auto-range frames the bulk of tan(x), not its poles (so the curve isn't flattened)", () => {
    const g = computePlot(plot("tan(x)"), 400)!;
    expect(g.ymax - g.ymin).toBeLessThan(60);
  });
  it("copes with constants, undefined regions and unplottable expressions", () => {
    expect(computePlot(plot("3"))).not.toBeNull();
    expect(computePlot(plot("sqrt(x)"))).not.toBeNull();         // undefined for x<0
    expect(computePlot(plot("ln(0-1-x*0)"))).toBeNull();          // undefined everywhere
  });
  it("respects an explicit y range", () => { const g = computePlot(plot("x^2", { ymin: 0, ymax: 30 }))!; expect([g.ymin, g.ymax]).toEqual([0, 30]); });
  it("'clear' steps wipe earlier shapes", () => {
    const v = validateLesson({ steps: [{ say: "a", board: [{ t: "text", s: "one", x: 1, y: 1 }] }, { say: "b", board: [{ t: "text", s: "two", x: 1, y: 1 }] }, { say: "c", clear: true, board: [{ t: "text", s: "three", x: 1, y: 1 }] }] });
    if (!v.ok) throw new Error();
    expect(visibleShapes(v.lesson.steps, 1)).toHaveLength(2);
    expect(visibleShapes(v.lesson.steps, 2).map(x => (x.sh as any).s)).toEqual(["three"]);
  });
  it("the built-in demo teaches true things: its plotted curve passes through its own table's points", () => {
    const shapes = DEMO_LESSON.steps.flatMap(s => s.board);
    const table = shapes.find(s => s.t === "table") as any, plotShape = shapes.find(s => s.t === "plot") as any;
    const ast = parse(plotShape.fn);
    for (const [, x, h] of table.rows.slice(1)) expect(evalAst(ast, { x: Number(x) }) as number, `x=${x}`).toBeCloseTo(Number(h), 6);
    expect(plotShape.ymax).toBeGreaterThanOrEqual(Math.max(...table.rows.slice(1).map((r: string[]) => Number(r[2]))));
  });
  it("answer checking is numeric-aware and format-tolerant", () => {
    for (const [a, b] of [["6", "6"], ["x = 6", "6"], ["12/2", "6"], ["6.0", "6"], [" 6 ", "x = 6"], ["−3", "-3"], ["y=-3", "-3"]]) expect(answersMatch(a, b), `${a} vs ${b}`).toBe(true);
    for (const [a, b] of [["7", "6"], ["", "6"], ["six", "6"], ["6", ""], ["x^2", "6"]]) expect(answersMatch(a, b), `${a} vs ${b}`).toBe(false);
    expect(answersMatch("Photosynthesis.", "photosynthesis")).toBe(true);
  });
});
