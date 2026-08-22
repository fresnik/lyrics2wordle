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
  /** Distinct words whose matches this span covers, in first-appearance order. Never empty. */
  words: string[];
}

export interface AnnotatedLine {
  text: string;
  /**
   * One span per match, sorted by start, within [0, text.length], each
   * carrying a non-empty `words`. Spans may overlap — run them through
   * filterAndMergeSpans before display (LyricsPanel expects merged spans).
   */
  spans: Span[];
}

export interface ExtractionResult {
  /** Deduped, ordered by first appearance. */
  words: WordEntry[];
  lines: AnnotatedLine[];
}

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
    // Combining marks (e.g. an already-decomposed "é" as e + U+0301) join a
    // token without contributing a letter or breaking it.
    if (/\p{M}/u.test(ch)) continue;
    const base = ch.normalize("NFD")[0].toLowerCase();
    // Apostrophes split tokens ("there's" → "there" + "s"), as does any
    // other non-letter. Non-decomposable letters (ø, ß, æ, …) don't reduce
    // to a-z and are intentionally treated as separators — an accepted
    // limitation.
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

/**
 * Prepares raw match spans for display: drops matches for words not in
 * `visible` (pass null to keep all), then merges overlapping spans into
 * sorted, non-overlapping ones. The result satisfies LyricsPanel's contract.
 */
export function filterAndMergeSpans(spans: Span[], visible: Set<string> | null): Span[] {
  const kept = visible ? spans.filter((s) => s.words.some((w) => visible.has(w))) : spans;
  const sorted = [...kept].sort((a, b) => a.start - b.start);
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

export function extractWordleWords(lyrics: string, wordSet: Set<string>): ExtractionResult {
  const entries = new Map<string, WordEntry>(); // insertion order = first appearance
  const lines: AnnotatedLine[] = lyrics.split(/\r?\n/).map((text) => {
    const spans: Span[] = [];
    for (const tok of tokenizeLine(text)) {
      if (tok.norm.length < 5) continue;
      // A simple plural ("fields") or past tense ("climbed") counts its
      // stem as a whole word, not a substring.
      const inflected =
        (tok.norm.length === 6 && tok.norm[5] === "s") ||
        (tok.norm.length === 7 && tok.norm.endsWith("ed"));
      for (let i = 0; i + 5 <= tok.norm.length; i++) {
        const cand = tok.norm.slice(i, i + 5);
        if (!wordSet.has(cand)) continue;
        let entry = entries.get(cand);
        if (!entry) {
          entry = { word: cand, wholeCount: 0, substringCount: 0 };
          entries.set(cand, entry);
        }
        if (tok.norm.length === 5 || (inflected && i === 0)) entry.wholeCount++;
        else entry.substringCount++;
        spans.push({ start: tok.map[i], end: tok.map[i + 4] + 1, words: [cand] });
      }
    }
    return { text, spans };
  });
  return { words: [...entries.values()], lines };
}
