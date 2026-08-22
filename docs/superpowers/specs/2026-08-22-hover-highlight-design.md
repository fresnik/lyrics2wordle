# Hover Highlight + Uppercase Copy — Design

**Date:** 2026-08-22
**Status:** Approved (user approved design in session; pre-approved proceeding to plan + implementation)

## Summary

Two changes to the song page:

1. Clicking a Wordle word tile copies the word in **UPPERCASE** (was lowercase).
2. **Bidirectional hover highlighting**: hovering a word tile highlights every occurrence
   of that word in the lyrics; hovering a highlighted word in the lyrics highlights the
   corresponding tile(s) in the word list.

## Decisions

- **Merged-overlap behavior:** lyrics highlights that cover overlapping matches (e.g.
  "stones" = STONE + TONES) light up when *any* involved word's tile is hovered, and
  hovering the mark lights up *all* involved tiles.
- **State wiring:** a new client wrapper component owns the hover state (Approach A);
  no CSS-only or DOM-script alternative.
- **Keyboard:** tiles also trigger highlighting on focus/blur (they are buttons).
  Lyric marks are not focusable (unchanged).
- **Touch:** no hover on touch devices — feature degrades gracefully; copy still works.
- **Visuals:** highlighted tiles get a Wordle-yellow (`#c9b458`) ring around the tile
  group; highlighted lyric marks switch from translucent green to solid green
  (`#6aaa64`, dark `#538d4e`) with white text.

## Data layer — `lib/extract.ts`

`Span` gains `words: string[]`: the distinct normalized words whose matches the span
covers, in first-appearance order within the span. `mergeSpans` unions word lists when
merging overlapping/adjacent spans (no duplicates). The documented span invariant
(sorted, non-overlapping, in-bounds) is extended to mention `words` is non-empty.
Extraction is otherwise unchanged.

## Components

- **`components/SongContent.tsx` (new, `"use client"`):** receives
  `{ extraction: ExtractionResult }` from the server page and renders the existing
  two-section grid (Wordle words + Lyrics) that currently lives in `page.tsx`.
  Owns `highlighted: string[]` (empty = nothing hovered). Passes `highlighted` and
  `onHover(words: string[] | null)` to both panels (null clears).
- **`components/WordTiles.tsx`:** new optional props `highlighted: string[]` and
  `onHover`. Tile button: `onMouseEnter/onFocus` → `onHover([word])`;
  `onMouseLeave/onBlur` → `onHover(null)`. Tile group shows the yellow ring when its
  word ∈ highlighted. Copy: `navigator.clipboard.writeText(word.toUpperCase())`
  (toast text unchanged — already uppercase).
- **`components/LyricsPanel.tsx`:** becomes a client component. Same two new props.
  Each `<mark>`: `onMouseEnter` → `onHover(span.words)`, `onMouseLeave` →
  `onHover(null)`; solid-green highlight style when any of `span.words` ∈ highlighted.
- **`app/song/[id]/[slug]/page.tsx`:** the two-section grid is replaced by
  `<SongContent extraction={data.extraction} />`. Page stays a server component; the
  extraction result is plain JSON. Header, share button, and the no-lyrics state stay
  in the page.

## Error handling

None new — pure client-side UI state.

## Testing

- `tests/extract.test.ts`: span expectations updated to include `words`; new case
  asserting the merged "stones" span carries `["stone", "tones"]`.
- `tests/components.test.tsx`: uppercase copy assertion; hover tile → mark highlighted
  (via SongContent); hover merged mark → both tiles highlighted; unhover clears.
- `tests/songPage.test.tsx`: existing integration tests keep passing with SongContent
  in the tree.

## Out of scope

Touch/long-press highlighting, focusable lyric marks, persistent selection on click.
