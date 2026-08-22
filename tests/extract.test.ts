import { describe, expect, it } from "vitest";
import { extractWordleWords, filterAndMergeSpans } from "@/lib/extract";

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

  it("splits on straight and curly apostrophes so contractions match their stem", () => {
    const r = extractWordleWords("there's where’s", set("there", "wheres", "heres", "theres"));
    expect(r.words).toEqual([{ word: "there", wholeCount: 1, substringCount: 0 }]);
  });

  it("counts a 6-letter simple plural as a whole match on its 5-letter stem", () => {
    const r = extractWordleWords("green fields", set("field"));
    expect(r.words).toEqual([{ word: "field", wholeCount: 1, substringCount: 0 }]);
  });

  it("keeps non-plural 6-letter containers as substring matches", () => {
    const r = extractWordleWords("stoned", set("stone"));
    expect(r.words).toEqual([{ word: "stone", wholeCount: 0, substringCount: 1 }]);
  });

  it("only promotes the leading window of a plural, and only for 6-letter tokens", () => {
    // "beasts": "easts" starts at index 1, so it stays a substring even
    // though the token ends in s; "screams" is 7 letters, so "cream" does too.
    const r = extractWordleWords("beasts screams", set("easts", "cream"));
    expect(r.words).toEqual([
      { word: "easts", wholeCount: 0, substringCount: 1 },
      { word: "cream", wholeCount: 0, substringCount: 1 },
    ]);
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

  it("strips diacritics when input is already NFD-decomposed", () => {
    // "cafes" with the accent as a separate combining acute mark
    // (U+0301) after the "e", instead of the precomposed "e-acute".
    // Written with a literal \u escape so editors/tools cannot
    // silently re-normalize the source file back to composed form.
    const r = extractWordleWords("two cafe\u0301s", set("cafes"));
    expect(r.words.map((w) => w.word)).toEqual(["cafes"]);
  });

  it("keeps span indices correct across surrogate-pair characters like emoji", () => {
    const r = extractWordleWords("hello🎵world", set("hello", "world"));
    expect(r.words.map((w) => w.word)).toEqual(["hello", "world"]);
    expect(r.lines[0].spans).toEqual([
      { start: 0, end: 5, words: ["hello"] },
      { start: 7, end: 12, words: ["world"] },
    ]);
  });

  it("records highlight spans in original character positions", () => {
    // "go there's go": the stem "there" spans original chars 3..7,
    // excluding the apostrophe and trailing s.
    const r = extractWordleWords("go there's go", set("there"));
    expect(r.lines[0].spans).toEqual([{ start: 3, end: 8, words: ["there"] }]);
  });

  it("emits one raw span per match and counts each match", () => {
    const r = extractWordleWords("stones", set("stone", "tones"));
    expect(r.words).toEqual([
      { word: "stone", wholeCount: 1, substringCount: 0 }, // plural stem
      { word: "tones", wholeCount: 0, substringCount: 1 },
    ]);
    expect(r.lines[0].spans).toEqual([
      { start: 0, end: 5, words: ["stone"] },
      { start: 1, end: 6, words: ["tones"] },
    ]);
  });

  it("does not duplicate a word repeated in separate spans on one line", () => {
    const r = extractWordleWords("hello hello", set("hello"));
    expect(r.lines[0].spans).toEqual([
      { start: 0, end: 5, words: ["hello"] },
      { start: 6, end: 11, words: ["hello"] },
    ]);
  });

  it("returns one annotated line per lyrics line, including empty ones", () => {
    const r = extractWordleWords("hello\n\nworld", set("hello"));
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0].spans).toEqual([{ start: 0, end: 5, words: ["hello"] }]);
    expect(r.lines[1]).toEqual({ text: "", spans: [] });
    expect(r.lines[2].spans).toEqual([]);
  });
});

describe("filterAndMergeSpans", () => {
  const stones = extractWordleWords("stones", set("stone", "tones")).lines[0].spans;

  it("merges overlapping spans and combines their words", () => {
    expect(filterAndMergeSpans(stones, null)).toEqual([
      { start: 0, end: 6, words: ["stone", "tones"] },
    ]);
  });

  it("drops matches for hidden words before merging, shrinking the span", () => {
    expect(filterAndMergeSpans(stones, new Set(["stone"]))).toEqual([
      { start: 0, end: 5, words: ["stone"] },
    ]);
  });

  it("keeps separate spans separate", () => {
    const spans = [
      { start: 0, end: 5, words: ["hello"] },
      { start: 6, end: 11, words: ["hello"] },
    ];
    expect(filterAndMergeSpans(spans, null)).toEqual(spans);
  });

  it("does not mutate its input", () => {
    filterAndMergeSpans(stones, null);
    expect(stones).toEqual([
      { start: 0, end: 5, words: ["stone"] },
      { start: 1, end: 6, words: ["tones"] },
    ]);
  });
});
