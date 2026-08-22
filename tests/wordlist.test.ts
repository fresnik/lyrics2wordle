// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getWordSet } from "@/lib/wordle";

describe("getWordSet", () => {
  it("loads a large set of lowercase 5-letter words", () => {
    const s = getWordSet();
    expect(s.size).toBeGreaterThan(12000);
    expect(s.has("clips")).toBe(true);
    expect(s.has("drums")).toBe(true);
    expect(s.has("zzzzz")).toBe(false);
    expect([...s].every((w) => /^[a-z]{5}$/.test(w))).toBe(true);
  });

  it("returns the same cached instance on repeat calls", () => {
    expect(getWordSet()).toBe(getWordSet());
  });
});
