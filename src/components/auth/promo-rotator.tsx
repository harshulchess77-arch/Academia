/* Academia · dynamic first-party commercial rotator.
   Decoupled from fixed visual paths and static hardcoded manifests.
   Renders resilient fallbacks if an asset is unavailable. */
import { useEffect, useState } from "react";
import manifest from "@/data/alt-manifest.json";
import { cn } from "@/utils/cn";

export interface PromoSlide {
  id: string;
  file?: string;
  src?: string;
  tag: string;
  line: string;
  sub: string;
  alt?: string;
}

const DEFAULT_SLIDES: PromoSlide[] = [
  {
    id: "promo-library",
    file: "promo-library.jpg",
    tag: "House banner · 01",
    line: "Recall on schedule, not on vibes.",
    sub: "SM-2 flashcards queue themselves the moment memory decays.",
    alt: "Spaced repetition flashcard interface with SuperMemo-2 interval scheduling",
  },
  {
    id: "promo-sandbox",
    file: "promo-sandbox.jpg",
    tag: "House banner · 02",
    line: "One run a day. Make it count.",
    sub: "Deterministic sandbox with rollback snapshots and honest quotas.",
    alt: "Deterministic code sandbox running mathematical factorial script",
  },
  {
    id: "promo-roadmap",
    file: "promo-roadmap.jpg",
    tag: "House banner · 03",
    line: "The admissions ladder, drawn to scale.",
    sub: "Milestone predictions calibrated to top-tier applications.",
    alt: "Gantt timeline of university admissions milestone benchmarks",
  },
];

const ALT_MANIFEST: Record<string, string> = manifest;

export function PromoRotator({ slides = DEFAULT_SLIDES }: { slides?: PromoSlide[] }) {
  const [i, setI] = useState(0);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = window.setInterval(() => setI(x => (x + 1) % slides.length), 5200);
    return () => window.clearInterval(t);
  }, [slides.length]);

  const slide = slides[i] ?? slides[0] ?? DEFAULT_SLIDES[0];

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "var(--background-200)" }}>
      {slides.map((sl, idx) => {
        const key = sl.file || sl.id;
        const isCurrent = idx === i;
        const alt = sl.alt || (sl.file ? ALT_MANIFEST[sl.file] : undefined) || sl.line;
        const imgSrc = sl.src || (sl.file ? `Images/promos/${sl.file}` : undefined);
        const failed = imgErrors[key];

        if (!imgSrc || failed) {
          // Resilient stylized fallback background for decoupled/offline operation
          return (
            <div
              key={key}
              aria-hidden={!isCurrent}
              className={cn("absolute inset-0 flex items-center justify-center p-8 transition-opacity duration-700")}
              style={{
                opacity: isCurrent ? 1 : 0,
                background: "linear-gradient(135deg, var(--background-100) 0%, var(--background-300) 100%)",
              }}
            >
              <div className="ruled-margin sheet p-6 text-center shadow-lg" style={{ maxWidth: "420px" }}>
                <span className="pill pill-tonal mb-3 inline-block font-mono text-[10px] uppercase tracking-widest">{sl.tag}</span>
                <p className="font-display text-2xl font-black">{sl.line}</p>
                <p className="mt-2 text-xs" style={{ color: "var(--text-500)" }}>{sl.sub}</p>
              </div>
            </div>
          );
        }

        return (
          <img
            key={key}
            src={imgSrc}
            alt={isCurrent ? alt : ""}
            aria-hidden={!isCurrent}
            onError={() => setImgErrors(prev => ({ ...prev, [key]: true }))}
            className={cn("rotator-img absolute inset-0 h-full w-full object-cover transition-all duration-700")}
            style={{
              opacity: isCurrent ? 1 : 0,
              transform: isCurrent ? "scale(1.04)" : "scale(1)",
            }}
          />
        );
      })}

      {/* Slide caption and indicators */}
      <div className="absolute inset-x-0 bottom-0 p-6" style={{ background: "linear-gradient(transparent, rgba(23,17,11,.78))" }}>
        <div className="sheet max-w-sm px-5 py-4" style={{ background: "var(--surface)" }}>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em]" style={{ color: "var(--accent-500)" }}>
            {slide.tag}
          </p>
          <p className="mt-1 font-display text-xl font-black leading-snug">{slide.line}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-500)" }}>{slide.sub}</p>
        </div>
        {slides.length > 1 && (
          <div className="mt-4 flex gap-2" role="tablist" aria-label="Banner slides">
            {slides.map((sl, idx) => (
              <button
                key={sl.file || sl.id}
                role="tab"
                aria-selected={idx === i}
                aria-label={`Show banner ${idx + 1}`}
                onClick={() => setI(idx)}
                className="h-3 rounded-full border-2 transition-all"
                style={{
                  width: idx === i ? 30 : 12,
                  borderColor: "var(--text-950)",
                  background: idx === i ? "var(--marigold-500)" : "var(--surface)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
