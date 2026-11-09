/* Academia · AI Whiteboard Tutor — draws every step, three modes, any subject (with a connected provider),
   deterministic built-in solver with none. Lessons are validated DATA rendered by React; nothing a model returns is executed. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eraser, ImagePlus, Lightbulb, Play, Pause, RotateCcw, Settings2, Sparkles, X } from "lucide-react";
import "@/styles/tutor.css";
import { useApp, uid } from "@/engine/store";
import { EmptyState, PageHeader, Pill, SectionHead, Tabs } from "@/components/ui";
import { Board } from "@/engine/tutor/render";
import { generateLesson, PRESETS, TutorError, type ProviderId } from "@/engine/tutor/providers";
import { FOLLOW_UPS, LANGUAGES, MODE_LABEL, RTL_LANGS, type TutorMode } from "@/engine/tutor/prompt";
import { forgetKey, getKey, loadSettings, saveSettings, setKey, toConfig, type TutorSettings } from "@/engine/tutor/settings";
import { answersMatch } from "@/engine/tutor/check";
import type { Lesson } from "@/engine/tutor/schema";

const MODES = Object.values(MODE_LABEL);
const modeFromLabel = (l: string): TutorMode => (Object.entries(MODE_LABEL).find(([, v]) => v === l)?.[0] as TutorMode) ?? "topic";
const MAX_TEXT_FILE = 200 * 1024, MAX_IMG = 4 * 1024 * 1024;

interface Run { lesson: Lesson; warnings: string[]; source: ProviderId }

const toBase64 = (f: File) => new Promise<{ mime: string; data: string }>((res, rej) => {
  const r = new FileReader();
  r.onerror = () => rej(new Error("Couldn't read that file."));
  r.onload = () => res({ mime: f.type, data: String(r.result).split(",")[1] ?? "" });
  r.readAsDataURL(f);
});

export function TutorView() {
  const { up, toast } = useApp();
  const [settings, setSettings] = useState<TutorSettings>(() => loadSettings());
  const [keyInput, setKeyInput] = useState(() => (getKey(loadSettings().remember) ? "••••••••" : ""));
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<TutorMode>("topic");
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<{ name: string; mime: string; data: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stack, setStack] = useState<Run[]>([]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [resolved, setResolved] = useState<Record<string, boolean>>({});
  const [answer, setAnswer] = useState("");
  const [hintN, setHintN] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const abort = useRef<AbortController | null>(null);

  const run = stack[stack.length - 1];
  const lesson = run?.lesson;
  const cur = lesson?.steps[step];
  const last = lesson ? step === lesson.steps.length - 1 : false;
  const rtl = RTL_LANGS.includes(settings.lang);
  const checkKey = `${stack.length}-${step}`;
  const needsCheck = mode === "homework" && !!cur?.check && !resolved[checkKey];

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { setAnswer(""); setHintN(0); setWrong(false); }, [step, stack.length]);
  useEffect(() => {
    if (!playing || !lesson) return;
    if (last || needsCheck) { setPlaying(false); return; }
    const t = window.setTimeout(() => setStep(s => Math.min(s + 1, lesson.steps.length - 1)), 5500);
    return () => window.clearTimeout(t);
  }, [playing, step, lesson, last, needsCheck]);

  const patch = (p: Partial<TutorSettings>) => setSettings(prev => { const n = { ...prev, ...p }; saveSettings(n); return n; });
  const choosePreset = (label: string) => {
    if (label === "builtin") { patch({ id: "builtin", model: "", baseUrl: "" }); return; }
    const p = PRESETS.find(x => x.label === label)!;
    patch({ id: p.id, model: p.model, baseUrl: p.baseUrl ?? "" });
  };
  const activePreset = settings.id === "builtin" ? "builtin" : (PRESETS.find(p => p.id === settings.id && (p.baseUrl ?? "") === settings.baseUrl)?.label ?? "Custom");
  const presetHint = PRESETS.find(p => p.label === activePreset)?.hint;

  const commitKey = (v: string) => { setKeyInput(v); if (v && !/^•+$/.test(v)) setKey(v, settings.remember); };

  const start = async (override?: { prompt: string; context?: string; push?: boolean }) => {
    setError(null); setBusy(true); setPlaying(false);
    abort.current?.abort(); const ctl = new AbortController(); abort.current = ctl;
    try {
      const text = override?.prompt ?? prompt;
      const r = await generateLesson(toConfig(settings), { mode, prompt: text, lang: settings.lang, images: override ? undefined : files.map(f => ({ mime: f.mime, data: f.data })), context: override?.context }, { signal: ctl.signal });
      setStack(prev => (override?.push ? [...prev, r] : [r])); setStep(0); setResolved({}); setPicked({});
    } catch (e) {
      if (e instanceof TutorError && e.kind === "aborted") return;
      setError(e instanceof TutorError ? e.message : "Something went wrong while building the lesson. Please try again.");
    } finally { setBusy(false); }
  };

  const summary = lesson ? `${lesson.title}. ${lesson.steps.map(s => s.say).join(" ")}`.slice(0, 1400) : "";
  const followUp = (text: string) => start({ prompt: text, context: summary, push: true });

  const onFiles = async (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list).slice(0, 3)) {
      if (f.type.startsWith("image/")) {
        if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) { toast("Use PNG, JPEG or WebP images", "warn"); continue; }
        if (f.size > MAX_IMG) { toast(`${f.name} is over 4 MB`, "warn"); continue; }
        try { next.push({ name: f.name, ...(await toBase64(f)) }); } catch { toast("Couldn't read that image", "warn"); }
      } else if (/\.(txt|md)$/i.test(f.name) || f.type === "text/plain") {
        if (f.size > MAX_TEXT_FILE) { toast(`${f.name} is over 200 KB`, "warn"); continue; }
        const t = await f.text();
        setPrompt(p => `${p}${p ? "\n\n" : ""}${t}`.slice(0, 12_000));
      } else toast("Attach a photo (PNG/JPEG/WebP) or a .txt/.md file", "warn");
    }
    setFiles(next.slice(0, 3));
  };

  const submitCheck = () => {
    if (!cur?.check) return;
    if (!cur.check.answer) { setResolved(r => ({ ...r, [checkKey]: true })); return; }
    if (answersMatch(answer, cur.check.answer)) { setResolved(r => ({ ...r, [checkKey]: true })); setWrong(false); }
    else setWrong(true);
  };

  const saveQuizToLibrary = () => {
    if (!lesson?.quiz.length) return;
    const now = Date.now();
    up(d => { lesson.quiz.forEach(q => d.flashcards.push({ id: uid(), front: q.q, back: `${q.options[q.answer]}${q.why ? ` — ${q.why}` : ""}`, deck: "Tutor", ef: 2.5, interval: 0, reps: 0, due: now })); });
    toast(`${lesson.quiz.length} card${lesson.quiz.length > 1 ? "s" : ""} added to Library → Tutor deck`, "ok");
  };

  const examples = useMemo(() => ["2x + 5 = 17", "3x − 4 = 2x + 7", "projectile motion"], []);
  const label = cur ? `${lesson!.title}. Step ${step + 1} of ${lesson!.steps.length}. ${cur.say}` : "Whiteboard";
  const score = lesson ? lesson.quiz.reduce((n, q, i) => n + (picked[i] === q.answer ? 1 : 0), 0) : 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader kicker="every step, on the board" title="AI Whiteboard Tutor"
        desc="Ask anything, practise for an exam, or get hints on homework. The tutor draws the idea step by step — and the maths on the board is computed, not guessed."
        right={<button className="btn" onClick={() => setShowSettings(s => !s)} aria-expanded={showSettings}><Settings2 size={15} /> Tutor settings</button>} />

      {showSettings && (
        <div className="sheet mb-5 px-5 py-4 fade-up" role="region" aria-label="Tutor settings">
          <SectionHead title="Where do lessons come from?" right={<Pill tone={settings.id === "builtin" ? "forest" : "cobalt"}>{settings.id === "builtin" ? "offline · free · private" : "your provider"}</Pill>} />
          <div className="flex flex-wrap gap-2">
            {["builtin", ...PRESETS.map(p => p.label), "Custom"].map(l => (
              <button key={l} className={`btn ${activePreset === l ? "btn-primary" : ""}`} onClick={() => (l === "Custom" ? patch({ id: "openai-compat", baseUrl: "", model: "" }) : choosePreset(l))}>{l === "builtin" ? "Built-in solver" : l}</button>
            ))}
          </div>
          {presetHint && <p className="mt-2 text-xs" style={{ color: "var(--text-700)" }}>{presetHint}</p>}
          {settings.id !== "builtin" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="field-label">API key{settings.baseUrl.startsWith("http://localhost") ? " (not needed locally)" : ""}</span>
                <input className="input" type="password" autoComplete="off" spellCheck={false} value={keyInput} onChange={e => commitKey(e.target.value)} placeholder="paste your key" /></label>
              <label className="block"><span className="field-label">Model</span>
                <input className="input font-mono" value={settings.model} onChange={e => patch({ model: e.target.value })} placeholder="model name" /></label>
              {settings.id === "openai-compat" && <label className="block sm:col-span-2"><span className="field-label">Base URL</span>
                <input className="input font-mono" value={settings.baseUrl} onChange={e => patch({ baseUrl: e.target.value })} placeholder="https://…/v1" /></label>}
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={settings.remember} onChange={e => { patch({ remember: e.target.checked }); const k = getKey(true) || (keyInput && !/^•+$/.test(keyInput) ? keyInput : ""); if (k) setKey(k, e.target.checked); }} /> Remember the key on this device <span className="text-xs" style={{ color: "var(--text-500)" }}>(off = forgotten when you close the tab)</span></label>
              <div className="sm:col-span-2"><button className="btn" onClick={() => { forgetKey(); setKeyInput(""); toast("Key forgotten", "info"); }}><Eraser size={14} /> Forget key</button></div>
            </div>
          )}
          <p className="mt-4 rounded-lg px-3 py-2 text-xs leading-relaxed" style={{ background: "var(--marigold-100)", color: "var(--marigold-900)" }}>
            Your question, photos and key go straight from your browser to the provider you pick — Academia’s servers never see them. That provider’s data terms apply, and some free tiers use prompts to improve their products. If you’re under 18, ask a parent or teacher before connecting an AI service.
          </p>
        </div>
      )}

      <div className="sheet px-5 py-4">
        <Tabs tabs={MODES} active={MODE_LABEL[mode]} onChange={t => setMode(modeFromLabel(t))} />
        <label className="mt-3 block">
          <span className="field-label">{mode === "homework" ? "Paste the problem (I’ll give hints, not the answer)" : mode === "exam" ? "Paste your notes or study guide" : "What do you want to understand?"}</span>
          <textarea className="input min-h-[96px]" dir={rtl ? "rtl" : "ltr"} maxLength={12000} value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder={settings.id === "builtin" ? "Try: 2x + 5 = 17" : "e.g. Why do seasons change?"} />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {examples.map(x => <button key={x} className="tutor-chip" onClick={() => setPrompt(x)}>{x}</button>)}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block"><span className="field-label">Language</span>
            <select className="input" value={settings.lang} onChange={e => patch({ lang: e.target.value })}>{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}</select></label>
          <label className="btn cursor-pointer"><ImagePlus size={15} /> Photo / file
            <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,.txt,.md,text/plain" multiple onChange={e => { void onFiles(e.target.files); e.target.value = ""; }} /></label>
          {files.map((f, i) => <span key={i} className="tutor-chip">{f.name.slice(0, 24)}<button aria-label={`Remove ${f.name}`} onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}><X size={12} /></button></span>)}
          <button className="btn btn-primary ml-auto" disabled={busy || (!prompt.trim() && !files.length)} onClick={() => void start()}><Sparkles size={15} /> {busy ? "Drawing…" : "Teach me"}</button>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: "var(--accent-100)", color: "var(--accent-600)" }}>{error}</p>}
      </div>

      {!lesson && !busy && <div className="mt-5"><EmptyState icon={<Lightbulb size={26} />} title="The board is clear" desc="Type a question above and press Teach me. With no AI connected, try an equation like 2x + 5 = 17 or the words “projectile motion”." /></div>}
      {busy && !lesson && <p className="mt-5 text-center font-hand text-xl" style={{ color: "var(--text-700)" }} aria-live="polite">chalk’s coming out…</p>}

      {lesson && cur && (
        <div className="mt-5 grid gap-4">
          <div className="sheet px-4 py-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {stack.length > 1 && <button className="btn" onClick={() => { setStack(s => s.slice(0, -1)); setStep(0); }}><ChevronLeft size={14} /> Back to previous lesson</button>}
              <h2 className="font-display text-xl font-black">{lesson.title}</h2>
              <Pill tone={run.source === "builtin" ? "forest" : "cobalt"}>{run.source === "builtin" ? "built-in solver" : "AI-drawn — double-check important facts"}</Pill>
            </div>
            <Board steps={lesson.steps} upTo={step} label={label} />
            <div dir={rtl ? "rtl" : "ltr"} className="mt-3 rounded-lg px-4 py-3 text-[15px] leading-relaxed" style={{ background: "var(--background-100)" }} aria-live="polite">
              <span className="mr-2 font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text-500)" }}>step {step + 1}/{lesson.steps.length}</span>{cur.say}
            </div>

            {cur.check && (
              <div className="mt-3 rounded-lg border-2 border-dashed px-4 py-3" style={{ borderColor: "var(--cobalt-500)" }}>
                <p className="text-sm font-bold">{cur.check.question}</p>
                {resolved[checkKey] ? <p className="mt-1 text-sm font-semibold" style={{ color: "var(--forest-700)" }}>✓ {cur.check.answer ?? "Got it"}</p> : (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {cur.check.answer && <input className="input w-40" value={answer} onChange={e => { setAnswer(e.target.value); setWrong(false); }} onKeyDown={e => e.key === "Enter" && submitCheck()} aria-label="Your answer" />}
                    <button className="btn btn-primary" onClick={submitCheck}>{cur.check.answer ? "Check" : "Continue"}</button>
                    {cur.check.hints.length > 0 && <button className="btn" onClick={() => setHintN(n => Math.min(n + 1, cur.check!.hints.length))}><Lightbulb size={14} /> Hint</button>}
                    {cur.check.answer && <button className="btn" onClick={() => setResolved(r => ({ ...r, [checkKey]: true }))}>Show answer</button>}
                  </div>
                )}
                {wrong && <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: "var(--accent-600)" }}>Not quite — have another go, or ask for a hint.</p>}
                {hintN > 0 && !resolved[checkKey] && <ul className="mt-2 list-disc pl-5 text-sm">{cur.check.hints.slice(0, hintN).map((h, i) => <li key={i}>{h}</li>)}</ul>}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn" disabled={step === 0} onClick={() => setStep(s => s - 1)} aria-label="Previous step"><ChevronLeft size={15} /></button>
              <button className="btn btn-primary" disabled={last || needsCheck} onClick={() => setStep(s => s + 1)}>Next step <ChevronRight size={15} /></button>
              <button className="btn" onClick={() => { if (last) setStep(0); setPlaying(p => !p); }} disabled={needsCheck} aria-pressed={playing}>{playing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}</button>
              <button className="btn" onClick={() => { setStep(0); setPlaying(false); setResolved({}); }}><RotateCcw size={14} /> Restart</button>
              <span className="ml-auto flex flex-wrap gap-2">
                <button className="btn" disabled={busy} onClick={() => void followUp(FOLLOW_UPS.why(cur.say))}>Explain why</button>
                <button className="btn" disabled={busy} onClick={() => void followUp(FOLLOW_UPS.another(lesson.title))}>Try another way</button>
              </span>
            </div>
            {needsCheck && <p className="mt-2 text-xs" style={{ color: "var(--text-500)" }}>Homework mode: answer the question (or reveal it) to move on — you do the thinking.</p>}
            {run.warnings.length > 0 && <p className="mt-2 text-xs" style={{ color: "var(--text-500)" }}>{run.warnings.length} drawing instruction{run.warnings.length > 1 ? "s were" : " was"} skipped because {run.warnings.length > 1 ? "they weren’t" : "it wasn’t"} valid.</p>}
          </div>

          {last && !needsCheck && (
            <div className="sheet px-5 py-4 fade-up">
              {lesson.notes.length > 0 && <><SectionHead title="Takeaways" /><ul className="mb-4 list-disc pl-5 text-sm leading-relaxed">{lesson.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></>}
              {lesson.quiz.length > 0 && (
                <>
                  <SectionHead title="Quick quiz" right={<Pill tone="cobalt">{score}/{lesson.quiz.length}</Pill>} />
                  <div className="grid gap-4">
                    {lesson.quiz.map((q, qi) => (
                      <fieldset key={qi}><legend className="mb-1.5 text-sm font-bold">{qi + 1}. {q.q}</legend>
                        <div className="grid gap-1.5">
                          {q.options.map((o, oi) => {
                            const done = picked[qi] !== undefined, isRight = oi === q.answer, isPick = picked[qi] === oi;
                            return <button key={oi} disabled={done} onClick={() => setPicked(p => ({ ...p, [qi]: oi }))} className="btn justify-start text-left"
                              style={done ? { borderColor: isRight ? "var(--forest-500)" : isPick ? "var(--accent-500)" : undefined, background: isRight ? "var(--forest-100)" : isPick ? "var(--accent-100)" : undefined } : undefined}>{o}</button>;
                          })}
                        </div>
                        {picked[qi] !== undefined && <p className="mt-1.5 text-sm" style={{ color: "var(--text-700)" }}>{picked[qi] === q.answer ? "✓ " : "✕ "}{q.why}
                          {picked[qi] !== q.answer && <button className="btn ml-2" disabled={busy} onClick={() => void followUp(FOLLOW_UPS.reteach(q.q, q.options[q.answer]))}>Explain again</button>}</p>}
                      </fieldset>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {lesson.quiz.length > 0 && <button className="btn" onClick={saveQuizToLibrary}>Save quiz to Library</button>}
                <button className="btn" onClick={() => { setStack([]); setStep(0); setPrompt(""); setFiles([]); }}>New question</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
