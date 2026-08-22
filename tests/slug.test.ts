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

  it("falls back to 'song' for empty input", () => {
    expect(slugify("")).toBe("song");
  });

  it("produces a URL-safe slug from punctuation-heavy input", () => {
    expect(slugify("AC/DC 50%?")).toBe("ac-dc-50");
  });

  it("caps the slug at 80 chars and trims a trailing dash left by truncation", () => {
    // 79 'a's + a space + 120 'b's: after transform the dash lands exactly
    // at the 80-char cut point, so truncation must re-trim it.
    const input = "a".repeat(79) + " " + "b".repeat(120);
    const result = slugify(input);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.endsWith("-")).toBe(false);
  });
});

describe("canonicalSlug", () => {
  it("joins artist and track", () => {
    expect(canonicalSlug("Toto", "Africa")).toBe("toto-africa");
  });

  it("caps the combined output at 80 chars with no trailing dash", () => {
    const artist = "a".repeat(100);
    const track = "b".repeat(100);
    const result = canonicalSlug(artist, track);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.endsWith("-")).toBe(false);
  });
});
