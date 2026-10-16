"use client";

import { useMemo } from "react";
import { useRouterState } from "../router";

/** next/navigation replacement for the artifact build. */
export function useRouter() {
  const { navigate, back } = useRouterState();
  return useMemo(
    () => ({
      push: (to: string) => navigate(to),
      replace: (to: string) => navigate(to, { replace: true }),
      back,
      refresh: () => undefined,
      prefetch: () => undefined,
    }),
    [navigate, back],
  );
}

export function usePathname(): string {
  return useRouterState().path.split("?")[0];
}

export function useParams<T extends Record<string, string>>(): T {
  return useRouterState().params as T;
}

export function redirect(): never {
  throw new Error("redirect() is not supported in the artifact build");
}
