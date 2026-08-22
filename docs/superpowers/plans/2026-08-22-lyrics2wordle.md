# Lyrics2Wordle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js app on Vercel where users search a song via lrclib.net, pick a result, and get a shareable page showing every valid Wordle word in the lyrics (whole words and substrings, visually distinguished).

**Architecture:** Server-rendered Next.js App Router. The song page `/song/[id]/[slug]` fetches lyrics from lrclib by ID server-side, extracts words server-side (word list never ships to the browser), and emits per-song Open Graph metadata. Search is a client page calling our `/api/search` proxy. No database; Next's fetch cache handles caching.

**Tech Stack:** Next.js (latest stable, App Router, TypeScript), Tailwind CSS, yarn, Vitest + Testing Library, deployed on Vercel.

**Spec:** `docs/superpowers/specs/2026-08-22-lyrics2wordle-design.md`

**Conventions for all tasks:**
- Work directly on `main` (fresh single-purpose repo).
- Run tests with `yarn vitest run <file>` (or `yarn test` for all).
- lrclib API base: `https://lrclib.net/api`. All requests send `User-Agent: Lyrics2Wordle/1.0 (https://github.com/freyr/lyrics-extractor)`.

---

### Task 1: Scaffold Next.js app + test tooling

**Files:**
- Create: entire Next.js scaffold (`app/`, `package.json`, `tsconfig.json`, `next.config.ts`, …)
- Create: `vitest.config.ts`, `tests/setup.ts`
- Modify: `.gitignore` (merge scaffold entries)

- [ ] **Step 1: Scaffold in a temp dir and copy in**

`create-next-app` refuses non-empty dirs, so scaffold elsewhere and copy (excluding its `.git` and `.gitignore`; ours exists):

```bash
cd "$(mktemp -d)"
npx create-next-app@latest l2w --ts --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-yarn --yes
rsync -a --exclude .git --exclude .gitignore --exclude node_modules l2w/ /Users/freyr/Code/freyr/lyrics-extractor/
cd /Users/freyr/Code/freyr/lyrics-extractor && yarn install
```

If `--yes` still prompts (CLI versions vary), accept defaults; Turbopack yes/no both fine.

- [ ] **Step 2: Merge scaffold .gitignore entries**

Overwrite `.gitignore` with:

```gitignore
# Brainstorming visual-companion sessions
.superpowers/

# Dependencies
node_modules/
.pnp
.pnp.*
.yarn/*

# Next.js build output
.next/
out/
build/

# Misc
.DS_Store
*.pem
npm-debug.log*
yarn-debug.log*
yarn-error.log*
coverage/

# Env files
.env*
!.env.example

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 3: Verify dev server starts**

Run: `yarn dev` (background), then `curl -s http://localhost:3000 | head -c 200`, then stop it.
Expected: HTML output containing `<!DOCTYPE html>`.

- [ ] **Step 4: Add Vitest + Testing Library**

```bash
yarn add -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
});
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 5: Verify vitest runs**

Run: `yarn test`
Expected: "No test files found" (exit code may be 1 — that's fine, nothing written yet). If vitest errors on config instead, fix before proceeding.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind and Vitest"
```

---

### Task 2: Word list data file + `getWordSet`

**Files:**
- Create: `data/wordle-words.txt`
- Create: `lib/wordle.ts`
- Test: `tests/wordlist.test.ts`

- [ ] **Step 1: Build the word list file**

CORRECTION (final review): use cfreshman's wordle-NYT gists (~14,855 merged),
not the classic 2021 lists — the classic lists contain slurs the NYT
removed. Discover current raw URLs via the GitHub gists API.

Merge cfreshman's Wordle allowed-guesses and answers gists (guessable = allowed + answers):

```bash
mkdir -p data
curl -sL "https://gist.githubusercontent.com/cfreshman/cdcdf777450c5b5301e439061d29694c/raw/wordle-allowed-guesses.txt" -o /tmp/allowed.txt
curl -sL "https://gist.githubusercontent.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b/raw/wordle-answers-alphabetical.txt" -o /tmp/answers.txt
cat /tmp/allowed.txt /tmp/answers.txt | tr "[:upper:]" "[:lower:]" | grep -E "^[a-z]{5}$" | sort -u > data/wordle-words.txt
wc -l data/wordle-words.txt
grep -cx "clips" data/wordle-words.txt
grep -cx "drums" data/wordle-words.txt
```

Expected: ≥ 12,000 lines (~12,972 for the classic lists; newer NYT mirrors are larger), and both greps print `1`. If a raw URL 404s (gist filenames occasionally change), open the gist page (`https://gist.github.com/cfreshman/<id>`) and download the file manually — do not substitute a different source without checking it's the Wordle guess list.

- [ ] **Step 2: Write the failing test**

Create `tests/wordlist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getWordSet } from "@/lib/wordle";

describe("getWordSet", () => {
  it("loads a large set of lowercase 5-letter words", () => {
    const s = getWordSet();
    expect(s.size).toBeGreaterThan(12000);
    expect(s.has("clips")).toBe(true);
    expect(s.has("drums")).toBe(true);
    expect(s.has("zzzzz")).toBe(false);
  });

  it("returns the same cached instance on repeat calls", () => {
    expect(getWordSet()).toBe(getWordSet());
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn vitest run tests/wordlist.test.ts`
Expected: FAIL — cannot resolve `@/lib/wordle`.

- [ ] **Step 4: Implement `lib/wordle.ts`**

```ts
import { readFileSync } from "node:fs";
import path from "node:path";

let cached: Set<string> | null = null;

/** Server-only: the Wordle allowed-guess set, loaded once per process. */
export function getWordSet(): Set<string> {
  if (!cached) {
    const file = path.join(process.cwd(), "data", "wordle-words.txt");
    cached = new Set(
      readFileSync(file, "utf8")
        .split("\n")
        .map((w) => w.trim())
        .filter(Boolean)
    );
  }
  return cached;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn vitest run tests/wordlist.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add data/wordle-words.txt lib/wordle.ts tests/wordlist.test.ts
git commit -m "feat: add Wordle guess list and server-side word set loader"
```

---

### Task 3: Slug helpers

**Files:**
- Create: `lib/slug.ts`
- Test: `tests/slug.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canonicalSlug, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and replaces non-alphanumerics with dashes", () => {
    expect(slugify("Hold the Line!")).toBe("hold-the-line");
  });

  it("strips diacritics", () => {
    expect(slugify("Beyoncé")).toBe("beyonce");
  });

  it("collapses runs and trims leading/trailing dashes", () => {
    expect(slugify("  Rock & Roll  ")).toBe("rock-roll");
  });

  it("falls back to 'song' for fully non-latin input", () => {
    expect(slugify("宇多田ヒカル")).toBe("song");
  });
});

describe("canonicalSlug", () => {
  it("joins artist and track", () => {
    expect(canonicalSlug("Toto", "Africa")).toBe("toto-africa");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run tests/slug.test.ts`
Expected: FAIL — cannot resolve `@/lib/slug`.

- [ ] **Step 3: Implement `lib/slug.ts`**

```ts
export function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "song"
  );
}

export function canonicalSlug(artist: string, track: string): string {
  return `${slugify(artist)}-${slugify(track)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run tests/slug.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/slug.ts tests/slug.test.ts
git commit -m "feat: add slug helpers for canonical song URLs"
```

---

### Task 4: Word extraction engine

The core of the app. Pure functions — the word set is a parameter, so tests use tiny custom sets.

**Files:**
- Create: `lib/extract.ts`
- Test: `tests/extract.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/extract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractWordleWords } from "@/lib/extract";

const set = (...words: string[]) => new Set(words);

describe("extractWordleWords", () => {
  it("finds whole 5-letter words, case-insensitively, and counts repeats", () => {
    const r = extractWordleWords("HELLO there\nhello again", set("hello"));
    expect(r.words).toEqual([{ word: "hello", wholeCount: 2, substringCount: 0 }]);
  });

  it("ignores words not in the set and tokens without 5-letter windows", () => {
    const r = extractWordleWords("cat cats hello", set("hello"));
    expect(r.words.map((w) => w.word)).toEqual(["hello"]);
  });

  it("finds 5-letter substrings inside longer words", () => {
    const r = extractWordleWords("total eclipse", set("clips"));
    expect(r.words).toEqual([{ word: "clips", wholeCount: 0, substringCount: 1 }]);
  });

  it("tracks whole and substring occurrences separately", () => {
    const r = extractWordleWords("clips eclipse", set("clips"));
    expect(r.words).toEqual([{ word: "clips", wholeCount: 1, substringCount: 1 }]);
  });

  it("orders deduped words by first appearance", () => {
    const r = extractWordleWords("world hello\nhello world", set("hello", "world"));
    expect(r.words.map((w) => w.word)).toEqual(["world", "hello"]);
  });

  it("strips straight and curly apostrophes inside words", () => {
    const r = extractWordleWords("can'ts don’ts", set("cants", "donts"));
    expect(r.words.map((w) => w.word)).toEqual(["cants", "donts"]);
  });

  it("splits on hyphens", () => {
    const r = extractWordleWords("harsh-lands", set("harsh", "lands"));
    expect(r.words.map((w) => w.word)).toEqual(["harsh", "lands"]);
    expect(r.words.every((w) => w.wholeCount === 1)).toBe(true);
  });

  it("strips diacritics", () => {
    const r = extractWordleWords("two cafés", set("cafes"));
    expect(r.words.map((w) => w.word)).toEqual(["cafes"]);
  });

  it("records highlight spans in original character positions", () => {
    // "go can'ts go": token "cants" spans original chars 3..8 (apostrophe included)
    const r = extractWordleWords("go can'ts go", set("cants"));
    expect(r.lines[0].spans).toEqual([{ start: 3, end: 9 }]);
  });

  it("merges overlapping spans for display but counts each match", () => {
    const r = extractWordleWords("stones", set("stone", "tones"));
    expect(r.words.map((w) => w.word)).toEqual(["stone", "tones"]);
    expect(r.lines[0].spans).toEqual([{ start: 0, end: 6 }]);
  });

  it("returns one annotated line per lyrics line, including empty ones", () => {
    const r = extractWordleWords("hello\n\nworld", set("hello"));
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0].spans).toEqual([{ start: 0, end: 5 }]);
    expect(r.lines[1]).toEqual({ text: "", spans: [] });
    expect(r.lines[2].spans).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run tests/extract.test.ts`
Expected: FAIL — cannot resolve `@/lib/extract`.

- [ ] **Step 3: Implement `lib/extract.ts`**

```ts
export interface WordEntry {
  word: string;
  /** Occurrences as a standalone 5-letter token. */
  wholeCount: number;
  /** Occurrences as a 5-letter window inside a longer token. */
  substringCount: number;
}

/** Character span in the ORIGINAL line text: [start, end). */
export interface Span {
  start: number;
  end: number;
}

export interface AnnotatedLine {
  text: string;
  spans: Span[];
}

export interface ExtractionResult {
  /** Deduped, ordered by first appearance. */
  words: WordEntry[];
  lines: AnnotatedLine[];
}

const APOSTROPHES = new Set(["'", "’", "ʼ"]);

interface Token {
  /** Normalized letters (lowercase ascii). */
  norm: string;
  /** map[i] = index in the original line of the char that produced norm[i]. */
  map: number[];
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let cur: Token | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (APOSTROPHES.has(ch)) continue; // joins a token, contributes no letter
    const base = ch.normalize("NFD")[0].toLowerCase();
    if (base >= "a" && base <= "z") {
      if (!cur) {
        cur = { norm: "", map: [] };
        tokens.push(cur);
      }
      cur.norm += base;
      cur.map.push(i);
    } else {
      cur = null; // any other char (hyphen, digit, space, …) ends the token
    }
  }
  return tokens;
}

function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

export function extractWordleWords(lyrics: string, wordSet: Set<string>): ExtractionResult {
  const entries = new Map<string, WordEntry>(); // insertion order = first appearance
  const lines: AnnotatedLine[] = lyrics.split(/\r?\n/).map((text) => {
    const spans: Span[] = [];
    for (const tok of tokenizeLine(text)) {
      if (tok.norm.length < 5) continue;
      for (let i = 0; i + 5 <= tok.norm.length; i++) {
        const cand = tok.norm.slice(i, i + 5);
        if (!wordSet.has(cand)) continue;
        let entry = entries.get(cand);
        if (!entry) {
          entry = { word: cand, wholeCount: 0, substringCount: 0 };
          entries.set(cand, entry);
        }
        if (tok.norm.length === 5) entry.wholeCount++;
        else entry.substringCount++;
        spans.push({ start: tok.map[i], end: tok.map[i + 4] + 1 });
      }
    }
    return { text, spans: mergeSpans(spans) };
  });
  return { words: [...entries.values()], lines };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run tests/extract.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/extract.ts tests/extract.test.ts
git commit -m "feat: add Wordle word extraction with substring matching and highlight spans"
```

---

### Task 5: lrclib API client

**Files:**
- Create: `lib/lrclib.ts`
- Create: `tests/helpers.ts` (shared fixtures — never put fixtures in a `.test.ts` file: importing one test file from another re-registers its tests)
- Test: `tests/lrclib.test.ts`

- [ ] **Step 1: Create shared test fixtures**

Create `tests/helpers.ts`:

```ts
import { vi } from "vitest";

export const record = {
  id: 1,
  trackName: "Africa",
  artistName: "Toto",
  albumName: "Toto IV",
  duration: 295,
  instrumental: false,
  plainLyrics: "I hear the drums",
  syncedLyrics: null,
};

export function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/lrclib.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSongById, searchSongs } from "@/lib/lrclib";
import { mockFetch, record } from "./helpers";

const instrumental = { ...record, id: 2, instrumental: true, plainLyrics: null };
const blankLyrics = { ...record, id: 3, plainLyrics: "  " };

afterEach(() => vi.unstubAllGlobals());

describe("searchSongs", () => {
  it("uses track_name/artist_name when artist is given", async () => {
    const fn = mockFetch(200, []);
    await searchSongs("africa", "toto");
    const url = new URL(fn.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api/search");
    expect(url.searchParams.get("track_name")).toBe("africa");
    expect(url.searchParams.get("artist_name")).toBe("toto");
  });

  it("uses q when no artist is given", async () => {
    const fn = mockFetch(200, []);
    await searchSongs("africa");
    const url = new URL(fn.mock.calls[0][0] as string);
    expect(url.searchParams.get("q")).toBe("africa");
  });

  it("filters instrumental and lyric-less records and normalizes fields", async () => {
    mockFetch(200, [record, instrumental, blankLyrics]);
    const results = await searchSongs("africa");
    expect(results).toEqual([
      { id: 1, trackName: "Africa", artistName: "Toto", albumName: "Toto IV", duration: 295 },
    ]);
  });

  it("sends an identifying User-Agent", async () => {
    const fn = mockFetch(200, []);
    await searchSongs("africa");
    const init = fn.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers["User-Agent"]).toContain("Lyrics2Wordle");
  });

  it("throws when lrclib errors", async () => {
    mockFetch(500, {});
    await expect(searchSongs("africa")).rejects.toThrow("lrclib search failed: 500");
  });
});

describe("getSongById", () => {
  it("returns the record", async () => {
    mockFetch(200, record);
    expect(await getSongById(1)).toEqual(record);
  });

  it("returns null on 404", async () => {
    mockFetch(404, {});
    expect(await getSongById(999)).toBeNull();
  });

  it("throws on other errors", async () => {
    mockFetch(503, {});
    await expect(getSongById(1)).rejects.toThrow("lrclib get failed: 503");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn vitest run tests/lrclib.test.ts`
Expected: FAIL — cannot resolve `@/lib/lrclib`.

- [ ] **Step 4: Implement `lib/lrclib.ts`**

```ts
const BASE = "https://lrclib.net/api";
const USER_AGENT = "Lyrics2Wordle/1.0 (https://github.com/freyr/lyrics-extractor)";

export interface LrclibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface SearchResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
}

export async function searchSongs(track: string, artist?: string): Promise<SearchResult[]> {
  const params = new URLSearchParams();
  if (artist) {
    params.set("track_name", track);
    params.set("artist_name", artist);
  } else {
    params.set("q", track);
  }
  const res = await fetch(`${BASE}/search?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 3600 }, // search results: cache 1 hour
  });
  if (!res.ok) throw new Error(`lrclib search failed: ${res.status}`);
  const records = (await res.json()) as LrclibRecord[];
  return records
    .filter((r) => !r.instrumental && r.plainLyrics && r.plainLyrics.trim().length > 0)
    .map(({ id, trackName, artistName, albumName, duration }) => ({
      id,
      trackName,
      artistName,
      albumName,
      duration,
    }));
}

export async function getSongById(id: number): Promise<LrclibRecord | null> {
  const res = await fetch(`${BASE}/get/${id}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 2592000 }, // lyrics records are effectively immutable: 30 days
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lrclib get failed: ${res.status}`);
  return (await res.json()) as LrclibRecord;
}
```

Note: the `next: { revalidate }` fetch option is Next.js-specific; the test's plain fetch mock ignores it, which is fine.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run tests/lrclib.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/lrclib.ts tests/helpers.ts tests/lrclib.test.ts
git commit -m "feat: add lrclib API client with filtering and caching"
```

---

### Task 6: `/api/search` route

**Files:**
- Create: `app/api/search/route.ts`
- Test: `tests/searchRoute.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/searchRoute.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/search/route";
import { mockFetch, record } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/search", () => {
  it("returns 400 when track is missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/search"));
    expect(res.status).toBe(400);
  });

  it("returns normalized results", async () => {
    mockFetch(200, [record]);
    const res = await GET(new NextRequest("http://localhost/api/search?track=africa&artist=toto"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: 1, trackName: "Africa", artistName: "Toto", albumName: "Toto IV", duration: 295 },
    ]);
  });

  it("returns 502 when lrclib fails", async () => {
    mockFetch(500, {});
    const res = await GET(new NextRequest("http://localhost/api/search?track=africa"));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run tests/searchRoute.test.ts`
Expected: FAIL — cannot resolve `@/app/api/search/route`.

- [ ] **Step 3: Implement `app/api/search/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { searchSongs } from "@/lib/lrclib";

export async function GET(req: NextRequest) {
  const track = req.nextUrl.searchParams.get("track")?.trim();
  const artist = req.nextUrl.searchParams.get("artist")?.trim() || undefined;
  if (!track) {
    return NextResponse.json({ error: "track is required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await searchSongs(track, artist));
  } catch {
    return NextResponse.json({ error: "Lyrics service unavailable" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run tests/searchRoute.test.ts`
Expected: PASS (3 tests). Also run `yarn vitest run tests/lrclib.test.ts` — still PASS (the route test imports helpers from it).

- [ ] **Step 5: Commit**

```bash
git add app/api/search/route.ts tests/searchRoute.test.ts
git commit -m "feat: add /api/search proxy route"
```

---

### Task 7: `getSongData` (song page data assembly)

**Files:**
- Create: `lib/songData.ts`
- Test: `tests/songData.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/songData.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSongData } from "@/lib/songData";
import { mockFetch, record } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("getSongData", () => {
  it("computes slug, hasLyrics and extraction (real word list)", async () => {
    mockFetch(200, { ...record, plainLyrics: "I hear the drums echoing tonight" });
    const data = await getSongData(1);
    expect(data?.slug).toBe("toto-africa");
    expect(data?.hasLyrics).toBe(true);
    expect(data?.extraction.words.map((w) => w.word)).toContain("drums");
  });

  it("returns null when the record does not exist", async () => {
    mockFetch(404, {});
    expect(await getSongData(999)).toBeNull();
  });

  it("treats instrumental records as having no lyrics", async () => {
    mockFetch(200, { ...record, instrumental: true, plainLyrics: null });
    const data = await getSongData(1);
    expect(data?.hasLyrics).toBe(false);
    expect(data?.extraction.words).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run tests/songData.test.ts`
Expected: FAIL — cannot resolve `@/lib/songData`.

- [ ] **Step 3: Implement `lib/songData.ts`**

```ts
import { extractWordleWords, type ExtractionResult } from "./extract";
import { getSongById } from "./lrclib";
import { canonicalSlug } from "./slug";
import { getWordSet } from "./wordle";

export interface SongPageData {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  slug: string;
  hasLyrics: boolean;
  extraction: ExtractionResult;
}

export async function getSongData(id: number): Promise<SongPageData | null> {
  const record = await getSongById(id);
  if (!record) return null;
  const lyrics = record.instrumental ? "" : (record.plainLyrics ?? "");
  return {
    id: record.id,
    trackName: record.trackName,
    artistName: record.artistName,
    albumName: record.albumName,
    slug: canonicalSlug(record.artistName, record.trackName),
    hasLyrics: lyrics.trim().length > 0,
    extraction: extractWordleWords(lyrics, getWordSet()),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run tests/songData.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/songData.ts tests/songData.test.ts
git commit -m "feat: assemble song page data from lrclib record and extraction"
```

---

### Task 8: Display components — WordTiles, LyricsPanel, ShareButton

**Files:**
- Create: `components/WordTiles.tsx`, `components/LyricsPanel.tsx`, `components/ShareButton.tsx`
- Test: `tests/components.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/components.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LyricsPanel from "@/components/LyricsPanel";
import WordTiles from "@/components/WordTiles";

const words = [
  { word: "drums", wholeCount: 2, substringCount: 1 },
  { word: "clips", wholeCount: 0, substringCount: 1 },
];

describe("WordTiles", () => {
  it("renders solid tiles for whole words and outlined for substring-only", () => {
    render(<WordTiles words={words} />);
    expect(screen.getByTitle("Appears as a word in the lyrics")).toBeInTheDocument();
    expect(screen.getByTitle("Found inside a longer word")).toBeInTheDocument();
  });

  it("shows a ×N badge only for repeated words", () => {
    render(<WordTiles words={words} />);
    expect(screen.getByText("×3")).toBeInTheDocument();
    expect(screen.queryByText("×1")).not.toBeInTheDocument();
  });

  it("copies a word on click and shows a toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<WordTiles words={words} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy drums" }));
    expect(writeText).toHaveBeenCalledWith("drums");
    expect(screen.getByRole("status")).toHaveTextContent("Copied DRUMS");
  });

  it("shows a cheerful empty state when there are no words", () => {
    render(<WordTiles words={[]} />);
    expect(screen.getByText(/No Wordle words in this one/)).toBeInTheDocument();
  });
});

describe("LyricsPanel", () => {
  it("highlights spans with <mark> and leaves the rest as plain text", () => {
    render(
      <LyricsPanel
        lines={[
          { text: "I hear the drums", spans: [{ start: 11, end: 16 }] },
          { text: "", spans: [] },
        ]}
      />
    );
    const mark = screen.getByText("drums");
    expect(mark.tagName).toBe("MARK");
    expect(screen.getByText(/I hear the/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run tests/components.test.tsx`
Expected: FAIL — cannot resolve the component modules.

- [ ] **Step 3: Implement `components/WordTiles.tsx`**

```tsx
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
```

- [ ] **Step 4: Implement `components/LyricsPanel.tsx`** (server component — no `"use client"`)

```tsx
import type { ReactNode } from "react";
import type { AnnotatedLine } from "@/lib/extract";

function renderLine(line: AnnotatedLine): ReactNode {
  if (line.spans.length === 0) return line.text || " ";
  const parts: ReactNode[] = [];
  let pos = 0;
  line.spans.forEach((span, i) => {
    if (span.start > pos) parts.push(line.text.slice(pos, span.start));
    parts.push(
      <mark
        key={i}
        className="rounded-xs bg-[#6aaa64]/25 px-0.5 font-semibold text-inherit dark:bg-[#538d4e]/40"
      >
        {line.text.slice(span.start, span.end)}
      </mark>
    );
    pos = span.end;
  });
  if (pos < line.text.length) parts.push(line.text.slice(pos));
  return parts;
}

export default function LyricsPanel({ lines }: { lines: AnnotatedLine[] }) {
  return (
    <div className="leading-7 text-gray-700 dark:text-gray-300">
      {lines.map((line, i) => (
        <p key={i}>{renderLine(line)}</p>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement `components/ShareButton.tsx`**

```tsx
"use client";

import { useState } from "react";

export default function ShareButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + path);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="cursor-pointer rounded-md bg-[#6aaa64] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#5c9a57] dark:bg-[#538d4e]"
    >
      {copied ? "Link copied!" : "Copy share link"}
    </button>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn vitest run tests/components.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add components/ tests/components.test.tsx
git commit -m "feat: add WordTiles, LyricsPanel and ShareButton components"
```

---

### Task 9: Song page routes, metadata, 404 and error states

**Files:**
- Create: `app/song/[id]/[slug]/page.tsx`, `app/song/[id]/[slug]/error.tsx`, `app/song/[id]/page.tsx`, `app/not-found.tsx`
- Test: `tests/songPage.test.tsx`

- [ ] **Step 1: Write the failing integration test**

Create `tests/songPage.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SongPage, { generateMetadata } from "@/app/song/[id]/[slug]/page";
import { mockFetch, record } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const params = Promise.resolve({ id: "1", slug: "toto-africa" });

describe("SongPage", () => {
  it("renders header, word tiles and highlighted lyrics", async () => {
    mockFetch(200, { ...record, plainLyrics: "I hear the drums echoing tonight" });
    render(await SongPage({ params }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Africa");
    expect(screen.getByRole("button", { name: "Copy drums" })).toBeInTheDocument();
    const mark = screen.getByText("drums", { selector: "mark" });
    expect(mark).toBeInTheDocument();
  });

  it("shows the no-lyrics state for instrumental records", async () => {
    mockFetch(200, { ...record, instrumental: true, plainLyrics: null });
    render(await SongPage({ params }));
    expect(screen.getByText("This record has no lyrics.")).toBeInTheDocument();
  });
});

describe("generateMetadata", () => {
  it("emits per-song title and word-count description", async () => {
    mockFetch(200, { ...record, plainLyrics: "I hear the drums echoing tonight" });
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe("Africa — Toto | Lyrics2Wordle");
    expect(meta.description).toMatch(/^\d+ Wordle words?/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run tests/songPage.test.tsx`
Expected: FAIL — cannot resolve the page module.

- [ ] **Step 3: Implement `app/song/[id]/[slug]/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import LyricsPanel from "@/components/LyricsPanel";
import ShareButton from "@/components/ShareButton";
import WordTiles from "@/components/WordTiles";
import { getSongData, type SongPageData } from "@/lib/songData";

interface Props {
  params: Promise<{ id: string; slug: string }>;
}

async function load(idParam: string): Promise<SongPageData> {
  if (!/^\d+$/.test(idParam)) notFound();
  const data = await getSongData(Number(idParam));
  if (!data) notFound();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  const title = `${data.trackName} — ${data.artistName} | Lyrics2Wordle`;
  const n = data.extraction.words.length;
  const description = `${n} Wordle ${n === 1 ? "word" : "words"} found in the lyrics`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function SongPage({ params }: Props) {
  const { id, slug } = await params;
  const data = await load(id);
  if (slug !== data.slug) permanentRedirect(`/song/${data.id}/${data.slug}`);

  const n = data.extraction.words.length;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <p className="text-sm">
          <Link href="/" className="font-semibold text-[#6aaa64] hover:underline">
            ← Lyrics2Wordle
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-extrabold">{data.trackName}</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {data.artistName}
          {data.albumName ? ` · ${data.albumName}` : ""} · {n} Wordle {n === 1 ? "word" : "words"}
        </p>
        <div className="mt-3">
          <ShareButton path={`/song/${data.id}/${data.slug}`} />
        </div>
      </header>

      {!data.hasLyrics ? (
        <p className="text-lg">This record has no lyrics.</p>
      ) : (
        <div className="grid gap-10 md:grid-cols-2">
          <section aria-label="Wordle words">
            <h2 className="mb-4 text-xs font-bold tracking-widest text-gray-500 uppercase">
              Wordle words
            </h2>
            <WordTiles words={data.extraction.words} />
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Solid tiles appear as words in the lyrics; outlined tiles are hidden inside longer
              words. Click a word to copy it.
            </p>
          </section>
          <section aria-label="Lyrics">
            <h2 className="mb-4 text-xs font-bold tracking-widest text-gray-500 uppercase">
              Lyrics
            </h2>
            <LyricsPanel lines={data.extraction.lines} />
          </section>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Implement the slug-less redirect `app/song/[id]/page.tsx`**

```tsx
import { notFound, permanentRedirect } from "next/navigation";
import { getSongData } from "@/lib/songData";

export default async function SongIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await getSongData(Number(id));
  if (!data) notFound();
  permanentRedirect(`/song/${data.id}/${data.slug}`);
}
```

- [ ] **Step 5: Implement `app/song/[id]/[slug]/error.tsx`**

```tsx
"use client";

export default function SongError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Couldn&apos;t load this song</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        The lyrics service may be temporarily unavailable.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 cursor-pointer rounded-md bg-[#6aaa64] px-4 py-2 font-semibold text-white dark:bg-[#538d4e]"
      >
        Try again
      </button>
    </main>
  );
}
```

- [ ] **Step 6: Implement `app/not-found.tsx`**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Song not found</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        That link doesn&apos;t match any song on lrclib.net.
      </p>
      <Link href="/" className="mt-6 inline-block font-semibold text-[#6aaa64] hover:underline">
        ← Search for a song
      </Link>
    </main>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `yarn vitest run tests/songPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 8: Manually verify the canonical redirect**

Run `yarn dev`, then:
- `curl -sI "http://localhost:3000/song/1/wrong-slug" | head -3` → expect `308` with `location: /song/1/toto-africa` (ID 1 on lrclib is a real record; if its artist/track differ, expect its actual canonical slug — the point is a 308 to the canonical URL).
- `curl -sI "http://localhost:3000/song/1" | head -3` → expect `308` to the same canonical URL.
- `curl -sI "http://localhost:3000/song/999999999" | head -3` → expect `404`.

Stop the dev server.

- [ ] **Step 9: Commit**

```bash
git add app/song app/not-found.tsx tests/songPage.test.tsx
git commit -m "feat: add song page with canonical redirects, metadata and error states"
```

---

### Task 10: Home page search UI

**Files:**
- Create: `components/Search.tsx`
- Modify: `app/page.tsx` (replace scaffold content entirely)
- Modify: `app/layout.tsx` (metadata only)
- Test: `tests/search.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/search.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Search from "@/components/Search";

afterEach(() => vi.unstubAllGlobals());

function mockSearchApi(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const results = [
  { id: 1, trackName: "Africa", artistName: "Toto", albumName: "Toto IV", duration: 295 },
];

describe("Search", () => {
  it("searches and renders result links with canonical hrefs and duration", async () => {
    const fn = mockSearchApi(200, results);
    render(<Search />);
    await userEvent.type(screen.getByLabelText("Song title"), "africa");
    await userEvent.type(screen.getByLabelText("Artist"), "toto");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    const link = await screen.findByRole("link");
    expect(link).toHaveAttribute("href", "/song/1/toto-africa");
    expect(link).toHaveTextContent("Africa");
    expect(link).toHaveTextContent("Toto IV");
    expect(link).toHaveTextContent("4:55");
    const calledUrl = fn.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/search?");
    expect(calledUrl).toContain("track=africa");
    expect(calledUrl).toContain("artist=toto");
  });

  it("shows an empty state when there are no results", async () => {
    mockSearchApi(200, []);
    render(<Search />);
    await userEvent.type(screen.getByLabelText("Song title"), "zzz");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText(/No results/)).toBeInTheDocument();
  });

  it("shows an error state with retry when the API fails", async () => {
    mockSearchApi(502, { error: "unavailable" });
    render(<Search />);
    await userEvent.type(screen.getByLabelText("Song title"), "africa");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Search failed/);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run tests/search.test.tsx`
Expected: FAIL — cannot resolve `@/components/Search`.

- [ ] **Step 3: Implement `components/Search.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { canonicalSlug } from "@/lib/slug";
import type { SearchResult } from "@/lib/lrclib";

type Status = "idle" | "loading" | "done" | "error";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Search() {
  const [track, setTrack] = useState("");
  const [artist, setArtist] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<SearchResult[]>([]);

  async function doSearch() {
    if (!track.trim()) return;
    setStatus("loading");
    try {
      const params = new URLSearchParams({ track: track.trim() });
      if (artist.trim()) params.set("artist", artist.trim());
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      setResults(await res.json());
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  const inputClass =
    "rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-[#6aaa64] focus:ring-2 focus:ring-[#6aaa64]/30 dark:border-gray-700 dark:bg-gray-950";

  return (
    <div className="mt-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          doSearch();
        }}
        className="flex flex-col gap-3"
      >
        <input
          value={track}
          onChange={(e) => setTrack(e.target.value)}
          placeholder="Song title"
          aria-label="Song title"
          required
          className={inputClass}
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artist (optional)"
          aria-label="Artist"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="cursor-pointer rounded-md bg-[#6aaa64] px-4 py-2 font-semibold text-white hover:bg-[#5c9a57] disabled:opacity-60 dark:bg-[#538d4e]"
        >
          {status === "loading" ? "Searching…" : "Search"}
        </button>
      </form>

      {status === "error" && (
        <p role="alert" className="mt-6 text-center text-red-600 dark:text-red-400">
          Search failed — the lyrics service may be down.{" "}
          <button type="button" onClick={doSearch} className="cursor-pointer underline">
            Retry
          </button>
        </p>
      )}

      {status === "done" && results.length === 0 && (
        <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
          No results — check the spelling, or try without the artist.
        </p>
      )}

      {status === "done" && results.length > 0 && (
        <ul className="mt-6 divide-y divide-gray-200 dark:divide-gray-800">
          {results.map((r) => (
            <li key={r.id}>
              <Link
                href={`/song/${r.id}/${canonicalSlug(r.artistName, r.trackName)}`}
                className="flex items-baseline justify-between gap-4 rounded-md px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <span>
                  <span className="font-semibold">{r.trackName}</span>{" "}
                  <span className="text-gray-600 dark:text-gray-400">— {r.artistName}</span>
                  {r.albumName && (
                    <span className="block text-sm text-gray-500">{r.albumName}</span>
                  )}
                </span>
                <span className="text-sm text-gray-500 tabular-nums">
                  {formatDuration(r.duration)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Replace `app/page.tsx`**

```tsx
import Search from "@/components/Search";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-center text-4xl font-extrabold tracking-tight">
        Lyrics<span className="text-[#6aaa64]">2</span>Wordle
      </h1>
      <p className="mt-2 text-center text-gray-600 dark:text-gray-400">
        Find every valid Wordle word hiding in a song&apos;s lyrics.
      </p>
      <Search />
    </main>
  );
}
```

- [ ] **Step 5: Update metadata in `app/layout.tsx`**

Replace only the exported `metadata` object (keep fonts/body from the scaffold):

```tsx
export const metadata: Metadata = {
  title: "Lyrics2Wordle",
  description: "Find every valid Wordle word hiding in a song's lyrics.",
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn vitest run tests/search.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add components/Search.tsx app/page.tsx app/layout.tsx tests/search.test.tsx
git commit -m "feat: add home page with song search"
```

---

### Task 11: Full verification, README, deploy

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run the full test suite**

Run: `yarn test`
Expected: all test files PASS.

- [ ] **Step 2: Lint and production build**

Run: `yarn lint && yarn build`
Expected: no lint errors; build succeeds. Fix anything that surfaces (unused imports, type errors) before proceeding.

- [ ] **Step 3: Manual end-to-end check**

Run `yarn dev` and in a browser:
1. Search "Africa" / artist "Toto" → results list appears with albums and durations.
2. Click a result → song page shows solid and outlined tiles, ×N badges, highlighted lyrics.
3. Click a tile → toast "Copied …", paste confirms the word.
4. Click "Copy share link" → paste URL in a new tab → same page loads directly.
5. Toggle OS dark mode → page follows.
6. Narrow the window → words stack above lyrics.

Stop the dev server. Fix anything broken before proceeding.

- [ ] **Step 4: Write `README.md`**

```markdown
# Lyrics2Wordle

Find every valid Wordle word hiding in a song's lyrics.

Search a song (title + optional artist), pick the right record, and get a
shareable page of all valid Wordle words in the lyrics — both whole words
(solid tiles) and words hidden inside longer words (outlined tiles), e.g.
CLIPS inside "eclipse".

Lyrics come from [lrclib.net](https://lrclib.net). The word list is Wordle's
allowed-guess list (~13k words), bundled server-side.

## Develop

    yarn install
    yarn dev        # http://localhost:3000
    yarn test       # Vitest
    yarn build      # production build

## Deploy

Deployed on Vercel; every push to `main` deploys. Song URLs are
`/song/{lrclib-id}/{artist-track-slug}` — the ID is authoritative, the slug
is cosmetic and redirects to canonical.

Design spec: `docs/superpowers/specs/2026-08-22-lyrics2wordle-design.md`.
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

- [ ] **Step 6: Deploy to Vercel (requires user login — pause here)**

This step needs the user's Vercel account. Ask the user to run interactively:

```bash
npx vercel login        # authenticate (user runs this: type `! npx vercel login` in the prompt)
npx vercel link         # link the directory to a new Vercel project named lyrics2wordle
npx vercel --prod       # production deploy
```

Alternatively: push the repo to GitHub (`gh repo create`) and import it in the Vercel dashboard for push-to-deploy. Either way, verify the production URL loads and a song page renders.

- [ ] **Step 7: Smoke-test production**

On the production URL: run the manual end-to-end check from Step 3 (search → select → tiles → share link). Confirm the shared URL works in a private browser window (no local state).
