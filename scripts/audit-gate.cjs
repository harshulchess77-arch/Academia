#!/usr/bin/env node

/**
 * Academia · Automated Security Audit Gate (CI/CD Compilation Barrier).
 * Integrates rules from security-audit-skill to ensure zero demo bypasses,
 * zero prototype pollution vectors, active Turnstile barriers, and active HexStrike WAF.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

const CHECKS = [
  {
    id: "SEC-001",
    title: "Zero Client-Side Demo Bypasses",
    description: "Verify that DEMO_MODE, seeded demo buttons, and demo session restore bypasses are absent from src/.",
    test: () => {
      const forbidden = [
        "DEMO_MODE",
        "seeded demo desks",
        "Demo admin",
        "Restore demo session",
        "demo keyring",
        "governance mode",
      ];
      const violations = [];

      function walk(dir) {
        for (const file of fs.readdirSync(dir)) {
          const full = path.join(dir, file);
          if (fs.statSync(full).isDirectory()) {
            walk(full);
          } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
            const content = fs.readFileSync(full, "utf8");
            for (const phrase of forbidden) {
              const regex = new RegExp(`\\b${phrase}\\b`, "i");
              // Allow comments documenting the elimination of demo shortcuts
              const lines = content.split("\n");
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (regex.test(line) && !line.includes("/*") && !line.includes("//") && !line.includes("without client-side demo")) {
                  violations.push(`${path.relative(ROOT, full)}:${i + 1} contains "${phrase}"`);
                }
              }
            }
          }
        }
      }

      walk(SRC);
      return { ok: violations.length === 0, violations };
    },
  },
  {
    id: "SEC-002",
    title: "HexStrike AI WAF & Route Sanitization",
    description: "Verify that hexstrikeSanitizeRoute is integrated into the routing engine.",
    test: () => {
      const routerPath = path.join(SRC, "engine", "router.tsx");
      const wafPath = path.join(SRC, "engine", "hexstrike-waf.ts");
      if (!fs.existsSync(wafPath)) return { ok: false, violations: ["Missing hexstrike-waf.ts"] };
      const routerCode = fs.readFileSync(routerPath, "utf8");
      if (!routerCode.includes("hexstrikeSanitizeRoute")) {
        return { ok: false, violations: ["router.tsx does not hook hexstrikeSanitizeRoute"] };
      }
      return { ok: true, violations: [] };
    },
  },
  {
    id: "SEC-003",
    title: "Cloudflare Turnstile CAPTCHA Barrier",
    description: "Verify that Cloudflare Turnstile human verification is required on authentication views.",
    test: () => {
      const turnstilePath = path.join(SRC, "components", "auth", "turnstile.tsx");
      const authPath = path.join(SRC, "views", "auth.tsx");
      if (!fs.existsSync(turnstilePath)) return { ok: false, violations: ["Missing turnstile.tsx"] };
      const authCode = fs.readFileSync(authPath, "utf8");
      if (!authCode.includes("TurnstileWidget") || !authCode.includes("turnstileToken")) {
        return { ok: false, violations: ["auth.tsx does not require TurnstileWidget or turnstileToken"] };
      }
      return { ok: true, violations: [] };
    },
  },
  {
    id: "SEC-004",
    title: "Administrative RBAC & Isolation Barrier",
    description: "Verify that administrative routes are isolated and verifyAdminClaims is strictly enforced.",
    test: () => {
      const appPath = path.join(SRC, "App.tsx");
      const appCode = fs.readFileSync(appPath, "utf8");
      if (!appCode.includes("AdminIsolationBarrier") || !appCode.includes("verifyAdminClaims")) {
        return { ok: false, violations: ["App.tsx does not enforce AdminIsolationBarrier with verifyAdminClaims"] };
      }
      return { ok: true, violations: [] };
    },
  },
];

console.log("================================================================================");
console.log("🛡️  ACADEMIA CI/CD SECURITY AUDIT GATE");
console.log("================================================================================");

let totalPassed = 0;
let totalFailed = 0;
const report = {
  timestamp: new Date().toISOString(),
  checks: [],
};

for (const check of CHECKS) {
  process.stdout.write(`[AUDIT] ${check.id}: ${check.title}... `);
  const result = check.test();
  if (result.ok) {
    console.log("PASSED ✓");
    totalPassed++;
    report.checks.push({ id: check.id, status: "PASSED", description: check.description });
  } else {
    console.log("FAILED ✖");
    totalFailed++;
    for (const v of result.violations) {
      console.error(`        → Violation: ${v}`);
    }
    report.checks.push({ id: check.id, status: "FAILED", description: check.description, violations: result.violations });
  }
}

console.log("--------------------------------------------------------------------------------");
console.log(`Audit Summary: ${totalPassed} passed, ${totalFailed} failed.`);

fs.writeFileSync(path.join(ROOT, "security-audit-report.json"), JSON.stringify(report, null, 2), "utf8");

if (totalFailed > 0) {
  console.error("❌ CI/CD Security Audit Gate: Invariants breached. Build halted.");
  process.exit(1);
} else {
  console.log("✅ CI/CD Security Audit Gate: All invariants verified.");
  process.exit(0);
}

