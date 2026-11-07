/* Academia · Phase 3.3 — privacy-gated media wall (youtube-nocookie only) */
import { useState } from "react";
import { CheckCircle2, Cookie, Play, ShieldAlert } from "lucide-react";
import { useApp } from "@/engine/store";
import { PageHeader, Pill, Tabs } from "@/components/ui";

const VIDEOS = [
  { id: "fNk_zzaMoSs", title: "Vectors — what even are they?", subject: "Math", dur: "9:52", hue: "var(--cobalt-500)" },
  { id: "kYB8IZa5AuE", title: "Linear transformations and matrices", subject: "Math", dur: "10:59", hue: "var(--chart-7)" },
  { id: "WUvTyaaNkzM", title: "The essence of calculus", subject: "Math", dur: "17:05", hue: "var(--forest-500)" },
  { id: "spUNpyF58BY", title: "But what is a Fourier transform?", subject: "Physics", dur: "24:47", hue: "var(--accent-500)" },
  { id: "aircAruvnKk", title: "But what is a neural network?", subject: "CS", dur: "18:40", hue: "var(--marigold-500)" },
  { id: "KuXjwB4LzSA", title: "Convolution, visually", subject: "CS", dur: "23:00", hue: "var(--plum-500)" },
];

export function MediaView() {
  const { s, up, toast } = useApp();
  const [filter, setFilter] = useState("All");
  const [playing, setPlaying] = useState<string | null>(null);
  const allowed = s.cookies.media;
  const list = VIDEOS.filter(v => filter === "All" || v.subject === filter);

  return (
    <div>
      <PageHeader kicker="watch with the door closed" title="Media wall"
        desc="Every embed is a privacy-gated youtube-nocookie frame. Nothing loads until you accept media cookies — and nothing tracks you before that."
        right={<Pill tone={allowed ? "forest" : "marigold"}>{allowed ? "Media cookies accepted" : "Embeds blocked"}</Pill>} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={["All", "Math", "Physics", "CS"]} active={filter} onChange={setFilter} />
        {allowed && (
          <button className="btn btn-sm" onClick={() => { up(d => { d.cookies.media = false; }); setPlaying(null); toast("Media cookies revoked — embeds re-blocked", "info"); }}>
            <ShieldAlert size={14} /> Revoke media cookies
          </button>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((v, i) => {
          const watched = s.videosWatched.includes(v.id);
          const isPlaying = playing === v.id && allowed;
          return (
            <article key={v.id} className="sheet sheet-lift fade-up overflow-hidden" style={{ "--stagger": i } as React.CSSProperties}>
              <div className="relative aspect-video border-b-2" style={{ borderColor: "var(--text-900)", background: "var(--text-950)" }}>
                {isPlaying ? (
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`}
                    title={v.title}
                    allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <>
                    {/* hand-set cover, no remote thumbnails */}
                    <div className="absolute inset-0" style={{ background: `repeating-linear-gradient(-45deg, ${v.hue} 0 14px, color-mix(in srgb, ${v.hue} 55%, #17110b) 14px 28px)`, opacity: 0.85 }} />
                    <div className="absolute inset-0 grid place-items-center">
                      {allowed ? (
                        <button className="grid h-16 w-16 place-items-center rounded-full border-2 transition-transform hover:scale-110"
                          style={{ background: "var(--surface)", borderColor: "var(--text-950)", boxShadow: "3px 3px 0 var(--text-950)" }}
                          aria-label={`Play ${v.title}`} onClick={() => setPlaying(v.id)}>
                          <Play size={26} fill="var(--text-900)" />
                        </button>
                      ) : (
                        <div className="sheet mx-4 flex flex-col items-center gap-2 px-5 py-4 text-center">
                          <Cookie size={20} style={{ color: "var(--marigold-900)" }} />
                          <p className="text-xs font-bold">Blocked by privacy gate</p>
                          <button className="btn btn-warn btn-sm" onClick={() => { up(d => { d.cookies = { decided: true, media: true }; }); toast("Media cookies accepted — embeds unlocked", "ok"); }}>
                            Accept media cookies
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="pill absolute bottom-2 right-2 !bg-[var(--surface)] font-mono !text-[10px]">{v.dur}</span>
                  </>
                )}
              </div>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug">{v.title}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-500)" }}>{v.subject} · youtube-nocookie.com</p>
                </div>
                <button className="btn btn-ghost btn-icon btn-sm flex-none" aria-label={watched ? `Mark ${v.title} unwatched` : `Mark ${v.title} watched`}
                  onClick={() => up(d => { d.videosWatched = watched ? d.videosWatched.filter(x => x !== v.id) : [...d.videosWatched, v.id]; })}>
                  <CheckCircle2 size={19} style={{ color: watched ? "var(--forest-500)" : "var(--text-300)" }} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-6 text-center font-mono text-[11px]" style={{ color: "var(--text-500)" }}>
        {s.videosWatched.length}/{VIDEOS.length} marked watched · consent state: essential=true, media={String(allowed)}
      </p>
    </div>
  );
}