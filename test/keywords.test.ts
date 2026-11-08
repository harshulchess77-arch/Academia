import { describe, expect, it } from "vitest";
import { keywordMatch, hasKeyword, keywordPattern } from "@/utils/keywords";

describe("whole-word keyword matcher", () => {
  it("matches whole words case-insensitively", () => {
    expect(keywordMatch("what is the Due date?", "due")).toBe(true);
    expect(keywordMatch("RUN the program", "run")).toBe(true);
    expect(keywordMatch("say hi there", "hi")).toBe(true);
  });

  it("does not fire inside larger words", () => {
    expect(keywordMatch("please truncate the file", "run")).toBe(false);
    expect(keywordMatch("an individual effort", "due")).toBe(false);
    expect(keywordMatch("welcome to Delhi", "hi")).toBe(false);
    expect(keywordMatch("this is fine", "hi")).toBe(false);
    expect(keywordMatch("running shoes", "run")).toBe(false);
  });

  it("is plural tolerant for keywords longer than 2 chars", () => {
    expect(keywordMatch("rate your cards", "card")).toBe(true);
    expect(keywordMatch("two runs left", "run")).toBe(true);
    expect(keywordMatch("the dues are paid", "due")).toBe(true);
    expect(keywordMatch("his book", "hi")).toBe(false);
  });

  it("treats multi-word keywords as phrases", () => {
    expect(keywordMatch("what is the due   date", "due date")).toBe(true);
    expect(keywordMatch("due tomorrow", "due date")).toBe(false);
    expect(keywordMatch("next event please", "next event")).toBe(true);
  });

  it("hasKeyword matches any of the list", () => {
    expect(hasKeyword("my quota is low", ["deadline", "quota", "gpa"])).toBe(true);
    expect(hasKeyword("nothing relevant", ["deadline", "quota"])).toBe(false);
  });

  it("empty keywords never match", () => {
    expect(keywordMatch("anything", "")).toBe(false);
    expect(keywordMatch("anything", "   ")).toBe(false);
  });

  it("escapes regex metacharacters in keywords", () => {
    expect(keywordPattern("c++").test("i love c++")).toBe(true);
    expect(keywordPattern("c++").test("cpp only")).toBe(false);
    expect(keywordPattern("a.b").test("a.b test")).toBe(true);
    expect(keywordPattern("a.b").test("axb test")).toBe(false);
  });
});
