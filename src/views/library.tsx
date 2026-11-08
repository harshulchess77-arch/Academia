/* Academia · Phase 3.2 — Library: summaries, notes, SM-2 active recall */
import { useMemo, useRef, useState } from "react";
import { AlertCircle, BookOpen, ChevronDown, ChevronUp, Download, Layers, Pencil, Plus, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import { useApp, fmtDate, uid, dayKey } from "@/engine/store";
import { sm2, SM2_LABELS } from "@/engine/rules";
import { useModal } from "@/engine/modal";
import { EmptyState, PageHeader, Pill, SectionHead, Tabs } from "@/components/ui";
import { CardFaceContent } from "@/engine/card-render";
import { parseCloze, syncClozeSiblings, getParentId } from "@/engine/cloze";
import { computeDeckAnalytics, forecastDueCards } from "@/engine/library-analytics";
import { exportDeckToCSV, importDeckFromCSV, exportDeckToJSON, importDeckFromJSON } from "@/engine/library-io";

export function LibraryView() {
  const { s, up, toast } = useApp();
  const { open, close } = useModal();
  const noteParam = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("note");
  const [tab, setTab] = useState(noteParam ? "Notes" : "Flashcards");
  const [query, setQuery] = useState("");
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
    if (aheadMode) return base;
    // Check if daily review limit is reached
    if (todayReviewsCount >= dailyReviewLimit) return [];
    // Filter new cards if new limit is reached
    return base.filter(c => {
      const isNew = c.reps === 0;
      if (isNew && todayNewCount >= dailyNewLimit) return false;
      return true;
    });
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
      const d = m.get(f.deck) ?? { total: 0, due: 0, ef: 0 };
      d.total++; if (f.due <= now) d.due++; d.ef += f.ef;
      m.set(f.deck, d);
    }
    return [...m.entries()];
  }, [s.flashcards, now]);

  const rate = (q: number) => {
    if (!card) return;
    const wasNew = card.reps === 0;
    const updated = sm2(card, q);

    // Track lapses and history
    const isLapse = q < 3;
    const lapses = (card.lapses ?? 0) + (isLapse ? 1 : 0);
    const history = [...(card.history ?? []), q].slice(-50);

    const cardWithMetrics = { ...updated, lapses, history };

    up(d => {
      const i = d.flashcards.findIndex(f => f.id === card.id);
      if (i >= 0) d.flashcards[i] = cardWithMetrics;

      // Append to reviewLog ring buffer (5,000 max)
      if (!Array.isArray(d.reviewLog)) d.reviewLog = [];
      d.reviewLog.push({ cardId: card.id, q, ts: Date.now(), wasNew });
      if (d.reviewLog.length > 5000) d.reviewLog.shift();
    });

    setReviewed(r => r + 1);
    setRevealed(false);
    toast(q < 3 ? `Reset — returns in 1 day (EF ${updated.ef})` : `Scheduled +${updated.interval}d (EF ${updated.ef})`, q < 3 ? "warn" : "ok");
  };

  const notes = s.notes.filter(n => (n.title + n.subject + n.body).toLowerCase().includes(query.toLowerCase()));
  const note = s.notes.find(n => n.id === noteId) ?? notes[0];

  // Helper to open Card creation modal
  const openCardModal = (initial?: { front?: string; back?: string; deck?: string; sourceNoteId?: string; editId?: string }) => {
    let fVal = initial?.front ?? "";
    let bVal = initial?.back ?? "";
    let dVal = initial?.deck ?? (s.flashcards[0]?.deck || "General");

    open({
      title: initial?.editId ? "Edit flashcard" : "New flashcard",
      body: (
        <form className="space-y-4 text-sm" onSubmit={e => {
          e.preventDefault();
          if (!fVal.trim()) return;

          // Check if cloze
          const isCloze = parseCloze(fVal).length > 0;
          up(d => {
            if (initial?.editId) {
              const pId = getParentId(initial.editId);
              // Remove existing siblings or card
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
                  lapses: 0,
                  history: [],
                  sourceNoteId: initial?.sourceNoteId,
                });
              }
            } else {
              const newId = uid();
              if (isCloze) {
                const siblings = syncClozeSiblings(newId, fVal, dVal, initial?.sourceNoteId, []);
                d.flashcards.push(...siblings);
              } else {
                d.flashcards.unshift({
                  id: newId,
                  front: fVal,
                  back: bVal,
                  deck: dVal,
                  ef: 2.5,
                  interval: 0,
                  reps: 0,
                  due: Date.now(),
                  lapses: 0,
                  history: [],
                  sourceNoteId: initial?.sourceNoteId,
                });
              }
            }
          });
          close();
          toast(initial?.editId ? "Card updated" : "Card created", "ok");
        }}>
          <div>
            <label className="field-label" htmlFor="card-deck">Deck</label>
            <input id="card-deck" className="input" defaultValue={dVal} onChange={e => { dVal = e.target.value; }} required />
          </div>
          <div>
            <label className="field-label" htmlFor="card-front">Front / Question / Cloze</label>
            <textarea id="card-front" className="input min-h-[90px] font-mono text-xs" defaultValue={fVal} onChange={e => { fVal = e.target.value; }} placeholder="Use {{c1::cloze deletion}} for cloze cards" required />
            <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--text-500)" }}>Supports **bold**, *italic*, `code`, and $plain-text math$.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="card-back">Back / Answer (optional for cloze)</label>
            <textarea id="card-back" className="input min-h-[70px] font-mono text-xs" defaultValue={bVal} onChange={e => { bVal = e.target.value; }} placeholder="Answer revealed on flip" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn" onClick={() => close()}>Cancel</button>
            <button type="submit" className="btn btn-primary">{initial?.editId ? "Update card" : "Save card"}</button>
          </div>
        </form>
      ),
    });
  };

  // Note selection helper
  const makeCardFromSelection = () => {
    const sel = window.getSelection()?.toString().trim();
    if (!sel) {
      toast("Select text inside the note first to create a card", "warn");
      return;
    }
    openCardModal({ front: `{{c1::${sel}}}`, back: sel, deck: note?.subject || "General", sourceNoteId: note?.id });
  };

  const deleteCard = (cardId: string) => {
    const pId = getParentId(cardId);
    up(d => {
      d.flashcards = d.flashcards.filter(c => getParentId(c.id) !== pId);
    });
    toast("Card deleted", "ok");
  };

  return (
    <div>
      <PageHeader kicker="memory, on schedule" title="Library"
        desc="SuperMemo SM-2 schedules every card at the edge of forgetting. Rate honestly — the algorithm does the rest."
        right={<><Pill tone="cobalt">{dueCards.length} due now</Pill><Pill>{s.flashcards.length} cards</Pill></>} />
      <Tabs tabs={["Summary", "Notes", "Flashcards"]} active={tab} onChange={setTab} className="mb-6" />

      {tab === "Summary" && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="sheet p-5 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHead title="Deck health" />
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm" onClick={() => setShowAnalytics(a => !a)}>
                  {showAnalytics ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Analytics & Forecast
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setTab("Flashcards")}>Start review</button>
              </div>
            </div>

            {/* Collapsible Analytics Panel - default collapsed */}
            {showAnalytics && (
              <div className="mt-4 rounded-xl border-2 p-4" style={{ borderColor: "var(--background-300)", background: "var(--background-50)" }}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--background-300)" }}>
                    <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--text-500)" }}>Overall Retention</p>
                    <p className="font-display text-2xl font-black" style={{ color: "var(--forest-700)" }}>{Math.round(analytics.retentionRate * 100)}%</p>
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

                {/* Leech list */}
                {analytics.leeches.length > 0 && (
                  <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--background-300)" }}>
                    <p className="flex items-center gap-1.5 font-bold text-xs" style={{ color: "var(--accent-600)" }}>
                      <AlertCircle size={14} /> Attention: Review Leech Warnings
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {analytics.leeches.map(l => (
                        <li key={l.card.id} className="text-xs font-mono" style={{ color: "var(--text-700)" }}>
                          • {l.card.front.slice(0, 45)}… ({l.suggestion})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {decks.map(([name, d]) => (
                <div key={name} className="rounded-xl border-2 p-4" style={{ borderColor: "var(--text-900)", background: "var(--background-50)", boxShadow: "3px 3px 0 var(--text-950)" }}>
                  <p className="font-display font-bold">{name}</p>
                  <p className="mt-1 font-mono text-xs" style={{ color: "var(--text-500)" }}>{d.total} cards · avg EF {(d.ef / d.total).toFixed(2)}</p>
                  <div className="gantt-track mt-2 !h-2.5"><div className="gantt-bar" style={{ width: `${(d.due / d.total) * 100}%`, background: d.due ? "var(--accent-500)" : "var(--forest-500)" }} /></div>
                  <p className="mt-1 text-xs font-bold" style={{ color: d.due ? "var(--accent-600)" : "var(--forest-700)" }}>{d.due ? `${d.due} due` : "all scheduled"}</p>
                </div>
              ))}
            </div>

            {/* Import / Export Decks row */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed pt-4" style={{ borderColor: "var(--background-300)" }}>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm" onClick={() => {
                  const csv = exportDeckToCSV(s.flashcards);
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `academia-deck-${todayKey}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast("Deck exported to CSV (formula-neutralized)", "ok");
                }}><Download size={13} /> Export CSV</button>
                <button className="btn btn-sm" onClick={() => {
                  const json = exportDeckToJSON(s.flashcards);
                  const blob = new Blob([json], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `academia-deck-${todayKey}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast("Deck exported to JSON", "ok");
                }}><Download size={13} /> Export JSON</button>
                <label className="btn btn-sm cursor-pointer">
                  <Upload size={13} /> Import CSV
                  <input type="file" accept=".csv" className="hidden" onChange={async e => {
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
                  }} />
                </label>
                <label className="btn btn-sm cursor-pointer">
                  <Upload size={13} /> Import JSON
                  <input type="file" accept=".json" className="hidden" onChange={async e => {
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
                  }} />
                </label>
              </div>
              <button className="btn btn-sm" onClick={() => openCardModal()}>
                <Plus size={14} /> New card
              </button>
            </div>
          </section>

          <section className="sheet p-5">
            <SectionHead title="How SM-2 schedules you" />
            <ul className="space-y-2 text-sm" style={{ color: "var(--text-700)" }}>
              <li><strong>0–2</strong> · lapse: reps reset, card returns tomorrow.</li>
              <li><strong>3–5</strong> · interval grows: 1d → 6d → interval × EF.</li>
              <li><strong>EF</strong> (ease factor) drifts with your honesty, floored at 1.3.</li>
              <li>No streaks, no notifications — the queue is the whole product.</li>
            </ul>
          </section>
          <section className="sheet p-5">
            <SectionHead title="Notebook shelf" />
            <ul className="space-y-2">
              {s.notes.map(n => (
                <li key={n.id}>
                  <button className="flex w-full items-center justify-between rounded-lg border-2 px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--background-200)]" style={{ borderColor: "var(--background-300)" }}
                    onClick={() => { setNoteId(n.id); setTab("Notes"); }}>
                    <span>{n.title}</span>
                    <span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>{fmtDate(n.updated)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === "Notes" && (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-300)" }} />
              <input className="input !pl-9" placeholder="Search notes…" aria-label="Search notes" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <ul className="space-y-2">
              {notes.map(n => (
                <li key={n.id}>
                  <button className="w-full rounded-xl border-2 p-3 text-left transition-all"
                    style={n.id === note?.id ? { borderColor: "var(--text-900)", background: "var(--marigold-100)", boxShadow: "3px 3px 0 var(--text-950)" } : { borderColor: "var(--background-300)", background: "var(--surface)" }}
                    onClick={() => { setNoteId(n.id); setEditing(false); }}>
                    <p className="text-sm font-bold">{n.title}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-500)" }}>{n.subject} · {fmtDate(n.updated)}</p>
                  </button>
                </li>
              ))}
              {notes.length === 0 && <p className="p-3 text-sm" style={{ color: "var(--text-500)" }}>No notes match “{query}”.</p>}
            </ul>
          </div>
          {note ? (
            <article className="sheet ruled-margin min-h-[420px] px-6 py-6 md:px-14">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-hand text-xl" style={{ color: "var(--cobalt-500)" }}>{note.subject}</p>
                  <h2 className="font-display text-2xl font-black">{note.title}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-sm" onClick={makeCardFromSelection} title="Create flashcard from selected text">
                    + Card from selection
                  </button>
                  <button className="btn btn-sm" onClick={() => { setEditing(e => !e); setDraft(note.body); }}>
                    <Pencil size={14} /> {editing ? "Cancel" : "Edit"}
                  </button>
                </div>
              </div>
              {editing ? (
                <div className="mt-4">
                  <textarea className="input min-h-[240px] font-mono !text-[13px]" value={draft} onChange={e => setDraft(e.target.value)} aria-label="Note body" />
                  <button className="btn btn-primary mt-3" onClick={() => {
                    up(d => { const n = d.notes.find(x => x.id === note.id); if (n) { n.body = draft; n.updated = Date.now(); } });
                    setEditing(false); toast("Note saved to local vault", "ok");
                  }}>Save note</button>
                </div>
              ) : (
                <p ref={noteBodyRef} className="mt-4 whitespace-pre-wrap text-[15px] leading-8 select-text">{note.body}</p>
              )}
            </article>
          ) : <EmptyState icon={<BookOpen size={36} />} title="No note selected" desc="Pick a note from the shelf." />}
        </div>
      )}

      {tab === "Flashcards" && (
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs" style={{ color: "var(--text-500)" }}>
              session: {reviewed} rated · queue: {queue.length} {aheadMode ? "(practice ahead)" : "due"}
            </p>
            <div className="flex items-center gap-2">
              <button className="btn btn-sm" onClick={() => openCardModal()}>
                <Plus size={14} /> New card
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
                <span className="absolute right-4 top-4 font-mono text-[10px]" style={{ color: "var(--text-500)" }}>EF {card.ef} · rep {card.reps} · {card.interval}d</span>

                {/* Card front with Markdown-lite and inline math */}
                <div className="font-display text-2xl font-bold leading-snug">
                  <CardFaceContent text={card.front} />
                </div>

                {revealed && (
                  <div className="mt-5 w-full border-t-2 border-dashed pt-5" style={{ borderColor: "var(--background-300)", animation: "popIn .25s var(--ease-snap)" }}>
                    <div className="text-[15px] leading-relaxed" style={{ color: "var(--text-700)" }}>
                      <CardFaceContent text={card.back} />
                    </div>

                    {/* Linked note pill */}
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
                  <button className="btn btn-primary mt-7" onClick={() => setRevealed(true)}>Show answer</button>
                )}
              </div>
              {revealed && (
                <div className="mt-5">
                  <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-500)" }}>Rate your recall (SM-2)</p>
                  <div className="grid grid-cols-6 gap-2">
                    {[0, 1, 2, 3, 4, 5].map(q => (
                      <button key={q} title={SM2_LABELS[q]} aria-label={`Rate ${q}: ${SM2_LABELS[q]}`}
                        className="btn !px-0 font-mono !text-base"
                        style={{ background: q < 3 ? "var(--accent-100)" : q === 5 ? "var(--forest-100)" : "var(--surface)", borderColor: q < 3 ? "var(--accent-600)" : "var(--text-900)" }}
                        onClick={() => rate(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-500)" }}>
                    <span>← lapse · resets</span><span className="text-right">perfect · grows →</span>
                  </div>
                </div>
              )}

              {/* Card Actions: Edit / Delete */}
              <div className="mt-4 flex justify-end gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => openCardModal({ editId: card.id, front: card.front, back: card.back, deck: card.deck, sourceNoteId: card.sourceNoteId })}>
                  <Pencil size={13} /> Edit card
                </button>
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--accent-600)" }} onClick={() => deleteCard(card.id)}>
                  <Trash2 size={13} /> Delete card
                </button>
              </div>
            </div>
          ) : (
            <EmptyState icon={<Layers size={36} />} title={reviewed > 0 ? "Queue cleared — well rated" : "Nothing due right now"}
              desc={todayReviewsCount >= dailyReviewLimit ? `Daily review limit of ${dailyReviewLimit} cards reached for today. Reset at midnight.` : reviewed > 0 ? `${reviewed} cards rescheduled. The next card surfaces exactly when SM-2 says so.` : "SM-2 says your memory is holding. Practice ahead if you want, or close the book."} />
          )}
        </div>
      )}
    </div>
  );
}