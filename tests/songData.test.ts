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
