import { describe, expect, it } from "vitest";
import {
  parse, evalAst, tokenize, astLines, matMul, matAdd, determinant, rref,
  solveLinear, fmt, toRpn, evalRpn, buildParseTree, findRoots, findIntersections
} from "@/engine/math";

const ev = (src: string, scope: Record<string, number> = {}) => evalAst(parse(src), scope);

describe("math core: tokenizer & parser", () => {
  it("tokenizes numbers, ids and operators", () => {
    expect(tokenize("2.5*x+sin(pi)").map(t => t.v)).toEqual(["2.5", "*", "x", "+", "sin", "(", "pi", ")"]);
  });

  it("rejects malformed number literals", () => {
    expect(() => tokenize("1.2.3")).toThrow(/Bad number/);
    expect(() => parse("1.2.3 + 1")).toThrow(/Bad number/);
  });

  it("rejects unexpected characters", () => {
    expect(() => tokenize("2 @ 3")).toThrow(/Unexpected character/);
  });

  it("parses precedence: ^ > * / % > + -", () => {
    expect(ev("2 + 3 * 4")).toBe(14);
    expect(ev("10 - 4 - 3")).toBe(3);
    expect(ev("20 / 5 / 2")).toBe(2);
  });

  it("makes ^ right-associative", () => {
    expect(ev("2 ^ 3 ^ 2")).toBe(512);
  });

  it("unary minus binds looser than ^", () => {
    expect(ev("-2 ^ 2")).toBe(-4);
    expect(ev("(-2) ^ 2")).toBe(4);
  });

  it("evaluates variables from scope and constants", () => {
    expect(ev("x + pi", { x: 1 })).toBeCloseTo(1 + Math.PI);
    expect(ev("e")).toBe(Math.E);
    expect(ev("tau")).toBeCloseTo(Math.PI * 2);
  });

  it("evaluates function calls", () => {
    expect(ev("sqrt(16) + abs(-3) + min(4, 2) + max(4, 2)")).toBe(4 + 3 + 2 + 4);
    expect(ev("pow(2, 10)")).toBe(1024);
    expect(ev("log(1000)")).toBe(3);
  });

  it("reports unknown symbols and functions", () => {
    expect(() => ev("zzz + 1")).toThrow(/Unknown symbol/);
    expect(() => ev("foo(1)")).toThrow(/Unknown function/);
  });

  it("does not resolve prototype members as symbols", () => {
    expect(() => ev("constructor")).toThrow(/Unknown symbol/);
    expect(() => ev("toString")).toThrow(/Unknown symbol/);
    expect(() => ev("__proto__")).toThrow(/Unknown symbol/);
    expect(() => ev("hasOwnProperty")).toThrow(/Unknown symbol/);
    expect(() => ev("constructor(5)")).toThrow(/Unknown function/);
  });

  it("does not resolve prototype members via scope either", () => {
    // a polluted-looking scope must not leak Object.prototype members
    const scope: Record<string, number> = {};
    expect(() => evalAst(parse("valueOf"), scope)).toThrow(/Unknown symbol/);
  });

  it("produces an AST preview", () => {
    const lines = astLines(parse("1 + x"));
    expect(lines.join("\n")).toContain("root: +");
    expect(lines.join("\n")).toContain("var x");
  });

  it("fmt renders finite, infinite and NaN cleanly", () => {
    expect(fmt(1.23456789, 4)).toBe("1.235");
    expect(fmt(Infinity)).toBe("∞");
    expect(fmt(NaN)).toBe("NaN");
    expect(fmt(0)).toBe("0");
  });
});

describe("math core: matrices", () => {
  it("multiplies and adds matrices", () => {
    expect(matMul([[1, 2], [3, 4]], [[5, 6], [7, 8]])).toEqual([[19, 22], [43, 50]]);
    expect(matAdd([[1, 2]], [[10, 20]])).toEqual([[11, 22]]);
  });

  it("rejects dimension mismatches", () => {
    expect(matMul([[1, 2]], [[1], [2]])).toEqual([[5]]);
    expect(() => matMul([[1, 2, 3]], [[1, 2], [3, 4]])).toThrow(/Inner dimensions/);
    expect(() => matAdd([[1]], [[1, 2]])).toThrow(/Dimensions/);
  });

  it("computes determinants", () => {
    expect(determinant([[1, 2], [3, 4]])).toBe(-2);
    expect(determinant([[2, 0, 0], [0, 3, 0], [0, 0, 4]])).toBe(24);
    expect(determinant([[1, 2], [2, 4]])).toBe(0);
  });

  it("reduces to RREF with visible steps", () => {
    const { m, steps } = rref([[2, 4], [1, 3]]);
    expect(steps.length).toBeGreaterThan(0);
    expect(m[0][0]).toBeCloseTo(1);
    expect(m[1][1]).toBeCloseTo(1);
  });

  it("solves linear systems", () => {
    // x + y = 3, x - y = 1 → x=2, y=1
    expect(solveLinear([[1, 1], [1, -1]], [3, 1])).toEqual([2, 1]);
  });

  it("detects singular systems", () => {
    expect(() => solveLinear([[1, 2], [2, 4]], [3, 6])).toThrow(/Singular/);
  });
});

describe("numera graphing engine: shunting-yard RPN, implicit multiplication & parse tree", () => {
  it("handles implicit multiplication seamlessly", () => {
    const rpn1 = toRpn("2x");
    expect(evalRpn(rpn1, { x: 5 })).toBe(10);

    const rpn2 = toRpn("4sin(pi/2)");
    expect(evalRpn(rpn2)).toBeCloseTo(4);

    const rpn3 = toRpn("2(3 + 4)");
    expect(evalRpn(rpn3)).toBe(14);

    const rpn4 = toRpn("(2 + 1)(3 + 1)");
    expect(evalRpn(rpn4)).toBe(12);
  });

  it("handles absolute value bars |x|", () => {
    const rpn = toRpn("|x - 5|");
    expect(evalRpn(rpn, { x: 2 })).toBe(3);
    expect(evalRpn(rpn, { x: 8 })).toBe(3);
  });

  it("evaluates complex RPN expressions with correct operator precedence", () => {
    const rpn = toRpn("3 + 4 * 2 / (1 - 5) ^ 2");
    // 3 + 8 / 16 = 3 + 0.5 = 3.5
    expect(evalRpn(rpn)).toBe(3.5);
  });

  it("builds structural human-readable parse tree", () => {
    const tree = buildParseTree("f(x) = 2 * x + 1");
    expect(tree.id).toBe("root");
    expect(tree.children.length).toBeGreaterThan(0);
    const firstChild = tree.children[0];
    expect(firstChild.explanation).toBeDefined();
  });

  it("locates roots via bisection solver", () => {
    // f(x) = x^2 - 4 has roots at -2 and 2
    const roots = findRoots(x => x * x - 4, -4, 4, 100);
    expect(roots.length).toBe(2);
    expect(roots[0]).toBeCloseTo(-2, 2);
    expect(roots[1]).toBeCloseTo(2, 2);
  });

  it("locates intersections between two curves", () => {
    // f(x) = x, g(x) = x^2 has intersections at (0, 0) and (1, 1)
    const crossings = findIntersections(x => x, x => x * x, -0.5, 1.5, 100);
    expect(crossings.length).toBe(2);
    expect(crossings[0].x).toBeCloseTo(0, 1);
    expect(crossings[1].x).toBeCloseTo(1, 1);
  });
});

