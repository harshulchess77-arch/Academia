/* Academia · Phase 3.2 — Library: summaries, notes, SM-2 active recall,
   and Virtualized Deck Explorer with strict 30-DOM-node viewport bound. */

import React, { useMemo, useRef, useState } from "react";
import {
  BookOpen, ChevronDown, ChevronUp, Download, Layers,
  Pencil, Plus, RotateCcw, Search, Trash2, Upload
} from "lucide-react";
import { useApp, fmtDate, uid, dayKey, type Flashcard } from "@/engine/store";
import { sm2, SM2_LABELS } from "@/engine/rules";
import { useModal } from "@/engine/modal";
import { EmptyState, PageHeader, Pill, SectionHead, Tabs } from "@/components/ui";
import { CardFaceContent } from "@/engine/card-render";
import { parseCloze, syncClozeSiblings, getParentId } from "@/engine/cloze";
import { computeDeckAnalytics, forecastDueCards } from "@/engine/library-analytics";
import {
  exportDeckToCSV, importDeckFromCSV, exportDeckToJSON,
  exportDeckToJSONStripped, importDeckFromJSON
} from "@/engine/library-io";

/* ============================================================================
   LIGHTWEIGHT VIRTUAL LIST SCROLLER (Strictly ≤ 30 Active DOM Nodes)
   ============================================================================ */

const ROW_HEIGHT = 74;
const MAX_DOM_NODES = 30;

interface VirtualCardScrollerProps {
  cards: Flashcard[];
  onEdit: (card: Flashcard) => void;
  onDelete: (id: string) => void;
}

export function VirtualCardScroller({ cards, onEdit, onDelete }: VirtualCardScrollerProps) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = cards.length * ROW_HEIGHT;
  const rawStartIndex = Math.floor(scrollTop / ROW_HEIGHT);
  // Clamp start and end indices so at most 30 DOM nodes exist in the tree
  const startIndex = Math.max(0, rawStartIndex - 2);
  const endIndex = Math.min(cards.length, startIndex + MAX_DOM_NODES);
  const visibleCards = cards.slice(startIndex, endIndex);
  const offsetY = startIndex * ROW_HEIGHT;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div
      onScroll={handleScroll}
      className="relative max-h-[580px] overflow-y-auto rounded-xl border-2 p-2"
      style={{ borderColor: "var(--text-900)", background: "var(--surface)" }}
      aria-label="Virtualized flashcard collection"
    >
      <div style={{ height: `${totalHeight}px`, position: "relative" }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
          }}
          className="space-y-2"
        >
          {visibleCards.map(card => (
            <VirtualCardRow
              key={card.id}
              card={card}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Strict React.memo comparison gate to suppress re-renders unless intrinsic node properties shift
export const VirtualCardRow = React.memo(
  function VirtualCardRow({
    card,
    onEdit,
    onDelete,
  }: {
    card: Flashcard;
    onEdit: (card: Flashcard) => void;
    onDelete: (id: string) => void;
  }) {
    return (
      <div
        className="flex items-center justify-between rounded-lg border p-3 transition-colors"
        style={{
          height: `${ROW_HEIGHT - 8}px`,
          borderColor: "var(--background-300)",
          background: "var(--background-50)",
        }}
      >
        <div className="flex-1 truncate pr-4">
          <div className="flex items-center gap-2">
            <span className="pill !text-[10px]">{card.deck}</span>
            <span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>
              EF {card.ef} · Interval {card.interval}d · Reps {card.reps}
            </span>
          </div>
          <p className="truncate font-bold text-sm mt-0.5" style={{ color: "var(--text-900)" }}>
            {card.front}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-none">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onEdit(card)}
            title="Edit Card"
          >
            <Pencil size={13} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--accent-600)" }}
            onClick={() => onDelete(card.id)}
            title="Delete Card"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.card.id === next.card.id &&
    prev.card.front === next.card.front &&
    prev.card.back === next.card.back &&
    prev.card.ef === next.card.ef &&
    prev.card.interval === next.card.interval &&
    prev.card.reps === next.card.reps &&
    prev.card.due === next.card.due
);

/* ============================================================================
   LIBRARY VIEW COMPONENT
   ============================================================================ */

export function LibraryView() {
  const { s, up, toast } = useApp();
  const { open, close } = useModal();
  const noteParam = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("note");
  const [tab, setTab] = useState(noteParam ? "Notes" : "Flashcards");
  const [query, setQuery] = useState("");
  const [explorerDeck, setExplorerDeck] = useState<string>("ALL");
  const [noteId, setNoteId] = useState(noteParam ?? s.notes[0]?.id ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [aheadMode, setAheadMode] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const noteBodyRef = useRef<HTMLParagraphElement>(null);

  const now = Date.now();
  const todayKey = dayKey(now);

  // Review log and daily limits
  const reviewLog = s.reviewLog ?? [];
  const dailyNewLimit = s.librarySettings?.dailyNewLimit ?? 20;
  const dailyReviewLimit = s.librarySettings?.dailyReviewLimit ?? 100;

  const todayReviewsCount = useMemo(() => {
    return reviewLog.filter(r => dayKey(r.ts) === todayKey).length;
  }, [reviewLog, todayKey]);

  const todayNewCount = useMemo(() => {
    return reviewLog.filter(r => dayKey(r.ts) === todayKey && r.wasNew).length;
  }, [reviewLog, todayKey]);

  // Review queue respecting limits
  const dueCards = useMemo(() => {
    return s.flashcards.filter(f => f.due <= now).sort((a, b) => a.due - b.due);
  }, [s.flashcards, now]);

  const aheadCards = useMemo(() => {
    return [...s.flashcards].sort((a, b) => a.due - b.due);
  }, [s.flashcards]);

  const queue = useMemo(() => {
    const base = aheadMode ? aheadCards : dueCards;
    // Filter out if daily review limit is reached
    if (todayReviewsCount >= dailyReviewLimit) return [];

    // Filter new cards if new limit is reached
    if (todayNewCount >= dailyNewLimit) {
      return base.filter(c => (c.reps > 0 || c.interval > 0));
    }
    return base;
  }, [aheadMode, aheadCards, dueCards, todayReviewsCount, dailyReviewLimit, todayNewCount, dailyNewLimit]);

  const card = queue[0];

  const analytics = useMemo(() => {
    return computeDeckAnalytics(s.flashcards, s.reviewLog, now);
  }, [s.flashcards, s.reviewLog, now]);

  const forecast = useMemo(() => {
    return forecastDueCards(s.flashcards, now);
  }, [s.flashcards, now]);

  const decks = useMemo(() => {
    const m = new Map<string, { total: number; due: number; ef: number }>();
    for (const f of s.flashcards) {
      const cur = m.get(f.deck) ?? { total: 0, due: 0, ef: 0 };
      m.set(f.deck, { total: cur.total + 1, due: cur.due + (f.due <= now ? 1 : 0), ef: cur.ef + f.ef });
    }
    return Array.from(m.entries());
  }, [s.flashcards, now]);

  // Filtered cards for Deck Explorer
  const explorerCards = useMemo(() => {
    return s.flashcards.filter(c => {
      const matchesDeck = explorerDeck === "ALL" || c.deck === explorerDeck;
      const matchesQuery = !query.trim() ||
        c.front.toLowerCase().includes(query.toLowerCase()) ||
        c.back.toLowerCase().includes(query.toLowerCase());
      return matchesDeck && matchesQuery;
    });
  }, [s.flashcards, explorerDeck, query]);

  const rate = (q: number) => {
    if (!card) return;
    const next = sm2(card, q);
    const wasNew = card.reps === 0 && card.interval === 0;

    // Track lapses and history
    const isLapse = q < 3;
    const nextLapses = isLapse ? (card.lapses ?? 0) + 1 : (card.lapses ?? 0);
    const nextHistory = [...(card.history ?? []), q].slice(-50);

    const cardWithMetrics: Flashcard = {
      ...next,
      lapses: nextLapses,
      history: nextHistory,
    };

    up(d => {
      const i = d.flashcards.findIndex(f => f.id === card.id);
      if (i >= 0) d.flashcards[i] = cardWithMetrics;

      // Append to reviewLog
      if (!Array.isArray(d.reviewLog)) d.reviewLog = [];
      d.reviewLog.push({
        ts: Date.now(),
        cardId: card.id,
        q,
        wasNew,
      });
      if (d.reviewLog.length > 5000) d.reviewLog = d.reviewLog.slice(-5000);
    });

    setRevealed(false);
    setReviewed(n => n + 1);
  };

  const openCardModal = (initial?: { editId?: string; front?: string; back?: string; deck?: string; sourceNoteId?: string }) => {
    let fVal = initial?.front ?? "";
    let bVal = initial?.back ?? "";
    let dVal = initial?.deck ?? (s.flashcards[0]?.deck || "General");

    open({
      title: initial?.editId ? "Edit Flashcard" : "New Flashcard",
      body: (
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            if (!fVal.trim()) return;

            const clozeNodes = parseCloze(fVal);
            const isCloze = clozeNodes.length > 0;
            const pId = initial?.editId ? getParentId(initial.editId) : uid();

            if (initial?.editId) {
              up(d => {
                d.flashcards = d.flashcards.filter(c => getParentId(c.id) !== pId);
                if (isCloze) {
                  const siblings = syncClozeSiblings(pId, fVal, dVal, initial?.sourceNoteId, s.flashcards);
                  d.flashcards.push(...siblings);
                } else {
                  d.flashcards.unshift({
                    id: pId,
                    front: fVal,
                    back: bVal,
                    deck: dVal,
                    ef: 2.5,
                    interval: 0,
                    reps: 0,
                    due: Date.now(),
                    sourceNoteId: initial?.sourceNoteId,
                    lapses: 0,
                    history: [],
                  });
                }
              });
              toast("Card updated", "ok");
            } else {
              up(d => {
                if (isCloze) {
                  const siblings = syncClozeSiblings(pId, fVal, dVal, initial?.sourceNoteId, s.flashcards);
                  d.flashcards.push(...siblings);
                } else {
                  d.flashcards.unshift({
                    id: pId,
                    front: fVal,
                    back: bVal,
                    deck: dVal,
                    ef: 2.5,
                    interval: 0,
                    reps: 0,
                    due: Date.now(),
                    sourceNoteId: initial?.sourceNoteId,
                    lapses: 0,
                    history: [],
                  });
                }
              });
              toast(isCloze ? "Cloze deletion cards generated" : "Flashcard created", "ok");
            }
            close();
          }}
        >
          <div>
            <label className="field-label" htmlFor="card-deck">Deck</label>
            <input id="card-deck" className="input" defaultValue={dVal} onChange={e => { dVal = e.target.value; }} required />
          </div>
          <div>
            <label className="field-label" htmlFor="card-front">Front / Question</label>
            <textarea
              id="card-front"
              className="input min-h-[90px] font-mono text-xs"
              defaultValue={fVal}
              onChange={e => { fVal = e.target.value; }}
              placeholder="Use {{c1::cloze deletion}} for cloze cards"
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="card-back">Back / Answer (optional for cloze)</label>
            <textarea id="card-back" className="input min-h-[90px] font-mono text-xs" defaultValue={bVal} onChange={e => { bVal = e.target.value; }} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => close()}>Cancel</button>
            <button type="submit" className="btn btn-primary">{initial?.editId ? "Save Changes" : "Create Card"}</button>
          </div>
        </form>
      ),
    });
  };

  const deleteCard = (id: string) => {
    const pId = getParentId(id);
    up(d => {
      d.flashcards = d.flashcards.filter(c => getParentId(c.id) !== pId);
    });
    toast("Card removed", "ok");
  };

  const currentNote = s.notes.find(n => n.id === noteId);

  return (
    <div>
      <PageHeader
        kicker="memory, on schedule"
        title="Library"
        desc="SuperMemo SM-2 schedules every card at the edge of forgetting. Rate honestly — the algorithm does the rest."
        right={
          <>
            <Pill tone="cobalt">{dueCards.length} due now</Pill>
            <Pill>{s.flashcards.length} cards</Pill>
          </>
        }
      />

      <Tabs
        tabs={["Summary", "Notes", "Flashcards", "Deck Explorer"]}
        active={tab}
        onChange={setTab}
        className="mb-6"
      />

      {/* TAB 1: SUMMARY */}
      {tab === "Summary" && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="sheet p-5 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHead title="Deck Health & Diagnostics" />
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm" onClick={() => setShowAnalytics(a => !a)}>
                  {showAnalytics ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Analytics & Forecast
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setTab("Flashcards")}>
                  Start Review
                </button>
              </div>
            </div>

            {showAnalytics && (
              <div className="mt-4 rounded-xl border-2 p-4" style={{ borderColor: "var(--background-300)", background: "var(--background-50)" }}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--background-300)" }}>
                    <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--text-500)" }}>Overall Retention</p>
                    <p className="font-display text-2xl font-black" style={{ color: "var(--forest-700)" }}>
                      {Math.round(analytics.retentionRate * 100)}%
                    </p>
                    <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--text-500)" }}>{analytics.totalReviews} lifetime reviews</p>
                  </div>
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--background-300)" }}>
                    <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--text-500)" }}>Today Limit Burn</p>
                    <p className="font-display text-2xl font-black">{todayReviewsCount} <span className="font-mono text-xs font-normal" style={{ color: "var(--text-500)" }}>/ {dailyReviewLimit}</span></p>
                    <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--text-500)" }}>{todayNewCount} / {dailyNewLimit} new cards introduced</p>
                  </div>
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--background-300)" }}>
                    <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--text-500)" }}>Leech Detection</p>
                    <p className="font-display text-2xl font-black" style={{ color: analytics.leeches.length ? "var(--accent-600)" : "var(--forest-700)" }}>
                      {analytics.leeches.length} {analytics.leeches.length === 1 ? "card" : "cards"}
                    </p>
                    <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--text-500)" }}>lapsed ≥4 times by rule L-4</p>
                  </div>
                </div>

                {/* 14-day Due Forecast */}
                <div className="mt-4">
                  <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-700)" }}>14-Day Queue Forecast</p>
                  <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ height: "70px" }}>
                    {forecast.map((f, i) => (
                      <div key={f.date} className="flex flex-1 min-w-[20px] flex-col items-center justify-end h-full">
                        <span className="font-mono text-[9px]" style={{ color: "var(--text-500)" }}>{f.count}</span>
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: `${Math.max(4, Math.min(48, f.count * 8))}px`,
                            background: i === 0 ? "var(--accent-500)" : "var(--cobalt-500)",
                          }}
                          title={`${f.date}: ${f.count} cards due`}
                        />
                        <span className="font-mono text-[8px] truncate max-w-full" style={{ color: "var(--text-500)" }}>{f.date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {decks.map(([name, d]) => (
                <div key={name} className="rounded-xl border-2 p-4" style={{ borderColor: "var(--text-900)", background: "var(--background-50)", boxShadow: "3px 3px 0 var(--text-950)" }}>
                  <p className="font-display font-bold">{name}</p>
                  <p className="mt-1 font-mono text-xs" style={{ color: "var(--text-500)" }}>{d.total} cards · avg EF {(d.ef / d.total).toFixed(2)}</p>
                  <div className="gantt-track mt-2 !h-2.5">
                    <div className="gantt-bar" style={{ width: `${(d.due / d.total) * 100}%`, background: d.due ? "var(--accent-500)" : "var(--forest-500)" }} />
                  </div>
                  <p className="mt-1 text-xs font-bold" style={{ color: d.due ? "var(--accent-600)" : "var(--forest-700)" }}>{d.due ? `${d.due} due` : "all scheduled"}</p>
                </div>
              ))}
            </div>

            {/* Import / Export Decks row */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed pt-4" style={{ borderColor: "var(--background-300)" }}>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const csv = exportDeckToCSV(s.flashcards);
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `academia-deck-${todayKey}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast("Deck exported to CSV (formula-neutralized)", "ok");
                  }}
                >
                  <Download size={13} /> Export CSV
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const json = exportDeckToJSON(s.flashcards);
                    const blob = new Blob([json], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `academia-deck-${todayKey}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast("Deck exported to JSON", "ok");
                  }}
                >
                  <Download size={13} /> Export JSON
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const lean = exportDeckToJSONStripped(s.flashcards);
                    const blob = new Blob([lean], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `academia-deck-lean-${todayKey}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast("Exported lean JSON (history omitted)", "ok");
                  }}
                  title="Export lean JSON without card history for faster portable transfer"
                >
                  <Download size={13} /> Export JSON (lean)
                </button>
                <label className="btn btn-sm cursor-pointer">
                  <Upload size={13} /> Import CSV
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const text = await f.text();
                        const cards = importDeckFromCSV(text);
                        up(d => { d.flashcards.push(...cards); });
                        toast(`Imported ${cards.length} cards from CSV`, "ok");
                      } catch (err: unknown) {
                        toast(err instanceof Error ? err.message : "CSV import failed", "err");
                      }
                    }}
                  />
                </label>
                <label className="btn btn-sm cursor-pointer">
                  <Upload size={13} /> Import JSON
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const text = await f.text();
                        const cards = importDeckFromJSON(text);
                        up(d => { d.flashcards.push(...cards); });
                        toast(`Imported ${cards.length} cards from JSON`, "ok");
                      } catch (err: unknown) {
                        toast(err instanceof Error ? err.message : "JSON import failed", "err");
                      }
                    }}
                  />
                </label>
              </div>
              <button className="btn btn-sm" onClick={() => openCardModal()}>
                <Plus size={14} /> New Card
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: NOTES SHELF */}
      {tab === "Notes" && (
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <section className="sheet p-4 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--background-300)" }}>
              <SectionHead title="Notebooks" />
              <button
                className="btn btn-sm"
                onClick={() => {
                  const newId = uid();
                  up(d => {
                    d.notes.unshift({ id: newId, title: "Untitled Note", subject: "General", body: "Type your notes here...", updated: Date.now() });
                  });
                  setNoteId(newId);
                }}
              >
                <Plus size={13} />
              </button>
            </div>
            <div className="space-y-1 overflow-y-auto max-h-[500px]">
              {s.notes.map(n => (
                <div
                  key={n.id}
                  className={`cursor-pointer rounded-lg p-2.5 text-xs transition-colors ${n.id === noteId ? "font-bold border-2" : "border"}`}
                  style={{
                    borderColor: n.id === noteId ? "var(--cobalt-600)" : "var(--background-300)",
                    background: n.id === noteId ? "var(--background-100)" : "transparent",
                  }}
                  onClick={() => { setNoteId(n.id); setEditing(false); }}
                >
                  <p className="truncate font-display text-sm">{n.title}</p>
                  <p className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>{n.subject} · {fmtDate(n.updated)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="sheet p-5 space-y-4">
            {currentNote ? (
              <div>
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--background-300)" }}>
                  <div>
                    <h2 className="font-display text-2xl font-bold">{currentNote.title}</h2>
                    <span className="pill pill-tab !text-[10px] mt-1">{currentNote.subject}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        openCardModal({ sourceNoteId: currentNote.id, front: `From ${currentNote.title}: ` });
                      }}
                    >
                      <Plus size={13} /> Card From Note
                    </button>
                    <button className="btn btn-sm" onClick={() => { setEditing(!editing); setDraft(currentNote.body); }}>
                      <Pencil size={13} /> {editing ? "Preview" : "Edit"}
                    </button>
                  </div>
                </div>

                {editing ? (
                  <textarea
                    className="input min-h-[360px] font-mono text-sm leading-relaxed mt-4"
                    value={draft}
                    onChange={e => {
                      setDraft(e.target.value);
                      up(d => {
                        const target = d.notes.find(x => x.id === currentNote.id);
                        if (target) { target.body = e.target.value; target.updated = Date.now(); }
                      });
                    }}
                  />
                ) : (
                  <div ref={noteBodyRef} className="mt-4 prose prose-sm max-w-none font-serif leading-relaxed" style={{ color: "var(--text-900)" }}>
                    <p className="whitespace-pre-wrap">{currentNote.body}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState icon={<BookOpen size={36} />} title="No Notebook Selected" desc="Select a notebook from the shelf or create a new one to begin taking notes." />
            )}
          </section>
        </div>
      )}

      {/* TAB 3: FLASHCARDS (ACTIVE RECALL REVIEW) */}
      {tab === "Flashcards" && (
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs" style={{ color: "var(--text-500)" }}>
              session: {reviewed} rated · queue: {queue.length} {aheadMode ? "(practice ahead)" : "due"}
            </p>
            <div className="flex items-center gap-2">
              <button className="btn btn-sm" onClick={() => openCardModal()}>
                <Plus size={14} /> New Card
              </button>
              <button className="btn btn-sm" onClick={() => { setAheadMode(a => !a); setRevealed(false); }}>
                <RotateCcw size={14} /> {aheadMode ? "Due only" : "Practice ahead"}
              </button>
            </div>
          </div>

          {card ? (
            <div>
              <div className="sheet tape sheet-dotted relative flex min-h-[280px] flex-col items-center justify-center px-8 py-10 text-center">
                <span className="pill absolute left-4 top-4 !text-[10px]">{card.deck}</span>
                <span className="absolute right-4 top-4 font-mono text-[10px]" style={{ color: "var(--text-500)" }}>
                  EF {card.ef} · rep {card.reps} · {card.interval}d
                </span>

                <div className="font-display text-2xl font-bold leading-snug">
                  <CardFaceContent text={card.front} />
                </div>

                {revealed && (
                  <div className="mt-5 w-full border-t-2 border-dashed pt-5" style={{ borderColor: "var(--background-300)", animation: "popIn .25s var(--ease-snap)" }}>
                    <div className="text-[15px] leading-relaxed" style={{ color: "var(--text-700)" }}>
                      <CardFaceContent text={card.back} />
                    </div>

                    {card.sourceNoteId && (
                      <div className="mt-3">
                        <button
                          className="pill !bg-[var(--cobalt-100)] !text-[10px] hover:underline"
                          style={{ borderColor: "var(--cobalt-500)", color: "var(--cobalt-600)" }}
                          onClick={() => {
                            setNoteId(card.sourceNoteId!);
                            setTab("Notes");
                          }}
                        >
                          From Note: {s.notes.find(n => n.id === card.sourceNoteId)?.title ?? "Linked Note"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!revealed && (
                  <button className="btn btn-primary mt-7" onClick={() => setRevealed(true)}>
                    Show answer
                  </button>
                )}
              </div>

              {revealed && (
                <div className="mt-5">
                  <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>
                    Rate your recall (SM-2)
                  </p>
                  <div className="grid grid-cols-6 gap-2">
                    {[0, 1, 2, 3, 4, 5].map(q => (
                      <button
                        key={q}
                        title={SM2_LABELS[q]}
                        aria-label={`Rate ${q}: ${SM2_LABELS[q]}`}
                        className="btn !px-0 font-mono !text-base"
                        style={{
                          background: q < 3 ? "var(--accent-100)" : q === 5 ? "var(--forest-100)" : "var(--surface)",
                          borderColor: q < 3 ? "var(--accent-600)" : "var(--text-900)",
                        }}
                        onClick={() => rate(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-500)" }}>
                    <span>← lapse · resets</span>
                    <span className="text-right">perfect · grows →</span>
                  </div>
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => openCardModal({ editId: card.id, front: card.front, back: card.back, deck: card.deck, sourceNoteId: card.sourceNoteId })}
                >
                  <Pencil size={13} /> Edit card
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--accent-600)" }}
                  onClick={() => deleteCard(card.id)}
                >
                  <Trash2 size={13} /> Delete card
                </button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Layers size={36} />}
              title={reviewed > 0 ? "Queue cleared — well rated" : "Nothing due right now"}
              desc={
                todayReviewsCount >= dailyReviewLimit
                  ? `Daily review limit of ${dailyReviewLimit} cards reached for today. Reset at midnight.`
                  : reviewed > 0
                  ? `${reviewed} cards rescheduled. The next card surfaces exactly when SM-2 says so.`
                  : "SM-2 says your memory is holding. Practice ahead if you want, or close the book."
              }
            />
          )}
        </div>
      )}

      {/* TAB 4: VIRTUALIZED DECK EXPLORER (Strict ≤ 30 DOM Nodes) */}
      {tab === "Deck Explorer" && (
        <div className="space-y-4">
          <div className="sheet p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-[var(--text-700)]">Deck Filter:</span>
              <button
                className={`pill pill-tab !text-[11px] ${explorerDeck === "ALL" ? "font-bold" : ""}`}
                onClick={() => setExplorerDeck("ALL")}
              >
                All Decks ({s.flashcards.length})
              </button>
              {decks.map(([name, d]) => (
                <button
                  key={name}
                  className={`pill pill-tab !text-[11px] ${explorerDeck === name ? "font-bold" : ""}`}
                  onClick={() => setExplorerDeck(name)}
                >
                  {name} ({d.total})
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 min-w-[200px]">
              <div className="relative w-full">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-400)]" />
                <input
                  type="text"
                  className="input !h-8 !pl-8 !text-xs font-mono"
                  placeholder="Filter cards..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between font-mono text-xs" style={{ color: "var(--text-500)" }}>
            <span>Showing {explorerCards.length} card{explorerCards.length === 1 ? "" : "s"}</span>
            <span className="pill !text-[10px]">Max 30 Active DOM Nodes</span>
          </div>

          {explorerCards.length > 0 ? (
            <VirtualCardScroller
              cards={explorerCards}
              onEdit={c => openCardModal({ editId: c.id, front: c.front, back: c.back, deck: c.deck, sourceNoteId: c.sourceNoteId })}
              onDelete={id => deleteCard(id)}
            />
          ) : (
            <EmptyState
              icon={<Search size={32} />}
              title="No Matching Cards"
              desc="No flashcards match the current filter criteria or deck selection."
            />
          )}
        </div>
      )}
    </div>
  );
}
