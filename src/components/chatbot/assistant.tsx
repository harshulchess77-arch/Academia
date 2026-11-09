/* Academia · Phase 2.2 — Multi-Buddy Assistant Drawer
   Deterministic FSM bot interfaces with human-like conversation layout,
   realistic typing animations, multi-bot specialization, and rule-traced provenance.
   Zero runtime LLM dependencies. Every response is rule-verified. */

import { useEffect, useRef, useState, useMemo } from "react";
import {
  Bot,
  Calculator,
  HeartPulse,
  Send,
  X,
  Sigma,
  ShieldCheck,
  BookOpen,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useApp } from "@/engine/store";
import { isExcludedRoute, navigate } from "@/engine/router";
import {
  customChatReply,
  tallyBudReply,
  adoroBuddyReply,
  numeraBudReply,
  lockerGuardReply,
  libraryBudReply,
  type AssistantReply,
} from "@/engine/rules";
import { QuotaPills } from "@/components/ui";

export type TabKey =
  | "Custom Chat"
  | "TallyBud"
  | "Adoro Buddy"
  | "NumeraBud"
  | "LockerGuard"
  | "LibraryBud";

interface Msg {
  id: number;
  who: "you" | "engine";
  text?: string;
  time: string;
  reply?: AssistantReply;
}

interface BuddyMeta {
  name: string;
  role: string;
  avatarBg: string;
  avatarText: string;
  icon: React.ReactNode;
  engine: string;
  welcome: string;
  chips: string[];
}

const TAB_META: Record<TabKey, BuddyMeta> = {
  "Custom Chat": {
    name: "Academia Core",
    role: "Academic Concierge",
    avatarBg: "var(--cobalt-500)",
    avatarText: "#ffffff",
    icon: <Bot size={15} />,
    engine: "intent-table v3 + Catalyst rule compiler",
    welcome: "Hello! I am your central desk assistant. I route your queries deterministically against your Catalyst rules and the system intent table with zero black-box estimation.",
    chips: ["Next deadline", "My quota", "Cards due", "Focus time"],
  },
  TallyBud: {
    name: "TallyBud",
    role: "Grade & GPA Analyst",
    avatarBg: "var(--forest-500)",
    avatarText: "#ffffff",
    icon: <Calculator size={15} />,
    engine: "credit-weighted collegiate arithmetic",
    welcome: "TallyBud online. I read your courses directly from Tally to compute your collegiate weighted GPA and target exam mark thresholds without estimation.",
    chips: ["Current GPA", "Required remaining score", "Weakest course"],
  },
  "Adoro Buddy": {
    name: "Adoro Buddy",
    role: "Diagnostic Coach",
    avatarBg: "var(--marigold-500)",
    avatarText: "var(--text-950)",
    icon: <HeartPulse size={15} />,
    engine: "diagnostic cutoff FSM (65 / 80 bands)",
    welcome: "Adoro Buddy ready. I evaluate your diagnostic assessment bands to build focused study recovery agendas and Pomodoro plans.",
    chips: ["Readiness score", "Weakest areas", "Plan for today"],
  },
  NumeraBud: {
    name: "NumeraBud",
    role: "Math & Plotting Specialist",
    avatarBg: "var(--accent-500)",
    avatarText: "#ffffff",
    icon: <Sigma size={15} />,
    engine: "symbolic solver & linear algebra FSM",
    welcome: "NumeraBud online. Ask me about Gaussian elimination, row reduction (RREF), matrix rank, eigenvalues, derivatives, or limits.",
    chips: ["RREF steps", "Matrix properties", "Derivatives", "Limits"],
  },
  LockerGuard: {
    name: "LockerGuard",
    role: "Cryptographic Sentinel",
    avatarBg: "var(--forest-600)",
    avatarText: "#ffffff",
    icon: <ShieldCheck size={15} />,
    engine: "WebCrypto AES-256-GCM / PBKDF2 auditor",
    welcome: "LockerGuard on duty. I inspect local document encryption containers, PBKDF2 key derivations, and SHA-256 integrity signatures.",
    chips: ["Vault status", "PBKDF2 rounds", "Tamper report", "Keypair export"],
  },
  LibraryBud: {
    name: "LibraryBud",
    role: "Spaced Recall Specialist",
    avatarBg: "var(--marigold-600)",
    avatarText: "#ffffff",
    icon: <BookOpen size={15} />,
    engine: "SuperMemo SM-2 spacing curve engine",
    welcome: "LibraryBud active. I track your flashcard review schedules, ease factor progression, and active recall intervals.",
    chips: ["Cards due today", "SM-2 algorithm", "Rating scale", "Margin notes"],
  },
};

let msgCounter = 1;

function formatTime(): string {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Web Audio pop sound when bot replies */
function playBotSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(560, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
    setTimeout(() => ctx.close(), 200);
  } catch {
    /* silent on headless */
  }
}

/** Extract deep link destination from rule name */
function getRuleDestination(rule = ""): { href: string; label: string } | null {
  if (rule.includes("INVENTORY")) return { href: "/inventory", label: "Open Inventory" };
  if (rule.includes("TALLY")) return { href: "/tally", label: "Open Tally Matrix" };
  if (rule.includes("LIBRARY")) return { href: "/library", label: "Open Library" };
  if (rule.includes("POMODORO") || rule.includes("PLAN_25X3")) return { href: "/pomodoro", label: "Open Pomodoro" };
  if (rule.includes("SANDBOX")) return { href: "/sandbox", label: "Open Sandbox" };
  if (rule.includes("ADORO")) return { href: "/adoro", label: "Open Adoro Diagnostic" };
  if (rule.includes("NUMERA")) return { href: "/numera", label: "Open Numera Plotter" };
  if (rule.includes("LOCKER")) return { href: "/locker", label: "Open Vault Locker" };
  if (rule.includes("Catalyst")) return { href: "/catalyst", label: "Open Catalyst Rules" };
  return null;
}

export function AssistantDrawer({
  open,
  onClose,
  path,
}: {
  open: boolean;
  onClose: () => void;
  path: string;
}) {
  const { s, up, toast } = useApp();
  const [tab, setTab] = useState<TabKey>("Custom Chat");
  const [input, setInput] = useState("");
  const [fsm, setFsm] = useState<AssistantReply["fsm"]>("IDLE");
  const [soundEnabled, setSoundEnabled] = useState(true);

  const initialThreads: Record<TabKey, Msg[]> = useMemo(() => {
    const time = formatTime();
    return {
      "Custom Chat": [
        {
          id: msgCounter++,
          who: "engine",
          time,
          reply: {
            fsm: "MATCHED",
            rule: "SYS/BOOT",
            lines: [TAB_META["Custom Chat"].welcome],
          },
        },
      ],
      TallyBud: [
        {
          id: msgCounter++,
          who: "engine",
          time,
          reply: {
            fsm: "MATCHED",
            rule: "SYS/BOOT",
            lines: [TAB_META["TallyBud"].welcome],
          },
        },
      ],
      "Adoro Buddy": [
        {
          id: msgCounter++,
          who: "engine",
          time,
          reply: {
            fsm: "MATCHED",
            rule: "SYS/BOOT",
            lines: [TAB_META["Adoro Buddy"].welcome],
          },
        },
      ],
      NumeraBud: [
        {
          id: msgCounter++,
          who: "engine",
          time,
          reply: {
            fsm: "MATCHED",
            rule: "SYS/BOOT",
            lines: [TAB_META["NumeraBud"].welcome],
          },
        },
      ],
      LockerGuard: [
        {
          id: msgCounter++,
          who: "engine",
          time,
          reply: {
            fsm: "MATCHED",
            rule: "SYS/BOOT",
            lines: [TAB_META["LockerGuard"].welcome],
          },
        },
      ],
      LibraryBud: [
        {
          id: msgCounter++,
          who: "engine",
          time,
          reply: {
            fsm: "MATCHED",
            rule: "SYS/BOOT",
            lines: [TAB_META["LibraryBud"].welcome],
          },
        },
      ],
    };
  }, []);

  const [threads, setThreads] = useState<Record<TabKey, Msg[]>>(initialThreads);
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [threads, tab, fsm]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  /* Strict route-exclusion guard: unmount the whole assistant surface */
  if (isExcludedRoute(path) || !open) return null;

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || fsm === "PARSING") return;

    if (s.quotas.chat.d <= 0 || s.quotas.chat.w <= 0) {
      toast("Assistant quota exhausted — resets at midnight", "warn");
      return;
    }

    up(d => {
      d.quotas.chat.d -= 1;
      d.quotas.chat.w -= 1;
    });

    const userTime = formatTime();
    setThreads(t => ({
      ...t,
      [tab]: [...t[tab], { id: msgCounter++, who: "you", text: trimmed, time: userTime }],
    }));

    setInput("");
    setFsm("PARSING");

    // Realistic bot calculation delay (400ms-550ms)
    const delay = 420 + Math.floor(Math.random() * 100);
    timerRef.current = window.setTimeout(() => {
      let reply: AssistantReply;
      switch (tab) {
        case "Custom Chat":
          reply = customChatReply(trimmed, s);
          break;
        case "TallyBud":
          reply = tallyBudReply(trimmed, s);
          break;
        case "Adoro Buddy":
          reply = adoroBuddyReply(trimmed, s);
          break;
        case "NumeraBud":
          reply = numeraBudReply(trimmed, s);
          break;
        case "LockerGuard":
          reply = lockerGuardReply(trimmed, s);
          break;
        case "LibraryBud":
          reply = libraryBudReply(trimmed, s);
          break;
      }

      if (soundEnabled) playBotSound();

      setThreads(t => ({
        ...t,
        [tab]: [...t[tab], { id: msgCounter++, who: "engine", reply, time: formatTime() }],
      }));
      setFsm(reply.fsm);
    }, delay);
  };

  const handleClearChat = () => {
    setThreads(t => ({
      ...t,
      [tab]: [
        {
          id: msgCounter++,
          who: "engine",
          time: formatTime(),
          reply: {
            fsm: "MATCHED",
            rule: "SYS/RESET",
            lines: [`${TAB_META[tab].name} conversation reset. Ready for next query.`],
          },
        },
      ],
    }));
    setFsm("IDLE");
  };

  const meta = TAB_META[tab];
  const fsmColor =
    fsm === "MATCHED"
      ? "var(--forest-500)"
      : fsm === "FALLBACK"
      ? "var(--marigold-500)"
      : fsm === "PARSING"
      ? "var(--cobalt-500)"
      : "var(--text-400)";

  return (
    <>
      <div className="scrim xl:hidden" onClick={onClose} />
      <aside
        className="drawer-panel fixed bottom-0 right-0 top-0 z-[95] flex w-[min(94vw,420px)] flex-col border-l-2 shadow-2xl"
        style={{ background: "var(--background-50)", borderColor: "var(--text-900)" }}
        role="complementary"
        aria-label="Assistant drawer"
      >
        {/* Header Bar */}
        <div
          className="flex items-center gap-2 border-b-2 px-4 py-3"
          style={{ borderColor: "var(--text-900)", background: "var(--surface)" }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border-2 shadow-xs"
            style={{ background: meta.avatarBg, borderColor: "var(--text-900)", color: meta.avatarText }}
          >
            {meta.icon}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm font-black">{meta.name}</span>
              <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 font-mono text-[9px] font-bold tracking-wider" style={{ background: "var(--forest-100)", color: "var(--forest-800)" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-forest-600 animate-pulse" />
                ONLINE
              </span>
            </div>
            <span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>
              {meta.role}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
              title={soundEnabled ? "Mute sound" : "Enable sound"}
              onClick={() => setSoundEnabled(v => !v)}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Reset this conversation"
              title="Reset conversation"
              onClick={handleClearChat}
            >
              <RotateCcw size={15} />
            </button>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Close assistant drawer"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Buddy Switcher Tabstrip (6 Buddies) */}
        <div
          role="tablist"
          aria-label="Assistant engines"
          className="flex gap-1.5 overflow-x-auto border-b-2 border-dashed px-3 py-2 no-scrollbar"
          style={{ borderColor: "var(--background-300)" }}
        >
          {(Object.keys(TAB_META) as TabKey[]).map(k => {
            const isSelected = tab === k;
            return (
              <button
                key={k}
                role="tab"
                aria-selected={isSelected}
                className={cn(
                  "pill pill-tab flex-none !px-2.5 !py-1 !text-[11px] font-bold transition-all",
                  isSelected && "shadow-xs font-black"
                )}
                style={{
                  background: isSelected ? "var(--text-900)" : undefined,
                  color: isSelected ? "var(--background-50)" : undefined,
                }}
                onClick={() => {
                  setTab(k);
                  setFsm("IDLE");
                }}
              >
                {TAB_META[k].icon}
                <span>{k}</span>
              </button>
            );
          })}
        </div>

        {/* Engine Specification Subtitle */}
        <div className="flex items-center justify-between border-b px-4 py-1.5" style={{ borderColor: "var(--background-200)", background: "var(--background-100)" }}>
          <p className="font-mono text-[9.5px] uppercase tracking-wider" style={{ color: "var(--text-600)" }}>
            engine: {meta.engine}
          </p>
          <span className="pill !min-h-0 !px-1.5 !py-0 !text-[9px]" style={{ borderColor: fsmColor, color: fsmColor }}>
            FSM · {fsm}
          </span>
        </div>

        {/* Conversation Stream */}
        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {threads[tab].map(m => {
            if (m.who === "you") {
              return (
                <div key={m.id} className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1 font-mono text-[10px]" style={{ color: "var(--text-400)" }}>
                    <span>You</span>
                    <span>·</span>
                    <span>{m.time}</span>
                  </div>
                  <div
                    className="max-w-[85%] rounded-2xl rounded-tr-xs border-2 px-3.5 py-2 text-sm font-medium leading-relaxed"
                    style={{
                      borderColor: "var(--text-900)",
                      background: "var(--cobalt-100)",
                      boxShadow: "2px 2px 0 var(--text-950)",
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              );
            }

            const ruleDest = getRuleDestination(m.reply?.rule);

            return (
              <div key={m.id} className="flex items-start gap-2.5">
                {/* Bot Avatar */}
                <div
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border-2 text-xs font-bold shadow-2xs"
                  style={{
                    background: meta.avatarBg,
                    borderColor: "var(--text-900)",
                    color: meta.avatarText,
                  }}
                >
                  {meta.icon}
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display text-xs font-bold">{meta.name}</span>
                    <span className="rounded bg-text-900 px-1 py-0.2 font-mono text-[8px] font-bold uppercase text-white">
                      BOT
                    </span>
                    <span className="font-mono text-[10px]" style={{ color: "var(--text-400)" }}>
                      {m.time}
                    </span>
                  </div>

                  <div
                    className="rounded-2xl rounded-tl-xs border-2 px-3.5 py-2.5"
                    style={{
                      borderColor: "var(--text-900)",
                      background: "var(--surface)",
                      boxShadow: "2px 2px 0 var(--text-950)",
                    }}
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span
                        className="inline-block rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
                        style={{
                          background: m.reply?.fsm === "FALLBACK" ? "var(--marigold-100)" : "var(--forest-100)",
                          color: m.reply?.fsm === "FALLBACK" ? "var(--marigold-900)" : "var(--forest-800)",
                          border: `1px solid ${m.reply?.fsm === "FALLBACK" ? "var(--marigold-300)" : "var(--forest-300)"}`,
                        }}
                      >
                        ▸ {m.reply?.rule}
                      </span>
                      <span className="font-mono text-[9px]" style={{ color: "var(--text-400)" }}>
                        DETERMINISTIC
                      </span>
                    </div>

                    <div className="space-y-1">
                      {m.reply?.lines.map((l, i) => (
                        <p key={i} className="text-[13px] leading-relaxed" style={{ color: "var(--text-800)" }}>
                          {l}
                        </p>
                      ))}
                    </div>

                    {ruleDest && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs mt-2.5 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-cobalt-700 hover:text-cobalt-900"
                        onClick={() => {
                          onClose();
                          navigate(ruleDest.href);
                        }}
                      >
                        <span>{ruleDest.label}</span>
                        <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Realistic "Bot is Typing..." Animation */}
          {fsm === "PARSING" && (
            <div className="flex items-start gap-2.5">
              <div
                className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border-2 text-xs font-bold"
                style={{
                  background: meta.avatarBg,
                  borderColor: "var(--text-900)",
                  color: meta.avatarText,
                }}
              >
                {meta.icon}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-xs font-bold">{meta.name}</span>
                  <span className="font-mono text-[10px]" style={{ color: "var(--text-400)" }}>
                    is typing…
                  </span>
                </div>
                <div
                  className="flex items-center gap-1.5 rounded-2xl rounded-tl-xs border-2 px-3.5 py-2.5"
                  style={{
                    borderColor: "var(--text-900)",
                    background: "var(--surface)",
                    boxShadow: "2px 2px 0 var(--text-950)",
                  }}
                >
                  <span className="h-2 w-2 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ background: meta.avatarBg }} />
                  <span className="h-2 w-2 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ background: meta.avatarBg }} />
                  <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: meta.avatarBg }} />
                  <span className="ml-2 font-mono text-[11px]" style={{ color: "var(--text-500)" }}>
                    evaluating rule matrices…
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips & Message Input */}
        <div className="border-t-2 px-3 py-2.5" style={{ borderColor: "var(--text-900)", background: "var(--surface)" }}>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {meta.chips.map(c => (
              <button
                key={c}
                type="button"
                className="pill pill-tab !min-h-[28px] !px-2.5 !text-[11px] font-semibold"
                onClick={() => send(c)}
              >
                <Sparkles size={11} className="inline mr-1 text-forest-600" />
                {c}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              className="input !min-h-[42px] flex-1 text-sm"
              placeholder={`Ask ${meta.name}…`}
              aria-label={`Message ${meta.name}`}
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button
              className="btn btn-primary btn-icon"
              type="submit"
              aria-label="Send message"
              disabled={!input.trim() || fsm === "PARSING"}
            >
              <Send size={16} />
            </button>
          </form>

          <div className="mt-2 flex items-center justify-between">
            <QuotaPills module="chat" />
            <span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>
              zero-hallucination · 100% rule-traced
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
