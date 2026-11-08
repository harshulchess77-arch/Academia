/* Academia · library-analytics.ts
   Pure analytics functions for SM-2 review progress:
   - Retention calculation from reviewLog
   - Daily new / review counts derived from reviewLog (bounded by dayKey in local calendar)
   - Leech detection (lapses >= 4) with rule citations
   - 14-day due cards forecast
*/

import type { Flashcard, ReviewLogEntry } from "./store";
import { dayKey } from "./store";

export interface DeckStat {
  deck: string;
  total: number;
  avgEf: number;
  dueNow: number;
}

export interface LeechReport {
  card: Flashcard;
  lapses: number;
  ruleId: string;
  suggestion: string;
}

export interface ForecastDay {
  date: string;
  count: number;
}

export interface LibraryAnalytics {
  retentionRate: number;
  totalReviews: number;
  todayReviews: number;
  todayNew: number;
  deckStats: Record<string, DeckStat>;
  leeches: LeechReport[];
}

const DAY_MS = 86400000;

/** Compute comprehensive deck statistics and retention from review log */
export function computeDeckAnalytics(
  cards: Flashcard[],
  reviewLog: ReviewLogEntry[] = [],
  now = Date.now()
): LibraryAnalytics {
  const today = dayKey(now);

  // Today counts from review log
  let todayReviews = 0;
  let todayNew = 0;
  let successfulReviews = 0;

  for (const entry of reviewLog) {
    if (dayKey(entry.ts) === today) {
      todayReviews++;
      if (entry.wasNew) todayNew++;
    }
    // Retention considers grade >= 3 as success
    if (entry.q >= 3) {
      successfulReviews++;
    }
  }

  // If reviewLog is empty, calculate fallback retention from cards history
  let totalRatings = reviewLog.length;
  if (totalRatings === 0) {
    let histTotal = 0;
    let histSuccess = 0;
    for (const card of cards) {
      if (Array.isArray(card.history)) {
        for (const q of card.history) {
          histTotal++;
          if (q >= 3) histSuccess++;
        }
      }
    }
    totalRatings = histTotal;
    successfulReviews = histSuccess;
  }

  const retentionRate = totalRatings > 0 ? successfulReviews / totalRatings : 1.0;

  // Deck stats
  const deckStats: Record<string, DeckStat> = {};
  for (const card of cards) {
    if (!deckStats[card.deck]) {
      deckStats[card.deck] = { deck: card.deck, total: 0, avgEf: 0, dueNow: 0 };
    }
    const stat = deckStats[card.deck];
    stat.total++;
    stat.avgEf += card.ef;
    if (card.due <= now) {
      stat.dueNow++;
    }
  }

  for (const deck in deckStats) {
    const s = deckStats[deck];
    if (s.total > 0) s.avgEf = Math.round((s.avgEf / s.total) * 100) / 100;
  }

  const leeches = detectLeeches(cards);

  return {
    retentionRate, // raw ratio [0,1] — round only at display site (library.tsx uses Math.round(retentionRate*100)%)
    totalReviews: totalRatings,
    todayReviews,
    todayNew,
    deckStats,
    leeches,
  };
}

/** Detect cards that have lapsed 4 or more times */
export function detectLeeches(cards: Flashcard[]): LeechReport[] {
  const leeches: LeechReport[] = [];
  for (const card of cards) {
    const lapses = card.lapses ?? 0;
    if (lapses >= 4) {
      leeches.push({
        card,
        lapses,
        ruleId: "LEECH/LAPSE_GTE_4",
        suggestion: `Lapsed ${lapses} times. Break into smaller cloze cards or add a distinctive mnemonic hint.`,
      });
    }
  }
  return leeches;
}

/** Forecast number of due cards over the next 14 days */
export function forecastDueCards(cards: Flashcard[], now = Date.now()): ForecastDay[] {
  const result: ForecastDay[] = [];
  const startDay = new Date(now);
  startDay.setHours(0, 0, 0, 0);
  const baseTime = startDay.getTime();

  for (let i = 0; i < 14; i++) {
    const dayStart = baseTime + i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const dateStr = dayKey(dayStart);

    let count = 0;
    for (const card of cards) {
      if (i === 0) {
        // Today includes overdue
        if (card.due < dayEnd) count++;
      } else {
        if (card.due >= dayStart && card.due < dayEnd) count++;
      }
    }

    result.push({ date: dateStr, count });
  }

  return result;
}

