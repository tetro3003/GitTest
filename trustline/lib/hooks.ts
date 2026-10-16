"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDemo } from "./store";

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload: () => void;
}

/**
 * Minimal data hook: runs `fn` on mount, when `deps` change, and whenever the
 * demo store is invalidated after a mutation. Swap for React Query later if needed.
 */
export function useApi<T>(fn: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const version = useDemo((s) => s.version);
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fnRef
      .current()
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((e: unknown) => !cancelled && setState((s) => ({ ...s, error: e instanceof Error ? e : new Error(String(e)), loading: false })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: state.data, error: state.error, loading: state.loading, reload };
}
