/* Academia · deterministic answer checking for "check" questions (no model involved). */
import { evalAst, parse } from "@/engine/math";

const norm = (s: string) => s.toLowerCase().replace(/[−–—]/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "").replace(/[.,;:!?]+$/, "");
const numeric = (s: string): number | null => {
  const t = norm(s).replace(/^[a-z]+=/, "");                // "x=6" → "6"
  if (!t || !/^[0-9+\-*/().^e]+$/.test(t)) return null;
  try { const v = evalAst(parse(t)); return typeof v === "number" && Number.isFinite(v) ? v : null; } catch { return null; }
};

/** True when the student's answer equals the expected one — numerically if both are numbers ("6", "x = 6", "12/2"), else as normalised text. */
export function answersMatch(given: string, expected: string): boolean {
  if (!given.trim() || !expected.trim()) return false;
  const a = numeric(given), b = numeric(expected);
  if (a !== null && b !== null) return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  return norm(given).replace(/^[a-z]=/, "") === norm(expected).replace(/^[a-z]=/, "");
}
