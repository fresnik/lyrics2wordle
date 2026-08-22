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
