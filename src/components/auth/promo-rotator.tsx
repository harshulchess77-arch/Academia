/* Academia · first-party commercial rotator. Alt text is enforced from
   Images/alt-manifest.json — a slide without a manifest entry cannot render. */
import { useEffect, useState } from "react";
import manifest from "@/data/alt-manifest.json";
import { cn } from "@/utils/cn";

const SLIDES = [
  { file: "promo-library.jpg", tag: "House banner · 01", line: "Recall on schedule, not on vibes.", sub: "SM-2 flashcards queue themselves the moment memory decays." },
  { file: "promo-sandbox.jpg", tag: "House banner · 02", line: "One run a day. Make it count.", sub: "Deterministic sandbox with rollback snapshots and honest quotas." },
  { file: "promo-roadmap.jpg", tag: "House banner · 03", line: "The admissions ladder, drawn to scale.", sub: "Milestone predictions calibrated to top-tier applications." },
] as const;

const ALT: Record<string, string> = manifest;

export function PromoRotator() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI(x => (x + 1) % SLIDES.length), 5200);
    return () => window.clearInterval(t);
  }, []);
  const slide = SLIDES[i];
  const alt = ALT[slide.file];
  if (!alt) throw new Error(`alt-manifest.json is missing an entry for ${slide.file}`);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "var(--background-200)" }}>
      {SLIDES.map((sl, idx) => (
        <img key={sl.file} src={`Images/promos/${sl.file}`} alt={idx === i ? ALT[sl.file] : ""}
          aria-hidden={idx !== i}
          className={cn("rotator-img absolute inset-0 h-full w-full object-cover")}
          style={{ opacity: idx === i ? 1 : 0, transform: idx === i ? "scale(1.04)" : "scale(1)" }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 p-6" style={{ background: "linear-gradient(transparent, rgba(23,17,11,.78))" }}>
        <div className="sheet max-w-sm px-5 py-4" style={{ background: "var(--surface)" }}>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em]" style={{ color: "var(--accent-500)" }}>{slide.tag}</p>
          <p className="mt-1 font-display text-xl font-black leading-snug">{slide.line}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-500)" }}>{slide.sub}</p>
        </div>
        <div className="mt-4 flex gap-2" role="tablist" aria-label="Banner slides">
          {SLIDES.map((sl, idx) => (
            <button key={sl.file} role="tab" aria-selected={idx === i} aria-label={`Show banner ${idx + 1}`}
              onClick={() => setI(idx)}
              className="h-3 rounded-full border-2 transition-all"
              style={{ width: idx === i ? 30 : 12, borderColor: "var(--text-950)", background: idx === i ? "var(--marigold-500)" : "var(--surface)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}