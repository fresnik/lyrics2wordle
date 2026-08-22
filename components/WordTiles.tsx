"use client";

import { useState } from "react";
import type { WordEntry } from "@/lib/extract";
import { useCopyFeedback } from "@/components/useCopyFeedback";

export default function WordTiles({ words }: { words: WordEntry[] }) {
  const { status, copy } = useCopyFeedback();
  const [lastWord, setLastWord] = useState<string | null>(null);

  function handleCopy(word: string) {
    setLastWord(word);
    void copy(word);
  }

  if (words.length === 0) {
    return <p className="text-lg">No Wordle words in this one — try another song! 🤷</p>;
  }

  const toast =
    status === "copied" && lastWord
      ? `Copied ${lastWord.toUpperCase()}`
      : status === "error"
        ? "Couldn't copy — try selecting the text"
        : null;

  return (
    <div>
      <ul className="flex flex-wrap gap-3">
        {words.map((w) => {
          const whole = w.wholeCount > 0;
          const total = w.wholeCount + w.substringCount;
          return (
            <li key={w.word}>
              <button
                type="button"
                onClick={() => handleCopy(w.word)}
                title={whole ? "Appears as a word in the lyrics" : "Found inside a longer word"}
                aria-label={whole ? `Copy ${w.word}` : `Copy ${w.word} (found inside a longer word)`}
                className="flex cursor-pointer items-center gap-1"
              >
                <span className="flex gap-0.5">
                  {[...w.word].map((ch, i) => (
                    <span
                      key={i}
                      className={
                        "flex h-8 w-8 items-center justify-center rounded-sm text-lg font-bold uppercase " +
                        (whole
                          ? "bg-[#6aaa64] text-white dark:bg-[#538d4e]"
                          : "border-2 border-[#6aaa64] text-[#6aaa64] dark:border-[#538d4e] dark:text-[#7cb56f]")
                      }
                    >
                      {ch}
                    </span>
                  ))}
                </span>
                {total > 1 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">×{total}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-gray-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
