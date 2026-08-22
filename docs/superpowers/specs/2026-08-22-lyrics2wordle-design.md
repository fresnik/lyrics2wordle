# Lyrics2Wordle — Design

**Date:** 2026-08-22
**Status:** Approved pending user review

## Summary

Lyrics2Wordle is a web app where a user searches for a song (title, optionally artist),
picks the right record from the results, and gets every valid Wordle word found in that
song's lyrics. Each song has a unique, shareable URL that recomputes the words on load.

## Decisions (settled during brainstorming)

- **Lyrics source:** lrclib.net public API (no key, returns plain lyrics as JSON; no scraping).
- **Hosting:** Vercel. **Framework:** Next.js (latest stable, App Router, TypeScript), Tailwind CSS, yarn.
- **Word list:** Wordle's allowed-guess list (~15k words) — anything you can physically type into Wordle.
- **Matching:** whole 5-letter tokens **and** 5-letter substrings of longer tokens (CLIPS inside "eclipse"), visually distinguished.
- **Word data:** deduplicated, ordered by first appearance in the lyrics, with occurrence counts.
- **Result flow:** search always shows a results list, even for a single hit.
- **URL scheme:** `/song/{id}/{slug}` — numeric lrclib ID is authoritative; slug is cosmetic.
- **Song page layout:** lyrics with matches highlighted in place, word tiles alongside (Layout B).
- **Style:** playful, Wordle-themed (green/yellow/gray tile palette); explicitly *not* the
  ct-frontend-design enterprise style (user decision — personal side project).
- **v1 extras:** copy-word-on-click, repeat-count badges, copy-link share button,
  dark mode via `prefers-color-scheme` (no toggle).
- **No database.** All pages are derivable from the URL + lrclib + the bundled word list.

## Architecture

### Routes

| Route | Type | Purpose |
|---|---|---|
| `/` | Client page | Search form (title required, artist optional) + results list |
| `/song/[id]/[slug]` | Server-rendered page | The shareable song page |
| `/api/search` | API route | Proxies lrclib search; normalizes and filters results |

### Data flow — search

1. `SearchForm` calls `/api/search?track=...&artist=...`.
2. The route calls `GET https://lrclib.net/api/search` with those terms.
3. Results are normalized to `{ id, trackName, artistName, albumName, duration }` and
   records that are instrumental or lack `plainLyrics` are filtered out.
4. The list renders; clicking a result navigates to `/song/{id}/{slug}`.

### Data flow — song page

1. Server component fetches `GET https://lrclib.net/api/get/{id}` (slug ignored for lookup).
2. Word extraction runs server-side (see below).
3. Page renders: header (title, artist, album, word count), word tiles, highlighted lyrics.
4. If the URL's slug is not the canonical `slugify(artist)-slugify(title)`, respond with a
   permanent (308) redirect to the canonical URL. `/song/{id}` without a slug redirects the
   same way. (Permanent is safe: lrclib records are effectively immutable.)
5. `generateMetadata` emits per-song Open Graph/Twitter metadata:
   title `"{Track} — {Artist} | Lyrics2Wordle"`, description `"{N} Wordle words"`.

### Word list

- Static text file in the repo (`data/wordle-guesses.txt`), one word per line —
  the NYT allowed-guess list: cfreshman's `wordle-nyt-allowed-guesses` gist merged with the
  `wordle-nyt-answers` gist (guessable = allowed + answers), combined into one file at build
  time by us and committed — no runtime dependency on the gists.
- Loaded once per server instance into a `Set<string>` (module-level). Never shipped to the browser.

### Caching

- Lyrics-by-ID fetches: Next data cache, `revalidate: 30 days` (records are effectively immutable).
- Search fetches: `revalidate: 1 hour`.
- All lrclib requests send an identifying `User-Agent` (app name + repo URL), per lrclib's API guidelines.

## Word extraction (`lib/wordle.ts`, pure functions)

1. **Normalize:** lowercase; curly apostrophes (`’`) → straight; strip diacritics (`café` → `cafe`).
2. **Tokenize:** remove apostrophes inside words (`can't` → `cant`), then split on every
   remaining non-letter character — hyphens split words (`blue-eyed` → `blue` + `eyed`).
   Substrings never cross token boundaries.
3. **Match:**
   - A 5-letter token in the guess set is a **whole-word match**.
   - For tokens longer than 5 letters, every contiguous 5-letter window in the guess set
     is a **substring match** (`eclipse` → `eclip`, `clips`, `lipse` → CLIPS).
   - A token can yield multiple substring matches; all count.
4. **Aggregate:** deduplicate by word, ordered by first appearance. Each unique word carries
   `wholeCount` and `substringCount`. A word is displayed as a whole-word match if
   `wholeCount ≥ 1`, otherwise as a substring match. The `×N` badge shows the total.
5. **Annotate for highlighting:** per lyrics line, character spans of every match **in the
   original text** (indices mapped back through apostrophe-stripping/normalization).
   Overlapping spans within a token are merged for display; each match still counts.

## Components

- `SearchForm`, `SearchResults` (client) — with loading, empty ("no results — check spelling
  or drop the artist"), and error/retry states.
- `LyricsPanel` (server-rendered) — plain lyrics; whole-word matches fully highlighted,
  substring matches highlight only the matching letters (e**clips**e).
- `WordTiles` (client) — Wordle-style letter tiles: solid green for whole words, outlined
  for substring finds; `×N` badges; click copies the word with a small toast.
- `ShareButton` (client) — copies the canonical URL to the clipboard.
- Responsive: side-by-side on desktop; stacked on mobile with words above lyrics.
- Dark mode follows `prefers-color-scheme`.

## Error handling

| Condition | Behavior |
|---|---|
| lrclib 404 for the ID | `notFound()` → friendly "Song not found" page |
| Record has no lyrics / instrumental (via direct URL) | "This record has no lyrics" state |
| Lyrics contain zero valid words | Cheerful empty state: "No Wordle words in this one — try another song" |
| lrclib down / timeout | Search: inline error with retry. Song page: error boundary with retry button |

## Testing

- **Vitest** unit tests, densest on extraction: apostrophes (straight + curly), hyphens,
  diacritics, case, dedupe order, counts, whole-vs-substring classification, overlapping
  substrings, 4/6-letter rejection, non-list rejection, highlight span mapping.
- lrclib client: fixture-JSON tests for normalization and instrumental/lyric-less filtering.
- One integration-style test: render the song page with mocked lrclib fetch; assert words,
  classification, and highlights.
- UI polish verified manually.

## Out of scope for v1 (future ideas)

- OG images (tile art via `next/og`), recently-shared feed, highlighting which words are
  also possible Wordle *answers*, anything using synced lyrics.
