/* Academia · Phase 3.2 — Library: summaries, notes, SM-2 active recall */
import { useMemo, useState } from "react";
import { BookOpen, Layers, Pencil, RotateCcw, Search } from "lucide-react";
import { useApp, fmtDate, uid } from "@/engine/store";
import { sm2, SM2_LABELS } from "@/engine/rules";
import { EmptyState, PageHeader, Pill, SectionHead, Tabs } from "@/components/ui";

export function LibraryView() {
  const { s, up, toast } = useApp();
  const noteParam = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("note");
  const [tab, setTab] = useState(noteParam ? "Notes" : "Flashcards");
  const [query, setQuery] = useState("");
  const [noteId, setNoteId] = useState(noteParam ?? s.notes[0]?.id ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [aheadMode, setAheadMode] = useState(false);

  const now = Date.now();
  const dueCards = useMemo(() => s.flashcards.filter(f => f.due <= now).sort((a, b) => a.due - b.due), [s.flashcards, now]);
  const aheadCards = useMemo(() => [...s.flashcards].sort((a, b) => a.due - b.due), [s.flashcards]);
  const queue = aheadMode ? aheadCards : dueCards;
  const card = queue[0];
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
    const updated = sm2(card, q);
    up(d => { const i = d.flashcards.findIndex(f => f.id === card.id); d.flashcards[i] = updated; });
    setReviewed(r => r + 1);
    setRevealed(false);
    toast(q < 3 ? `Reset — returns in 1 day (EF ${updated.ef})` : `Scheduled +${updated.interval}d (EF ${updated.ef})`, q < 3 ? "warn" : "ok");
  };

  const notes = s.notes.filter(n => (n.title + n.subject + n.body).toLowerCase().includes(query.toLowerCase()));
  const note = s.notes.find(n => n.id === noteId) ?? notes[0];

  return (
    <div>
      <PageHeader kicker="memory, on schedule" title="Library"
        desc="SuperMemo SM-2 schedules every card at the edge of forgetting. Rate honestly — the algorithm does the rest."
        right={<><Pill tone="cobalt">{dueCards.length} due now</Pill><Pill>{s.flashcards.length} cards</Pill></>} />
      <Tabs tabs={["Summary", "Notes", "Flashcards"]} active={tab} onChange={setTab} className="mb-6" />

      {tab === "Summary" && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="sheet p-5 md:col-span-2">
            <SectionHead title="Deck health" right={<button className="btn btn-primary btn-sm" onClick={() => setTab("Flashcards")}>Start review</button>} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {decks.map(([name, d]) => (
                <div key={name} className="rounded-xl border-2 p-4" style={{ borderColor: "var(--text-900)", background: "var(--background-50)", boxShadow: "3px 3px 0 var(--text-950)" }}>
                  <p className="font-display font-bold">{name}</p>
                  <p className="mt-1 font-mono text-xs" style={{ color: "var(--text-500)" }}>{d.total} cards · avg EF {(d.ef / d.total).toFixed(2)}</p>
                  <div className="gantt-track mt-2 !h-2.5"><div className="gantt-bar" style={{ width: `${(d.due / d.total) * 100}%`, background: d.due ? "var(--accent-500)" : "var(--forest-500)" }} /></div>
                  <p className="mt-1 text-xs font-bold" style={{ color: d.due ? "var(--accent-600)" : "var(--forest-700)" }}>{d.due ? `${d.due} due` : "all scheduled"}</p>
                </div>
              ))}
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
                <button className="btn btn-sm" onClick={() => { setEditing(e => !e); setDraft(note.body); }}>
                  <Pencil size={14} /> {editing ? "Cancel" : "Edit"}
                </button>
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
                <p className="mt-4 whitespace-pre-wrap text-[15px] leading-8">{note.body}</p>
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
            <button className="btn btn-sm" onClick={() => { setAheadMode(a => !a); setRevealed(false); }}>
              <RotateCcw size={14} /> {aheadMode ? "Due only" : "Practice ahead"}
            </button>
          </div>
          {card ? (
            <div>
              <div className="sheet tape sheet-dotted relative flex min-h-[280px] flex-col items-center justify-center px-8 py-10 text-center">
                <span className="pill absolute left-4 top-4 !text-[10px]">{card.deck}</span>
                <span className="absolute right-4 top-4 font-mono text-[10px]" style={{ color: "var(--text-500)" }}>EF {card.ef} · rep {card.reps} · {card.interval}d</span>
                <p className="font-display text-2xl font-bold leading-snug">{card.front}</p>
                {revealed && (
                  <div className="mt-5 w-full border-t-2 border-dashed pt-5" style={{ borderColor: "var(--background-300)", animation: "popIn .25s var(--ease-snap)" }}>
                    <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-700)" }}>{card.back}</p>
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
            </div>
          ) : (
            <EmptyState icon={<Layers size={36} />} title={reviewed > 0 ? "Queue cleared — well rated" : "Nothing due right now"}
              desc={reviewed > 0 ? `${reviewed} cards rescheduled. The next card surfaces exactly when SM-2 says so.` : "SM-2 says your memory is holding. Practice ahead if you want, or close the book."} />
          )}
          <div className="mt-6 flex justify-center">
            <button className="btn btn-sm" onClick={() => {
              up(d => { d.flashcards.push({ id: uid(), front: "New card — edit me in a note first", back: "Answer side", deck: "Algorithms", ef: 2.5, interval: 0, reps: 0, due: Date.now() }); });
              toast("Blank card added to Algorithms deck", "info");
            }}>+ Add blank card</button>
          </div>
        </div>
      )}
    </div>
  );
}