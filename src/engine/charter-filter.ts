/* Academia · charter-filter.ts
   Hardened community charter filter with dynamic vocabulary dependency injection.
   Supports internationalization and jurisdiction-specific regulatory enforcement
   (IN-DPDP, EU-GDPR, US-COPPA) while preserving deterministic multi-stage normalization.

   Pipeline:
   1. NFKC normalization (collapses Unicode homoglyphs)
   2. Replace known confusable Unicode characters (Cyrillic/Greek -> Latin)
   3. Strip zero-width / invisible characters
   4. Lowercase conversion
   5. Leet-speak substitution (1->i, 3->e, 0->o, @->a, 4->a, $->s, 5->s, 7->t, 8->b, !->i)
   6. Remove inter-letter punctuation spacers (s.t.u.p.i.d -> stupid)
   7. Collapse single-letter-space evasion patterns (s t u p i d -> stupid)
   8. Collapse repeated consecutive letters (3+ -> 2 max)
   9. Dual-pass matching: exact normalized + fuzzy single-character collapse
   10. Scunthorpe allow-list patterns veto false positives against raw text
*/

import {
  defaultVocabularyProvider,
  DynamicVocabularyProvider,
  type CharterEntry,
  type CharterVocabularyProvider,
  type Severity,
} from "./charter-filter-words";

export { DynamicVocabularyProvider, defaultVocabularyProvider };
export type { Severity, CharterEntry, CharterVocabularyProvider };

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

/** Server-side re-check hook interface. The client stub always returns null. */
export interface ServerChecker {
  recheck(text: string): Promise<ScreenResult | null>;
}

export const clientStubChecker: ServerChecker = {
  async recheck(_text: string): Promise<ScreenResult | null> {
    return null;
  },
};

// ── Deterministic Substitution Tables ───────────────────────────────────────

const ZERO_WIDTH_RE = /[\u200b\u200c\u200d\u200e\u200f\u00ad\ufeff\u2060]/g;

const DEFAULT_LEET: Record<string, string> = {
  "1": "i", "3": "e", "0": "o", "@": "a", "4": "a",
  "$": "s", "5": "s", "7": "t", "8": "b", "!": "i",
};

const DEFAULT_CONFUSABLE: Record<string, string> = {
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

/**
 * Object-oriented, dependency-injected Content Moderation Engine.
 * Decouples rule matching from static data arrays and enables runtime
 * localized vocabulary injection based on active locale and jurisdiction.
 */
export class CharterFilter {
  private provider: CharterVocabularyProvider;
  private activeJurisdiction: string;
  private confusableMap: Record<string, string>;
  private confusableRegex: RegExp;
  private leetMap: Record<string, string>;

  constructor(
    provider: CharterVocabularyProvider = defaultVocabularyProvider,
    jurisdiction: string = "IN-DPDP",
  ) {
    this.provider = provider;
    this.activeJurisdiction = jurisdiction;

    this.confusableMap = {
      ...DEFAULT_CONFUSABLE,
      ...(this.provider.getConfusables?.(this.activeJurisdiction) ?? {}),
    };
    this.confusableRegex = new RegExp(Object.keys(this.confusableMap).join("|"), "g");

    this.leetMap = {
      ...DEFAULT_LEET,
      ...(this.provider.getLeetMap?.(this.activeJurisdiction) ?? {}),
    };
  }

  public setJurisdiction(jurisdiction: string): void {
    this.activeJurisdiction = jurisdiction;
  }

  public setProvider(provider: CharterVocabularyProvider): void {
    this.provider = provider;
    this.confusableMap = {
      ...DEFAULT_CONFUSABLE,
      ...(this.provider.getConfusables?.(this.activeJurisdiction) ?? {}),
    };
    this.confusableRegex = new RegExp(Object.keys(this.confusableMap).join("|"), "g");
    this.leetMap = {
      ...DEFAULT_LEET,
      ...(this.provider.getLeetMap?.(this.activeJurisdiction) ?? {}),
    };
  }

  /**
   * Deterministic multi-stage text normalization pipeline.
   * Strips evasions, zero-width spaces, leetspeak, and visual confusables.
   */
  public normalizeText(text: string): string {
    // 1. NFKC: collapses fullwidth, ligatures, homoglyphs
    let t = text.normalize("NFKC");
    // 2. Replace known confusable Unicode characters
    t = t.replace(this.confusableRegex, (ch) => this.confusableMap[ch] ?? ch);
    // 3. Strip zero-width and invisible characters
    t = t.replace(ZERO_WIDTH_RE, "");
    // 4. Lowercase
    t = t.toLowerCase();
    // 5. Leet substitution
    t = t.replace(/[1304@$57!8]/g, (ch) => this.leetMap[ch] ?? ch);
    // 6. Remove inter-letter punctuation spacers (s.t.u.p.i.d → stupid)
    t = t.replace(/(?<=[a-z0-9])[.\-_](?=[a-z0-9])/g, "");
    // 7. Collapse single-letter-space patterns used to evade (s t u p i d → stupid)
    t = t.replace(/\b((?:\S\s+){2,}\S)\b/g, (m) => m.replace(/\s+/g, ""));
    // 8. Collapse 3+ repeated consecutive identical letters to 2
    t = t.replace(/(.)\1{2,}/g, "$1$1");
    return t;
  }

  /**
   * Evaluates input text against the active vocabulary entries.
   * Employs dual-pass matching (normalized + fuzzy) with Scunthorpe allow-list vetoes.
   */
  public screen(raw: string): ScreenResult {
    const normalized = this.normalizeText(raw);
    const fuzzy = normalized.replace(/(.)\1+/g, "$1");
    const hits: ScreenHit[] = [];

    const entries = this.provider.getEntries(this.activeJurisdiction);

    for (const entry of entries) {
      const normalTerm = this.normalizeText(entry.term);
      const pat = buildPattern(normalTerm);
      const fuzzyPat = buildPattern(this.normalizeText(entry.term).replace(/(.)\1+/g, "$1"));

      let matched = false;
      for (const [text, patt] of [[normalized, pat], [fuzzy, fuzzyPat]] as [string, RegExp][]) {
        patt.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = patt.exec(text)) !== null) {
          const vetoed = entry.allowPatterns?.some((ap) => ap.test(raw));
          if (!vetoed && !matched) {
            hits.push({ term: entry.term, severity: entry.severity, index: m.index });
            matched = true;
          }
        }
        if (matched) break;
      }
    }

    // Deduplicate hits by term
    const seen = new Set<string>();
    const deduped = hits.filter(h => {
      if (seen.has(h.term)) return false;
      seen.add(h.term);
      return true;
    });

    const overall: ScreenResult["overall"] =
      deduped.some(h => h.severity === "high") ? "block" :
      deduped.some(h => h.severity === "medium") ? "warn" :
      deduped.length > 0 ? "warn" :
      "clean";

    return { hits: deduped, overall, normalized };
  }
}

/** Global default CharterFilter instance using default composite vocabulary */
export const defaultCharterFilter = new CharterFilter();

/** Functional facade maintaining 100% backwards compatibility */
export function screenTextV2(raw: string): ScreenResult {
  return defaultCharterFilter.screen(raw);
}

/** @deprecated Use screenTextV2 for severity + normalization. */
export function screenText(text: string): string[] {
  return screenTextV2(text).hits.map(h => h.term);
}

export function normalizeText(text: string): string {
  return defaultCharterFilter.normalizeText(text);
}
