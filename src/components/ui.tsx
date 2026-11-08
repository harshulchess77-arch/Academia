/* Academia · shared notebook-skin UI kit */
import { type ReactNode, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/utils/cn";
import { useApp, QUOTA_MAX, type Tier } from "@/engine/store";

/* ---------- pills ---------- */
export function Pill({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={cn("pill", className)} style={tone ? { background: `var(--${tone}-100, var(--surface))`, borderColor: `var(--${tone}-500, var(--text-900))`, color: `var(--${tone}-900, var(--${tone}-700, var(--text-900)))` } : undefined}>{children}</span>;
}
export function TierPill({ tier }: { tier: Tier }) {
  return <span className="pill" style={{ background: "transparent", borderColor: `var(--tier-${tier.toLowerCase()})`, color: `var(--tier-${tier.toLowerCase()})` }}>Tier {tier}</span>;
}
export function QuotaPills({ module, compact }: { module: "portfolio" | "sandbox" | "chat"; compact?: boolean }) {
  const { s } = useApp();
  const q = s.quotas[module];
  const max = QUOTA_MAX[module];
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${module} quota: ${q.d} of ${max.d} daily remaining, ${q.w} of ${max.w} weekly remaining`}>
      <span className={cn("pill quota-pill", q.d === 0 && "quota-low")}>{q.d}/{max.d} Daily</span>
      {!compact && <span className="text-xs font-bold" aria-hidden>·</span>}
      {!compact && <span className={cn("pill quota-pill", q.w <= 1 && "quota-low")}>{q.w}/{max.w} Weekly</span>}
    </span>
  );
}

/* ---------- headers ---------- */
export function PageHeader({ kicker, title, desc, right }: { kicker: string; title: string; desc?: string; right?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-up">
      <div>
        <p className="font-hand text-xl" style={{ color: "var(--accent-500)" }}>{kicker}</p>
        <h1 className="font-display text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
        {desc && <p className="mt-1.5 max-w-xl text-sm" style={{ color: "var(--text-500)" }}>{desc}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </header>
  );
}
export function SectionHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {right}
    </div>
  );
}

/* ---------- tabs ---------- */
export function Tabs({ tabs, active, onChange, className }: { tabs: string[]; active: string; onChange: (t: string) => void; className?: string }) {
  return (
    <div role="tablist" aria-label="View tabs" className={cn("flex flex-wrap gap-2", className)}>
      {tabs.map(t => (
        <button key={t} role="tab" aria-selected={active === t} className="pill pill-tab" onClick={() => onChange(t)}>{t}</button>
      ))}
    </div>
  );
}

/* ---------- avatar ---------- */
export function Avatar({ name, hue = 25, size = 36 }: { name: string; hue?: number; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("");
  return (
    <span aria-hidden className="grid flex-none place-items-center rounded-full border-2 font-display font-bold"
      style={{ width: size, height: size, fontSize: size * 0.38, borderColor: "var(--text-900)", background: `oklch(0.86 0.09 ${hue})`, color: "#241c14", boxShadow: "2px 2px 0 var(--text-950)" }}>
      {initials}
    </span>
  );
}

/* ---------- gauge (semi-circular) ---------- */
export function Gauge({ value, label, color = "var(--cobalt-500)", size = 150 }: { value: number; label: string; color?: string; size?: number }) {
  const r = size / 2 - 14;
  const cx = size / 2, cy = size / 2;
  const circ = Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center" role="img" aria-label={`${label}: ${Math.round(v)} out of 100`}>
      <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--background-200)" strokeWidth={13} strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--text-900)" strokeWidth={16} strokeLinecap="round" opacity={0.15} />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round"
          strokeDasharray={`${(v / 100) * circ} ${circ}`} style={{ transition: "stroke-dasharray .8s var(--ease-out)" }} />
        <text x={cx} y={cy - 6} textAnchor="middle" fontFamily="var(--font-mono)" fontWeight={600} fontSize={size * 0.17} fill="var(--text-900)">{Math.round(v)}</text>
        <text x={cx - r} y={cy + 16} textAnchor="middle" fontSize={9} fill="var(--text-500)">0</text>
        <text x={cx + r} y={cy + 16} textAnchor="middle" fontSize={9} fill="var(--text-500)">100</text>
      </svg>
      <span className="mt-1 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-500)" }}>{label}</span>
    </div>
  );
}

/* ---------- gantt row ---------- */
export function GanttRow({ label, pct, color, note }: { label: string; pct: number; color: string; note?: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[150px_1fr_auto]">
      <span className="truncate font-semibold">{label}</span>
      <div className="gantt-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="gantt-bar gantt-hatch" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <span className="font-mono text-xs" style={{ color: "var(--text-500)" }}>{note ?? `${Math.round(pct)}%`}</span>
    </div>
  );
}

/* ---------- toggle ---------- */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className="relative h-7 w-12 flex-none rounded-full border-2 transition-colors"
      style={{ borderColor: "var(--text-900)", background: on ? "var(--forest-500)" : "var(--background-200)", boxShadow: "2px 2px 0 var(--text-950)" }}>
      <span className="absolute top-0.5 h-5 w-5 rounded-full border-2 transition-all"
        style={{ left: on ? 22 : 2, borderColor: "var(--text-900)", background: "var(--surface)" }} />
    </button>
  );
}

/* ---------- sparkline ---------- */
export function Sparkline({ points, color = "var(--cobalt-500)", w = 120, h = 36 }: { points: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * w},${h - 4 - ((p - min) / (max - min || 1)) * (h - 8)}`).join(" ");
  return (
    <svg width={w} height={h} aria-hidden className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={w} cy={h - 4 - ((points[points.length - 1] - min) / (max - min || 1)) * (h - 8)} r={3.5} fill={color} stroke="var(--text-900)" strokeWidth={1.5} />
    </svg>
  );
}

/* ---------- empty state ---------- */
export function EmptyState({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="sheet sheet-dotted flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span style={{ color: "var(--text-300)" }}>{icon}</span>
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="max-w-sm text-sm" style={{ color: "var(--text-500)" }}>{desc}</p>
    </div>
  );
}

/* ---------- toast host ---------- */
export function ToastHost() {
  const { toasts, dismiss } = useApp();
  const icons = { ok: <CheckCircle2 size={18} style={{ color: "var(--forest-500)" }} />, warn: <AlertTriangle size={18} style={{ color: "var(--marigold-900)" }} />, err: <XCircle size={18} style={{ color: "var(--accent-500)" }} />, info: <Info size={18} style={{ color: "var(--cobalt-500)" }} /> };
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-36 left-1/2 z-[120] flex w-[min(94vw,420px)] -translate-x-1/2 flex-col gap-2 md:bottom-6">
      {toasts.map(t => (
        <div key={t.id} className="sheet sheet-flat pointer-events-auto flex items-center gap-3 px-4 py-3 text-sm font-semibold" style={{ animation: "popIn .25s var(--ease-snap)" }}>
          {icons[t.tone]}
          <span className="flex-1">{t.msg}</span>
          {t.action && <button className="btn btn-sm btn-warn" onClick={() => { t.action!.fn(); dismiss(t.id); }}>{t.action.label}</button>}
          <button aria-label="Dismiss notification" className="opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)}><X size={16} /></button>
        </div>
      ))}
    </div>
  );
}

/* ---------- doodles ---------- */
export function ScribbleUnder({ color = "var(--marigold-500)" }: { color?: string }) {
  return (
    <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden>
      <path d="M4 14 C 40 6, 70 18, 105 10 S 170 6, 196 12" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" />
    </svg>
  );
}
export function DoodleArrow({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 90 60" className={className} aria-hidden style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M6 8 C 30 4, 66 14, 74 44 M74 44 l-12 -8 M74 44 l4 -14" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function DoodleStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M20 4 L23 16 L36 20 L23 24 L20 36 L17 24 L4 20 L17 16 Z" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- canvas hook: crisp DPR-capped sizing ---------- */
export function useCanvasSize(ref: React.RefObject<HTMLCanvasElement | null>, draw: () => void) {
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const parent = cv.parentElement!;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth, h = parent.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      cv.style.width = w + "px";
      cv.style.height = h + "px";
      cv.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current();
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [ref]);
}

/* ============================================================================
   SKELETAL UI LOADING SHELLS (Zero spinners, instant scannable layout)
   ============================================================================ */

export function LibrarySkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading Active-Recall Library...">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-[#0B3D91]/20" />
          <div className="h-8 w-64 rounded bg-[#0B3D91]/30" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-24 rounded-full bg-[var(--background-300)]" />
          <div className="h-6 w-20 rounded-full bg-[var(--background-300)]" />
        </div>
      </div>
      <div className="flex gap-2 border-b-2 pb-2" style={{ borderColor: "var(--background-300)" }}>
        <div className="h-7 w-20 rounded-full bg-[var(--background-200)]" />
        <div className="h-7 w-24 rounded-full bg-[var(--background-200)]" />
        <div className="h-7 w-28 rounded-full bg-[var(--background-200)]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="sheet p-5 space-y-4 lg:col-span-2">
          <div className="h-6 w-48 rounded bg-[var(--background-300)]" />
          <div className="h-44 w-full rounded-xl border-2 border-dashed border-[var(--background-300)] bg-[var(--background-100)]" />
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 rounded-lg bg-[var(--background-200)]" />
            ))}
          </div>
        </div>
        <div className="sheet p-5 space-y-3">
          <div className="h-5 w-36 rounded bg-[var(--background-300)]" />
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 rounded-lg border border-[var(--background-300)] bg-[var(--background-50)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function NumeraSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading Numera Graphing Engine...">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-4 w-36 rounded bg-[#0B3D91]/20" />
          <div className="h-8 w-56 rounded bg-[#0B3D91]/30" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        <div className="sheet p-4 space-y-3" style={{ minHeight: "560px" }}>
          <div className="flex justify-between">
            <div className="h-5 w-32 rounded bg-[var(--background-300)]" />
            <div className="h-6 w-24 rounded bg-[var(--background-200)]" />
          </div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 rounded-xl border-2 border-[var(--background-300)] bg-[var(--background-50)] p-3 space-y-2">
              <div className="h-3 w-20 rounded bg-[var(--background-200)]" />
              <div className="h-7 w-full rounded bg-[var(--background-200)]" />
            </div>
          ))}
        </div>
        <div className="sheet overflow-hidden !p-0">
          <div className="flex h-[560px] w-full flex-col items-center justify-center border-2 border-[var(--background-300)] bg-[#fffdf7]">
            {/* Skeletal coordinate crosshair */}
            <div className="relative h-full w-full">
              <div className="absolute top-1/2 w-full border-t border-[var(--background-300)]" />
              <div className="absolute left-1/2 h-full border-l border-[var(--background-300)]" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#0B3D91]/40 p-3">
                <div className="h-2 w-2 rounded-full bg-[#0B3D91]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LockerSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading Sealed Document Locker...">
      <div className="space-y-2">
        <div className="h-4 w-40 rounded bg-[#0B3D91]/20" />
        <div className="h-8 w-64 rounded bg-[#0B3D91]/30" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="sheet p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-lg bg-[#0B3D91]/15" />
              <div className="h-4 w-16 rounded-full bg-[var(--background-300)]" />
            </div>
            <div className="h-5 w-40 rounded bg-[var(--background-300)]" />
            <div className="h-3 w-24 rounded bg-[var(--background-200)]" />
            <div className="pt-2 border-t border-[var(--background-300)] flex justify-between">
              <div className="h-4 w-16 rounded bg-[var(--background-200)]" />
              <div className="h-4 w-12 rounded bg-[var(--background-200)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 w-full rounded-lg bg-[var(--background-200)]" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 py-2 border-b border-[var(--background-300)]">
          <div className="h-4 w-1/4 rounded bg-[var(--background-200)]" />
          <div className="h-4 w-1/4 rounded bg-[var(--background-100)]" />
          <div className="h-4 w-1/4 rounded bg-[var(--background-200)]" />
          <div className="h-4 w-1/4 rounded bg-[var(--background-100)]" />
        </div>
      ))}
    </div>
  );
}

export function ViewSkeleton({ route }: { route?: string }) {
  if (route?.includes("library")) return <LibrarySkeleton />;
  if (route?.includes("numera")) return <NumeraSkeleton />;
  if (route?.includes("locker")) return <LockerSkeleton />;
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading view...">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-[#0B3D91]/20" />
        <div className="h-8 w-56 rounded bg-[#0B3D91]/30" />
      </div>
      <div className="sheet p-6 space-y-4">
        <div className="h-6 w-48 rounded bg-[var(--background-300)]" />
        <TableSkeleton rows={4} />
      </div>
    </div>
  );
}
