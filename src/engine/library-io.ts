/* Academia · library-io.ts
   Safe CSV and JSON import/export for flashcard decks.
   - Neutralizes formula injection (prefixes cells starting with = + - @ with a single quote)
   - Max 2MB / 5,000 row import cap
   - Clamps EF to [1.3, 4.0], intervals and reps to non-negative integers
   - Prototype pollution prevention via strict allowlist parsing
*/

import type { Flashcard } from "./store";
import { uid } from "./store";

const MAX_CSV_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ROWS = 5000;
const ALLOWED_CARD_KEYS = new Set([
  "id", "front", "back", "deck", "ef", "interval", "reps", "due",
  "sourceNoteId", "clozeIdx", "lapses", "history"
]);

/** Neutralize formula injection in CSV cells */
function sanitizeCsvCell(text: string): string {
  const trimmed = text.trimStart();
  if (/^[=+\-@\t\r%]/.test(trimmed)) {
    return `'${text}`;
  }
  return text;
}

/** Remove formula injection prefix on import */
function unescapeCsvCell(text: string): string {
  if (text.startsWith("'") && /^[=+\-@\t\r%]/.test(text.slice(1).trimStart())) {
    return text.slice(1);
  }
  return text;
}

/** Export cards to CSV string */
export function exportDeckToCSV(cards: Flashcard[]): string {
  const header = "ID,Front,Back,Deck,EF,Interval,Reps,Due\n";
  const rows = cards.map(c => {
    const safeFront = `"${sanitizeCsvCell(c.front).replace(/"/g, '""')}"`;
    const safeBack = `"${sanitizeCsvCell(c.back).replace(/"/g, '""')}"`;
    const safeDeck = `"${sanitizeCsvCell(c.deck).replace(/"/g, '""')}"`;
    return [
      c.id,
      safeFront,
      safeBack,
      safeDeck,
      c.ef.toFixed(2),
      c.interval,
      c.reps,
      c.due,
    ].join(",");
  });

  return header + rows.join("\n");
}

/** Import cards from CSV string */
export function importDeckFromCSV(csv: string, defaultDeck = "Imported"): Flashcard[] {
  if (csv.length > MAX_CSV_SIZE) {
    throw new Error("File exceeds 2MB size limit.");
  }

  const lines = csv.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length > MAX_ROWS + 1) {
    throw new Error(`CSV exceeds maximum limit of ${MAX_ROWS} rows.`);
  }

  if (lines.length <= 1) return [];

  // Parse header
  const isHeader = lines[0].toLowerCase().includes("front");
  const hasIdCol = isHeader && lines[0].toLowerCase().startsWith("id");
  const dataLines = isHeader ? lines.slice(1) : lines;

  const cards: Flashcard[] = [];
  const seenIds = new Set<string>();
  const now = Date.now();

  for (const line of dataLines) {
    const cols = parseCsvLine(line);
    if (cols.length < 2) continue;

    // Detect format: either ID,Front,Back... or Front,Back...
    let id = uid();
    let front = "";
    let back = "";
    let deck = defaultDeck;
    let ef = 2.5;
    let interval = 0;
    let reps = 0;

    if (cols.length >= 4 && (hasIdCol || cols[0].startsWith("f") || cols[0].length >= 8)) {
      id = cols[0] || uid();
      front = cols[1];
      back = cols[2];
      deck = cols[3] || defaultDeck;
      if (cols[4]) ef = parseFloat(cols[4]);
      if (cols[5]) interval = parseInt(cols[5], 10);
      if (cols[6]) reps = parseInt(cols[6], 10);
    } else {
      front = cols[0];
      back = cols[1];
      if (cols[2]) deck = cols[2];
    }

    if (!front.trim()) continue;

    // Dedupe ID
    if (seenIds.has(id)) id = uid();
    seenIds.add(id);

    cards.push({
      id,
      front: unescapeCsvCell(front),
      back: unescapeCsvCell(back),
      deck: unescapeCsvCell(deck) || defaultDeck,
      ef: Math.max(1.3, Math.min(4.0, isNaN(ef) ? 2.5 : ef)),
      interval: Math.max(0, Math.min(10000, isNaN(interval) ? 0 : interval)),
      reps: Math.max(0, Math.min(10000, isNaN(reps) ? 0 : reps)),
      due: now,
      lapses: 0,
      history: [],
    });
  }

  return cards;
}

/** Robust single-line CSV parser handling escaped quotes */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

/** Export cards to validated JSON */
export function exportDeckToJSON(cards: Flashcard[]): string {
  return JSON.stringify(cards, null, 2);
}

/** Export cards to lean JSON (omits history array for portable storage) */
export function exportDeckToJSONStripped(cards: Flashcard[]): string {
  const stripped = cards.map(({ history: _, ...rest }) => rest);
  return JSON.stringify(stripped, null, 2);
}

/** Import cards from JSON with prototype pollution protection */
export function importDeckFromJSON(jsonString: string): Flashcard[] {
  if (jsonString.length > MAX_CSV_SIZE) {
    throw new Error("JSON file exceeds 2MB limit.");
  }

  const parsed = JSON.parse(jsonString);
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid deck format: expected an array of flashcards.");
  }
  if (parsed.length > MAX_ROWS) {
    throw new Error(`JSON exceeds ${MAX_ROWS} card limit.`);
  }

  const seenIds = new Set<string>();
  const cards: Flashcard[] = [];
  const now = Date.now();

  for (const raw of parsed) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;

    // Filter against allowed keys only (drops __proto__, constructor, etc.)
    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      if (ALLOWED_CARD_KEYS.has(key)) {
        clean[key] = (raw as Record<string, unknown>)[key];
      }
    }

    let id = typeof clean.id === "string" && clean.id.trim() ? clean.id.trim() : uid();
    if (seenIds.has(id)) id = uid();
    seenIds.add(id);

    const front = typeof clean.front === "string" ? clean.front : "";
    const back = typeof clean.back === "string" ? clean.back : "";
    const deck = typeof clean.deck === "string" && clean.deck.trim() ? clean.deck.trim() : "Imported";
    const ef = typeof clean.ef === "number" && isFinite(clean.ef) ? clean.ef : 2.5;
    const interval = typeof clean.interval === "number" && isFinite(clean.interval) ? Math.round(clean.interval) : 0;
    const reps = typeof clean.reps === "number" && isFinite(clean.reps) ? Math.round(clean.reps) : 0;
    const due = typeof clean.due === "number" && isFinite(clean.due) ? clean.due : now;
    const lapses = typeof clean.lapses === "number" && isFinite(clean.lapses) ? clean.lapses : 0;
    const history = Array.isArray(clean.history)
      ? clean.history.filter((x): x is number => typeof x === "number").slice(-50)
      : [];

    if (!front.trim()) continue;

    cards.push({
      id,
      front,
      back,
      deck,
      ef: Math.max(1.3, Math.min(4.0, ef)),
      interval: Math.max(0, interval),
      reps: Math.max(0, reps),
      due,
      lapses: Math.max(0, lapses),
      history,
      sourceNoteId: typeof clean.sourceNoteId === "string" ? clean.sourceNoteId : undefined,
      clozeIdx: typeof clean.clozeIdx === "number" ? clean.clozeIdx : undefined,
    });
  }

  return cards;
}

