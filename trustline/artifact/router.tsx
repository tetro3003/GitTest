"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Tiny in-memory router used only by the single-file artifact build, where
 * Next.js file routing is not available. Pages call next/link and
 * next/navigation, which are aliased to the shims in ./shims.
 */
interface RouterState {
  path: string;
  params: Record<string, string>;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
  back: () => void;
}

export const RouterContext = createContext<RouterState>({ path: "/", params: {}, navigate: () => undefined, back: () => undefined });

export const useRouterState = () => useContext(RouterContext);

export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean);
  const b = path.split("?")[0].split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

/** A plain #token in the link (e.g. #lender) opens that section. */
const HASH_ROUTES: Record<string, string> = { demo: "/demo", lender: "/lender", borrower: "/borrower/profile", monitoring: "/lender/monitoring", api: "/lender/api", onboarding: "/borrower/onboarding" };

function initialPath(): string {
  try {
    const token = window.location.hash.replace(/^#/, "");
    return HASH_ROUTES[token] ?? "/";
  } catch {
    return "/";
  }
}

export function RouterProvider({ patterns, children }: { patterns: string[]; children: (path: string, params: Record<string, string>) => React.ReactNode }) {
  const [stack, setStack] = useState<string[]>(() => [initialPath()]);
  const path = stack[stack.length - 1];

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    const target = to.startsWith("/") ? to : `/${to}`;
    setStack((s) => (opts?.replace ? [...s.slice(0, -1), target] : [...s, target]));
  }, []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);

  useEffect(() => {
    const onHash = () => {
      const token = window.location.hash.replace(/^#/, "");
      if (HASH_ROUTES[token]) setStack((st) => [...st, HASH_ROUTES[token]]);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    try {
      window.scrollTo({ top: 0 });
    } catch {
      // ignore
    }
  }, [path]);

  const params = useMemo(() => {
    for (const p of patterns) {
      const m = matchRoute(p, path);
      if (m) return m;
    }
    return {};
  }, [patterns, path]);

  const value = useMemo(() => ({ path, params, navigate, back }), [path, params, navigate, back]);
  return <RouterContext.Provider value={value}>{children(path, params)}</RouterContext.Provider>;
}
