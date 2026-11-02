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
  /**
   * Set on raw extraction spans: true when the match is a whole word (or the
   * stem of a simple inflection), false when it is hidden inside a longer
   * word. Dropped by filterAndMergeSpans.
   */
  whole?: boolean;
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
  /**
   * Deduped, ordered by first whole occurrence; words that never appear whole
   * are ordered by their first (substring) occurrence.
   */
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
      merged.push({ start: s.start, end: s.end, words: [...s.words] });
    }
  }
  return merged;
}

/**
 * The first lyric line containing `word` as a whole word — or, when it never
 * appears whole, the first line containing it at all — with one match of that
 * word uppercased in place: the line's first whole match, else its first
 * substring match (only the matched window, so a substring match inside a
 * longer word uppercases just those letters). Returns null when the word
 * matches no line. Expects raw extraction spans.
 */
export function lineWithWordUppercased(lines: AnnotatedLine[], word: string): string | null {
  const isMatch = (whole: boolean) => (s: Span) => s.words.includes(word) && (!whole || !!s.whole);
  const line =
    lines.find((l) => l.spans.some(isMatch(true))) ??
    lines.find((l) => l.spans.some(isMatch(false)));
  if (!line) return null;
  // Raw spans are sorted by start, so find() picks the earliest match.
  const span = (line.spans.find(isMatch(true)) ?? line.spans.find(isMatch(false)))!;
  const { text } = line;
  return (
    text.slice(0, span.start) + text.slice(span.start, span.end).toUpperCase() + text.slice(span.end)
  );
}

export function extractWordleWords(lyrics: string, wordSet: Set<string>): ExtractionResult {
  const entries = new Map<string, WordEntry>(); // insertion order = first appearance
  // Sort position of each word: its first whole occurrence once one is seen,
  // else its first occurrence. Matches are visited in reading order, so the
  // first assignment of each kind is the earliest.
  const order = new Map<string, { pos: number; whole: boolean }>();
  let offset = 0; // running position across lines, for a single sortable number
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
        const whole = tok.norm.length === 5 || (inflected && i === 0);
        if (whole) entry.wholeCount++;
        else entry.substringCount++;
        const start = tok.map[i];
        const prev = order.get(cand);
        if (!prev || (whole && !prev.whole)) order.set(cand, { pos: offset + start, whole });
        spans.push({ start, end: tok.map[i + 4] + 1, words: [cand], whole });
      }
    }
    offset += text.length + 1;
    return { text, spans };
  });
  const words = [...entries.values()].sort(
    (a, b) => order.get(a.word)!.pos - order.get(b.word)!.pos
  );
  return { words, lines };
}
