/* Academia · last-resort error boundary.
   Corrupted or hand-edited localStorage used to white-screen the whole app
   on first render and on every reload. This boundary catches render crashes
   and offers a one-click "Reset local data" escape hatch. */
import { Component, type ReactNode } from "react";

const LS_KEY = "academia-state-v3";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { console.error("Academia render crashed:", error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center px-6" style={{ background: "var(--background-100, #f6efe0)" }}>
        <div className="sheet max-w-md p-8 text-center" role="alert">
          <p className="font-hand text-2xl" style={{ color: "var(--accent-500, #d92d20)" }}>the desk tipped over</p>
          <h1 className="mt-1 font-display text-2xl font-black">Something broke while rendering</h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-700, #4a4237)" }}>
            This is usually caused by corrupted or hand-edited local data. Your work lives only in this browser — resetting clears it and starts a fresh seed.
          </p>
          <p className="mt-3 break-all font-mono text-[11px]" style={{ color: "var(--text-500, #8a8172)" }}>{this.state.error.message}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button className="btn" onClick={() => { try { localStorage.removeItem(LS_KEY); localStorage.removeItem("academia-scratch-html"); localStorage.removeItem("academia-tutor-cfg"); localStorage.removeItem("academia-tutor-key"); } catch { /* ignore */ } window.location.reload(); }}>
              Reset local data
            </button>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    );
  }
}
