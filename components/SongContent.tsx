"use client";

import { useState } from "react";
import type { ExtractionResult } from "@/lib/extract";
import LyricsPanel from "@/components/LyricsPanel";
import WordTiles from "@/components/WordTiles";

/** Client wrapper for the song page's two panels; owns the shared hover-highlight state. */
export default function SongContent({ extraction }: { extraction: ExtractionResult }) {
  const [highlighted, setHighlighted] = useState<string[]>([]);

  function handleHover(words: string[] | null) {
    setHighlighted(words ?? []);
  }

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section aria-label="Wordle words">
        <h2 className="mb-4 text-xs font-bold tracking-widest text-gray-500 uppercase">
          Wordle words
        </h2>
        <WordTiles words={extraction.words} highlighted={highlighted} onHover={handleHover} />
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Solid tiles appear as words in the lyrics; outlined tiles are hidden inside longer
          words. Click a word to copy it — hover one to spot it in the lyrics.
        </p>
      </section>
      <section aria-label="Lyrics">
        <h2 className="mb-4 text-xs font-bold tracking-widest text-gray-500 uppercase">
          Lyrics
        </h2>
        <LyricsPanel lines={extraction.lines} highlighted={highlighted} onHover={handleHover} />
      </section>
    </div>
  );
}
