// Enrutado por location.hash, sin librerías.
import { useEffect, useState } from "preact/hooks";

export const ROUTES = [
  "/",
  "/session",
  "/exercises",
  "/exercises/:id",
  "/routines",
  "/history/:exerciseId",
  "/volume",
  "/ingredients",
  "/recipes",
  "/recipes/:id",
  "/plan",
  "/day/:date",
  "/shopping",
  "/progress",
  "/settings",
] as const;

export type RoutePattern = (typeof ROUTES)[number];

export interface Route {
  pattern: RoutePattern | null;
  path: string;
  params: Record<string, string>;
}

function currentPath(): string {
  const h = location.hash.replace(/^#/, "");
  return h === "" ? "/" : h;
}

export function matchRoute(path: string): Route {
  const clean = path.split("?")[0]!;
  const parts = clean.split("/").filter(Boolean);
  for (const pattern of ROUTES) {
    const pp = pattern.split("/").filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < pp.length; i++) {
      const seg = pp[i]!;
      if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(parts[i]!);
      else if (seg !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { pattern, path: clean, params };
  }
  return { pattern: null, path: clean, params: {} };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => matchRoute(currentPath()));
  useEffect(() => {
    const onChange = () => {
      setRoute(matchRoute(currentPath()));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(path: string): void {
  location.hash = path;
}

export function back(fallback = "/"): void {
  if (history.length > 1) history.back();
  else navigate(fallback);
}
