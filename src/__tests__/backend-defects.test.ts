import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase 0 — Defect Verification Suite (§0.7 & §0.8)", () => {
  const root = process.cwd();
  const initSql = fs.readFileSync(path.join(root, "supabase/migrations/20261107_init.sql"), "utf8");
  const vercelJson = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

  describe("§0.7 CSP Wildcard Defect", () => {
    const rootHeader = vercelJson.headers.find((h: { source: string }) => h.source === "/(.*)");
    const cspHeader = rootHeader?.headers.find((h: { key: string }) => h.key === "Content-Security-Policy");

    it("confirms vercel.json contains wildcards allowing connections to ANY Supabase project", () => {
      expect(cspHeader).toBeDefined();
      // DEFECT CONFIRMED: vercel.json contains *.supabase.co wildcard
      expect(cspHeader.value).toContain("https://*.supabase.co");
      expect(cspHeader.value).toContain("wss://*.supabase.co");
    });

    it("confirms index.html and vercel.json CSP connect-src are out of sync", () => {
      const indexMatch = indexHtml.match(/connect-src\s+([^"]+)/);
      const vercelMatch = cspHeader.value.match(/connect-src\s+([^;]+)/);

      expect(indexMatch).not.toBeNull();
      expect(vercelMatch).not.toBeNull();
      // DEFECT CONFIRMED: index.html lacks supabase origins while vercel.json has wildcard
      expect(indexMatch![1]).not.toBe(vercelMatch![1]);
    });
  });

  describe("§0.8 Database Migration 20261107_init.sql Defects", () => {
    it("Defect 1: confirms no handle_new_user trigger exists on auth.users", () => {
      expect(initSql).not.toContain("handle_new_user");
      expect(initSql).not.toContain("ON auth.users");
    });

    it("Defect 2: confirms is_admin() lacks SET search_path and revokes", () => {
      const isAdminBlock = initSql.match(/FUNCTION\s+public\.is_admin\(\)[\s\S]*?\$\$\s+LANGUAGE\s+sql\s+SECURITY\s+DEFINER;/);
      expect(isAdminBlock).not.toBeNull();
      expect(isAdminBlock![0]).not.toContain("SET search_path");
      expect(initSql).not.toContain("REVOKE ALL ON FUNCTION public.is_admin");
    });

    it("Defect 3: confirms consume_quota() lacks SET search_path and revokes", () => {
      const consumeBlock = initSql.match(/FUNCTION\s+public\.consume_quota[\s\S]*?\$\$\s+LANGUAGE\s+plpgsql\s+SECURITY\s+DEFINER;/);
      expect(consumeBlock).not.toBeNull();
      expect(consumeBlock![0]).not.toContain("SET search_path");
      expect(initSql).not.toContain("REVOKE ALL ON FUNCTION public.consume_quota");
    });

    it("Defect 4: confirms profiles table lacks INSERT policy and WITH CHECK protection", () => {
      expect(initSql).not.toContain('CREATE POLICY "Users can insert');
      expect(initSql).not.toContain("FOR INSERT");
      expect(initSql).not.toContain("WITH CHECK");
    });

    it("Defect 5: confirms parental_consents and admin_warnings have RLS enabled but ZERO policies", () => {
      expect(initSql).toContain("ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;");
      expect(initSql).toContain("ALTER TABLE public.admin_warnings ENABLE ROW LEVEL SECURITY;");

      // Look for policies for parental_consents or admin_warnings
      const consentPolicy = initSql.match(/CREATE\s+POLICY\s+.*ON\s+public\.parental_consents/);
      const warningsPolicy = initSql.match(/CREATE\s+POLICY\s+.*ON\s+public\.admin_warnings/);
      expect(consentPolicy).toBeNull();
      expect(warningsPolicy).toBeNull();
    });

    it("Defect 6: confirms parental_consents stores plaintext token without hashing", () => {
      expect(initSql).toContain("consent_token TEXT NOT NULL UNIQUE");
      expect(initSql).not.toContain("token_hash");
    });

    it("Defect 7: confirms consume_quota ignores user time zone and account status", () => {
      const consumeBlock = initSql.match(/FUNCTION\s+public\.consume_quota[\s\S]*?\$\$\s+LANGUAGE\s+plpgsql/);
      expect(consumeBlock).not.toBeNull();
      // Uses CURRENT_DATE (database server time), not client IANA time zone
      expect(consumeBlock![0]).toContain("today DATE := CURRENT_DATE;");
      // Never inspects status or profiles.status
      expect(consumeBlock![0]).not.toContain("profiles.status");
      expect(consumeBlock![0]).not.toContain("BAN");
    });

    it("Defect 8: confirms account_status enum lacks PENDING_CONSENT", () => {
      const enumMatch = initSql.match(/CREATE\s+TYPE\s+account_status\s+AS\s+ENUM\s*\(([^)]+)\);/);
      expect(enumMatch).not.toBeNull();
      expect(enumMatch![1]).not.toContain("PENDING_CONSENT");
    });

    it("Defect 9: confirms no user data sync table (user_state) exists", () => {
      expect(initSql).not.toContain("user_state");
    });
  });
});
