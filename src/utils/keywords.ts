/* Academia · whole-word keyword matcher shared by the assistant intent
   table and the Catalyst rule engine. Substring matching fired on
   "indivIDUal" for "due" and "tRUNcate" for "run" — this matches on word
   boundaries only, with plural tolerance for keywords longer than 3 chars. */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function keywordPattern(keyword: string): RegExp {
  const kw = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
  if (!kw) return /(?!)/;
  const allowPlural = kw.length > 2;
  const stem = allowPlural && kw.endsWith("s") ? kw.slice(0, -1) : kw;
  const body = stem.split(" ").map(escapeRe).join("\\s+") + (allowPlural ? "s?" : "");
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, "i");
}

export function keywordMatch(text: string, keyword: string): boolean {
  return keywordPattern(keyword).test(text);
}

export function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(k => keywordMatch(text, k));
}
