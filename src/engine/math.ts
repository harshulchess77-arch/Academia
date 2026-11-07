/* Academia · deterministic math core: tokenizer → Pratt parser → AST → eval.
   Shared by Numera, the assistant engines and the sandbox VM. */

export type Ast =
  | { t: "num"; v: number }
  | { t: "var"; name: string }
  | { t: "bin"; op: string; a: Ast; b: Ast }
  | { t: "un"; op: string; a: Ast }
  | { t: "call"; name: string; args: Ast[] };

interface Tok { k: "num" | "id" | "op"; v: string }

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      if (!isFinite(parseFloat(raw))) throw new Error(`Bad number "${raw}"`);
      out.push({ k: "num", v: raw }); i = j; continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i; while (j < src.length && /[a-zA-Z_0-9]/.test(src[j])) j++;
      out.push({ k: "id", v: src.slice(i, j) }); i = j; continue;
    }
    if ("+-*/^%(),".includes(c)) { out.push({ k: "op", v: c }); i++; continue; }
    throw new Error(`Unexpected character "${c}"`);
  }
  return out;
}

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };

export function parse(src: string): Ast {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = (v?: string) => {
    const t = toks[p];
    if (!t) throw new Error("Unexpected end of expression");
    if (v && t.v !== v) throw new Error(`Expected "${v}" but found "${t.v}"`);
    p++; return t;
  };
  function expr(min: number): Ast {
    let left = prefix();
    while (peek() && peek().k === "op" && PREC[peek().v] !== undefined && PREC[peek().v] >= min) {
      const op = eat().v;
      const next = op === "^" ? PREC[op] : PREC[op] + 1; // ^ right-assoc
      left = { t: "bin", op, a: left, b: expr(next) };
    }
    return left;
  }
  function prefix(): Ast {
    const t = peek();
    if (!t) throw new Error("Unexpected end of expression");
    if (t.v === "-" || t.v === "+") { eat(); return { t: "un", op: t.v, a: expr(3) }; }
    if (t.k === "num") { eat(); return { t: "num", v: parseFloat(t.v) }; }
    if (t.k === "id") {
      eat();
      if (peek()?.v === "(") {
        eat("(");
        const args: Ast[] = [];
        if (peek()?.v !== ")") {
          args.push(expr(1));
          while (peek()?.v === ",") { eat(","); args.push(expr(1)); }
        }
        eat(")");
        return { t: "call", name: t.v, args };
      }
      return { t: "var", name: t.v };
    }
    if (t.v === "(") { eat("("); const e = expr(1); eat(")"); return e; }
    throw new Error(`Unexpected token "${t.v}"`);
  }
  const ast = expr(1);
  if (p < toks.length) throw new Error(`Unexpected token "${toks[p].v}"`);
  return ast;
}

export const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, sqrt: Math.sqrt, abs: Math.abs,
  ln: Math.log, log: Math.log10, exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
  round: Math.round, sign: Math.sign, min: Math.min, max: Math.max, pow: Math.pow,
};
export const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

export function evalAst(ast: Ast, scope: Record<string, number> = {}): number {
  switch (ast.t) {
    case "num": return ast.v;
    case "var": {
      if (ast.name in scope) return scope[ast.name];
      if (ast.name in CONSTS) return CONSTS[ast.name];
      throw new Error(`Unknown symbol "${ast.name}"`);
    }
    case "un": return ast.op === "-" ? -evalAst(ast.a, scope) : evalAst(ast.a, scope);
    case "bin": {
      const a = evalAst(ast.a, scope), b = evalAst(ast.b, scope);
      switch (ast.op) {
        case "+": return a + b; case "-": return a - b; case "*": return a * b;
        case "/": return a / b; case "%": return a % b; case "^": return Math.pow(a, b);
        default: throw new Error(`Unknown operator ${ast.op}`);
      }
    }
    case "call": {
      const f = FUNCS[ast.name];
      if (!f) throw new Error(`Unknown function "${ast.name}"`);
      return f(...ast.args.map(a => evalAst(a, scope)));
    }
  }
}

export function astLines(ast: Ast, depth = 0, label = "root"): string[] {
  const pad = "  ".repeat(depth);
  switch (ast.t) {
    case "num": return [`${pad}${label}: num ${ast.v}`];
    case "var": return [`${pad}${label}: var ${ast.name}`];
    case "un": return [`${pad}${label}: unary ${ast.op}`, ...astLines(ast.a, depth + 1, "arg")];
    case "bin": return [`${pad}${label}: ${ast.op}`, ...astLines(ast.a, depth + 1, "left"), ...astLines(ast.b, depth + 1, "right")];
    case "call": return [`${pad}${label}: call ${ast.name}()`, ...ast.args.flatMap((a, i) => astLines(a, depth + 1, `arg${i}`))];
  }
}

export function fmt(n: number, digits = 6): string {
  if (!isFinite(n)) return n > 0 ? "∞" : isNaN(n) ? "NaN" : "−∞";
  if (Math.abs(n) < 1e-12) return "0";
  const r = parseFloat(n.toPrecision(digits));
  return String(r);
}

/* ---------- matrices ---------- */
export type Mat = number[][];
export const matZeros = (r: number, c: number): Mat => Array.from({ length: r }, () => Array(c).fill(0));
export function matMul(a: Mat, b: Mat): Mat {
  if (a[0].length !== b.length) throw new Error("Inner dimensions must match");
  const out = matZeros(a.length, b[0].length);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b[0].length; j++) for (let k = 0; k < b.length; k++) out[i][j] += a[i][k] * b[k][j];
  return out;
}
export function matAdd(a: Mat, b: Mat): Mat {
  if (a.length !== b.length || a[0].length !== b[0].length) throw new Error("Dimensions must match");
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}
export function determinant(m: Mat): number {
  const n = m.length;
  if (n !== m[0].length) throw new Error("Determinant needs a square matrix");
  const a = m.map(r => [...r]);
  let det = 1;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    if (Math.abs(a[piv][col]) < 1e-12) return 0;
    if (piv !== col) { [a[piv], a[col]] = [a[col], a[piv]]; det = -det; }
    det *= a[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = a[r][col] / a[col][col];
      for (let c = col; c < n; c++) a[r][c] -= f * a[col][c];
    }
  }
  return det;
}
export function rref(m: Mat): { m: Mat; steps: string[] } {
  const a = m.map(r => [...r]);
  const steps: string[] = [];
  const rows = a.length, cols = a[0].length;
  let lead = 0;
  for (let r = 0; r < rows && lead < cols; r++) {
    let i = r;
    while (Math.abs(a[i][lead]) < 1e-12) {
      i++;
      if (i === rows) { i = r; lead++; if (lead === cols) return { m: a, steps }; }
    }
    if (i !== r) { [a[i], a[r]] = [a[r], a[i]]; steps.push(`R${r + 1} ↔ R${i + 1}`); }
    const f = a[r][lead];
    if (f !== 1) { a[r] = a[r].map(v => v / f); steps.push(`R${r + 1} ← R${r + 1} / ${fmt(f, 4)}`); }
    for (let k = 0; k < rows; k++) {
      if (k !== r && Math.abs(a[k][lead]) > 1e-12) {
        const g = a[k][lead];
        a[k] = a[k].map((v, c) => v - g * a[r][c]);
        steps.push(`R${k + 1} ← R${k + 1} − ${fmt(g, 4)}·R${r + 1}`);
      }
    }
    lead++;
  }
  return { m: a.map(r => r.map(v => (Math.abs(v) < 1e-12 ? 0 : v))), steps };
}
/** Gaussian solve A·x = b with partial pivoting (used by the MNA solver). */
export function solveLinear(A: Mat, b: number[]): number[] {
  const n = b.length;
  const a = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    if (Math.abs(a[piv][col]) < 1e-12) throw new Error("Singular system — check for floating nodes or duplicate sources");
    [a[piv], a[col]] = [a[col], a[piv]];
    for (let r = 0; r < n; r++) {
      if (r !== col) {
        const f = a[r][col] / a[col][col];
        for (let c = col; c <= n; c++) a[r][c] -= f * a[col][c];
      }
    }
  }
  return a.map((row, i) => row[n] / a[i][i]);
}