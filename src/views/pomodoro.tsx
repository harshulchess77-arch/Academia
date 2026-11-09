/* Academia · Pomodoro Focus Engine & Deterministic Study Heatmap
   Pure local-first, zero-telemetry, zero-gamification study timer.
   No streaks, no penalties, no loss-aversion mechanics. */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX, Sparkles, BookOpen, Trash2 } from "lucide-react";
import { useApp, dayKey } from "@/engine/store";
import { PageHeader, Pill, SectionHead } from "@/components/ui";
import { t, getLocale } from "@/engine/i18n";

/** Deterministic Web Audio synthesizer: zero external audio assets */
function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [660, 880];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const startTime = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, startTime);
      g.gain.exponentialRampToValueAtTime(0.12, startTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(startTime);
      o.stop(startTime + 0.55);
    });
    window.setTimeout(() => ctx.close(), 1500);
  } catch {
    /* Audio output unavailable or muted in headless test environments */
  }
}

export function PomodoroView() {
  const { s, up, toast } = useApp();
  const [mode, setMode] = useState<"Focus" | "Break">("Focus");
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(s.pomodoro.focusMin * 60);
  const [sound, setSound] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState("");
  const endAt = useRef(0);

  const total = (mode === "Focus" ? s.pomodoro.focusMin : s.pomodoro.breakMin) * 60;

  // Active locale for deterministic date rendering
  const activeLocale = useMemo(() => {
    const loc = getLocale();
    if (loc === "hi") return "hi-IN";
    if (loc === "es") return "es-ES";
    if (loc === "fr") return "fr-FR";
    if (loc === "de") return "de-DE";
    return typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
  }, []);

  // Sync remaining time when settings change while paused
  useEffect(() => {
    if (!running) {
      setLeft((mode === "Focus" ? s.pomodoro.focusMin : s.pomodoro.breakMin) * 60);
    }
  }, [s.pomodoro.focusMin, s.pomodoro.breakMin, mode, running]);

  // Main countdown timer interval
  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + left * 1000;
    const interval = window.setInterval(() => {
      const remain = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(remain);
      if (remain === 0) {
        setRunning(false);
        if (sound) playChime();
        if (mode === "Focus") {
          const mins = s.pomodoro.focusMin;
          up(d => {
            const k = dayKey(Date.now());
            d.pomodoro.sessions[k] = (d.pomodoro.sessions[k] ?? 0) + mins;
          });
          toast(t("pomodoro.focusCompleteToast", { min: mins }), "ok");
          setMode("Break");
          setLeft(s.pomodoro.breakMin * 60);
        } else {
          toast(t("pomodoro.breakCompleteToast"), "info");
          setMode("Focus");
          setLeft(s.pomodoro.focusMin * 60);
        }
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [running, mode, left, sound, s.pomodoro.focusMin, s.pomodoro.breakMin, up, toast]);

  // Document tab title synchronization
  useEffect(() => {
    if (!running) {
      document.title = "Academia";
      return;
    }
    const mm = String(Math.floor(left / 60)).padStart(2, "0");
    const ss = String(left % 60).padStart(2, "0");
    const label = mode === "Focus" ? t("pomodoro.focus") : t("pomodoro.break");
    document.title = `(${mm}:${ss}) ${label} · Academia`;

    return () => {
      document.title = "Academia";
    };
  }, [running, left, mode]);

  // Keyboard shortcut listener (Space = Start/Pause, R = Reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        setRunning(prev => !prev);
      } else if (e.key === "r" || e.key === "R") {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setRunning(false);
          setLeft((mode === "Focus" ? s.pomodoro.focusMin : s.pomodoro.breakMin) * 60);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, s.pomodoro.focusMin, s.pomodoro.breakMin]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const frac = total > 0 ? 1 - left / total : 0;
  const CIRCLE_RADIUS = 120;
  const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

  // Preset setter helper
  const applyPreset = useCallback((focus: number, breakM: number) => {
    setRunning(false);
    up(d => {
      d.pomodoro.focusMin = focus;
      d.pomodoro.breakMin = breakM;
    });
    setLeft((mode === "Focus" ? focus : breakM) * 60);
  }, [mode, up]);

  // Heatmap calculation: 20 weeks × 7 days
  const WEEKS = 20;
  const todayD = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => dayKey(Date.now()), []);
  const todayMins = s.pomodoro.sessions[todayKey] ?? 0;

  const { cells, totalMin, activeDays } = useMemo(() => {
    const list: { key: string; mins: number; date: Date; isToday: boolean }[] = [];
    const start = new Date(todayD);
    start.setDate(start.getDate() - (WEEKS * 7 - 1) - todayD.getDay());

    for (let i = 0; i < WEEKS * 7 + todayD.getDay() + 1; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d > todayD) break;
      const key = dayKey(d.getTime());
      list.push({
        key,
        mins: s.pomodoro.sessions[key] ?? 0,
        date: d,
        isToday: key === todayKey,
      });
    }

    const sessionValues = Object.values(s.pomodoro.sessions);
    const sum = sessionValues.reduce((a, b) => a + b, 0);
    const days = sessionValues.filter(v => v > 0).length;

    return { cells: list, totalMin: sum, activeDays: days };
  }, [s.pomodoro.sessions, todayD, todayKey]);

  const heatColor = (m: number) => {
    if (m === 0) return "var(--background-200)";
    if (m < 30) return "color-mix(in srgb, var(--forest-500) 30%, var(--surface))";
    if (m < 60) return "color-mix(in srgb, var(--forest-500) 55%, var(--surface))";
    if (m < 90) return "color-mix(in srgb, var(--forest-500) 80%, var(--surface))";
    return "var(--forest-500)";
  };

  // Reset today's logged focus time
  const handleResetToday = () => {
    if (!todayMins) return;
    if (window.confirm(t("pomodoro.resetTodayConfirm"))) {
      up(d => {
        delete d.pomodoro.sessions[todayKey];
      });
      toast(t("pomodoro.resetTodayToast"), "info");
    }
  };

  // Available subjects for linking
  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    s.grades.forEach(g => subjects.add(g.name));
    s.notes.forEach(n => subjects.add(n.subject));
    return Array.from(subjects).sort();
  }, [s.grades, s.notes]);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={t("pomodoro.kicker")}
        title={t("pomodoro.title")}
        desc={t("pomodoro.subtitle")}
        right={
          <button
            className="btn btn-sm"
            aria-pressed={sound}
            onClick={() => setSound(v => !v)}
          >
            {sound ? <Volume2 size={15} /> : <VolumeX size={15} />} {sound ? t("pomodoro.chimeOn") : t("pomodoro.chimeOff")}
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Left · Timer Workbench */}
        <section className="sheet tape flex flex-col items-center px-6 py-8">
          <div className="flex w-full max-w-xs gap-2" role="tablist" aria-label="Timer mode">
            {(["Focus", "Break"] as const).map(m => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                className="pill pill-tab flex-1 justify-center"
                onClick={() => {
                  setMode(m);
                  setRunning(false);
                  setLeft((m === "Focus" ? s.pomodoro.focusMin : s.pomodoro.breakMin) * 60);
                }}
              >
                {m === "Focus" ? t("pomodoro.focus") : t("pomodoro.break")}
              </button>
            ))}
          </div>

          {/* SVG Circular Progress Meter */}
          <div
            className="relative mt-6"
            role="timer"
            aria-label={`${mode} timer: ${mm} minutes ${ss} seconds remaining`}
          >
            <svg width={280} height={280} viewBox="0 0 280 280">
              <circle
                cx={140}
                cy={140}
                r={CIRCLE_RADIUS}
                fill="none"
                stroke="var(--background-200)"
                strokeWidth={14}
              />
              <circle
                cx={140}
                cy={140}
                r={CIRCLE_RADIUS}
                fill="none"
                stroke={mode === "Focus" ? "var(--accent-500)" : "var(--forest-500)"}
                strokeWidth={14}
                strokeLinecap="round"
                strokeDasharray={`${frac * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                transform="rotate(-90 140 140)"
                style={{ transition: "stroke-dasharray .3s linear" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="font-mono text-6xl font-semibold tabular-nums">{mm}:{ss}</p>
                <p
                  className="mt-1 font-hand text-2xl"
                  style={{ color: mode === "Focus" ? "var(--accent-500)" : "var(--forest-500)" }}
                >
                  {mode === "Focus" ? t("pomodoro.taglineFocus") : t("pomodoro.taglineBreak")}
                </p>
                {selectedSubject && (
                  <p className="mt-1 flex items-center justify-center gap-1 font-mono text-xs font-semibold" style={{ color: "var(--text-600)" }}>
                    <BookOpen size={12} /> {selectedSubject}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Play/Pause & Reset Controls */}
          <div className="mt-5 flex items-center gap-3">
            <button
              className={`btn ${running ? "" : "btn-primary"} !min-h-[48px] !px-8 text-base`}
              onClick={() => setRunning(r => !r)}
            >
              {running ? <Pause size={18} /> : <Play size={18} />} {running ? t("pomodoro.pause") : t("pomodoro.start")}
            </button>
            <button
              className="btn btn-icon !min-h-[48px] !w-12"
              aria-label={t("pomodoro.reset")}
              title={t("pomodoro.reset")}
              onClick={() => {
                setRunning(false);
                setLeft(total);
              }}
            >
              <RotateCcw size={17} />
            </button>
          </div>

          {/* Presets */}
          <div className="mt-6 w-full space-y-2 border-t pt-4" style={{ borderColor: "var(--background-300)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-500)" }}>
              {t("pomodoro.presets")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className={`btn btn-sm text-xs ${s.pomodoro.focusMin === 25 && s.pomodoro.breakMin === 5 ? "btn-primary" : ""}`}
                onClick={() => applyPreset(25, 5)}
              >
                {t("pomodoro.presetClassic")}
              </button>
              <button
                type="button"
                className={`btn btn-sm text-xs ${s.pomodoro.focusMin === 50 && s.pomodoro.breakMin === 10 ? "btn-primary" : ""}`}
                onClick={() => applyPreset(50, 10)}
              >
                {t("pomodoro.presetDeep")}
              </button>
              <button
                type="button"
                className={`btn btn-sm text-xs ${s.pomodoro.focusMin === 15 && s.pomodoro.breakMin === 3 ? "btn-primary" : ""}`}
                onClick={() => applyPreset(15, 3)}
              >
                {t("pomodoro.presetSprint")}
              </button>
            </div>
          </div>

          {/* Linked Subject / Note Selector */}
          {availableSubjects.length > 0 && (
            <div className="mt-4 w-full">
              <label className="block text-xs font-bold" htmlFor="pomodoro-subject">
                {t("pomodoro.linkedSubject")}
              </label>
              <select
                id="pomodoro-subject"
                className="input mt-1 w-full text-xs"
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
              >
                <option value="">{t("pomodoro.generalFocus")}</option>
                {availableSubjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sliders */}
          <div className="mt-4 w-full space-y-3">
            <label className="block text-xs font-bold" htmlFor="focus-len">
              {t("pomodoro.focusLength", { min: s.pomodoro.focusMin })}
              <input
                id="focus-len"
                type="range"
                className="range mt-1"
                min={5}
                max={90}
                step={5}
                value={s.pomodoro.focusMin}
                onChange={e => up(d => { d.pomodoro.focusMin = Number(e.target.value); })}
              />
            </label>
            <label className="block text-xs font-bold" htmlFor="break-len">
              {t("pomodoro.breakLength", { min: s.pomodoro.breakMin })}
              <input
                id="break-len"
                type="range"
                className="range mt-1"
                min={1}
                max={30}
                value={s.pomodoro.breakMin}
                onChange={e => up(d => { d.pomodoro.breakMin = Number(e.target.value); })}
              />
            </label>
          </div>
        </section>

        {/* Right · Heatmap & Records */}
        <section className="space-y-6">
          <div className="sheet p-5">
            <SectionHead
              title={t("pomodoro.studyHeatmap")}
              right={
                <Pill tone={totalMin > 0 ? "forest" : "neutral"}>
                  {t("pomodoro.lifetime", { hours: Math.round(totalMin / 60) })}
                </Pill>
              }
            />

            {/* Zero State Notice */}
            {totalMin === 0 && (
              <div
                className="my-3 flex items-center gap-3 rounded-xl border-2 border-dashed p-3 text-xs font-semibold"
                style={{ borderColor: "var(--background-300)", color: "var(--text-600)", background: "var(--background-100)" }}
              >
                <Sparkles size={16} className="flex-none text-forest-600" />
                <span>{t("pomodoro.emptyNotice")}</span>
              </div>
            )}

            {/* Heatmap Grid */}
            <div className="overflow-x-auto pb-2">
              <div
                className="grid grid-flow-col gap-[3px]"
                style={{ gridTemplateRows: "repeat(7, 13px)" }}
                role="img"
                aria-label={`Study heatmap: ${activeDays} active days, ${totalMin} total minutes`}
              >
                {cells.map(c => {
                  const dateStr = c.date.toLocaleDateString(activeLocale, { day: "numeric", month: "short" });
                  const title = `${dateStr} · ${c.mins > 0 ? t("pomodoro.logToast", { min: c.mins }) : t("pomodoro.zeroRecorded")}`;
                  return (
                    <div
                      key={c.key}
                      className="heat-cell"
                      title={title}
                      style={{
                        background: heatColor(c.mins),
                        outline: c.isToday ? "2px solid var(--accent-500)" : undefined,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Heatmap Footer Legend */}
            <div className="mt-3 flex items-center gap-2 text-[10px] font-bold" style={{ color: "var(--text-500)" }}>
              <span>{t("pomodoro.less")}</span>
              {[0, 20, 45, 75, 100].map(m => (
                <span key={m} className="heat-cell inline-block" style={{ background: heatColor(m) }} />
              ))}
              <span>{t("pomodoro.more")}</span>
              <span className="ml-auto font-mono">
                {t("pomodoro.activeDaysSummary", { days: activeDays })}
              </span>
            </div>
          </div>

          {/* Information & Quick Log Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sheet p-5">
              <SectionHead title={t("pomodoro.whyNoStreaksTitle")} />
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-700)" }}>
                {t("pomodoro.whyNoStreaksBody")}
              </p>
            </div>

            <div className="sheet p-5">
              <div className="flex items-center justify-between">
                <SectionHead title={t("pomodoro.quickLogTitle")} />
                {todayMins > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700"
                    onClick={handleResetToday}
                    title={t("pomodoro.resetToday")}
                  >
                    <Trash2 size={12} /> {t("pomodoro.resetToday")} ({todayMins}m)
                  </button>
                )}
              </div>
              <p className="mb-3 text-sm" style={{ color: "var(--text-500)" }}>
                {t("pomodoro.quickLogDesc")}
              </p>
              <div className="flex flex-wrap gap-2">
                {[15, 25, 45, 60].map(m => (
                  <button
                    key={m}
                    className="btn btn-sm"
                    onClick={() => {
                      up(d => {
                        const k = dayKey(Date.now());
                        d.pomodoro.sessions[k] = (d.pomodoro.sessions[k] ?? 0) + m;
                      });
                      toast(t("pomodoro.logToast", { min: m }), "ok");
                    }}
                  >
                    {t("pomodoro.quickLogPlus", { min: m })}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
