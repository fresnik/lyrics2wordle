# Hover Highlight + Uppercase Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy tiles as UPPERCASE and add bidirectional hover-highlighting between word tiles and lyric marks.

**Architecture:** `Span` gains word identity (`words: string[]`, unioned on merge). A new client component `SongContent` owns `highlighted: string[]` state and renders the existing two-panel grid; `WordTiles` and `LyricsPanel` (now a client component) receive `highlighted` + `onHover` props. Highlight state is asserted in tests via `data-highlighted` attributes so styling stays free to change.

**Tech Stack:** Existing Next.js 16 / React 19 / Tailwind v4 / Vitest + Testing Library setup.

**Spec:** `docs/superpowers/specs/2026-08-22-hover-highlight-design.md`

---

### Task 1: Span word identity in the extraction engine

**Files:**
- Modify: `lib/extract.ts`
- Modify: `tests/extract.test.ts` (3 span assertions), `tests/components.test.tsx` (LyricsPanel fixtures gain `words` so tsc stays green)

- [ ] **Step 1: Update the failing tests**

In `tests/extract.test.ts` update the three span assertions:

```ts
  it("records highlight spans in original character positions", () => {
    // "go can'ts go": token "cants" spans original chars 3..8 (apostrophe included)
    const r = extractWordleWords("go can'ts go", set("cants"));
    expect(r.lines[0].spans).toEqual([{ start: 3, end: 9, words: ["cants"] }]);
  });

  it("merges overlapping spans for display but counts each match", () => {
    const r = extractWordleWords("stones", set("stone", "tones"));
    expect(r.words.map((w) => w.word)).toEqual(["stone", "tones"]);
    expect(r.lines[0].spans).toEqual([{ start: 0, end: 6, words: ["stone", "tones"] }]);
  });

  it("returns one annotated line per lyrics line, including empty ones", () => {
    const r = extractWordleWords("hello\n\nworld", set("hello"));
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0].spans).toEqual([{ start: 0, end: 5, words: ["hello"] }]);
    expect(r.lines[1]).toEqual({ text: "", spans: [] });
    expect(r.lines[2].spans).toEqual([]);
  });
```

Also add one new test pinning no-duplicate union on repeated words in one merged span:

```ts
  it("does not duplicate a word in a merged span's word list", () => {
    // "hellohello" yields two overlapping windows of "hello"? No — windows are
    // hell+o…; use a token where the same word matches twice non-adjacently on
    // one line instead: two separate spans, each carrying the word once.
    const r = extractWordleWords("hello hello", set("hello"));
    expect(r.lines[0].spans).toEqual([
      { start: 0, end: 5, words: ["hello"] },
      { start: 6, end: 11, words: ["hello"] },
    ]);
  });
```

In `tests/components.test.tsx` update the LyricsPanel fixtures to satisfy the new type:

```tsx
        lines={[
          { text: "I hear the drums", spans: [{ start: 11, end: 16, words: ["drums"] }] },
          { text: "", spans: [] },
        ]}
```

and in the two-marks test give each span `words: [...]` matching its text.

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run tests/extract.test.ts`
Expected: FAIL — spans lack `words`.

- [ ] **Step 3: Implement in `lib/extract.ts`**

```ts
/** Character span in the ORIGINAL line text: [start, end). */
export interface Span {
  start: number;
  end: number;
  /** Distinct words whose matches this span covers, in first-appearance order. Never empty. */
  words: string[];
}
```

Update the `AnnotatedLine.spans` doc comment to mention each span carries a non-empty `words`.

In `mergeSpans`, union word lists on merge:

```ts
function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
      for (const w of s.words) if (!last.words.includes(w)) last.words.push(w);
    } else {
      merged.push({ ...s, words: [...s.words] });
    }
  }
  return merged;
}
```

In `extractWordleWords`, push spans with their word:

```ts
        spans.push({ start: tok.map[i], end: tok.map[i + 4] + 1, words: [cand] });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run tests/extract.test.ts tests/components.test.tsx` then full `yarn vitest run` and `npx tsc --noEmit`.
Expected: all pass (65 total after the added test).

- [ ] **Step 5: Commit**

```bash
git add lib/extract.ts tests/extract.test.ts tests/components.test.tsx
git commit -m "feat: spans carry the words they cover"
```

---

### Task 2: Copy words in uppercase

**Files:**
- Modify: `components/WordTiles.tsx:13`
- Modify: `tests/components.test.tsx` (copy assertion)

- [ ] **Step 1: Update the failing test**

In the "copies a word on click and shows a toast" test:

```tsx
    expect(writeText).toHaveBeenCalledWith("DRUMS");
```

- [ ] **Step 2: Run to verify FAIL** — `yarn vitest run tests/components.test.tsx` (expected `"drums"` ≠ `"DRUMS"`).

- [ ] **Step 3: Implement** — in `components/WordTiles.tsx`:

```tsx
  function handleCopy(word: string) {
    setLastWord(word);
    void copy(word.toUpperCase());
  }
```

- [ ] **Step 4: Run to verify PASS**, then full suite.

- [ ] **Step 5: Commit**

```bash
git add components/WordTiles.tsx tests/components.test.tsx
git commit -m "feat: copy Wordle words in uppercase"
```

---

### Task 3: Bidirectional hover highlighting

**Files:**
- Create: `components/SongContent.tsx`
- Modify: `components/WordTiles.tsx`, `components/LyricsPanel.tsx`, `app/song/[id]/[slug]/page.tsx`
- Test: `tests/components.test.tsx`

- [ ] **Step 1: Write the failing tests** (append to `tests/components.test.tsx`):

```tsx
import SongContent from "@/components/SongContent";

describe("SongContent hover highlighting", () => {
  const extraction = {
    words: [
      { word: "stone", wholeCount: 0, substringCount: 1 },
      { word: "tones", wholeCount: 0, substringCount: 1 },
    ],
    lines: [{ text: "stones", spans: [{ start: 0, end: 6, words: ["stone", "tones"] }] }],
  };
  const stoneName = "Copy stone (found inside a longer word)";
  const tonesName = "Copy tones (found inside a longer word)";

  it("hovering a tile highlights the lyric marks containing that word", async () => {
    render(<SongContent extraction={extraction} />);
    const mark = screen.getByText("stones");
    expect(mark).not.toHaveAttribute("data-highlighted");
    await userEvent.hover(screen.getByRole("button", { name: stoneName }));
    expect(mark).toHaveAttribute("data-highlighted");
    await userEvent.unhover(screen.getByRole("button", { name: stoneName }));
    expect(mark).not.toHaveAttribute("data-highlighted");
  });

  it("hovering a merged lyric mark highlights all involved tiles", async () => {
    render(<SongContent extraction={extraction} />);
    await userEvent.hover(screen.getByText("stones"));
    expect(screen.getByRole("button", { name: stoneName })).toHaveAttribute("data-highlighted");
    expect(screen.getByRole("button", { name: tonesName })).toHaveAttribute("data-highlighted");
    await userEvent.unhover(screen.getByText("stones"));
    expect(screen.getByRole("button", { name: stoneName })).not.toHaveAttribute("data-highlighted");
  });

  it("focusing a tile also highlights the lyric marks (keyboard)", async () => {
    render(<SongContent extraction={extraction} />);
    await userEvent.tab(); // first tile button receives focus
    expect(screen.getByText("stones")).toHaveAttribute("data-highlighted");
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — cannot resolve `@/components/SongContent`.

- [ ] **Step 3: Extend `components/WordTiles.tsx`**

```tsx
interface WordTilesProps {
  words: WordEntry[];
  /** Words to visually highlight (driven by lyric-mark hover). */
  highlighted?: string[];
  /** Fires with this tile's word on hover/focus, null on leave/blur. */
  onHover?: (words: string[] | null) => void;
}

export default function WordTiles({ words, highlighted = [], onHover }: WordTilesProps) {
```

On the tile `<button>` add:

```tsx
                onMouseEnter={() => onHover?.([w.word])}
                onMouseLeave={() => onHover?.(null)}
                onFocus={() => onHover?.([w.word])}
                onBlur={() => onHover?.(null)}
                data-highlighted={highlighted.includes(w.word) || undefined}
```

and change the tile-group `<span>` class to key off the same boolean (Wordle-yellow ring):

```tsx
                <span
                  className={
                    "flex gap-0.5 rounded-sm" +
                    (highlighted.includes(w.word)
                      ? " ring-2 ring-[#c9b458] ring-offset-2 ring-offset-white dark:ring-offset-gray-950"
                      : "")
                  }
                >
```

- [ ] **Step 4: Convert `components/LyricsPanel.tsx` to a client component**

```tsx
"use client";

import type { ReactNode } from "react";
import type { AnnotatedLine } from "@/lib/extract";

interface LyricsPanelProps {
  lines: AnnotatedLine[];
  /** Words to visually highlight (driven by tile hover/focus). */
  highlighted?: string[];
  /** Fires with the hovered mark's words, null on leave. */
  onHover?: (words: string[] | null) => void;
}

function renderLine(
  line: AnnotatedLine,
  highlighted: string[],
  onHover: LyricsPanelProps["onHover"]
): ReactNode {
  if (line.spans.length === 0) return line.text || " ";
  const parts: ReactNode[] = [];
  let pos = 0;
  line.spans.forEach((span, i) => {
    if (span.start > pos) parts.push(line.text.slice(pos, span.start));
    const active = span.words.some((w) => highlighted.includes(w));
    parts.push(
      <mark
        key={i}
        onMouseEnter={() => onHover?.(span.words)}
        onMouseLeave={() => onHover?.(null)}
        data-highlighted={active || undefined}
        className={
          "rounded-xs px-0.5 font-semibold " +
          (active
            ? "bg-[#6aaa64] text-white dark:bg-[#538d4e]"
            : "bg-[#6aaa64]/25 text-inherit dark:bg-[#538d4e]/40")
        }
      >
        {line.text.slice(span.start, span.end)}
      </mark>
    );
    pos = span.end;
  });
  if (pos < line.text.length) parts.push(line.text.slice(pos));
  return parts;
}

export default function LyricsPanel({ lines, highlighted = [], onHover }: LyricsPanelProps) {
  return (
    <div className="leading-7 text-gray-700 dark:text-gray-300">
      {lines.map((line, i) => (
        <p key={i}>{renderLine(line, highlighted, onHover)}</p>
      ))}
    </div>
  );
}
```

(Note: the empty-line fallback is the NBSP escape `" "`, same as today's literal.)

- [ ] **Step 5: Create `components/SongContent.tsx`**

```tsx
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
```

- [ ] **Step 6: Slim down `app/song/[id]/[slug]/page.tsx`**

Replace the `<div className="grid gap-10 md:grid-cols-2">…</div>` block with:

```tsx
        <SongContent extraction={data.extraction} />
```

Replace the `LyricsPanel`/`WordTiles` imports with:

```tsx
import SongContent from "@/components/SongContent";
```

(`ShareButton` import stays.)

- [ ] **Step 7: Run tests to verify PASS**

Run: `yarn vitest run` (expect 68), `npx tsc --noEmit`, `yarn lint`, `yarn build`.

- [ ] **Step 8: Manual check**

`yarn dev`, open a real song page: hover a tile → occurrences light up solid green; hover a lyric mark → tile(s) get the yellow ring; click a tile → clipboard has UPPERCASE. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add components/SongContent.tsx components/WordTiles.tsx components/LyricsPanel.tsx "app/song/[id]/[slug]/page.tsx" tests/components.test.tsx
git commit -m "feat: bidirectional hover highlighting between tiles and lyrics"
```
