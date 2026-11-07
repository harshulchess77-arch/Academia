/* Academia · headless modal state manager */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { uid } from "./store";

interface ModalSpec { id: string; title: string; body: ReactNode; footer?: ReactNode; wide?: boolean }
interface ModalCtx { open: (m: Omit<ModalSpec, "id">) => string; close: (id?: string) => void }
const Ctx = createContext<ModalCtx | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ModalSpec[]>([]);
  const restoreRef = useRef<HTMLElement | null>(null);

  const close = (id?: string) => setStack(s => (id ? s.filter(m => m.id !== id) : s.slice(0, -1)));
  const open = (m: Omit<ModalSpec, "id">) => {
    restoreRef.current = document.activeElement as HTMLElement;
    const id = uid();
    setStack(s => [...s, { ...m, id }]);
    return id;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (stack.length === 0) restoreRef.current?.focus?.();
    else {
      const el = document.querySelector<HTMLElement>(`[data-modal="${stack[stack.length - 1].id}"] [data-autofocus], [data-modal="${stack[stack.length - 1].id}"] button`);
      window.setTimeout(() => el?.focus(), 30);
    }
  }, [stack.length]);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      {stack.map(m => (
        <div key={m.id} className="scrim grid place-items-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) close(m.id); }}>
          <div
            data-modal={m.id}
            role="dialog" aria-modal="true" aria-label={m.title}
            className={`sheet modal-panel w-full ${m.wide ? "max-w-2xl" : "max-w-lg"} flex flex-col`}
          >
            <div className="flex items-center justify-between gap-4 border-b-2 border-dashed px-5 py-4" style={{ borderColor: "var(--background-300)" }}>
              <h2 className="font-display text-lg font-bold">{m.title}</h2>
              <button className="btn btn-ghost btn-icon btn-sm" aria-label="Close dialog" onClick={() => close(m.id)}><X size={18} /></button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{m.body}</div>
            {m.footer && <div className="flex flex-wrap justify-end gap-3 border-t-2 border-dashed px-5 py-4" style={{ borderColor: "var(--background-300)" }}>{m.footer}</div>}
          </div>
        </div>
      ))}
    </Ctx.Provider>
  );
}

export function useModal(): ModalCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useModal outside provider");
  return ctx;
}