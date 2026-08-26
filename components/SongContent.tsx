"use client";

import { useMemo, useState } from "react";
import { filterAndMergeSpans, lineWithWordUppercased, type ExtractionResult } from "@/lib/extract";
import LyricsPanel from "@/components/LyricsPanel";
import WordTiles from "@/components/WordTiles";
import { useFinishedWords } from "@/components/useFinishedWords";
import { useLocalPreference } from "@/components/useLocalPreference";

const SUBSTRINGS_KEY = "lyrics2wordle:include-substring-words";
const COPY_LINE_KEY = "lyrics2wordle:copy-whole-line";

/** Client wrapper for the song page's two panels; owns the shared hover-highlight state. */
export default function SongContent({
  songId,
  extraction,
}: {
  songId: number;
  extraction: ExtractionResult;
}) {
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [includeSubstrings, setIncludeSubstrings] = useLocalPreference(SUBSTRINGS_KEY, true);
  const [copyWholeLine, setCopyWholeLine] = useLocalPreference(COPY_LINE_KEY, false);
  const { finished, toggle, markAll, reset } = useFinishedWords(songId);

  function handleHover(words: string[] | null) {
    setHighlighted(words ?? []);
  }

  const hasWords = extraction.words.length > 0;
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

  // Every listed word comes from some line's spans, so the fallback only
  // guards against inconsistent extraction data.
  const copyTextFor = copyWholeLine
    ? (word: string) => lineWithWordUppercased(extraction.lines, word) ?? word.toUpperCase()
    : undefined;

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section aria-label="Wordle words">
        <h2 className="mb-4 text-xs font-bold tracking-widest text-gray-500 uppercase">
          Wordle words
        </h2>
        {hasWords && (
          <div className="mb-4 flex flex-col gap-2">
            {hasSubstringOnly && (
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={includeSubstrings}
                  onChange={(e) => setIncludeSubstrings(e.target.checked)}
                  className="h-4 w-4 accent-[#6aaa64] dark:accent-[#538d4e]"
                />
                Include words hidden inside longer words
              </label>
            )}
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={copyWholeLine}
                onChange={(e) => setCopyWholeLine(e.target.checked)}
                className="h-4 w-4 accent-[#6aaa64] dark:accent-[#538d4e]"
              />
              Copy the whole line instead of just the word
            </label>
          </div>
        )}
        <WordTiles
          words={words}
          highlighted={highlighted}
          onHover={handleHover}
          finished={finished}
          onToggleFinished={toggle}
          copyTextFor={copyTextFor}
        />
        {words.length > 0 && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            <button
              type="button"
              onClick={() => markAll(words.map((w) => w.word))}
              disabled={words.every((w) => finished.includes(w.word))}
              className="cursor-pointer underline-offset-2 hover:underline disabled:cursor-default disabled:opacity-40 disabled:hover:no-underline"
            >
              mark all used
            </button>
            <span aria-hidden="true"> · </span>
            <button
              type="button"
              onClick={reset}
              disabled={finished.length === 0}
              className="cursor-pointer underline-offset-2 hover:underline disabled:cursor-default disabled:opacity-40 disabled:hover:no-underline"
            >
              reset
            </button>
          </p>
        )}
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Solid tiles appear as words in the lyrics; outlined tiles are hidden inside longer
          words. Click a word to copy it and mark it as used — click a greyed word to unmark
          it. Hover a word to spot it in the lyrics.
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
