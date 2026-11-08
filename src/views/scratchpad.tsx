/* Academia · Phase 3.8 — dual-mode scratchpad: pressure stylus canvas + typed notebook */
import { useEffect, useRef, useState } from "react";
import { Bold, Download, Eraser, Image as ImageIcon, Italic, List, PenLine, Trash2, Type, Underline } from "lucide-react";
import { useApp } from "@/engine/store";
import { sanitizeHtml } from "@/engine/sanitize";
import { PageHeader, Pill, Tabs } from "@/components/ui";

const W = 1440, H = 960;
const INKS = [
  { name: "Ink", val: "#241c14" },
  { name: "Cobalt", val: "#2742d6" },
  { name: "Vermillion", val: "#d92d20" },
  { name: "Forest", val: "#1f7a4d" },
];
const SCRATCH_KEY = "academia-scratch-html";

export function ScratchpadView() {
  const { toast } = useApp();
  const [mode, setMode] = useState("Stylus");
  const [ink, setInk] = useState(INKS[0].val);
  const [size, setSize] = useState(4);
  const [erasing, setErasing] = useState(false);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const pts = useRef<{ x: number; y: number; p: number }[]>([]);
  const undoStack = useRef<string[]>([]);
  const savedSheet = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  /* paper base */
  const paintBase = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#fffdf6";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#d5c7a8";
    for (let x = 24; x < W; x += 24) for (let y = 24; y < H; y += 24) { ctx.beginPath(); ctx.arc(x, y, 1.1, 0, 7); ctx.fill(); }
    ctx.strokeStyle = "rgba(217,45,32,.4)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(88, 0); ctx.lineTo(88, H); ctx.stroke();
  };

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    paintBase(ctx);
    // handwritten welcome stroke
    ctx.strokeStyle = "#2742d6"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(140, 160);
    ctx.bezierCurveTo(240, 90, 340, 230, 440, 150);
    ctx.bezierCurveTo(540, 80, 620, 210, 730, 140);
    ctx.stroke();
    ctx.font = "42px Caveat, cursive"; ctx.fillStyle = "#6b5d49";
    ctx.fillText("draw here — pressure & tilt smoothing on", 140, 250);
  }, []);

  /* restore ink when returning from typed mode */
  useEffect(() => {
    if (mode === "Stylus" && savedSheet.current && cvRef.current) {
      const img = new Image();
      const src = savedSheet.current;
      img.onload = () => { const ctx = cvRef.current?.getContext("2d"); if (ctx) { ctx.clearRect(0, 0, W, H); ctx.drawImage(img, 0, 0); } };
      img.src = src;
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "Typed" && editorRef.current && !editorRef.current.innerHTML) {
      const saved = localStorage.getItem(SCRATCH_KEY);
      editorRef.current.innerHTML = saved ? sanitizeHtml(saved) : "<p><b>Typed notebook.</b> Use this fallback when a stylus isn't around — formatting saves locally as you type.</p><ul><li>Chain rule: outside-in</li><li>KCL: sum of currents = 0</li></ul>";
    }
  }, [mode]);

  const toCanvas = (e: React.PointerEvent) => {
    const r = cvRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, p: e.pressure || 0.5 };
  };
  const snapshot = () => {
    const cv = cvRef.current!;
    undoStack.current.push(cv.toDataURL());
    if (undoStack.current.length > 12) undoStack.current.shift();
  };
  const down = (e: React.PointerEvent) => {
    if (mode !== "Stylus") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    snapshot();
    drawing.current = true;
    pts.current = [toCanvas(e)];
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = cvRef.current!.getContext("2d")!;
    pts.current.push(toCanvas(e));
    const n = pts.current.length;
    if (n < 3) return;
    const a = pts.current[n - 3], b = pts.current[n - 2], c = pts.current[n - 1];
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    ctx.strokeStyle = ink;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = erasing ? size * 6 : size * (0.5 + b.p * 1.3);
    ctx.beginPath();
    ctx.moveTo(m1.x, m1.y);
    ctx.quadraticCurveTo(b.x, b.y, m2.x, m2.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  };
  const upStroke = () => { drawing.current = false; pts.current = []; };

  const undo = () => {
    const last = undoStack.current.pop();
    if (!last) { toast("Nothing to undo", "info"); return; }
    const img = new Image();
    img.onload = () => { const ctx = cvRef.current!.getContext("2d")!; ctx.clearRect(0, 0, W, H); ctx.drawImage(img, 0, 0); };
    img.src = last;
  };

  /* pixel filters */
  const applyFilter = (kind: "sepia" | "threshold" | "despeckle") => {
    snapshot();
    const ctx = cvRef.current!.getContext("2d")!;
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    if (kind === "sepia") {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        d[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        d[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        d[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      }
    } else if (kind === "threshold") {
      for (let i = 0; i < d.length; i += 4) {
        const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        const v = lum < 140 ? 23 : 253;
        d[i] = v; d[i + 1] = v - (v === 23 ? 6 : 0); d[i + 2] = v - (v === 23 ? 12 : 7);
      }
    } else {
      const copy = new Uint8ClampedArray(d);
      const lumAt = (x: number, y: number) => { const i = (y * W + x) * 4; return copy[i] * 0.299 + copy[i + 1] * 0.587 + copy[i + 2] * 0.114; };
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (lumAt(x, y) < 150) {
          let dark = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && lumAt(x + dx, y + dy) < 150) dark++;
          if (dark <= 1) { const i = (y * W + x) * 4; d[i] = 255; d[i + 1] = 253; d[i + 2] = 246; }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    toast(kind === "sepia" ? "Sepia tone applied" : kind === "threshold" ? "Threshold ink applied" : "Speckles removed", "ok");
  };

  const importImage = (f: File) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      snapshot();
      const ctx = cvRef.current!.getContext("2d")!;
      const scale = Math.min(W / img.width, H / img.height) * 0.9;
      ctx.drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale);
      URL.revokeObjectURL(url);
      toast("Scan placed on the sheet — try Threshold Ink", "ok");
    };
    img.src = url;
  };

  const exportPng = () => {
    const a = document.createElement("a");
    a.href = cvRef.current!.toDataURL("image/png");
    a.download = "academia-scratchpad.png";
    a.click();
    toast("Sheet exported as PNG", "ok");
  };

  const fmt = (cmd: string) => { document.execCommand(cmd); editorRef.current?.focus(); };

  return (
    <div>
      <PageHeader kicker="think in the margins" title="Scratchpad"
        desc="Pressure-smoothed Bezier ink for stylus work, a typed rich-text fallback, and scan-cleanup filters for photographed notes."
        right={<Pill tone="cobalt">{mode === "Stylus" ? "pointer events · 120Hz" : "rich text · local save"}</Pill>} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs tabs={["Stylus", "Typed"]} active={mode} onChange={m => { if (m !== "Stylus" && cvRef.current) savedSheet.current = cvRef.current.toDataURL(); setMode(m); }} />
        {mode === "Stylus" ? (
          <div className="flex flex-wrap items-center gap-2">
            {INKS.map(c => (
              <button key={c.name} aria-label={`${c.name} ink`} aria-pressed={ink === c.val && !erasing}
                onClick={() => { setInk(c.val); setErasing(false); }}
                className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: c.val, borderColor: "var(--text-900)", boxShadow: ink === c.val && !erasing ? "0 0 0 3px var(--marigold-500)" : "2px 2px 0 var(--text-950)" }} />
            ))}
            <label className="ml-2 flex items-center gap-2 text-xs font-bold">
              nib
              <input type="range" className="range w-24" min={1} max={14} value={size} onChange={e => setSize(Number(e.target.value))} aria-label="Nib size" />
              <span className="font-mono">{size}px</span>
            </label>
            <button className={`btn btn-sm ${erasing ? "btn-ink" : ""}`} aria-pressed={erasing} onClick={() => setErasing(v => !v)}><Eraser size={14} /> Eraser</button>
            <button className="btn btn-sm" onClick={undo}>⟲ Undo</button>
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()}><ImageIcon size={14} /> Import scan</button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Import scan image" onChange={e => { const f = e.target.files?.[0]; if (f) importImage(f); e.target.value = ""; }} />
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="btn btn-sm btn-icon" aria-label="Bold" onClick={() => fmt("bold")}><Bold size={15} /></button>
            <button className="btn btn-sm btn-icon" aria-label="Italic" onClick={() => fmt("italic")}><Italic size={15} /></button>
            <button className="btn btn-sm btn-icon" aria-label="Underline" onClick={() => fmt("underline")}><Underline size={15} /></button>
            <button className="btn btn-sm btn-icon" aria-label="Bullet list" onClick={() => fmt("insertUnorderedList")}><List size={15} /></button>
          </div>
        )}
      </div>

      {mode === "Stylus" ? (
        <>
          <div className="sheet overflow-hidden !p-0">
            <canvas
              ref={cvRef} width={W} height={H}
              className="block w-full touch-none"
              style={{ aspectRatio: "3/2", cursor: erasing ? "cell" : "crosshair" }}
              aria-label="Drawing canvas — use a stylus, mouse or finger"
              onPointerDown={down} onPointerMove={move} onPointerUp={upStroke} onPointerCancel={upStroke}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-500)" }}>Scan filters</span>
            <button className="btn btn-sm" onClick={() => applyFilter("sepia")}>Sepia</button>
            <button className="btn btn-sm" onClick={() => applyFilter("threshold")}>Threshold Ink</button>
            <button className="btn btn-sm" onClick={() => applyFilter("despeckle")}>Despeckle</button>
            <span className="mx-2 hidden h-6 w-0.5 sm:block" style={{ background: "var(--background-300)" }} />
            <button className="btn btn-sm" style={{ color: "var(--accent-600)" }} onClick={() => { snapshot(); paintBase(cvRef.current!.getContext("2d")!); toast("Sheet cleared", "info", { label: "Undo", fn: undo }); }}>
              <Trash2 size={14} /> Clear
            </button>
            <button className="btn btn-primary btn-sm ml-auto" onClick={exportPng}><Download size={14} /> Export PNG</button>
          </div>
        </>
      ) : (
        <div className="sheet ruled-margin min-h-[480px] px-6 py-6 md:px-16">
          <p className="mb-3 flex items-center gap-2 font-hand text-xl" style={{ color: "var(--cobalt-500)" }}><Type size={16} /> typed fallback — autosaves locally</p>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox" aria-multiline="true" aria-label="Typed notebook"
            className="prose min-h-[380px] text-[15px] leading-8 outline-none [&_li]:list-disc [&_ul]:pl-6"
            onInput={() => { const el = editorRef.current; if (el) localStorage.setItem(SCRATCH_KEY, sanitizeHtml(el.innerHTML)); }}
            onPaste={e => {
              // paste is plain text only — rich markup never enters the notebook
              e.preventDefault();
              const text = e.clipboardData.getData("text/plain");
              document.execCommand("insertText", false, text);
            }}
          />
          <p className="mt-4 flex items-center gap-2 font-mono text-[10px]" style={{ color: "var(--text-300)" }}><PenLine size={12} /> stylus mode keeps your ink; this page keeps your words</p>
        </div>
      )}
    </div>
  );
}