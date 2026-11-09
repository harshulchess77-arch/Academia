/* Academia · Cloudflare Turnstile Human Verification Barrier.
   Enforces anti-automation and human registration handshakes on all authentication flows.
   Ingests client verification tokens securely using VITE_CLOUDFLARE_TURNSTILE_SITE_KEY. */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { ENV } from "@/engine/env";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: (error: unknown) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
}

export function TurnstileWidget({ onVerify, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);

  const siteKey = ENV.cloudflareTurnstileSiteKey || "1x00000000000000000000AA";
  const isMockOrTest =
    ENV.appEnv !== "production" ||
    siteKey === "1x00000000000000000000AA" ||
    !siteKey;

  // Real Cloudflare Turnstile loader for production
  useEffect(() => {
    if (isMockOrTest) return;

    let widgetId: string | undefined;

    const initTurnstile = () => {
      if (window.turnstile && containerRef.current) {
        try {
          widgetId = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: "auto",
            callback: (verifiedToken: string) => {
              setToken(verifiedToken);
              setTurnstileError(null);
              onVerify(verifiedToken);
            },
            "error-callback": () => {
              const err = "Cloudflare Turnstile verification failed. Retry.";
              setTurnstileError(err);
              onError?.(err);
            },
            "expired-callback": () => {
              setToken(null);
              onVerify("");
            },
          });
        } catch {
          // Fall back gracefully
        }
      }
    };

    if (window.turnstile) {
      initTurnstile();
    } else {
      const scriptId = "cf-turnstile-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => initTurnstile();
        document.head.appendChild(script);
      }
    }

    return () => {
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {}
      }
    };
  }, [siteKey, isMockOrTest, onVerify, onError]);

  // Deterministic local handshake solver for dev/test/offline workflows
  const handleSimulateVerification = () => {
    setVerifying(true);
    setTurnstileError(null);

    window.setTimeout(() => {
      const issuedToken = `cf_turnstile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      setToken(issuedToken);
      setVerifying(false);
      onVerify(issuedToken);
    }, 450);
  };

  return (
    <div
      className="my-3 rounded-xl border-2 p-3 transition-colors"
      style={{
        borderColor: token ? "var(--forest-500)" : "var(--background-300)",
        background: token ? "var(--forest-100)" : "var(--background-100)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {token ? (
            <CheckCircle2 size={18} style={{ color: "var(--forest-700)" }} />
          ) : (
            <ShieldCheck size={18} style={{ color: "var(--text-500)" }} />
          )}
          <div>
            <p className="text-xs font-bold leading-tight" style={{ color: token ? "var(--forest-900)" : "var(--text-900)" }}>
              {token ? "Cloudflare Turnstile Verified" : "Cloudflare Human Verification Barrier"}
            </p>
            <p className="font-mono text-[10px] opacity-75">
              {token
                ? `Handshake token: ${token.slice(0, 16)}...`
                : "Cryptographic human proof required before submission"}
            </p>
          </div>
        </div>

        {/* Real Turnstile container mounted here */}
        {!isMockOrTest && <div ref={containerRef} className="my-1" />}

        {/* Dev / Test Verification Button */}
        {isMockOrTest && (
          <div>
            {token ? (
              <span className="pill !py-0.5 !text-[10px] font-mono font-bold" style={{ background: "var(--forest-100)", borderColor: "var(--forest-500)", color: "var(--forest-700)" }}>
                PASSED
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-sm !py-1 !px-2.5 font-bold !text-xs"
                disabled={verifying}
                onClick={handleSimulateVerification}
              >
                {verifying ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" /> Verifying...
                  </>
                ) : (
                  "Verify Human"
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {turnstileError && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "var(--accent-600)" }}>
          <ShieldAlert size={13} /> {turnstileError}
        </div>
      )}
    </div>
  );
}

