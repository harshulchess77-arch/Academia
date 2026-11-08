/* Academia · charter-filter.ts
   Hardened community charter filter.

   Pipeline:
   1. NFKC normalization (collapses Unicode homoglyphs)
   2. Strip zero-width / invisible characters
   3. Leet-speak substitution (1→i, 3→e, 0→o, @→a, 4→a, $→s, 5→s, 7→t)
   4. Collapse repeated consecutive letters (3+ → 2 max)
   5. Strip punctuation / spacing used to evade (s.t.u.p.i.d → stupid)
   6. Word-boundary match against CharterEntry list
   7. Scunthorpe allow-list patterns veto false positives

   Server-side re-check:
   The client filter is ADVISORY only. The ServerChecker interface
   describes the hook to be implemented in the backend; a no-op stub
   ships client-side.
*/

import { CHARTER_ENTRIES, type Severity } from "./charter-filter-words";

export type { Severity };

export interface ScreenHit {
  term: string;
  severity: Severity;
  /** position of the match in the normalized text */
  index: number;
}

export interface ScreenResult {
  /** All matched terms with their severity */
  hits: ScreenHit[];
  /** Aggregate outcome */
  overall: "clean" | "warn" | "block";
  /** The normalized string that was actually matched against */
  normalized: string;
}

/** Server-side re-check hook interface. The client stub always returns
    null (no server veto). A real backend replaces this. */
export interface ServerChecker {
  recheck(text: string): Promise<ScreenResult | null>;
}

/** No-op client stub — the advisory result stands until a server verifies. */
export const clientStubChecker: ServerChecker = {
  async recheck(_text: string): Promise<ScreenResult | null> {
    return null; // no server override in demo/offline mode
  },
};

// ── normalizer ────────────────────────────────────────────────────────────

const ZERO_WIDTH_RE = /[\u200b\u200c\u200d\u200e\u200f\u00ad\ufeff\u2060]/g;
const LEET: Record<string, string> = {
  "1": "i", "3": "e", "0": "o", "@": "a", "4": "a",
  "$": "s", "5": "s", "7": "t", "8": "b", "!": "i",
};
// Cyrillic / Greek / other-script visual confusables → Latin
const CONFUSABLE: Record<string, string> = {
  "\u0456": "i",  // Cyrillic і → i
  "\u0430": "a",  // Cyrillic а → a
  "\u0435": "e",  // Cyrillic е → e
  "\u043e": "o",  // Cyrillic о → o
  "\u0440": "r",  // Cyrillic р → r
  "\u0441": "c",  // Cyrillic с → c
  "\u0445": "x",  // Cyrillic х → x
  "\u03b1": "a",  // Greek α → a
  "\u03b5": "e",  // Greek ε → e
  "\u03bf": "o",  // Greek ο → o
};
const CONFUSABLE_RE = new RegExp(Object.keys(CONFUSABLE).join("|"), "g");

export function normalizeText(text: string): string {
  // 1. NFKC: collapses fullwidth, ligatures, homoglyphs
  let t = text.normalize("NFKC");
  // 2. Replace known confusable Unicode chars
  t = t.replace(CONFUSABLE_RE, (ch) => CONFUSABLE[ch] ?? ch);
  // 3. Strip zero-width chars
  t = t.replace(ZERO_WIDTH_RE, "");
  // 4. Lowercase
  t = t.toLowerCase();
  // 5. Leet substitution
  t = t.replace(/[1304@$57!8]/g, (ch) => LEET[ch] ?? ch);
  // 6. Remove inter-letter punctuation spacers (s.t.u.p.i.d → stupid)
  //    Keep * and # because buildPattern handles them as vowel-mask substitutes
  t = t.replace(/(?<=[a-z0-9])[.\-_](?=[a-z0-9])/g, "");
  // 7. Collapse single-letter-space patterns used to evade (s t u p i d → stupid)
  t = t.replace(/\b((?:\S\s+){2,}\S)\b/g, (m) => m.replace(/\s+/g, ""));
  // 8. Collapse 3+ repeated consecutive identical letters to 2
  t = t.replace(/(.)\1{2,}/g, "$1$1");
  return t;
}

// ── matcher ───────────────────────────────────────────────────────────────

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build a word-boundary regex for a charter term.
    Multi-word terms (e.g. "shut up") use \s+ between words.
    Vowels in the term can be substituted by [*#_] to defeat simple masking. */
function buildPattern(term: string): RegExp {
  const parts = term.trim().split(/\s+/)
    .map(word => {
      return word.split("").map(ch => {
        if (/[aeiou]/i.test(ch)) return `(?:${escapeRe(ch)}|[*#_])`;
        return escapeRe(ch);
      }).join("");
    })
    .join("\\s+");
  return new RegExp(`(?<![a-z0-9])${parts}(?![a-z0-9])`, "gi");
}

export function screenTextV2(raw: string): ScreenResult {
  const normalized = normalizeText(raw);
  // A second pass that collapses ALL repeated letters (2+ → 1) for fuzzy matching.
  // This catches "looser" → "loser", "loooooser" → "loser", etc.
  const fuzzy = normalized.replace(/(.)\1+/g, "$1");
  const hits: ScreenHit[] = [];

  for (const entry of CHARTER_ENTRIES) {
    const normalTerm = normalizeText(entry.term);
    // Build pattern for both normalized and fuzzy forms
    const pat = buildPattern(normalTerm);
    const fuzzyPat = buildPattern(normalizeText(entry.term).replace(/(.)\1+/g, "$1"));

    // Check normalized text first; then fuzzy text
    let matched = false;
    for (const [text, patt] of [[normalized, pat], [fuzzy, fuzzyPat]] as [string, RegExp][]) {
      patt.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = patt.exec(text)) !== null) {
        // Check allow-list patterns against the ORIGINAL raw text to catch
        // Scunthorpe cases (e.g. "dumbbell" should not be flagged as "dumb")
        const vetoed = entry.allowPatterns?.some((ap) => ap.test(raw));
        if (!vetoed && !matched) {
          hits.push({ term: entry.term, severity: entry.severity, index: m.index });
          matched = true;
        }
      }
      if (matched) break;
    }
  }

  // Deduplicate by term
  const seen = new Set<string>();
  const deduped = hits.filter(h => { const k = h.term; if (seen.has(k)) return false; seen.add(k); return true; });

  const overall: ScreenResult["overall"] =
    deduped.some(h => h.severity === "high") ? "block" :
    deduped.some(h => h.severity === "medium") ? "warn" :
    deduped.length > 0 ? "warn" :
    "clean";

  return { hits: deduped, overall, normalized };
}

// ── backward-compat shim for existing screenText callers ──────────────────
/** @deprecated Use screenTextV2 for severity + normalization. */
export function screenText(text: string): string[] {
  return screenTextV2(text).hits.map(h => h.term);
}
