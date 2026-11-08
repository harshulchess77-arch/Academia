/* Academia · i18n.ts
   Lightweight, type-safe, deterministic internationalization engine.
   Zero external dependencies. Supports dot-notation keys, interpolation,
   and dynamic language/jurisdiction switching. */

import enLocale from "../locales/en.json";

export type LocaleKey = string;
export type SupportedLocale = "en" | "hi" | "es" | "fr" | "de";

type LocaleDictionary = Record<string, unknown>;

const dictionaries: Record<string, LocaleDictionary> = {
  en: enLocale as unknown as LocaleDictionary,
};

let currentLocale: SupportedLocale = "en";

/** Registers a new locale translation dictionary at runtime. */
export function registerLocale(locale: SupportedLocale, dict: LocaleDictionary): void {
  dictionaries[locale] = dict;
}

/** Sets active application translation locale. */
export function setLocale(locale: SupportedLocale): void {
  if (dictionaries[locale]) {
    currentLocale = locale;
  }
}

/** Retrieves the active application translation locale code. */
export function getLocale(): SupportedLocale {
  return currentLocale;
}

/** Retrieves translated text by dot-notated key with optional string parameter interpolation. */
export function t(key: LocaleKey, params?: Record<string, string | number>): string {
  const dict = dictionaries[currentLocale] || dictionaries.en;
  const parts = key.split(".");
  let cur: unknown = dict;

  for (const part of parts) {
    if (cur && typeof cur === "object" && part in cur) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      // Fallback to English dictionary if key is missing in active locale
      let fallbackCur: unknown = dictionaries.en;
      for (const fallbackPart of parts) {
        if (fallbackCur && typeof fallbackCur === "object" && fallbackPart in fallbackCur) {
          fallbackCur = (fallbackCur as Record<string, unknown>)[fallbackPart];
        } else {
          fallbackCur = undefined;
          break;
        }
      }
      cur = fallbackCur ?? key;
      break;
    }
  }

  let text = typeof cur === "string" ? cur : key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }

  return text;
}

