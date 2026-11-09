/* Academia · tutor settings. The provider choice/model/base URL are harmless and live in localStorage.
   The API key is held in memory only, unless the student explicitly ticks "remember on this device". It is NEVER put
   in AppState, exports, logs or error messages. */
import type { ProviderConfig, ProviderId } from "./providers";

export const CFG_KEY = "academia-tutor-cfg";
export const KEY_KEY = "academia-tutor-key";

export interface TutorSettings { id: ProviderId; model: string; baseUrl: string; lang: string; remember: boolean }
export const DEFAULT_SETTINGS: TutorSettings = { id: "builtin", model: "", baseUrl: "", lang: "en", remember: false };

let memoryKey = "";

export function loadSettings(): TutorSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) ?? "null");
    if (raw && typeof raw === "object") {
      const id: ProviderId = raw.id === "gemini" || raw.id === "openai-compat" ? raw.id : "builtin";
      return { id, model: typeof raw.model === "string" ? raw.model.slice(0, 100) : "", baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl.slice(0, 300) : "", lang: typeof raw.lang === "string" ? raw.lang.slice(0, 8) : "en", remember: raw.remember === true };
    }
  } catch { /* ignore corrupt settings */ }
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(s: TutorSettings) { try { localStorage.setItem(CFG_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

export function getKey(remember: boolean): string {
  if (memoryKey) return memoryKey;
  if (remember) { try { return localStorage.getItem(KEY_KEY) ?? ""; } catch { /* ignore */ } }
  return "";
}
export function setKey(key: string, remember: boolean) {
  memoryKey = key.trim();
  try { if (remember && memoryKey) localStorage.setItem(KEY_KEY, memoryKey); else localStorage.removeItem(KEY_KEY); } catch { /* ignore */ }
}
export function forgetKey() { memoryKey = ""; try { localStorage.removeItem(KEY_KEY); } catch { /* ignore */ } }
export const toConfig = (s: TutorSettings): ProviderConfig => ({ id: s.id, model: s.model || undefined, baseUrl: s.baseUrl || undefined, apiKey: getKey(s.remember) || undefined });
