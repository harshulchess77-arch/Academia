/* Academia · HexStrike AI Serverless Defensive Firewall Shield Layer.
   Autonomous Edge WAF & Request Sanitization Engine.
   Provides real-time inspection for Prototype Pollution, XSS, SQLi, and Path Traversal. */

export type HexStrikeThreatCategory =
  | "PROTOTYPE_POLLUTION"
  | "CROSS_SITE_SCRIPTING"
  | "SQL_INJECTION"
  | "PATH_TRAVERSAL"
  | "COMMAND_INJECTION";

export interface HexStrikeThreat {
  category: HexStrikeThreatCategory;
  pattern: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
}

export interface HexStrikeAuditEntry {
  id: string;
  timestamp: number;
  input: string;
  threats: HexStrikeThreat[];
  action: "BLOCKED" | "SANITIZED" | "ALLOWED";
}

// In-memory append-only audit trail for defensive WAF telemetry
const WAF_AUDIT_LOG: HexStrikeAuditEntry[] = [];

// Threat Signature Patterns inspired by HexStrike AI Security Rules
const SIGNATURES: Array<{
  category: HexStrikeThreatCategory;
  regex: RegExp;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
}> = [
  // 1. Prototype Pollution Vectors
  {
    category: "PROTOTYPE_POLLUTION",
    regex: /(?:__proto__|constructor\s*\[\s*['"]prototype['"]\s*\]|Object\.prototype|__defineGetter__|__defineSetter__|__lookupGetter__|__lookupSetter__)/i,
    severity: "critical",
    description: "Prototype pollution injection targeting JavaScript object prototype.",
  },
  // 2. Cross-Site Scripting (XSS) Vectors
  {
    category: "CROSS_SITE_SCRIPTING",
    regex: /<script\b[^>]*>/i,
    severity: "critical",
    description: "Script tag execution sequence.",
  },
  {
    category: "CROSS_SITE_SCRIPTING",
    regex: /(?:javascript|data|vbscript):[^\n]+/i,
    severity: "high",
    description: "Dangerous pseudo-protocol URI scheme.",
  },
  {
    category: "CROSS_SITE_SCRIPTING",
    regex: /on(?:load|error|click|mouseover|focus|blur|submit|keydown|keyup)\s*=/i,
    severity: "high",
    description: "Inline DOM event handler attribute injection.",
  },
  {
    category: "CROSS_SITE_SCRIPTING",
    regex: /<img[^>]+src=[^>]+onerror\s*=/i,
    severity: "critical",
    description: "Image tag onerror execution payload.",
  },
  // 3. SQL Injection (SQLi) Vectors
  {
    category: "SQL_INJECTION",
    regex: /(?:\b(?:union\s+all\s+select|union\s+select|select\s+.*\s+from|insert\s+into|drop\s+table|delete\s+from)\b|--\s*$|\/\*.*?\*\/)/i,
    severity: "critical",
    description: "SQL query structure manipulation or comment termination.",
  },
  {
    category: "SQL_INJECTION",
    regex: /(?:'\s+or\s+.*=.*|'\s+or\s+\d+\s*=\s*\d+|"\s+or\s+.*=.*|\b(?:or|and)\s+['"]?[\w]+['"]?\s*=\s*['"]?[\w]+['"]?)/i,
    severity: "high",
    description: "Tautological boolean SQL bypass injection.",
  },
  // 4. Directory & Path Traversal Vectors
  {
    category: "PATH_TRAVERSAL",
    regex: /(?:\.\.[\\/]|%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e%2e%5c)/i,
    severity: "high",
    description: "Directory traversal sequence attempting escape from workspace root.",
  },
  // 5. Shell & Command Injection
  {
    category: "COMMAND_INJECTION",
    regex: /(?:;\s*(?:cat|ls|rm|chmod|sh|bash|curl|wget)\b|\|\s*(?:bash|sh)\b|`[^`]+`|\$\([^)]+\))/i,
    severity: "critical",
    description: "OS command chaining or subshell execution payload.",
  },
];

/**
 * HexStrike AI Deep Packet & Route Inspection Routine.
 * Scans string inputs against threat signatures and returns structured security verdicts.
 */
export function hexstrikeInspect(input: string): {
  safe: boolean;
  threats: HexStrikeThreat[];
  severity: "none" | "low" | "medium" | "high" | "critical";
} {
  if (!input || typeof input !== "string") {
    return { safe: true, threats: [], severity: "none" };
  }

  // Normalize Unicode representations to defeat homoglyphic bypasses
  const normalized = input.normalize("NFKC");
  const threats: HexStrikeThreat[] = [];

  for (const sig of SIGNATURES) {
    if (sig.regex.test(normalized)) {
      threats.push({
        category: sig.category,
        pattern: sig.regex.source,
        severity: sig.severity,
        description: sig.description,
      });
    }
  }

  const safe = threats.length === 0;
  const severity = safe
    ? "none"
    : threats.some(t => t.severity === "critical")
      ? "critical"
      : threats.some(t => t.severity === "high")
        ? "high"
        : threats.some(t => t.severity === "medium")
          ? "medium"
          : "low";

  return { safe, threats, severity };
}

/**
 * HexStrike AI Edge Route Sanitizer.
 * Intercepts incoming route requests, strips dangerous tokens, and enforces
 * navigational invariants before the hash router or React tree mounts.
 */
export function hexstrikeSanitizeRoute(rawRoute: string): {
  safeRoute: string;
  blocked: boolean;
  threats: HexStrikeThreat[];
} {
  if (!rawRoute || typeof rawRoute !== "string") {
    return { safeRoute: "/", blocked: false, threats: [] };
  }

  const inspection = hexstrikeInspect(rawRoute);

  if (!inspection.safe) {
    // Record defensive telemetry
    WAF_AUDIT_LOG.unshift({
      id: `waf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      input: rawRoute,
      threats: inspection.threats,
      action: inspection.severity === "critical" || inspection.severity === "high" ? "BLOCKED" : "SANITIZED",
    });

    // Prune log to 100 entries max to conserve memory
    if (WAF_AUDIT_LOG.length > 100) {
      WAF_AUDIT_LOG.length = 100;
    }

    // High/critical threats trigger immediate route eviction to safe landing
    if (inspection.severity === "critical" || inspection.severity === "high") {
      return {
        safeRoute: "/",
        blocked: true,
        threats: inspection.threats,
      };
    }
  }

  // Clean route of control characters and leading/trailing invalid tokens
  let cleaned = rawRoute
    .replace(/[\x00-\x1f\x7f]/g, "") // Strip ASCII control characters
    .replace(/[<>'"`;]/g, "")       // Strip script execution symbols
    .trim();

  if (!cleaned.startsWith("/")) {
    cleaned = `/${cleaned}`;
  }

  // Deduplicate consecutive slashes (e.g., //admin -> /admin)
  cleaned = cleaned.replace(/\/+/g, "/");

  return {
    safeRoute: cleaned,
    blocked: false,
    threats: inspection.threats,
  };
}

/** Returns the active in-memory HexStrike WAF defensive audit stream. */
export function getHexStrikeWafAuditLog(): readonly HexStrikeAuditEntry[] {
  return WAF_AUDIT_LOG;
}

/** Clears the HexStrike WAF audit log (primarily for clean test harness isolation). */
export function clearHexStrikeWafAuditLog(): void {
  WAF_AUDIT_LOG.length = 0;
}
