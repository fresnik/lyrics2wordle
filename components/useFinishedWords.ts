"use client";

import { useCallback, useSyncExternalStore } from "react";

// Per-song "used words" store backed by localStorage, mirroring the
// include-substrings preference in SongContent: the server snapshot is the
// empty list so the first client render matches SSR, "storage" events keep
// other tabs in sync, and an in-memory fallback covers privacy modes where
// storage is unavailable (the marks just won't survive a reload).
const keyFor = (songId: number) => `lyrics2wordle:finished:${songId}`;

const storeListeners = new Set<() => void>();
const fallbackValues = new Map<number, string[]>();
// useSyncExternalStore needs a referentially stable snapshot, so parses are
// cached against the raw string they came from.
const parseCache = new Map<number, { raw: string; parsed: string[] }>();
const EMPTY: string[] = [];

function subscribeToStore(listener: () => void): () => void {
  storeListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    storeListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readFinished(songId: number): string[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(keyFor(songId));
  } catch {
    return fallbackValues.get(songId) ?? EMPTY;
  }
  if (raw === null) return EMPTY;
  const cached = parseCache.get(songId);
  if (cached && cached.raw === raw) return cached.parsed;
  let parsed = EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) parsed = value.filter((w): w is string => typeof w === "string");
  } catch {
    // corrupt entry — treat as no words used
  }
  parseCache.set(songId, { raw, parsed });
  return parsed;
}

function writeFinished(songId: number, words: string[]) {
  fallbackValues.set(songId, words);
  try {
    if (words.length === 0) localStorage.removeItem(keyFor(songId));
    else localStorage.setItem(keyFor(songId), JSON.stringify(words));
  } catch {
    // storage unavailable — the in-memory fallback still applies this visit
  }
  storeListeners.forEach((listener) => listener());
}

/** Words the user has marked as already used in this song's Wordle games. */
export function useFinishedWords(songId: number) {
  const finished = useSyncExternalStore(
    subscribeToStore,
    () => readFinished(songId),
    () => EMPTY
  );
  const toggle = useCallback(
    (word: string) => {
      const current = readFinished(songId);
      writeFinished(
        songId,
        current.includes(word) ? current.filter((w) => w !== word) : [...current, word]
      );
    },
    [songId]
  );
  const markAll = useCallback(
    (words: string[]) => {
      const current = readFinished(songId);
      writeFinished(songId, [...current, ...words.filter((w) => !current.includes(w))]);
    },
    [songId]
  );
  const reset = useCallback(() => writeFinished(songId, []), [songId]);
  return { finished, toggle, markAll, reset };
}
