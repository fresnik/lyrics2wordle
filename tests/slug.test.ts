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
