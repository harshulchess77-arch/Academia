/* Academia · AI Whiteboard Tutor — lesson format.
   A "lesson" is DATA, never code: a bounded list of steps, each with a spoken/caption line and a few board
   shapes. Whatever produces it (the built-in solver or any language model) must pass validateLesson(),
   so the renderer only ever sees clamped numbers, capped strings and allow-listed shape types. */
import { parse } from "@/engine/math";

export const BOARD_W = 1000;
export const BOARD_H = 625;

export type Color = "ink" | "cobalt" | "vermillion" | "forest" | "marigold";
const COLORS: Color[] = ["ink", "cobalt", "vermillion", "forest", "marigold"];

export type Shape =
  | { t: "text"; x: number; y: number; s: string; size: number; color: Color; anchor: "start" | "middle" | "end" }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; color: Color; dashed: boolean }
  | { t: "arrow"; x1: number; y1: number; x2: number; y2: number; color: Color; dashed: boolean }
  | { t: "rect"; x: number; y: number; w: number; h: number; color: Color; fill: boolean; label: string }
  | { t: "circle"; x: number; y: number; r: number; color: Color; fill: boolean }
  | { t: "plot"; x: number; y: number; w: number; h: number; fn: string; xmin: number; xmax: number; ymin: number | null; ymax: number | null; color: Color }
  | { t: "table"; x: number; y: number; rows: string[][]; color: Color };

export interface Check { question: string; answer: string | null; hints: string[] }
export interface Step { say: string; board: Shape[]; clear: boolean; check: Check | null }
export interface QuizQ { q: string; options: string[]; answer: number; why: string }
export interface Lesson { title: string; lang: string; steps: Step[]; quiz: QuizQ[]; notes: string[] }

export const LIMITS = { steps: 24, shapes: 30, say: 600, text: 120, title: 120, quiz: 6, options: 5, option: 160, notes: 8, noteLen: 200, rows: 8, cols: 6, cell: 40, fn: 120, hints: 4, hint: 240, question: 300 };

export type Validation = { ok: true; lesson: Lesson; warnings: string[] } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200F\u202A-\u202E]/g, "").trim().slice(0, max) : "");
const clamp = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const color = (v: unknown): Color => (COLORS.includes(v as Color) ? (v as Color) : "ink");
/* the model works in 0–100 "board percent" units on both axes */
const px = (v: unknown, d = 50) => (clamp(v, -10, 110, d) / 100) * BOARD_W;
const py = (v: unknown, d = 50) => (clamp(v, -10, 110, d) / 100) * BOARD_H;
const pw = (v: unknown, d = 10) => (clamp(v, 0, 120, d) / 100) * BOARD_W;
const ph = (v: unknown, d = 10) => (clamp(v, 0, 120, d) / 100) * BOARD_H;

function shape(raw: unknown, warn: (m: string) => void, where: string): Shape | null {
  if (!isObj(raw)) { warn(`${where}: shape is not an object`); return null; }
  switch (raw.t) {
    case "text": {
      const s = str(raw.s, LIMITS.text);
      if (!s) return null;
      return { t: "text", x: px(raw.x), y: py(raw.y), s, size: clamp(raw.size, 14, 56, 28), color: color(raw.color), anchor: raw.anchor === "middle" || raw.anchor === "end" ? raw.anchor : "start" };
    }
    case "line": case "arrow":
      return { t: raw.t, x1: px(raw.x1, 10), y1: py(raw.y1, 50), x2: px(raw.x2, 90), y2: py(raw.y2, 50), color: color(raw.color), dashed: raw.dashed === true };
    case "rect":
      return { t: "rect", x: px(raw.x, 20), y: py(raw.y, 20), w: pw(raw.w, 20), h: ph(raw.h, 15), color: color(raw.color), fill: raw.fill === true, label: str(raw.label, LIMITS.text) };
    case "circle":
      return { t: "circle", x: px(raw.x), y: py(raw.y), r: Math.min(clamp(raw.r, 0.5, 60, 5) / 100 * BOARD_W, BOARD_W / 2), color: color(raw.color), fill: raw.fill === true };
    case "plot": {
      const fn = str(raw.fn, LIMITS.fn);
      try { parse(fn); } catch { warn(`${where}: plot expression "${fn.slice(0, 30)}" does not parse — dropped`); return null; }
      let xmin = clamp(raw.xmin, -1e6, 1e6, -10), xmax = clamp(raw.xmax, -1e6, 1e6, 10);
      if (xmax <= xmin) { xmin = -10; xmax = 10; }
      const ymin = typeof raw.ymin === "number" && Number.isFinite(raw.ymin) ? raw.ymin : null;
      const ymax = typeof raw.ymax === "number" && Number.isFinite(raw.ymax) ? raw.ymax : null;
      return { t: "plot", x: px(raw.x, 55), y: py(raw.y, 12), w: pw(raw.w, 40), h: ph(raw.h, 60), fn, xmin, xmax, ymin: ymin !== null && ymax !== null && ymax > ymin ? ymin : null, ymax: ymin !== null && ymax !== null && ymax > ymin ? ymax : null, color: color(raw.color) };
    }
    case "table": {
      if (!Array.isArray(raw.rows)) return null;
      const rows = raw.rows.slice(0, LIMITS.rows).map(r => (Array.isArray(r) ? r.slice(0, LIMITS.cols).map(c => str(typeof c === "number" ? String(c) : c, LIMITS.cell)) : [])).filter(r => r.length);
      return rows.length ? { t: "table", x: px(raw.x, 10), y: py(raw.y, 40), rows, color: color(raw.color) } : null;
    }
    default:
      warn(`${where}: unknown shape type "${String(raw.t).slice(0, 20)}" — dropped`);
      return null;
  }
}

export function validateLesson(raw: unknown): Validation {
  const warnings: string[] = [];
  const warn = (m: string) => { if (warnings.length < 20) warnings.push(m); };
  if (!isObj(raw)) return { ok: false, errors: ["lesson is not a JSON object"] };
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) return { ok: false, errors: ['lesson needs a non-empty "steps" array'] };
  if (raw.steps.length > LIMITS.steps) warn(`only the first ${LIMITS.steps} steps are kept`);

  const steps: Step[] = [];
  raw.steps.slice(0, LIMITS.steps).forEach((st, i) => {
    if (!isObj(st)) { warn(`step ${i + 1} is not an object — dropped`); return; }
    const say = str(st.say, LIMITS.say);
    if (!say) { warn(`step ${i + 1} has no "say" text — dropped`); return; }
    const board = (Array.isArray(st.board) ? st.board : []).slice(0, LIMITS.shapes)
      .map((sh, j) => shape(sh, warn, `step ${i + 1} shape ${j + 1}`)).filter((x): x is Shape => x !== null);
    let check: Check | null = null;
    if (isObj(st.check)) {
      const question = str(st.check.question, LIMITS.question);
      if (question) {
        const answer = str(st.check.answer, 80);
        check = { question, answer: answer || null, hints: (Array.isArray(st.check.hints) ? st.check.hints : []).slice(0, LIMITS.hints).map(h => str(h, LIMITS.hint)).filter(Boolean) };
      }
    }
    steps.push({ say, board, clear: st.clear === true, check });
  });
  if (!steps.length) return { ok: false, errors: ['no usable steps: each step needs a non-empty "say" string'] };

  const quiz: QuizQ[] = [];
  (Array.isArray(raw.quiz) ? raw.quiz : []).slice(0, LIMITS.quiz).forEach((q, i) => {
    if (!isObj(q) || !Array.isArray(q.options)) { warn(`quiz question ${i + 1} dropped`); return; }
    const options = q.options.slice(0, LIMITS.options).map(o => str(o, LIMITS.option)).filter(Boolean);
    const answer = typeof q.answer === "number" ? Math.trunc(q.answer) : -1;
    const question = str(q.q, LIMITS.question);
    if (!question || options.length < 2 || answer < 0 || answer >= options.length) { warn(`quiz question ${i + 1} is malformed — dropped`); return; }
    quiz.push({ q: question, options, answer, why: str(q.why, LIMITS.say) });
  });

  const notes = (Array.isArray(raw.notes) ? raw.notes : []).slice(0, LIMITS.notes).map(n => str(n, LIMITS.noteLen)).filter(Boolean);
  return { ok: true, warnings, lesson: { title: str(raw.title, LIMITS.title) || "Untitled lesson", lang: str(raw.lang, 12) || "en", steps, quiz, notes } };
}
