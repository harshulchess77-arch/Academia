// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateEnvironment } from "@/engine/env";
import { createClient } from "@/engine/supabase";
import { t, setLocale, getLocale, registerLocale } from "@/engine/i18n";
import {
  CharterFilter,
  DynamicVocabularyProvider,
  screenTextV2,
  normalizeText,
} from "@/engine/charter-filter";
import { getDefaultPbkdf2Iterations } from "@/engine/locker-crypto";

describe("Phase 1: Strict Environment Configuration & Production Invariants", () => {
  it("parses development environment with safe defaults", () => {
    const config = validateEnvironment({
      VITE_APP_ENV: "development",
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
      VITE_CRYPTO_MIN_PBKDF2_ITERATIONS: "750000",
      VITE_DEFAULT_COMPLIANCE_JURISDICTION: "EU-GDPR",
    });

    expect(config.appEnv).toBe("development");
    expect(config.allowMockFallback).toBe(true);
    expect(config.cryptoMinPbkdf2Iterations).toBe(750000);
    expect(config.complianceJurisdiction).toBe("EU-GDPR");
  });

  it("enforces 600,000 iterations minimum floor", () => {
    const config = validateEnvironment({
      VITE_APP_ENV: "development",
      VITE_CRYPTO_MIN_PBKDF2_ITERATIONS: "1000", // below 600k
    });
    expect(config.cryptoMinPbkdf2Iterations).toBe(600000);
  });

  it("throws loud explicit error in production when credentials are missing", () => {
    expect(() => {
      validateEnvironment({
        VITE_APP_ENV: "production",
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_ANON_KEY: "",
      });
    }).toThrow(/Production environment configuration invariants breached/i);
  });

  it("throws loud explicit error in production when transport scheme is insecure", () => {
    expect(() => {
      validateEnvironment({
        VITE_APP_ENV: "production",
        VITE_SUPABASE_URL: "http://insecure.supabase.co",
        VITE_SUPABASE_ANON_KEY: "valid-key",
      });
    }).toThrow(/Insecure transport scheme/i);
  });

  it("guards Supabase client creation", () => {
    const client = createClient("https://example.supabase.co", "sample-key");
    expect(client.supabaseUrl).toBe("https://example.supabase.co");
    expect(client.supabaseAnonKey).toBe("sample-key");
    expect(typeof client.from).toBe("function");
    expect(typeof client.rpc).toBe("function");

    expect(() => {
      createClient("", "");
    }).toThrow(/Missing verified backend service credentials/i);
  });
});

describe("Phase 2: Internationalization & Jurisdiction-Decoupled Moderation", () => {
  it("translates dot-notated keys from en.json schema", () => {
    setLocale("en");
    expect(getLocale()).toBe("en");
    expect(t("app.name")).toBe("Academia");
    expect(t("common.save")).toBe("Save");
    expect(t("numera.title")).toContain("Numera");
    expect(t("locker.title")).toContain("Locker");
  });

  it("supports dynamic registration and fallback for missing keys", () => {
    registerLocale("es", {
      common: {
        save: "Guardar",
      },
    });
    setLocale("es");
    expect(getLocale()).toBe("es");
    expect(t("common.save")).toBe("Guardar");
    // Fallback to English for missing keys in Spanish dict
    expect(t("common.delete")).toBe("Delete");

    // Reset back to English
    setLocale("en");
  });

  it("supports parameter replacement in translated text", () => {
    registerLocale("en", {
      greeting: "Hello, {name}!",
    });
    expect(t("greeting", { name: "Aditi" })).toBe("Hello, Aditi!");
  });

  it("allows dependency injection of custom vocabulary provider into CharterFilter", () => {
    const customProvider = new DynamicVocabularyProvider();
    customProvider.registerCustomEntries("test-jurisdiction", [
      { term: "toxicword", severity: "high" },
    ]);

    const filter = new CharterFilter(customProvider, "test-jurisdiction");
    const result = filter.screen("This is a toxicword here");
    expect(result.overall).toBe("block");
    expect(result.hits[0].term).toBe("toxicword");
  });

  it("preserves all deterministic normalizations across languages", () => {
    // Unicode confusables: Cyrillic і (\u0456) -> i
    expect(normalizeText("\u0456diot")).toBe("idiot");
    // Leetspeak
    expect(normalizeText("st3p1d")).toBe("stepid");
    // Vowel censors in screening
    const res = screenTextV2("st*pid");
    expect(res.hits.some(h => h.term === "stupid")).toBe(true);
  });
});

describe("Phase 4: Dynamic Cryptographic Parameter Enforcement", () => {
  it("dynamically retrieves PBKDF2 iterations from environment", () => {
    const iterations = getDefaultPbkdf2Iterations();
    expect(iterations).toBeGreaterThanOrEqual(600000);
  });
});
