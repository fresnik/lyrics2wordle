"use client";

import { useState } from "react";
import type { WordEntry } from "@/lib/extract";

export default function WordTiles({ words }: { words: WordEntry[] }) {
  const [toast, setToast] = useState<string | null>(null);

  async function copy(word: string) {
    try {
      await navigator.clipboard.writeText(word);
    } catch {
      return;
    }
    setToast(`Copied ${word.toUpperCase()}`);
    window.setTimeout(() => setToast(null), 1500);
  }

  if (words.length === 0) {
    return <p className="text-lg">No Wordle words in this one — try another song! 🤷</p>;
  }

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
                onClick={() => copy(w.word)}
                title={whole ? "Appears as a word in the lyrics" : "Found inside a longer word"}
                aria-label={`Copy ${w.word}`}
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
