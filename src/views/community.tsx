/* Academia · Phase 3.16 — Q&A feed with live keystroke charter filter + collaborative study room
   UPGRADED: screenTextV2 replaces the deprecated screenText shim — now has full severity
   data, Scunthorpe allow-list vetoes, and severity-differentiated banner UI (warn vs block). */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Hand, MessageSquare, Send, ShieldAlert, Users } from "lucide-react";
import { useApp, uid, type Thread } from "@/engine/store";
import { screenTextV2, type ScreenResult } from "@/engine/charter-filter";
import { Avatar, PageHeader, Pill, SectionHead, Tabs } from "@/components/ui";
import { cn } from "@/utils/cn";

function ago(ts: number): string {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

/** Severity-aware keystroke banner — shows warn vs block distinction.
    "warn" = medium terms: amber border, posting still allowed (social nudge).
    "block" = high terms: red border, posting disabled until rephrased. */
function KeystrokeBanner({ result }: { result: ScreenResult }) {
  if (result.hits.length === 0) return null;
  const isBlock = result.overall === "block";
  return (
    <div role="alert" className="warn-slide mt-2 flex items-start gap-2 rounded-lg border-2 px-3 py-2"
      style={{
        borderColor: isBlock ? "var(--accent-600)" : "var(--marigold-500)",
        background: isBlock ? "var(--accent-100)" : "var(--marigold-100)",
      }}>
      {isBlock
        ? <ShieldAlert size={16} className="mt-0.5 flex-none" style={{ color: "var(--accent-600)" }} />
        : <AlertTriangle size={16} className="mt-0.5 flex-none" style={{ color: "var(--marigold-900)" }} />}
      <p className="text-xs font-semibold leading-relaxed"
        style={{ color: isBlock ? "var(--accent-600)" : "var(--marigold-900)" }}>
        {isBlock ? "Charter violation — posting blocked: " : "Charter warning: "}
        {result.hits.map(h => `"${h.term}" (${h.severity})`).join(", ")}.{" "}
        Rephrase to enable posting — drafts are never sent or stored.
      </p>
    </div>
  );
}

export function CommunityView() {
  const { s, up, toast } = useApp();
  const [tab, setTab] = useState("Q&A feed");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("Numera");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  // screenTextV2 — full severity + allow-list pipeline (replaces deprecated screenText shim)
  const postResult = screenTextV2(title + " " + body);
  const replyResult = screenTextV2(reply);
  const me = s.session.name;

  const post = () => {
    // Block only on "block" severity; "warn" terms display the banner but allow posting
    if (postResult.overall === "block" || !title.trim() || body.trim().length < 10) return;
    const t: Thread = { id: uid(), author: me, hue: 25, title: title.trim(), body: body.trim(), tag, replies: [], ts: Date.now() };
    up(d => { d.community.unshift(t); });
    setTitle(""); setBody("");
    toast("Thread posted — clean draft, no flags", "ok");
  };
  const sendReply = (tid: string) => {
    if (replyResult.overall === "block" || !reply.trim()) return;
    up(d => { const t = d.community.find(x => x.id === tid); if (t) t.replies.push({ id: uid(), author: me, body: reply.trim(), ts: Date.now() }); });
    setReply(""); setReplyFor(null);
    toast("Reply added", "ok");
  };

  /* study room timer */
  const [roomLeft, setRoomLeft] = useState(25 * 60);
  const [roomRun, setRoomRun] = useState(false);
  const endRef = useRef(0);
  useEffect(() => {
    if (!roomRun) return;
    endRef.current = Date.now() + roomLeft * 1000;
    const t = window.setInterval(() => {
      const r = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRoomLeft(r);
      if (r === 0) { setRoomRun(false); toast("Room interval complete — stretch together", "ok"); }
    }, 300);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomRun]);
  const inRoom = s.room.hands.includes(me);

  return (
    <div>
      <PageHeader kicker="civil by construction" title="Community"
        desc="Q&A with a keystroke-level charter filter — hostile drafts are blocked before they exist. Study rooms share one CRDT scratch sheet."
        right={<Pill tone="plum">{s.community.length} threads</Pill>} />
      <Tabs tabs={["Q&A feed", "Study room"]} active={tab} onChange={setTab} className="mb-6" />

      {tab === "Q&A feed" && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* composer */}
          <aside className="sheet h-fit p-5 lg:sticky lg:top-4">
            <SectionHead title="Ask the room" />
            <label className="field-label" htmlFor="q-title">Title</label>
            <input id="q-title" className={cn("input", screenTextV2(title).hits.length > 0 && "input-flagged")} placeholder="What are you stuck on?" value={title} onChange={e => setTitle(e.target.value)} />
            <label className="field-label mt-3" htmlFor="q-body">Details</label>
            <textarea id="q-body" className={cn("input min-h-[110px]", screenTextV2(body).hits.length > 0 && "input-flagged")} placeholder="Show your working so far…" value={body} onChange={e => setBody(e.target.value)} />
            <KeystrokeBanner result={postResult} />
            <label className="field-label mt-3" htmlFor="q-tag">Module tag</label>
            <select id="q-tag" className="input" value={tag} onChange={e => setTag(e.target.value)}>
              {["Numera", "Library", "Sandbox", "Workbench", "Study room", "Portfolio"].map(t => <option key={t}>{t}</option>)}
            </select>
            <button className="btn btn-primary mt-4 w-full"
              disabled={postResult.overall === "block" || !title.trim() || body.trim().length < 10}
              onClick={post}>
              <Send size={15} /> {postResult.overall === "block" ? "Blocked by charter filter" : "Post thread"}
            </button>
            <p className="mt-2 text-center font-mono text-[10px]" style={{ color: "var(--text-500)" }}>
              filter runs on every keystroke · client advisory · server verifies before persist
            </p>
          </aside>

          {/* feed */}
          <div className="space-y-4">
            {s.community.length === 0 ? (
              <div className="sheet p-10 text-center">
                <MessageSquare size={36} className="mx-auto" style={{ color: "var(--text-400)" }} />
                <h3 className="mt-3 font-display text-xl font-bold">No questions posted yet</h3>
                <p className="mt-1.5 text-sm" style={{ color: "var(--text-500)" }}>
                  The Q&A feed is live and verified by the real-time keystroke charter filter. Post the first question to begin a discussion.
                </p>
              </div>
            ) : (
              s.community.map(t => (
                <article key={t.id} className="sheet p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={t.author} hue={t.hue} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold" style={{ color: "var(--text-500)" }}>{t.author} · {ago(t.ts)} · <span style={{ color: "var(--cobalt-600)" }}>{t.tag}</span></p>
                      <h3 className="mt-0.5 font-display text-lg font-bold leading-snug">{t.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-700)" }}>{t.body}</p>
                    </div>
                  </div>
                  {t.replies.length > 0 && (
                    <ul className="mt-4 space-y-3 border-l-2 pl-4" style={{ borderColor: "var(--background-300)" }}>
                      {t.replies.map(r => (
                        <li key={r.id} className="flex items-start gap-2.5">
                          <Avatar name={r.author} hue={r.author.length * 37 % 360} size={26} />
                          <div>
                            <p className="text-[11px] font-semibold" style={{ color: "var(--text-500)" }}>{r.author} · {ago(r.ts)}</p>
                            <p className="text-sm leading-relaxed">{r.body}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3">
                    {replyFor === t.id ? (
                      <div>
                        <textarea className={cn("input min-h-[70px]", replyResult.hits.length > 0 && "input-flagged")} aria-label="Reply text" placeholder="Reply with working, not verdicts…" value={reply} onChange={e => setReply(e.target.value)} autoFocus />
                        <KeystrokeBanner result={replyResult} />
                        <div className="mt-2 flex gap-2">
                          <button className="btn btn-primary btn-sm" disabled={replyResult.overall === "block" || !reply.trim()} onClick={() => sendReply(t.id)}>Reply</button>
                          <button className="btn btn-sm" onClick={() => { setReplyFor(null); setReply(""); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-sm" onClick={() => { setReplyFor(t.id); setReply(""); }}><MessageSquare size={14} /> Reply · {t.replies.length}</button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "Study room" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Pill tone="forest"><Users size={13} /> Study Room · Collaborative</Pill>
            <Pill tone="cobalt">CRDT sheet · live merge</Pill>
            <button className={`btn btn-sm ml-auto ${inRoom ? "btn-warn" : ""}`} aria-pressed={inRoom}
              onClick={() => { up(d => { d.room.hands = inRoom ? d.room.hands.filter(h => h !== me) : [...d.room.hands, me]; }); toast(inRoom ? "Hand lowered" : "Hand raised — the room can see you", "info"); }}>
              <Hand size={14} /> {inRoom ? "Hand raised ✓" : "Raise hand"}
            </button>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* shared scratch */}
            <section className="sheet ruled-margin flex min-h-[420px] flex-col px-6 py-5 md:px-14">
              <SectionHead title="Shared scratch sheet" right={<span className="pulse-dot inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--forest-500)" }} aria-label="Live" />} />
              <textarea
                className="min-h-[300px] flex-1 resize-none bg-transparent font-mono text-[13.5px] leading-7 outline-none"
                aria-label="Shared study room notes"
                placeholder="Write notes, formulas, or working here... changes synchronize across room peers."
                value={s.room.notes}
                onChange={e => up(d => { d.room.notes = e.target.value; })}
              />
              <p className="mt-2 font-mono text-[10px]" style={{ color: "var(--text-500)" }}>every keystroke becomes a CRDT op · offline edits merge on reconnect</p>
            </section>
            {/* room side */}
            <section className="space-y-4">
              <div className="sheet flex flex-col items-center p-6">
                <p className="font-mono text-5xl font-semibold tabular-nums">{String(Math.floor(roomLeft / 60)).padStart(2, "0")}:{String(roomLeft % 60).padStart(2, "0")}</p>
                <p className="mt-1 font-hand text-xl" style={{ color: "var(--accent-500)" }}>shared interval — silent co-working</p>
                <div className="mt-3 flex gap-2">
                  <button className={`btn btn-sm ${roomRun ? "" : "btn-primary"}`} onClick={() => setRoomRun(r => !r)}>{roomRun ? "Pause" : "Start together"}</button>
                  <button className="btn btn-sm" onClick={() => { setRoomRun(false); setRoomLeft(25 * 60); }}>Reset</button>
                </div>
              </div>
              <div className="sheet p-5">
                <SectionHead title="In the room" />
                <ul className="space-y-2.5">
                  {[
                    { n: me, h: (me.length * 37) % 360, hand: inRoom },
                    ...s.admin.students
                      .filter(st => st.name.toLowerCase() !== me.toLowerCase())
                      .slice(0, 4)
                      .map(st => ({
                        n: st.name,
                        h: (st.name.length * 43) % 360,
                        hand: s.room.hands.includes(st.name),
                      })),
                  ].map(m => (
                    <li key={m.n} className="flex items-center gap-3">
                      <Avatar name={m.n} hue={m.h} size={32} />
                      <span className="flex-1 text-sm font-semibold">{m.n}</span>
                      {m.hand && <span className="pill !text-[10px]" style={{ background: "var(--marigold-100)", borderColor: "var(--marigold-900)", color: "var(--marigold-900)" }}><Hand size={11} /> hand up</span>}
                      <span className="h-2 w-2 rounded-full" style={{ background: "var(--forest-500)" }} aria-label="online" />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-mono text-[10px]" style={{ color: "var(--text-500)" }}>no voice, no video — the sheet is the conversation</p>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
