/* Academia · headless hash router + route guards (client FSM, no server) */
import { useEffect, useState } from "react";

export const ASSISTANT_EXCLUDED = ["/404", "/500", "/banned", "/inactive", "/locker-locked"];

export function currentPath(): string {
  const h = window.location.hash.replace(/^#/, "");
  return h === "" ? "/" : h;
}

export function navigate(to: string) {
  if (currentPath() === to) return;
  window.location.hash = to;
}

export function useRoute(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onHash = () => { setPath(currentPath()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return path;
}

export function isExcludedRoute(path: string): boolean {
  return ASSISTANT_EXCLUDED.some(p => path === p || path.startsWith(p + "/"));
}

export function isAppRoute(path: string): boolean {
  return path !== "/" && path !== "/auth" && path !== "/questionnaire" && path !== "/provisioning" && !isExcludedRoute(path);
}