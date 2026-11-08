/* Academia · acad-vm — deterministic sandbox interpreter (WASM target profile).
   Supports: let, assignment, while, if/else, console.log, arithmetic,
   comparisons, string literals and a fixed math builtin table. Bounded steps. */

type Val = number | string | boolean;
interface St { kind: "let" | "assign" | "log" | "while" | "if"; line: number; name?: string; expr?: string; args?: string[]; cond?: string; body?: St[]; elseBody?: St[] }

const MAX_SRC = 20000;
const MAX_DEPTH = 40;
const MAX_STR = 100000;

function splitTop(src: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, str = false, cur = "";
  for (const ch of src) {
    if (ch === '"') str = !str;
    if (!str) { if (ch === "(") depth++; if (ch === ")") depth--; }
    if (ch === sep && depth === 0 && !str) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}

/* ---------- recursive-descent parser over the source text ---------- */
/* Statements are line-oriented like before, but blocks are matched by a real
   cursor so `} else if (…) {` chains and nested blocks parse correctly. */

const isIdStart = (c: string) => /[a-zA-Z_]/.test(c);
const isIdChar = (c: string) => /[a-zA-Z_0-9]/.test(c);

class ParseError extends Error {}

function parseProgram(src: string): St[] {
  if (src.length > MAX_SRC) throw new ParseError(`source too large (${src.length} chars, max ${MAX_SRC})`);
  let pos = 0;
  const lineAt = (p: number) => src.slice(0, p).split("\n").length;
  const eof = () => pos >= src.length;
  const peek = () => src[pos];

  function skipWsComments() {
    for (;;) {
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      if (src.startsWith("//", pos)) {
        while (pos < src.length && src[pos] !== "\n") pos++;
        continue;
      }
      return;
    }
  }
  function readWord(): string {
    const start = pos;
    while (pos < src.length && isIdChar(src[pos])) pos++;
    return src.slice(start, pos);
  }
  function expectWord(w: string) {
    skipWsComments();
    if (!src.startsWith(w, pos) || (isIdChar(src[pos + w.length] ?? " "))) throw new ParseError(`line ${lineAt(pos)}: expected "${w}"`);
    pos += w.length;
  }
  function expectChar(c: string) {
    skipWsComments();
    if (src[pos] !== c) throw new ParseError(`line ${lineAt(pos)}: expected "${c}"`);
    pos++;
  }
  /* scan an expression until ; / newline / } / eof at paren-depth 0 (strings aware) */
  function scanExpr(): string {
    const start = pos;
    let depth = 0, str = false;
    while (pos < src.length) {
      const c = src[pos];
      if (str) {
        if (c === '"') str = false;
        else if (c === "\n") break; // unterminated string — eval reports it
        pos++;
        continue;
      }
      if (c === '"') { str = true; pos++; continue; }
      if (c === "(") depth++;
      else if (c === ")") { if (depth === 0) break; depth--; }
      else if (depth === 0 && (c === ";" || c === "\n" || c === "}")) break;
      pos++;
    }
    return src.slice(start, pos).trim();
  }
  /* scan a balanced (...) group, returns inner text */
  function scanParens(): string {
    expectChar("(");
    const start = pos;
    let depth = 1, str = false;
    while (pos < src.length) {
      const c = src[pos];
      if (str) { if (c === '"') str = false; pos++; continue; }
      if (c === '"') { str = true; pos++; continue; }
      if (c === "(") depth++;
      else if (c === ")") { depth--; if (depth === 0) { const inner = src.slice(start, pos); pos++; return inner; } }
      pos++;
    }
    throw new ParseError(`line ${lineAt(start)}: unclosed "("`);
  }
  function parseBlockBody(depth: number): St[] {
    if (depth > MAX_DEPTH) throw new ParseError(`line ${lineAt(pos)}: nesting too deep (max ${MAX_DEPTH})`);
    expectChar("{");
    const out: St[] = [];
    for (;;) {
      skipWsComments();
      if (eof()) throw new ParseError(`line ${lineAt(pos)}: unclosed "{" — missing "}"`);
      if (peek() === "}") { pos++; return out; }
      out.push(parseStmt(depth + 1));
    }
  }
  /* parse `if (…) {…}` plus any `else {…}` / `else if (…) {…}` chain */
  function parseIf(depth: number): St {
    const line = lineAt(pos);
    expectWord("if");
    const cond = scanParens();
    const body = parseBlockBody(depth);
    skipWsComments();
    let elseBody: St[] | undefined;
    if (src.startsWith("else", pos) && !isIdChar(src[pos + 4] ?? " ")) {
      pos += 4;
      skipWsComments();
      if (src.startsWith("if", pos) && !isIdChar(src[pos + 2] ?? " ")) {
        elseBody = [parseIf(depth)];
      } else {
        elseBody = parseBlockBody(depth);
      }
    }
    return { kind: "if", line, cond, body, elseBody };
  }
  function parseStmt(depth: number): St {
    skipWsComments();
    const line = lineAt(pos);
    const c = peek();
    if (c === undefined) throw new ParseError(`line ${line}: unexpected end of input`);
    if (isIdStart(c)) {
      const word = readWord();
      if (word === "let") {
        skipWsComments();
        const name = readWord();
        if (!name) throw new ParseError(`line ${line}: "let" requires a variable name`);
        expectChar("=");
        const expr = scanExpr();
        if (!expr) throw new ParseError(`line ${line}: "let ${name}" needs an expression`);
        skipWsComments();
        if (peek() === ";") pos++;
        return { kind: "let", line, name, expr };
      }
      if (word === "while") {
        const cond = scanParens();
        const body = parseBlockBody(depth);
        return { kind: "while", line, cond, body };
      }
      if (word === "if") { pos -= 2; return parseIf(depth); }
      if (word === "console") {
        skipWsComments();
        if (!src.startsWith(".log", pos)) throw new ParseError(`line ${line}: expected "console.log"`);
        pos += 4;
        const inner = scanParens();
        skipWsComments();
        if (peek() === ";") pos++;
        return { kind: "log", line, args: splitTop(inner, ",") };
      }
      // assignment: name = expr
      skipWsComments();
      if (peek() !== "=") {
        // statement ended without ; — recover by skipping to EOL for a better error
        throw new ParseError(`line ${line}: cannot parse "${word}" — did you mean "${word} = …"?`);
      }
      pos++;
      const expr = scanExpr();
      if (!expr) throw new ParseError(`line ${line}: "${word}" needs an expression`);
      skipWsComments();
      if (peek() === ";") pos++;
      return { kind: "assign", line, name: word, expr };
    }
    throw new ParseError(`line ${line}: cannot parse "${src.slice(pos, src.indexOf("\n", pos) === -1 ? src.length : src.indexOf("\n", pos)).trim() || src[pos]}"`);
  }
  skipWsComments();
  const out: St[] = [];
  while (!eof()) {
    skipWsComments();
    if (eof()) break;
    if (peek() === "}") throw new ParseError(`line ${lineAt(pos)}: unexpected "}"`);
    out.push(parseStmt(0));
  }
  return out;
}

/* expression evaluator over Vals with comparisons + string concat */
function evalExpr(src: string, env: Map<string, Val>): Val {
  const toks: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let j = i + 1; while (j < src.length && src[j] !== '"') j++;
      if (j >= src.length) throw new Error("unterminated string");
      toks.push(src.slice(i, j + 1)); i = j + 1; continue;
    }
    const two = src.slice(i, i + 2);
    if (["<=", ">=", "==", "!="].includes(two)) { toks.push(two); i += 2; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(raw)) throw new Error(`bad number "${raw}"`);
      toks.push(raw); i = j; continue;
    }
    if (/[a-zA-Z_]/.test(c)) { let j = i; while (j < src.length && /[a-zA-Z_0-9]/.test(src[j])) j++; toks.push(src.slice(i, j)); i = j; continue; }
    if ("+-*/%^()<>,!".includes(c)) { toks.push(c); i++; continue; }
    throw new Error(`bad character "${c}"`);
  }
  let p = 0;
  const peek = () => toks[p];
  const num = (v: Val): number => {
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    const n = parseFloat(v); if (isNaN(n)) throw new Error(`"${v}" is not a number`); return n;
  };
  const FUNCS: Record<string, (...a: number[]) => number> = {
    sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
    min: Math.min, max: Math.max, pow: Math.pow, sin: Math.sin, cos: Math.cos, ln: Math.log,
  };
  function cmp(): Val {
    let left = add();
    while (peek() && ["<", ">", "<=", ">=", "==", "!="].includes(peek())) {
      const op = toks[p++]; const right = add();
      if (op === "==") left = left === right;
      else if (op === "!=") left = left !== right;
      else {
        const a = num(left), b = num(right);
        left = op === "<" ? a < b : op === ">" ? a > b : op === "<=" ? a <= b : a >= b;
      }
    }
    return left;
  }
  function add(): Val {
    let left = mul();
    while (peek() === "+" || peek() === "-") {
      const op = toks[p++]; const right = mul();
      if (op === "+" && (typeof left === "string" || typeof right === "string")) left = String(left) + String(right);
      else left = op === "+" ? num(left) + num(right) : num(left) - num(right);
    }
    return left;
  }
  function mul(): Val {
    let left = unary();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = toks[p++]; const right = num(unary()); const a = num(left);
      left = op === "*" ? a * right : op === "/" ? a / right : a % right;
    }
    return left;
  }
  function unary(): Val {
    if (peek() === "-") { p++; return -num(unary()); }
    if (peek() === "!") { p++; return !truth(unary()); }
    return power();
  }
  function power(): Val {
    const base = atom();
    if (peek() === "^") { p++; return Math.pow(num(base), num(unary())); }
    return base;
  }
  function atom(): Val {
    const t = toks[p++];
    if (t === undefined) throw new Error("unexpected end of expression");
    if (t === "(") { const v = cmp(); if (toks[p++] !== ")") throw new Error("missing )"); return v; }
    if (t.startsWith('"')) {
      if (t.length - 2 > MAX_STR) throw new Error(`string literal too long (max ${MAX_STR})`);
      return t.slice(1, -1);
    }
    if (/^[0-9.]/.test(t)) return parseFloat(t);
    if (t === "true") return true;
    if (t === "false") return false;
    if (peek() === "(") {
      p++;
      const args: number[] = [];
      if (peek() !== ")") {
        args.push(num(cmp()));
        while (peek() === ",") { p++; args.push(num(cmp())); }
      }
      if (toks[p++] !== ")") throw new Error("missing ) in call");
      if (!Object.prototype.hasOwnProperty.call(FUNCS, t)) throw new Error(`unknown function "${t}"`);
      return FUNCS[t](...args);
    }
    if (env.has(t)) return env.get(t)!;
    if (t === "pi") return Math.PI;
    throw new Error(`unknown variable "${t}"`);
  }
  const truth = (v: Val): boolean => (typeof v === "boolean" ? v : typeof v === "number" ? v !== 0 : v.length > 0);
  const out = cmp();
  if (p < toks.length) throw new Error(`unexpected token "${toks[p]}"`);
  return out;
}
const isTrue = (v: Val) => (typeof v === "boolean" ? v : typeof v === "number" ? v !== 0 : v.length > 0);

export interface RunResult { ok: boolean; lines: { text: string; kind: "out" | "err" | "sys" }[]; steps: number; ms: number }

export function runProgram(code: string): RunResult {
  const t0 = performance.now();
  const lines: RunResult["lines"] = [];
  let steps = 0;
  const MAX = 20000;
  try {
    const program = parseProgram(code);
    const env = new Map<string, Val>();
    const tick = (line: number) => {
      steps++;
      if (steps > MAX) throw new Error(`line ${line}: step budget exhausted (${MAX} ops) — possible infinite loop`);
    };
    const show = (v: Val) => (typeof v === "number" ? String(parseFloat(v.toPrecision(12))) : String(v));
    const evalAt = (expr: string, env: Map<string, Val>, line: number): Val => {
      try { return evalExpr(expr, env); }
      catch (e) { throw new Error(`line ${line}: ${(e as Error).message}`); }
    };
    const exec = (sts: St[]) => {
      for (const st of sts) {
        tick(st.line);
        if (st.kind === "let" || st.kind === "assign") {
          if (st.kind === "assign" && !env.has(st.name!)) throw new Error(`line ${st.line}: "${st.name}" not declared (use let)`);
          env.set(st.name!, evalAt(st.expr!, env, st.line));
        } else if (st.kind === "log") {
          lines.push({ text: st.args!.map(a => show(evalAt(a, env, st.line))).join(" "), kind: "out" });
        } else if (st.kind === "while") {
          let guard = 0;
          while (isTrue(evalAt(st.cond!, env, st.line))) {
            tick(st.line);
            exec(st.body!);
            if (++guard > MAX) throw new Error(`line ${st.line}: loop budget exhausted`);
          }
        } else if (st.kind === "if") {
          if (isTrue(evalAt(st.cond!, env, st.line))) exec(st.body!);
          else if (st.elseBody) exec(st.elseBody);
        }
      }
    };
    exec(program);
    lines.push({ text: `— exited 0 · ${steps} ops · acad-vm v1.4 (wasm32 profile)`, kind: "sys" });
    return { ok: true, lines, steps, ms: performance.now() - t0 };
  } catch (e) {
    lines.push({ text: `✕ ${(e as Error).message}`, kind: "err" });
    lines.push({ text: `— exited 1 · ${steps} ops`, kind: "sys" });
    return { ok: false, lines, steps, ms: performance.now() - t0 };
  }
}