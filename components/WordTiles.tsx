"use client";

import { useState } from "react";
import type { WordEntry } from "@/lib/extract";
import { useCopyFeedback } from "@/components/useCopyFeedback";

interface WordTilesProps {
  words: WordEntry[];
  /** Words to visually highlight (driven by lyric-mark hover). */
  highlighted?: string[];
  /** Fires with this tile's word on hover/focus, null on leave/blur. */
  onHover?: (words: string[] | null) => void;
  /** Words already used in this song — shown greyed out. */
  finished?: string[];
  /** When provided, clicking a tile also marks it used; clicking a used tile unmarks it instead of copying. */
  onToggleFinished?: (word: string) => void;
  /** Overrides what a click copies (e.g. the whole lyric line); defaults to the uppercased word. */
  copyTextFor?: (word: string) => string;
}

export default function WordTiles({
  words,
  highlighted = [],
  onHover,
  finished = [],
  onToggleFinished,
  copyTextFor,
}: WordTilesProps) {
  const { status, copy } = useCopyFeedback();
  const [lastCopied, setLastCopied] = useState<string | null>(null);

  function handleClick(word: string) {
    if (onToggleFinished && finished.includes(word)) {
      onToggleFinished(word);
      return;
    }
    onToggleFinished?.(word);
    const text = copyTextFor ? copyTextFor(word) : word.toUpperCase();
    setLastCopied(text);
    void copy(text);
  }

  if (words.length === 0) {
    return <p className="text-lg">No Wordle words in this one — try another song! 🤷</p>;
  }

  const toast =
    status === "copied" && lastCopied
      ? `Copied ${lastCopied}${onToggleFinished ? " — marked as used" : ""}`
      : status === "error"
        ? "Couldn't copy — try selecting the text"
        : null;

  return (
    <div>
      <ul className="flex flex-wrap gap-3">
        {words.map((w) => {
          const whole = w.wholeCount > 0;
          const total = w.wholeCount + w.substringCount;
          const isFinished = finished.includes(w.word);
          return (
            <li key={w.word}>
              <button
                type="button"
                onClick={() => handleClick(w.word)}
                onMouseEnter={() => onHover?.([w.word])}
                onMouseLeave={() => onHover?.(null)}
                onFocus={() => onHover?.([w.word])}
                onBlur={() => onHover?.(null)}
                data-highlighted={highlighted.includes(w.word) || undefined}
                data-finished={isFinished || undefined}
                title={
                  isFinished
                    ? "Marked as used — click to unmark"
                    : whole
                      ? "Appears as a word in the lyrics"
                      : "Found inside a longer word"
                }
                aria-label={
                  isFinished
                    ? `Unmark ${w.word}`
                    : whole
                      ? `Copy ${w.word}`
                      : `Copy ${w.word} (found inside a longer word)`
                }
                className="flex cursor-pointer items-center gap-1"
              >
                <span
                  className={
                    "flex gap-0.5 rounded-sm" +
                    (highlighted.includes(w.word)
                      ? " ring-2 ring-[#c9b458] ring-offset-2 ring-offset-white dark:ring-offset-gray-950"
                      : "")
                  }
                >
                  {[...w.word].map((ch, i) => (
                    <span
                      key={i}
                      className={
                        "flex h-8 w-8 items-center justify-center rounded-sm text-lg font-bold uppercase " +
                        (isFinished
                          ? whole
                            ? "bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                            : "border-2 border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500"
                          : whole
                            ? "bg-[#6aaa64] text-white dark:bg-[#538d4e]"
                            : "border-2 border-[#6aaa64] text-[#6aaa64] dark:border-[#538d4e] dark:text-[#7cb56f]")
                      }
                    >
                      {ch}
                    </span>
                  ))}
                </span>
                {/* Always shown (even ×1) so tile rows line up evenly. */}
                <span className="text-xs text-gray-500 dark:text-gray-400">×{total}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 max-w-[calc(100vw-3rem)] -translate-x-1/2 truncate rounded-md bg-gray-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
