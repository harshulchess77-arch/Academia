/* Academia · charter-filter-words.ts
   Moderated word list in a separate data file so moderators can edit
   without touching the matching engine.

   Format per entry:
   { term, severity, notes? }
   - severity: "low" | "medium" | "high"
   - term: the canonical (un-evasion-normalized) form

   This file is intentionally NOT sanitized at import time — the engine
   does that at match time.
*/

export type Severity = "low" | "medium" | "high";

export interface CharterEntry {
  term: string;
  severity: Severity;
  /** Optional Scunthorpe-style allow-list patterns that defuse the match */
  allowPatterns?: RegExp[];
}

export const CHARTER_ENTRIES: CharterEntry[] = [
  // ── English — insulting / demeaning ──────────────────────────────────────
  { term: "stupid", severity: "medium" },
  { term: "idiot", severity: "medium" },
  {
    term: "dumb", severity: "low",
    allowPatterns: [/dumbbell/i, /dumbwaiter/i]
  },
  { term: "noob", severity: "low" },
  { term: "trash", severity: "low" },
  { term: "shut up", severity: "medium" },
  { term: "loser", severity: "medium" },
  {
    term: "moron", severity: "medium",
    allowPatterns: [/moran'?s\s+i/i, /moron\s+problem\s+in\s+chapter/i]
  },
  { term: "pathetic", severity: "medium" },
  { term: "retard", severity: "high" },
  { term: "freak", severity: "low" },
  { term: "ugly", severity: "low" },
  { term: "fat", severity: "low" },
  { term: "loser", severity: "medium" },
  { term: "worthless", severity: "medium" },
  { term: "imbecile", severity: "medium" },
  { term: "cretin", severity: "medium" },

  // ── Hinglish / romanized Hindi — common insults ───────────────────────────
  // Note: These are listed here so moderators know they are intentional.
  // Severity is calibrated to match English equivalents.
  { term: "bewakoof", severity: "medium" },   // fool / idiot
  { term: "gadha", severity: "medium" },       // donkey / blockhead
  { term: "chutiya", severity: "high" },       // vulgar — equivalent to English high-severity
  { term: "pagal", severity: "low" },   // pagal = crazy, used as a demeaning insult
  { term: "bakwaas", severity: "low" },        // nonsense / trash-talk
  { term: "haramkhor", severity: "high" },     // good-for-nothing (literally haram-eater)
  { term: "ullu", severity: "medium" },        // owl / fool
  { term: "nikamma", severity: "medium" },     // worthless / idle
  { term: "nikammi", severity: "medium" },     // feminine form of nikamma
  { term: "kamina", severity: "high" },        // scoundrel / bastard
  { term: "harami", severity: "high" },        // bastard / scoundrel
  { term: "kamine", severity: "high" },        // plural of kamina
  { term: "besharam", severity: "medium" },    // shameless
  { term: "dhakkan", severity: "medium" },     // lid / blockhead
  { term: "lafanga", severity: "medium" },     // loafer / good-for-nothing
  { term: "badtameez", severity: "medium" },   // rude / ill-mannered
  { term: "kutte", severity: "high" },         // dog (used as an insult)
  { term: "suar", severity: "high" },          // pig (used as an insult)
  { term: "gandu", severity: "high" },         // vulgar insult
  { term: "behenchod", severity: "high" },     // highly vulgar
  { term: "madarchod", severity: "high" },     // highly vulgar
  { term: "bkl", severity: "high" },          // common abbreviation for behenchod
  {
    term: "bc", severity: "high",
    allowPatterns: [/\bbc\s*\d/i, /broadcast/i, /before\s+christ/i, /bc\s+era/i]
  }, // BC can be innocent
  {
    term: "mc", severity: "high",
    allowPatterns: [/\bmc\s+[a-z]/i, /emcee/i, /minecraft/i, /master\s+of\s+ceremonies/i]
  },
];
