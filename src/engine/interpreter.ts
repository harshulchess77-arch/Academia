/* Academia · acad-vm — deterministic sandbox interpreter (WASM target profile).
   Supports: let, assignment, while, if/else, console.log, arithmetic,
   comparisons, string literals and a fixed math builtin table. Bounded steps. */

type Val = number | string | boolean;
interface St { kind: "let" | "assign" | "log" | "while" | "if"; line: number; name?: string; expr?: string; args?: string[]; cond?: string; body?: St[]; elseBody?: St[] }

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

function parseBlock(lines: string[], start: number, end: number): St[] {
  const out: St[] = [];
  let i = start;
  while (i < end) {
    const raw = lines[i].trim();
    const line = i + 1;
    if (!raw || raw.startsWith("//")) { i++; continue; }
    if (raw.startsWith("}")) { i++; continue; }
    const whileM = raw.match(/^while\s*\((.*)\)\s*\{$/);
    const ifM = raw.match(/^if\s*\((.*)\)\s*\{$/);
    if (whileM || ifM) {
      let depth = 1, j = i + 1;
      while (j < end && depth > 0) {
        const t = lines[j].trim();
        const closes = t.startsWith("}"), opens = t.endsWith("{");
        if (closes && opens) { if (ifM && depth === 1) depth--; } // "} else {" closes the if-body only
        else if (closes) depth--;
        else if (opens) depth++;
        if (depth > 0) j++;
      }
      const body = parseBlock(lines, i + 1, j);
      let elseBody: St[] | undefined;
      let next = j + 1;
      if (ifM && lines[j]?.trim() === "} else {") {
        let d2 = 1, k = j + 1;
        while (k < end && d2 > 0) {
          const t = lines[k].trim();
          const closes = t.startsWith("}"), opens = t.endsWith("{");
          if (closes && opens) { /* nested else — net zero */ }
          else if (closes) d2--;
          else if (opens) d2++;
          if (d2 > 0) k++;
        }
        elseBody = parseBlock(lines, j + 1, k);
        next = k + 1;
      }
      out.push(ifM ? { kind: "if", line, cond: ifM[1], body, elseBody } : { kind: "while", line, cond: whileM![1], body });
      i = next;
      continue;
    }
    const logM = raw.match(/^console\.log\s*\((.*)\)\s*;?$/);
    if (logM) { out.push({ kind: "log", line, args: splitTop(logM[1], ",") }); i++; continue; }
    const letM = raw.match(/^let\s+([a-zA-Z_]\w*)\s*=\s*(.+?);?$/);
    if (letM) { out.push({ kind: "let", line, name: letM[1], expr: letM[2].replace(/;$/, "") }); i++; continue; }
    const asM = raw.match(/^([a-zA-Z_]\w*)\s*=\s*(.+?);?$/);
    if (asM) { out.push({ kind: "assign", line, name: asM[1], expr: asM[2].replace(/;$/, "") }); i++; continue; }
    throw new Error(`line ${line}: cannot parse "${raw}"`);
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
    if (/[0-9.]/.test(c)) { let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++; toks.push(src.slice(i, j)); i = j; continue; }
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
    if (t.startsWith('"')) return t.slice(1, -1);
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
      const f = FUNCS[t];
      if (!f) throw new Error(`unknown function "${t}"`);
      return f(...args);
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
    const program = parseBlock(code.split("\n"), 0, code.split("\n").length);
    const env = new Map<string, Val>();
    const tick = (line: number) => {
      steps++;
      if (steps > MAX) throw new Error(`line ${line}: step budget exhausted (${MAX} ops) — possible infinite loop`);
    };
    const show = (v: Val) => (typeof v === "number" ? String(parseFloat(v.toPrecision(12))) : String(v));
    const exec = (sts: St[]) => {
      for (const st of sts) {
        tick(st.line);
        if (st.kind === "let" || st.kind === "assign") {
          if (st.kind === "assign" && !env.has(st.name!)) throw new Error(`line ${st.line}: "${st.name}" not declared (use let)`);
          env.set(st.name!, evalExpr(st.expr!, env));
        } else if (st.kind === "log") {
          lines.push({ text: st.args!.map(a => show(evalExpr(a, env))).join(" "), kind: "out" });
        } else if (st.kind === "while") {
          let guard = 0;
          while (isTrue(evalExpr(st.cond!, env))) {
            tick(st.line);
            exec(st.body!);
            if (++guard > MAX) throw new Error(`line ${st.line}: loop budget exhausted`);
          }
        } else if (st.kind === "if") {
          if (isTrue(evalExpr(st.cond!, env))) exec(st.body!);
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