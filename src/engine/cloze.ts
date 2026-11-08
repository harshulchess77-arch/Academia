/* Academia · cloze.ts
   Pure parser and sibling generator for cloze flashcards.
   Syntax: {{c1::answer}} or {{c1::answer::hint}}

   Sibling ID scheme: `<parentId>#c<index>` (e.g. `card123#c1`)
*/

import type { Flashcard } from "./store";

export interface ParsedCloze {
  index: number;
  answer: string;
  hint?: string;
}

const CLOZE_REGEX = /\{\{c(\d+)::(.*?)(?:::([^}]*))?\}\}/g;

/** Parse all cloze deletion tokens from text */
export function parseCloze(text: string): ParsedCloze[] {
  const clozes: ParsedCloze[] = [];
  const matches = text.matchAll(CLOZE_REGEX);
  for (const m of matches) {
    const index = parseInt(m[1], 10);
    const answer = m[2];
    const hint = m[3]?.trim() || undefined;
    if (!isNaN(index) && answer !== undefined) {
      clozes.push({ index, answer, hint });
    }
  }
  return clozes;
}

/** Get unique cloze indices in a text */
export function getClozeIndices(text: string): number[] {
  const set = new Set<number>();
  for (const c of parseCloze(text)) {
    set.add(c.index);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/** Render prompt replacing cloze with placeholder or hint, while showing others */
export function renderClozePrompt(text: string, activeIndex: number): string {
  return text.replace(CLOZE_REGEX, (_match, idxStr, answer, hint) => {
    const idx = parseInt(idxStr, 10);
    if (idx === activeIndex) {
      return hint && hint.trim() ? `[${hint.trim()}]` : "[...]";
    }
    return answer;
  });
}

/** Render the back of a cloze card highlighting the answers */
export function renderClozeAnswer(text: string, activeIndex: number): string {
  const matches = parseCloze(text).filter(c => c.index === activeIndex);
  return matches.map(c => c.answer).join(", ");
}

/** Build child sibling ID */
export function makeSiblingId(parentId: string, clozeIdx: number): string {
  return `${parentId}#c${clozeIdx}`;
}

/** Check if card is a cloze sibling */
export function isClozeSibling(cardId: string): boolean {
  return cardId.includes("#c");
}

/** Extract parent ID from sibling ID */
export function getParentId(cardId: string): string {
  return cardId.split("#c")[0];
}

/**
 * Synchronize sibling cards for a cloze template.
 * Preserves existing scheduling for indices that are kept.
 */
export function syncClozeSiblings(
  parentId: string,
  fullText: string,
  deck: string,
  sourceNoteId: string | undefined,
  existingCards: Flashcard[]
): Flashcard[] {
  const indices = getClozeIndices(fullText);
  if (indices.length === 0) return [];

  const existingMap = new Map<number, Flashcard>();
  for (const card of existingCards) {
    if (card.id.startsWith(`${parentId}#c`) && card.clozeIdx !== undefined) {
      existingMap.set(card.clozeIdx, card);
    }
  }

  const now = Date.now();
  return indices.map(idx => {
    const existing = existingMap.get(idx);
    const prompt = renderClozePrompt(fullText, idx);
    const answer = renderClozeAnswer(fullText, idx);

    if (existing) {
      return {
        ...existing,
        front: prompt,
        back: answer,
        deck,
        sourceNoteId,
      };
    }

    return {
      id: makeSiblingId(parentId, idx),
      front: prompt,
      back: answer,
      deck,
      ef: 2.5,
      interval: 0,
      reps: 0,
      due: now,
      lapses: 0,
      history: [],
      clozeIdx: idx,
      sourceNoteId,
    };
  });
}

