"use client";

import { useCallback, useSyncExternalStore } from "react";

// Boolean preferences live in localStorage, exposed as an external store: the
// server snapshot is the default so the first client render matches SSR, and
// "storage" events keep other tabs in sync. Listeners are shared across all
// preference keys — a write re-reads every subscribed preference, which is
// cheap and keeps the store logic trivial.
const listeners = new Set<() => void>();
// In-memory fallback so toggles still work when storage is unavailable
// (e.g. privacy mode); they just won't survive a reload.
const fallbacks = new Map<string, boolean>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** A boolean preference persisted under `key`, shared across tabs and components. */
export function useLocalPreference(
  key: string,
  defaultValue: boolean
): [boolean, (next: boolean) => void] {
  const read = useCallback(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? defaultValue : raw !== "false";
    } catch {
      // storage unavailable — the in-memory fallback applies for this visit
      return fallbacks.get(key) ?? defaultValue;
    }
  }, [key, defaultValue]);

  const value = useSyncExternalStore(subscribe, read, () => defaultValue);

  const write = useCallback(
    (next: boolean) => {
      fallbacks.set(key, next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // storage unavailable — the in-memory fallback still applies this visit
      }
      listeners.forEach((listener) => listener());
    },
    [key]
  );

  return [value, write];
}
