/* Academia · deterministic math core: tokenizer → Pratt parser → AST → eval.
   Extended with Shunting-Yard RPN engine, implicit multiplication, human-readable
   parse trees, and root/intersection solvers for Numera. */

export type Ast =
  | { t: "num"; v: number }
  | { t: "var"; name: string }
  | { t: "bin"; op: string; a: Ast; b: Ast }
  | { t: "un"; op: string; a: Ast }
  | { t: "call"; name: string; args: Ast[] };

export interface Tok { k: "num" | "id" | "op"; v: string }

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(raw)) throw new Error(`Bad number "${raw}"`);
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
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  ln: Math.log, log: Math.log10, log2: Math.log2, exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
  round: Math.round, sign: Math.sign, min: Math.min, max: Math.max, pow: Math.pow,
};
export const CONSTS: Record<string, number> = {
  pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: 1.618033988749895,
};

export function evalAst(ast: Ast, scope: Record<string, number> = {}): number {
  switch (ast.t) {
    case "num": return ast.v;
    case "var": {
      if (Object.prototype.hasOwnProperty.call(scope, ast.name)) return scope[ast.name];
      if (Object.prototype.hasOwnProperty.call(CONSTS, ast.name)) return CONSTS[ast.name];
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
      if (!Object.prototype.hasOwnProperty.call(FUNCS, ast.name)) throw new Error(`Unknown function "${ast.name}"`);
      return FUNCS[ast.name](...ast.args.map(a => evalAst(a, scope)));
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

/* ============================================================================
   SHUNTING-YARD PARSER, RPN ENGINE & IMPLICIT MULTIPLICATION
   ============================================================================ */

export type RpnToken =
  | { t: "NUM"; v: number }
  | { t: "VAR"; name: string }
  | { t: "OP"; op: "+" | "-" | "*" | "/" | "^" | "%"; arity: 1 | 2 }
  | { t: "CALL"; name: string; args: number };

/** Normalizes absolute value bars `|x|` into `abs(x)` and handles implicit multiplication */
export function preprocessExpression(raw: string): string {
  let s = raw.trim();

  // Convert |expr| to abs(expr)
  let absDepth = 0;
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "|") {
      if (absDepth === 0) {
        out += "abs(";
        absDepth++;
      } else {
        out += ")";
        absDepth--;
      }
    } else {
      out += ch;
    }
  }
  s = out;

  // Insert implicit multiplication:
  // e.g., 2x -> 2*x, 4sin(x) -> 4*sin(x), 2(x) -> 2*(x), (x)(y) -> (x)*(y)
  const tokens = tokenize(s);
  const result: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    result.push(cur.v);

    if (i + 1 < tokens.length) {
      const next = tokens[i + 1];
      const curIsNum = cur.k === "num";
      const curIsId = cur.k === "id";
      const curIsCloseParen = cur.v === ")";

      const nextIsNum = next.k === "num";
      const nextIsId = next.k === "id";
      const nextIsOpenParen = next.v === "(";

      // Cases requiring implicit '*':
      // 1. Number followed by ID: 2x -> 2 * x, 4sin -> 4 * sin
      // 2. Number followed by '(': 2(x) -> 2 * (x)
      // 3. ')' followed by ID: (x)y -> (x) * y
      // 4. ')' followed by '(': (x)(y) -> (x) * (y)
      // 5. ')' followed by Number: (x)2 -> (x) * 2
      // 6. ID followed by '(' IF ID is NOT a recognized function
      const isCustomIdBeforeParen = curIsId && !Object.prototype.hasOwnProperty.call(FUNCS, cur.v) && nextIsOpenParen;

      if (
        (curIsNum && (nextIsId || nextIsOpenParen)) ||
        (curIsCloseParen && (nextIsId || nextIsOpenParen || nextIsNum)) ||
        isCustomIdBeforeParen
      ) {
        result.push("*");
      }
    }
  }

  return result.join(" ");
}

/** Parses mathematical string directly to Reverse Polish Notation (RPN) via Shunting-Yard */
export function toRpn(src: string): RpnToken[] {
  const eqIdx = src.indexOf("=");
  const expr = eqIdx !== -1 ? src.slice(eqIdx + 1).trim() : src;
  const preprocessed = preprocessExpression(expr);
  const toks = tokenize(preprocessed);
  const outputQueue: RpnToken[] = [];
  const opStack: Tok[] = [];

  let expectUnary = true;

  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];

    if (tok.k === "num") {
      outputQueue.push({ t: "NUM", v: parseFloat(tok.v) });
      expectUnary = false;
      continue;
    }

    if (tok.k === "id") {
      const next = toks[i + 1];
      if (next && next.v === "(") {
        // Function call
        opStack.push({ k: "id", v: tok.v });
      } else {
        // Variable or constant
        outputQueue.push({ t: "VAR", name: tok.v });
      }
      expectUnary = false;
      continue;
    }

    if (tok.v === "(") {
      opStack.push(tok);
      expectUnary = true;
      continue;
    }

    if (tok.v === ")") {
      while (opStack.length > 0 && opStack[opStack.length - 1].v !== "(") {
        const top = opStack.pop()!;
        outputQueue.push({ t: "OP", op: top.v as "+" | "-" | "*" | "/" | "^" | "%", arity: 2 });
      }
      if (opStack.length === 0) throw new Error("Mismatched parentheses");
      opStack.pop(); // pop '('

      // If top of stack is a function, pop it to output
      if (opStack.length > 0 && opStack[opStack.length - 1].k === "id") {
        const fnTok = opStack.pop()!;
        outputQueue.push({ t: "CALL", name: fnTok.v, args: 1 });
      }
      expectUnary = false;
      continue;
    }

    if (tok.v === ",") {
      while (opStack.length > 0 && opStack[opStack.length - 1].v !== "(") {
        const top = opStack.pop()!;
        outputQueue.push({ t: "OP", op: top.v as "+" | "-" | "*" | "/" | "^" | "%", arity: 2 });
      }
      continue;
    }

    // Operator handling
    if ("+-*/^%".includes(tok.v)) {
      if (expectUnary && (tok.v === "-" || tok.v === "+")) {
        // Handle unary minus / plus
        if (tok.v === "-") {
          // Precedence 4 for unary operator
          opStack.push({ k: "op", v: "NEG" });
        }
        continue;
      }

      const p1 = PREC[tok.v] ?? 0;
      while (opStack.length > 0) {
        const top = opStack[opStack.length - 1];
        if (top.v === "(") break;
        const p2 = top.v === "NEG" ? 4 : (PREC[top.v] ?? 0);
        // ^ is right-associative, all others left-associative
        if ((tok.v !== "^" && p1 <= p2) || (tok.v === "^" && p1 < p2)) {
          opStack.pop();
          if (top.v === "NEG") {
            outputQueue.push({ t: "OP", op: "-", arity: 1 });
          } else {
            outputQueue.push({ t: "OP", op: top.v as "+" | "-" | "*" | "/" | "^" | "%", arity: 2 });
          }
        } else {
          break;
        }
      }
      opStack.push(tok);
      expectUnary = true;
    }
  }

  while (opStack.length > 0) {
    const top = opStack.pop()!;
    if (top.v === "(" || top.v === ")") throw new Error("Mismatched parentheses");
    if (top.v === "NEG") {
      outputQueue.push({ t: "OP", op: "-", arity: 1 });
    } else {
      outputQueue.push({ t: "OP", op: top.v as "+" | "-" | "*" | "/" | "^" | "%", arity: 2 });
    }
  }

  return outputQueue;
}

/** Vectorized, zero-heap RPN stack evaluator */
export function evalRpn(rpn: RpnToken[], scope: Record<string, number> = {}): number {
  const stack: number[] = [];

  for (let i = 0; i < rpn.length; i++) {
    const token = rpn[i];
    switch (token.t) {
      case "NUM":
        stack.push(token.v);
        break;
      case "VAR": {
        const name = token.name;
        if (Object.prototype.hasOwnProperty.call(scope, name)) {
          stack.push(scope[name]);
        } else if (Object.prototype.hasOwnProperty.call(CONSTS, name)) {
          stack.push(CONSTS[name]);
        } else {
          throw new Error(`Unknown symbol "${name}"`);
        }
        break;
      }
      case "OP": {
        if (token.arity === 1) {
          const val = stack.pop() ?? 0;
          stack.push(token.op === "-" ? -val : val);
        } else {
          const b = stack.pop() ?? 0;
          const a = stack.pop() ?? 0;
          switch (token.op) {
            case "+": stack.push(a + b); break;
            case "-": stack.push(a - b); break;
            case "*": stack.push(a * b); break;
            case "/": stack.push(b === 0 ? NaN : a / b); break;
            case "%": stack.push(b === 0 ? NaN : a % b); break;
            case "^": stack.push(Math.pow(a, b)); break;
          }
        }
        break;
      }
      case "CALL": {
        if (!Object.prototype.hasOwnProperty.call(FUNCS, token.name)) {
          throw new Error(`Unknown function "${token.name}"`);
        }
        const fn = FUNCS[token.name];
        const args: number[] = [];
        for (let j = 0; j < token.args; j++) {
          args.unshift(stack.pop() ?? 0);
        }
        stack.push(fn(...args));
        break;
      }
    }
  }

  return stack[0] ?? NaN;
}

/* ============================================================================
   STRUCTURAL HUMAN-READABLE PARSE TREE (STEP-BY-STEP ALGEBRAIC INSPECTION)
   ============================================================================ */

export interface ParseTreeNode {
  id: string;
  label: string;
  type: "root" | "operator" | "function" | "variable" | "constant" | "literal";
  explanation: string;
  children: ParseTreeNode[];
}

export function buildParseTree(src: string): ParseTreeNode {
  let labelPrefix = "";
  let expr = src;
  const eqIdx = src.indexOf("=");
  if (eqIdx !== -1) {
    const lhs = src.slice(0, eqIdx).trim();
    labelPrefix = `${lhs} = `;
    expr = src.slice(eqIdx + 1).trim();
  }

  const ast = parse(expr);
  let idCounter = 0;

  function toTree(node: Ast): ParseTreeNode {
    const id = `node_${++idCounter}`;
    switch (node.t) {
      case "num":
        return {
          id,
          label: `${node.v}`,
          type: "literal",
          explanation: `Numeric literal constant ${node.v}`,
          children: [],
        };
      case "var": {
        const isConst = Object.prototype.hasOwnProperty.call(CONSTS, node.name);
        return {
          id,
          label: node.name,
          type: isConst ? "constant" : "variable",
          explanation: isConst
            ? `Mathematical constant ${node.name} ≈ ${fmt(CONSTS[node.name])}`
            : `Variable symbol "${node.name}" bound from row context or slider`,
          children: [],
        };
      }
      case "un":
        return {
          id,
          label: `Unary ${node.op}`,
          type: "operator",
          explanation: `Unary negation operation`,
          children: [toTree(node.a)],
        };
      case "bin": {
        const opNames: Record<string, string> = {
          "+": "Addition (+)",
          "-": "Subtraction (−)",
          "*": "Multiplication (×)",
          "/": "Division (÷)",
          "%": "Modulo (%)",
          "^": "Exponentiation (^)",
        };
        return {
          id,
          label: opNames[node.op] || node.op,
          type: "operator",
          explanation: `Binary operator ${node.op} applied to left and right expressions`,
          children: [toTree(node.a), toTree(node.b)],
        };
      }
      case "call":
        return {
          id,
          label: `${node.name}(...)`,
          type: "function",
          explanation: `Mathematical function call ${node.name} with ${node.args.length} argument(s)`,
          children: node.args.map(toTree),
        };
    }
  }

  return {
    id: "root",
    label: labelPrefix ? `${labelPrefix}${expr}` : `Expression: ${src}`,
    type: "root",
    explanation: labelPrefix ? `Assignment definition for ${labelPrefix.trim()}` : "Top-level evaluated expression tree",
    children: [toTree(ast)],
  };
}

/* ============================================================================
   ROOTS, CROSSINGS & BISECTION SOLVER
   ============================================================================ */

/** Deterministic bisection solver to locate roots f(x) = 0 */
export function findRoots(fn: (x: number) => number, xMin: number, xMax: number, samples = 200): number[] {
  const roots: number[] = [];
  const step = (xMax - xMin) / samples;
  let prevX = xMin;
  let prevY: number;

  try { prevY = fn(prevX); } catch { prevY = NaN; }

  for (let i = 1; i <= samples; i++) {
    const curX = xMin + i * step;
    let curY: number;
    try { curY = fn(curX); } catch { curY = NaN; }

    if (isFinite(prevY) && isFinite(curY)) {
      if (prevY === 0) {
        roots.push(prevX);
      } else if (prevY * curY < 0) {
        // Sign change detected: bisect
        let lo = prevX, hi = curX;
        for (let iter = 0; iter < 24; iter++) {
          const mid = (lo + hi) / 2;
          const midY = fn(mid);
          if (!isFinite(midY) || Math.abs(midY) < 1e-9) {
            lo = mid;
            break;
          }
          if (prevY * midY < 0) hi = mid;
          else lo = mid;
        }
        roots.push((lo + hi) / 2);
      }
    }
    prevX = curX;
    prevY = curY;
  }
  return roots;
}

/** Finds intersections f(x) = g(x) using bisection */
export function findIntersections(
  f: (x: number) => number,
  g: (x: number) => number,
  xMin: number,
  xMax: number,
  samples = 200,
): { x: number; y: number }[] {
  const diff = (x: number) => f(x) - g(x);
  const rootXs = findRoots(diff, xMin, xMax, samples);
  return rootXs.map(x => ({ x, y: f(x) }));
}

/* ============================================================================
   MATRICES
   ============================================================================ */

export type Mat = number[][];
export const matZeros = (r: number, c: number): Mat => Array.from({ length: r }, () => Array(c).fill(0));

export function matMul(a: Mat, b: Mat): Mat {
  if (a[0].length !== b.length) throw new Error("Inner dimensions must match");
  const out = matZeros(a.length, b[0].length);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b[0].length; j++) {
      for (let k = 0; k < b.length; k++) {
        out[i][j] += a[i][k] * b[k][j];
      }
    }
  }
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
