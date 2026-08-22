"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { filterAndMergeSpans, type ExtractionResult } from "@/lib/extract";
import LyricsPanel from "@/components/LyricsPanel";
import WordTiles from "@/components/WordTiles";

const SUBSTRINGS_KEY = "lyrics2wordle:include-substring-words";

// The include-substrings preference lives in localStorage, exposed as an
// external store: the server snapshot is the default (include) so the first
// client render matches SSR, and "storage" events keep other tabs in sync.
const storeListeners = new Set<() => void>();
// In-memory fallback so the toggle still works when storage is unavailable
// (e.g. privacy mode); it just won't survive a reload.
let fallbackValue = true;
function subscribeToPreference(listener: () => void): () => void {
  storeListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    storeListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function readPreference(): boolean {
  try {
    return localStorage.getItem(SUBSTRINGS_KEY) !== "false";
  } catch {
    return fallbackValue;
  }
}
function writePreference(next: boolean) {
  fallbackValue = next;
  try {
    localStorage.setItem(SUBSTRINGS_KEY, String(next));
  } catch {
    // storage unavailable — the in-memory fallback still applies this visit
  }
  storeListeners.forEach((listener) => listener());
}

/** Client wrapper for the song page's two panels; owns the shared hover-highlight state. */
export default function SongContent({ extraction }: { extraction: ExtractionResult }) {
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const includeSubstrings = useSyncExternalStore(subscribeToPreference, readPreference, () => true);

  function handleHover(words: string[] | null) {
    setHighlighted(words ?? []);
  }

  const hasSubstringOnly = extraction.words.some((w) => w.wholeCount === 0);
  const words = useMemo(
    () =>
      includeSubstrings ? extraction.words : extraction.words.filter((w) => w.wholeCount > 0),
    [extraction, includeSubstrings]
  );
  const lines = useMemo(() => {
    const visible = includeSubstrings ? null : new Set(words.map((w) => w.word));
    return extraction.lines.map((line) => ({
      ...line,
      spans: filterAndMergeSpans(line.spans, visible),
    }));
  }, [extraction, includeSubstrings, words]);

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section aria-label="Wordle words">
        <h2 className="mb-4 text-xs font-bold tracking-widest text-gray-500 uppercase">
          Wordle words
        </h2>
        {hasSubstringOnly && (
          <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={includeSubstrings}
              onChange={(e) => writePreference(e.target.checked)}
              className="h-4 w-4 accent-[#6aaa64] dark:accent-[#538d4e]"
            />
            Include words hidden inside longer words
          </label>
        )}
        <WordTiles words={words} highlighted={highlighted} onHover={handleHover} />
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Solid tiles appear as words in the lyrics; outlined tiles are hidden inside longer
          words. Click a word to copy it — hover one to spot it in the lyrics.
        </p>
      </section>
      <section aria-label="Lyrics">
        <h2 className="mb-4 text-xs font-bold tracking-widest text-gray-500 uppercase">
          Lyrics
        </h2>
        <LyricsPanel lines={lines} highlighted={highlighted} onHover={handleHover} />
      </section>
    </div>
  );
}
