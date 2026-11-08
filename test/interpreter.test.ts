import { describe, expect, it } from "vitest";
import { runProgram, analyzeCode } from "@/engine/interpreter";

const outText = (code: string) => runProgram(code).lines.filter(l => l.kind === "out").map(l => l.text);
const errText = (code: string) => runProgram(code).lines.filter(l => l.kind === "err").map(l => l.text).join("\n");

describe("acad-vm: programs", () => {
  it("runs the seeded factorial program", () => {
    const r = runProgram(`let n = 6;\nlet fact = 1;\nlet i = 1;\nwhile (i <= n) {\n  fact = fact * i;\n  i = i + 1;\n}\nconsole.log("factorial of", n, "=", fact);`);
    expect(r.ok).toBe(true);
    expect(outText(`let n = 6;\nlet fact = 1;\nlet i = 1;\nwhile (i <= n) {\n  fact = fact * i;\n  i = i + 1;\n}\nconsole.log("factorial of", n, "=", fact);`)).toContain("factorial of 6 = 720");
  });

  it("prints nothing extra for a plain log", () => {
    expect(outText(`console.log("hello", "world");`)).toEqual(["hello world"]);
  });

  it("evaluates arithmetic, power and comparisons", () => {
    expect(outText(`console.log(2 + 3 * 4, 2 ^ 10, sqrt(144), 10 % 3, 7 / 2);`)).toEqual(["14 1024 12 1 3.5"]);
  });

  it("supports string concatenation with +", () => {
    expect(outText(`let who = "ada";\nconsole.log("hello " + who + "!");`)).toEqual(["hello ada!"]);
  });

  it("if/else picks exactly one branch", () => {
    const code = `let a = 1;\nif (a == 1) {\n  console.log("one");\n} else {\n  console.log("other");\n}`;
    expect(outText(code)).toEqual(["one"]);
  });

  it("else-if chains evaluate left to right and stop at first match", () => {
    const code = `let a = 2;\nif (a == 3) {\n  console.log("three");\n} else if (a == 2) {\n  console.log("two");\n} else {\n  console.log("other");\n}`;
    expect(outText(code)).toEqual(["two"]);
  });

  it("else-if with no match falls through to else", () => {
    const code = `let a = 9;\nif (a == 3) {\n  console.log("three");\n} else if (a == 2) {\n  console.log("two");\n} else {\n  console.log("other");\n}`;
    expect(outText(code)).toEqual(["other"]);
  });

  it("supports three-level else-if chains", () => {
    const code = `let a = 3;\nif (a == 1) {\n console.log("one");\n} else if (a == 2) {\n console.log("two");\n} else if (a == 3) {\n console.log("three");\n} else {\n console.log("other");\n}`;
    expect(outText(code)).toEqual(["three"]);
  });

  it("handles } else { on one line and } else if on the next", () => {
    const code = `let a = 0;\nif (a > 0) { console.log("pos"); } else if (a < 0) {\n  console.log("neg");\n} else {\n  console.log("zero");\n}`;
    expect(runProgram(code).ok).toBe(true);
    expect(outText(code)).toEqual(["zero"]);
  });

  it("handles else on its own line", () => {
    const code = `let a = 5;\nif (a > 10) {\n  console.log("big");\n}\nelse {\n  console.log("small");\n}`;
    expect(outText(code)).toEqual(["small"]);
  });

  it("nests if inside while correctly", () => {
    const code = `let i = 1;\nlet s = 0;\nwhile (i <= 5) {\n  if (i % 2 == 0) {\n    s = s + i;\n  }\n  i = i + 1;\n}\nconsole.log("even sum =", s);`;
    expect(outText(code)).toEqual(["even sum = 6"]);
  });

  it("nests while inside if", () => {
    const code = `let k = 0;\nif (1 == 1) {\n  while (k < 3) {\n    console.log("tick", k);\n    k = k + 1;\n  }\n}`;
    expect(outText(code)).toEqual(["tick 0", "tick 1", "tick 2"]);
  });

  it("allows multiple statements per line separated by ;", () => {
    expect(outText(`let a = 1; let b = 2; console.log(a + b);`)).toEqual(["3"]);
  });

  it("lets statements end at newline without semicolon", () => {
    expect(outText(`let a = 4\nlet b = 5\nconsole.log(a * b)`)).toEqual(["20"]);
  });

  it("ignores // comments and blank lines", () => {
    expect(outText(`// header comment\nlet a = 2; // trailing\n\nconsole.log(a);`)).toEqual(["2"]);
  });

  it("exits nonzero on unknown variable with line number", () => {
    const r = runProgram(`let a = 1;\nconsole.log(missing);`);
    expect(r.ok).toBe(false);
    expect(errText(`let a = 1;\nconsole.log(missing);`)).toContain("line 2");
  });

  it("rejects assignment to undeclared variable", () => {
    expect(errText(`x = 5;`)).toContain("not declared");
  });

  it("rejects unparseable lines with line number", () => {
    expect(errText(`let a = 1;\nfoo bar baz`)).toContain("line 2");
  });

  it("reports unclosed block instead of silently running", () => {
    const r = runProgram(`let a = 1;\nif (a == 1) {\n  console.log("hi");`);
    expect(r.ok).toBe(false);
    expect(errText(`let a = 1;\nif (a == 1) {\n  console.log("hi");`)).toMatch(/unclosed|missing/);
  });

  it("reports unclosed while block", () => {
    expect(runProgram(`while (1 == 2) {`).ok).toBe(false);
  });

  it("rejects malformed number 1.2.3", () => {
    const r = runProgram(`console.log(1.2.3);`);
    expect(r.ok).toBe(false);
    expect(errText(`console.log(1.2.3);`)).toContain("bad number");
  });

  it("rejects unterminated string", () => {
    expect(runProgram(`console.log("oops);`).ok).toBe(false);
  });

  it("does not resolve constructor/toString/__proto__ as functions", () => {
    expect(runProgram(`console.log(constructor(5));`).ok).toBe(false);
    expect(errText(`console.log(constructor(5));`)).toContain("unknown function");
    expect(runProgram(`console.log(toString(5));`).ok).toBe(false);
    expect(runProgram(`console.log(__proto__(5));`).ok).toBe(false);
  });

  it("still allows user variables with dangerous names via let", () => {
    expect(outText(`let constructor = 5;\nconsole.log(constructor + 1);`)).toEqual(["6"]);
    expect(outText(`let __proto__ = 7;\nconsole.log(__proto__ * 2);`)).toEqual(["14"]);
  });

  it("enforces the step budget on infinite loops", () => {
    const r = runProgram(`while (1 == 1) {\n  let z = 1;\n}`);
    expect(r.ok).toBe(false);
    expect(r.lines.some(l => l.text.includes("budget"))).toBe(true);
  });

  it("rejects sources over 20k chars", () => {
    const big = `//${"x".repeat(21000)}`;
    expect(runProgram(big).ok).toBe(false);
  });

  it("rejects nesting deeper than 40 levels", () => {
    const depth = 45;
    const code = `${"if (1 == 1) {\n".repeat(depth)}${"}".repeat(depth)}`;
    expect(runProgram(code).ok).toBe(false);
  });

  it("supports builtins: min max pow ln floor", () => {
    expect(outText(`console.log(min(3, 1, 2), max(3, 1, 2), pow(2, 8), floor(3.7), round(ln(20) * 100) / 100);`)).toEqual(["1 3 256 3 3"]);
  });

  it("treats booleans and comparisons in conditions", () => {
    const code = `let a = 3;\nif (a > 2 && a < 5) {\n  console.log("mid");\n}`;
    // && is not in the grammar — document actual behavior
    expect(runProgram(code).ok).toBe(false);
  });
});

describe("acad-vm: predictive static analyzer", () => {
  it("detects unconditional infinite loops", () => {
    const code = `while (true) {\n  console.log("spin");\n}`;
    const diags = analyzeCode(code);
    expect(diags.some(d => d.message.includes("Infinite loop"))).toBe(true);
  });

  it("detects unmutated loop condition variables", () => {
    const code = `let i = 0;\nwhile (i < 10) {\n  console.log("loop");\n}`;
    const diags = analyzeCode(code);
    expect(diags.some(d => d.message.includes("never updated"))).toBe(true);
  });

  it("detects unclosed parentheses and braces", () => {
    const diags1 = analyzeCode("let a = (2 + 3;");
    expect(diags1.some(d => d.message.includes("parenthesis"))).toBe(true);

    const diags2 = analyzeCode("if (1 == 1) {\n  console.log(1);");
    expect(diags2.some(d => d.message.includes("block"))).toBe(true);
  });

  it("returns zero diagnostics for valid terminating programs", () => {
    const code = `let i = 0;\nwhile (i < 5) {\n  console.log(i);\n  i = i + 1;\n}`;
    const diags = analyzeCode(code);
    expect(diags.filter(d => d.severity === "error")).toHaveLength(0);
  });
});

