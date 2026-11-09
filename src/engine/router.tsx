/* Academia · headless hash router + route guards (client FSM, no server)
   Protected by HexStrike AI Serverless Defensive Routing & WAF Shield. */
import { useEffect, useState } from "react";
import { hexstrikeSanitizeRoute } from "@/engine/hexstrike-waf";

export const ASSISTANT_EXCLUDED = ["/404", "/500", "/banned", "/inactive", "/locker-locked"];

export function currentPath(): string {
  const h = window.location.hash.replace(/^#/, "");
  let raw = "/";
  if (h && h !== "") {
    raw = h;
  } else {
    const p = window.location.pathname;
    if (p && p !== "/" && p !== "/blank") raw = p;
  }

  // Pass through HexStrike AI Deep Packet & Route Inspection
  const { safeRoute } = hexstrikeSanitizeRoute(raw);
  return safeRoute;
}

export function navigate(to: string) {
  const { safeRoute, blocked } = hexstrikeSanitizeRoute(to);
  if (blocked) {
    // Malicious injection payload intercepted: force eviction to safe root
    window.location.hash = "/";
    return;
  }
  if (currentPath() === safeRoute) return;
  window.location.hash = safeRoute;
}

export function useRoute(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onHash = () => { setPath(currentPath()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, []);
  return path;
}

export function isExcludedRoute(path: string): boolean {
  return ASSISTANT_EXCLUDED.some(p => path === p || path.startsWith(p + "/"));
}

export function isAppRoute(path: string): boolean {
  return path !== "/" && path !== "/auth" && path !== "/questionnaire" && path !== "/provisioning" && !isExcludedRoute(path);
}

export const ADMIN_ROUTES = [
  "/admin",
  "/admin/console",
  "/admin/dashboard",
  "/admin/students",
] as const;

export function isAdminRoute(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}
