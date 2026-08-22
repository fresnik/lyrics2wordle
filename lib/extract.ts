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
  /** Sorted, non-overlapping, and within [0, text.length] — consumers (e.g. LyricsPanel) rely on this invariant. */
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
    // Apostrophes and combining marks (e.g. an already-decomposed "é" as
    // e + U+0301) join a token without contributing a letter or breaking it.
    if (APOSTROPHES.has(ch) || /\p{M}/u.test(ch)) continue;
    const base = ch.normalize("NFD")[0].toLowerCase();
    // Non-decomposable letters (ø, ß, æ, …) don't reduce to a-z and are
    // intentionally treated as separators — an accepted limitation.
    if (base.length === 1 && base >= "a" && base <= "z") {
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

/** Merges overlapping or adjacent spans for display; each source match is still counted separately. */
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
