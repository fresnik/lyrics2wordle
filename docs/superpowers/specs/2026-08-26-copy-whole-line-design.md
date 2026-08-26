# Copy whole line option — design

Date: 2026-08-26

## Goal

Let the user switch between two copy behaviors when clicking a word tile:

1. Copy just the word, uppercased (current behavior, remains the default).
2. Copy the whole lyric line the word appears in, with the clicked word kept
   in uppercase inside the line.

## Design

### Preference

- New localStorage key `lyrics2wordle:copy-whole-line`, boolean, default
  `false` (copy just the word).
- Same semantics as the existing include-substrings preference: exposed via
  `useSyncExternalStore`, synced across tabs via the `storage` event, with an
  in-memory fallback when storage is unavailable, and a server snapshot equal
  to the default so the first client render matches SSR.
- Since this is the second preference with identical plumbing, the bespoke
  store code in `SongContent.tsx` is extracted into a reusable
  `useLocalPreference(key, defaultValue)` hook
  (`components/useLocalPreference.ts`) used by both checkboxes.

### UI

- A second checkbox in the "Wordle words" section, styled like the existing
  one, labeled **"Copy the whole line instead of just the word"**.
- Shown whenever the song has at least one Wordle word (the substrings
  checkbox keeps its stricter "only when substring-only words exist"
  condition).

### Line selection and uppercasing

- New pure helper `lineWithWordUppercased(lines, word)` in `lib/extract.ts`:
  scans `extraction.lines` in order and returns the **first** line whose raw
  spans include the word, with **every** span of that word in the line
  uppercased via its span range; returns `null` when the word matches no
  line (callers fall back to the bare word).
- Substring matches uppercase only the matched window (e.g. clicking *tones*
  on the line "stones" copies "sTONES").
- Overlapping same-word spans (e.g. "aaaaaaa") are guarded so no text is
  duplicated.

### Wiring

- `SongContent` computes the copy text and passes an optional
  `copyTextFor(word)` prop to `WordTiles`. Without the prop (or with the
  preference off) `WordTiles` copies `word.toUpperCase()` as before.
- The toast reports what was actually copied ("Copied sTONES — marked as
  used"), truncated with CSS so long lines don't overflow.

## Testing

- Unit tests for `lineWithWordUppercased` in `tests/extract.test.ts`.
- Component tests in `tests/components.test.tsx`: default off, line copied
  with the word uppercased when on, substring-window uppercasing, word found
  on a later line, persistence across remounts, checkbox hidden when the song
  has no words, and `WordTiles` honoring the `copyTextFor` prop.
