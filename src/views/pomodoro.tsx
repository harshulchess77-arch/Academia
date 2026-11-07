/* Academia · Phase 3.13 — focus timer + non-addictive study heatmap */
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useApp, dayKey } from "@/engine/store";
import { PageHeader, Pill, SectionHead } from "@/components/ui";

function chime() {
  try {
    const AC = window.AudioContext;
    const ctx = new AC();
    const notes = [660, 880];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.55);
    });
    window.setTimeout(() => ctx.close(), 1500);
  } catch { /* audio unavailable — silent completion */ }
}

export function PomodoroView() {
  const { s, up, toast } = useApp();
  const [mode, setMode] = useState<"Focus" | "Break">("Focus");
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(s.pomodoro.focusMin * 60);
  const [sound, setSound] = useState(true);
  const endAt = useRef(0);
  const total = (mode === "Focus" ? s.pomodoro.focusMin : s.pomodoro.breakMin) * 60;

  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + left * 1000;
    const t = window.setInterval(() => {
      const remain = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(remain);
      if (remain === 0) {
        setRunning(false);
        if (sound) chime();
        if (mode === "Focus") {
          const mins = s.pomodoro.focusMin;
          up(d => { const k = dayKey(Date.now()); d.pomodoro.sessions[k] = (d.pomodoro.sessions[k] ?? 0) + mins; });
          toast(`+${mins} min logged — take your break`, "ok");
          setMode("Break"); setLeft(s.pomodoro.breakMin * 60);
        } else {
          toast("Break over — the desk is yours again", "info");
          setMode("Focus"); setLeft(s.pomodoro.focusMin * 60);
        }
      }
    }, 250);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode]);

  useEffect(() => { if (!running) setLeft((mode === "Focus" ? s.pomodoro.focusMin : s.pomodoro.breakMin) * 60); }, [s.pomodoro.focusMin, s.pomodoro.breakMin, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const frac = total ? 1 - left / total : 0;
  const C = 2 * Math.PI * 120;

  /* heatmap: 20 weeks × 7 */
  const weeks = 20;
  const todayD = new Date();
  const cells: { key: string; mins: number; date: Date }[] = [];
  const start = new Date(todayD); start.setDate(start.getDate() - (weeks * 7 - 1) - todayD.getDay());
  for (let i = 0; i < weeks * 7 + todayD.getDay() + 1; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (d > todayD) break;
    const key = dayKey(d.getTime());
    cells.push({ key, mins: s.pomodoro.sessions[key] ?? 0, date: d });
  }
  const totalMin = Object.values(s.pomodoro.sessions).reduce((a, b) => a + b, 0);
  const activeDays = Object.values(s.pomodoro.sessions).filter(v => v > 0).length;
  const heat = (m: number) => m === 0 ? "var(--background-200)" : m < 30 ? "color-mix(in srgb, var(--forest-500) 30%, var(--surface))" : m < 60 ? "color-mix(in srgb, var(--forest-500) 55%, var(--surface))" : m < 90 ? "color-mix(in srgb, var(--forest-500) 80%, var(--surface))" : "var(--forest-500)";

  return (
    <div>
      <PageHeader kicker="attention is the syllabus" title="Pomodoro"
        desc="Fixed intervals, a soft chime, and a heatmap that records — never nags. There are no streaks to lose here."
        right={<button className="btn btn-sm" aria-pressed={sound} onClick={() => setSound(v => !v)}>{sound ? <Volume2 size={15} /> : <VolumeX size={15} />} Chime {sound ? "on" : "off"}</button>} />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="sheet tape flex flex-col items-center px-6 py-8">
          <div className="flex gap-2" role="tablist" aria-label="Timer mode">
            {(["Focus", "Break"] as const).map(m => (
              <button key={m} role="tab" aria-selected={mode === m} className="pill pill-tab" onClick={() => { setMode(m); setRunning(false); setLeft((m === "Focus" ? s.pomodoro.focusMin : s.pomodoro.breakMin) * 60); }}>{m}</button>
            ))}
          </div>
          <div className="relative mt-6" role="timer" aria-label={`${mode} timer: ${mm} minutes ${ss} seconds remaining`}>
            <svg width={280} height={280} viewBox="0 0 280 280">
              <circle cx={140} cy={140} r={120} fill="none" stroke="var(--background-200)" strokeWidth={14} />
              <circle cx={140} cy={140} r={120} fill="none" stroke={mode === "Focus" ? "var(--accent-500)" : "var(--forest-500)"} strokeWidth={14} strokeLinecap="round"
                strokeDasharray={`${frac * C} ${C}`} transform="rotate(-90 140 140)" style={{ transition: "stroke-dasharray .3s linear" }} />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="font-mono text-6xl font-semibold tabular-nums">{mm}:{ss}</p>
                <p className="mt-1 font-hand text-2xl" style={{ color: mode === "Focus" ? "var(--accent-500)" : "var(--forest-500)" }}>{mode === "Focus" ? "deep work" : "breathe & stretch"}</p>
              </div>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button className={`btn ${running ? "" : "btn-primary"} !min-h-[48px] !px-7`} onClick={() => setRunning(r => !r)}>
              {running ? <Pause size={18} /> : <Play size={18} />} {running ? "Pause" : "Start"}
            </button>
            <button className="btn btn-icon !min-h-[48px] !w-12" aria-label="Reset timer" onClick={() => { setRunning(false); setLeft(total); }}><RotateCcw size={17} /></button>
          </div>
          <div className="mt-6 w-full space-y-3">
            <label className="block text-xs font-bold" htmlFor="focus-len">Focus length · {s.pomodoro.focusMin} min
              <input id="focus-len" type="range" className="range" min={15} max={60} step={5} value={s.pomodoro.focusMin} onChange={e => up(d => { d.pomodoro.focusMin = Number(e.target.value); })} />
            </label>
            <label className="block text-xs font-bold" htmlFor="break-len">Break length · {s.pomodoro.breakMin} min
              <input id="break-len" type="range" className="range" min={3} max={15} value={s.pomodoro.breakMin} onChange={e => up(d => { d.pomodoro.breakMin = Number(e.target.value); })} />
            </label>
          </div>
        </section>

        <section className="space-y-6">
          <div className="sheet p-5">
            <SectionHead title="Study heatmap" right={<Pill tone="forest">{Math.round(totalMin / 60)}h lifetime</Pill>} />
            <div className="overflow-x-auto pb-2">
              <div className="grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, 13px)" }} role="img" aria-label={`Study heatmap: ${activeDays} active days, ${totalMin} total minutes`}>
                {cells.map(c => (
                  <div key={c.key} className="heat-cell" title={`${c.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${c.mins} min`} style={{ background: heat(c.mins) }} />
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[10px] font-bold" style={{ color: "var(--text-500)" }}>
              less {[0, 20, 45, 75, 100].map(m => <span key={m} className="heat-cell" style={{ background: heat(m) }} />)} more
              <span className="ml-auto font-mono">{activeDays} active days · no streak counter on purpose</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sheet p-5">
              <SectionHead title="Why no streaks?" />
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-700)" }}>
                Streak counters convert studying into loss-aversion. This heatmap is a <strong>record, not a score</strong> — empty squares carry no penalty, and nothing here sends notifications.
              </p>
            </div>
            <div className="sheet p-5">
              <SectionHead title="Quick log" />
              <p className="mb-3 text-sm" style={{ color: "var(--text-500)" }}>Studied away from the desk? Log it honestly.</p>
              <div className="flex flex-wrap gap-2">
                {[15, 25, 45].map(m => (
                  <button key={m} className="btn btn-sm" onClick={() => { up(d => { const k = dayKey(Date.now()); d.pomodoro.sessions[k] = (d.pomodoro.sessions[k] ?? 0) + m; }); toast(`+${m} min logged for today`, "ok"); }}>+{m} min</button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}