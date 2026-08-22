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
      { start: 0, end: 5 },
      { start: 7, end: 12 },
    ]);
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
