/* Academia · charter-filter-words.ts
   Decoupled, jurisdiction-aware vocabulary definitions and localized token providers.
   Supports dynamic vocabulary injection across internationalized locales ('en', 'hi')
   and compliance frameworks ('IN-DPDP', 'EU-GDPR', 'US-COPPA'). */

export type Severity = "low" | "medium" | "high";

export interface CharterEntry {
  term: string;
  severity: Severity;
  /** Optional Scunthorpe-style allow-list patterns that defuse the match */
  allowPatterns?: RegExp[];
  /** Optional locale tags (e.g., 'en', 'hi', 'universal') */
  locale?: string;
}

/** Interface for dynamically injecting vocabularies and confusables into the moderation engine. */
export interface CharterVocabularyProvider {
  getEntries(localeOrJurisdiction?: string): CharterEntry[];
  getConfusables?(localeOrJurisdiction?: string): Record<string, string>;
  getLeetMap?(localeOrJurisdiction?: string): Record<string, string>;
}

// ── English Terms (US-COPPA, EU-GDPR, Global) ─────────────────────────────────
export const ENGLISH_CHARTER_ENTRIES: CharterEntry[] = [
  { term: "stupid", severity: "medium", locale: "en" },
  { term: "idiot", severity: "medium", locale: "en" },
  {
    term: "dumb", severity: "low", locale: "en",
    allowPatterns: [/dumbbell/i, /dumbwaiter/i]
  },
  { term: "noob", severity: "low", locale: "en" },
  { term: "trash", severity: "low", locale: "en" },
  { term: "shut up", severity: "medium", locale: "en" },
  { term: "loser", severity: "medium", locale: "en" },
  {
    term: "moron", severity: "medium", locale: "en",
    allowPatterns: [/moran'?s\s+i/i, /moron\s+problem\s+in\s+chapter/i]
  },
  { term: "pathetic", severity: "medium", locale: "en" },
  { term: "retard", severity: "high", locale: "en" },
  { term: "freak", severity: "low", locale: "en" },
  { term: "ugly", severity: "low", locale: "en" },
  { term: "fat", severity: "low", locale: "en" },
  { term: "worthless", severity: "medium", locale: "en" },
  { term: "imbecile", severity: "medium", locale: "en" },
  { term: "cretin", severity: "medium", locale: "en" },
];

// ── Hinglish / Romanized Hindi Terms (IN-DPDP, South Asia) ───────────────────
export const HINGLISH_CHARTER_ENTRIES: CharterEntry[] = [
  { term: "bewakoof", severity: "medium", locale: "hi" },
  { term: "gadha", severity: "medium", locale: "hi" },
  { term: "chutiya", severity: "high", locale: "hi" },
  { term: "pagal", severity: "low", locale: "hi" },
  { term: "bakwaas", severity: "low", locale: "hi" },
  { term: "haramkhor", severity: "high", locale: "hi" },
  { term: "ullu", severity: "medium", locale: "hi" },
  { term: "nikamma", severity: "medium", locale: "hi" },
  { term: "nikammi", severity: "medium", locale: "hi" },
  { term: "kamina", severity: "high", locale: "hi" },
  { term: "harami", severity: "high", locale: "hi" },
  { term: "kamine", severity: "high", locale: "hi" },
  { term: "besharam", severity: "medium", locale: "hi" },
  { term: "dhakkan", severity: "medium", locale: "hi" },
  { term: "lafanga", severity: "medium", locale: "hi" },
  { term: "badtameez", severity: "medium", locale: "hi" },
  { term: "kutte", severity: "high", locale: "hi" },
  { term: "suar", severity: "high", locale: "hi" },
  { term: "gandu", severity: "high", locale: "hi" },
  { term: "behenchod", severity: "high", locale: "hi" },
  { term: "madarchod", severity: "high", locale: "hi" },
  { term: "bkl", severity: "high", locale: "hi" },
  {
    term: "bc", severity: "high", locale: "hi",
    allowPatterns: [/\bbc\s*\d/i, /broadcast/i, /before\s+christ/i, /bc\s+era/i]
  },
  {
    term: "mc", severity: "high", locale: "hi",
    allowPatterns: [/\bmc\s+[a-z]/i, /emcee/i, /minecraft/i, /master\s+of\s+ceremonies/i]
  },
];

/** Canonical composite vocabulary for default global moderation */
export const CHARTER_ENTRIES: CharterEntry[] = [
  ...ENGLISH_CHARTER_ENTRIES,
  ...HINGLISH_CHARTER_ENTRIES,
];

/** Extensible, jurisdiction-aware vocabulary provider implementation */
export class DynamicVocabularyProvider implements CharterVocabularyProvider {
  private customEntries: Map<string, CharterEntry[]> = new Map();

  constructor() {
    this.customEntries.set("en", ENGLISH_CHARTER_ENTRIES);
    this.customEntries.set("hi", HINGLISH_CHARTER_ENTRIES);
    this.customEntries.set("IN-DPDP", CHARTER_ENTRIES);
    this.customEntries.set("US-COPPA", ENGLISH_CHARTER_ENTRIES);
    this.customEntries.set("EU-GDPR", ENGLISH_CHARTER_ENTRIES);
  }

  public registerCustomEntries(key: string, entries: CharterEntry[]): void {
    this.customEntries.set(key, entries);
  }

  public getEntries(localeOrJurisdiction?: string): CharterEntry[] {
    if (!localeOrJurisdiction) return CHARTER_ENTRIES;
    const directMatch = this.customEntries.get(localeOrJurisdiction);
    if (directMatch) return directMatch;

    // Fallback: match by prefix
    if (localeOrJurisdiction.startsWith("en")) return ENGLISH_CHARTER_ENTRIES;
    if (localeOrJurisdiction.startsWith("hi")) return CHARTER_ENTRIES;

    return CHARTER_ENTRIES;
  }
}

export const defaultVocabularyProvider = new DynamicVocabularyProvider();
