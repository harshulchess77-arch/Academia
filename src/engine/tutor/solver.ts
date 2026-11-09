/* Academia · deterministic step-by-step solver (no network, no model). Correct by construction: every number
   shown on the board is computed with the Numera expression engine, and the answer is substituted back to verify. */
import { evalAst, parse } from "@/engine/math";
import type { Lesson, Shape, Step } from "./schema";

const fmtN = (n: number): string => {
  if (!Number.isFinite(n)) return String(n);
  const r = Math.round(n * 1e6) / 1e6;
  return Number.isInteger(r) ? String(r) : String(r);
};
const sgn = (n: number) => (n < 0 ? `− ${fmtN(-n)}` : `+ ${fmtN(n)}`);
const lin = (a: number, b: number, v: string) => `${a === 1 ? "" : a === -1 ? "−" : fmtN(a)}${a === 0 ? "0" : v}${b === 0 ? "" : ` ${sgn(b)}`}`.replace(/^0[a-z]/i, "0");

export class SolverInputError extends Error {}

/** Detects the single variable used in an equation ("x", "y", "t"…). */
function variableOf(src: string): string {
  const names = new Set((src.match(/[A-Za-z_]\w*/g) ?? []).filter(n => !["sin", "cos", "tan", "sqrt", "ln", "log", "abs", "pi", "tau", "e"].includes(n.toLowerCase())));
  if (names.size === 0) throw new SolverInputError("I couldn't find a variable. Try something like 2x + 5 = 17.");
  if (names.size > 1) throw new SolverInputError(`I found several variables (${[...names].slice(0, 4).join(", ")}). The built-in solver handles one variable at a time.`);
  return [...names][0];
}

/** Matches "2x+5=17"-style input; returns null when the text isn't an equation at all. */
export function looksLikeEquation(text: string): boolean {
  const t = text.trim();
  return t.length <= 120 && (t.match(/=/g) ?? []).length === 1 && /[A-Za-z]/.test(t) && /\d/.test(t) && !/[?]/.test(t);
}

export function solveLinearLesson(input: string): Lesson {
  const src = input.trim().replace(/[−–]/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, " ");
  const parts = src.split("=");
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) throw new SolverInputError("I need an equation with exactly one “=”, like 3x − 4 = 2x + 7.");
  const v = variableOf(src);
  const side = (s: string) => {
    const ast = parse(s.replace(/(\d)\s*([A-Za-z(])/g, "$1*$2").replace(/\)\s*([A-Za-z(\d])/g, ")*$1"));
    const at = (x: number) => { const r = evalAst(ast, { [v]: x }); if (typeof r !== "number" || !Number.isFinite(r)) throw new SolverInputError("That side isn't a plain number-and-variable expression."); return r; };
    const b = at(0), a = at(1) - b;
    // linearity check at a third point: rejects x^2, 1/x, etc.
    if (Math.abs(at(3) - (a * 3 + b)) > 1e-9 * Math.max(1, Math.abs(a * 3 + b))) throw new SolverInputError("This isn't a linear equation (no powers or variables in denominators). The built-in solver covers linear equations; connect an AI provider for anything else.");
    return { a, b };
  };
  let L: { a: number; b: number }, R: { a: number; b: number };
  try { L = side(parts[0]); R = side(parts[1]); } catch (e) { if (e instanceof SolverInputError) throw e; throw new SolverInputError(`I couldn't read that equation: ${(e as Error).message}`); }

  const A = L.a - R.a, B = R.b - L.b; // A·v = B
  const steps: Step[] = [];
  const eq = (c: "ink" | "cobalt" | "vermillion" | "forest", s: string, y: number, size = 40): Shape => ({ t: "text", x: 500, y: (y / 100) * 625, s, size, color: c, anchor: "middle" });
  const title = `Solve ${src}`;

  steps.push({ say: `We want the value of ${v} that makes both sides equal. Think of the equation as a balanced scale: whatever we do to one side, we must do to the other.`, clear: false, check: null,
    board: [eq("ink", `${lin(L.a, L.b, v)} = ${lin(R.a, R.b, v)}`, 30, 44), { t: "text", x: 500, y: 222, s: "left side   =   right side", size: 24, color: "cobalt", anchor: "middle" }] });

  let curA = L.a, curB = L.b, rA = R.a, rB = R.b, y = 46;
  /* the operation applied, written beside the new line like a teacher would */
  const op = (txt: string, yy: number): Shape => ({ t: "text", x: 740, y: (yy / 100) * 625, s: txt, size: 26, color: "marigold", anchor: "start" });
  if (R.a !== 0) {
    steps.push({ say: `Collect the ${v}-terms on one side. Subtract ${fmtN(R.a)}${v} from both sides.`, clear: false,
      check: { question: `What is ${fmtN(L.a)}${v} − ${fmtN(R.a)}${v}?`, answer: `${fmtN(A)}${v}`, hints: [`Subtract the numbers in front of ${v}: ${fmtN(L.a)} − ${fmtN(R.a)}.`] },
      board: [eq("vermillion", `${lin(curA - rA, curB, v)} = ${fmtN(rB)}`, y, 40), op(`− ${fmtN(R.a)}${v} both sides`, y)] });
    curA = A; rA = 0; y += 14;
  }
  if (curB !== 0) {
    const move = -curB;
    steps.push({ say: `Now move the constant. ${move < 0 ? "Subtract" : "Add"} ${fmtN(Math.abs(move))} ${move < 0 ? "from" : "to"} both sides.`, clear: false,
      check: { question: `What is ${fmtN(rB)} ${sgn(move)}?`, answer: fmtN(B), hints: [`Do ${fmtN(rB)} ${move < 0 ? "−" : "+"} ${fmtN(Math.abs(move))}.`] },
      board: [eq("cobalt", `${lin(curA, 0, v)} = ${fmtN(B)}`, y, 40), op(`${move < 0 ? "−" : "+"} ${fmtN(Math.abs(move))} both sides`, y)] });
    y += 14;
  }
  let solution: number | null = null;
  if (A === 0) {
    steps.push({ say: B === 0 ? `Both sides are always equal, whatever ${v} is — infinitely many solutions.` : `The ${v}-terms cancel and we're left with 0 = ${fmtN(B)}, which is never true. There is no solution.`, clear: false, check: null,
      board: [eq(B === 0 ? "forest" : "vermillion", B === 0 ? "0 = 0   ✓ always true" : `0 = ${fmtN(B)}   ✗ never true`, y + 6, 40)] });
  } else {
    solution = B / A;
    if (A !== 1) steps.push({ say: `Divide both sides by ${fmtN(A)} to get ${v} alone.`, clear: false,
      check: { question: `What is ${fmtN(B)} ÷ ${fmtN(A)}?`, answer: fmtN(solution), hints: [`Divide ${fmtN(B)} by ${fmtN(A)}.`] },
      board: [eq("forest", `${v} = ${fmtN(B)} / ${fmtN(A)} = ${fmtN(solution)}`, y, 42), op(`÷ ${fmtN(A)} both sides`, y)] });
    const lv = L.a * solution + L.b, rv = R.a * solution + R.b;
    steps.push({ say: `Check by substituting ${v} = ${fmtN(solution)} back in: left side = ${fmtN(lv)}, right side = ${fmtN(rv)}. ${Math.abs(lv - rv) < 1e-9 ? "They match, so the answer is correct." : "These differ slightly because of rounding."}`, clear: true, check: null,
      board: [eq("forest", `${v} = ${fmtN(solution)}`, 26, 60), { t: "rect", x: 340, y: 100, w: 320, h: 84, color: "forest", fill: false, label: "" },
        { t: "text", x: 500, y: 300, s: `left:  ${lin(L.a, L.b, v).replace(v, `(${fmtN(solution)})`)} = ${fmtN(lv)}`, size: 30, color: "ink", anchor: "middle" },
        { t: "text", x: 500, y: 350, s: `right: ${lin(R.a, R.b, v).replace(v, `(${fmtN(solution)})`)} = ${fmtN(rv)}`, size: 30, color: "ink", anchor: "middle" },
        { t: "text", x: 500, y: 410, s: Math.abs(lv - rv) < 1e-9 ? "✓ both sides match" : "≈ equal (rounding)", size: 30, color: "forest", anchor: "middle" }] });
  }
  const quiz = solution === null ? [] : [
    { q: `If ${v} = ${fmtN(solution)}, which side of the original equation equals ${fmtN(L.a * solution + L.b)}?`, options: ["Left side", "Right side", "Both sides", "Neither"], answer: 2, why: "A solution makes both sides equal." },
  ];
  return { title, lang: "en", steps, quiz, notes: solution === null ? [] : [`${src}  →  ${v} = ${fmtN(solution)}`, "Do the same thing to both sides to keep the equation balanced."] };
}
