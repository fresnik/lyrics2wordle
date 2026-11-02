import { afterEach, describe, expect, it, vi } from "vitest";
import { getSongById, searchSongs } from "@/lib/lrclib";
import { mockFetch, record } from "./helpers";

const instrumental = { ...record, id: 2, instrumental: true, plainLyrics: null };
const blankLyrics = { ...record, id: 3, plainLyrics: "  " };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  return { ok: status < 400, status, headers: new Headers(headers), json: async () => body };
}

// Resolves each queued response, or rejects with each queued error, in order.
// (Checked via "status" since jsdom's DOMException isn't an Error instance.)
function mockFetchSequence(...steps: Array<ReturnType<typeof response> | Error | DOMException>) {
  const fn = vi.fn();
  for (const step of steps) {
    if ("status" in step) fn.mockResolvedValueOnce(step);
    else fn.mockRejectedValueOnce(step);
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

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

  it("rejects when the response body isn't valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("bad json");
        },
      })
    );
    await expect(searchSongs("africa")).rejects.toThrow();
  });

  it("passes through a null albumName without filtering the record", async () => {
    const noAlbum = { ...record, id: 4, albumName: null };
    mockFetch(200, [noAlbum]);
    const results = await searchSongs("africa");
    expect(results).toEqual([
      { id: 4, trackName: "Africa", artistName: "Toto", albumName: null, duration: 295 },
    ]);
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
    mockFetch(500, {});
    await expect(getSongById(1)).rejects.toThrow("lrclib get failed: 500");
  });
});

describe("retries", () => {
  it("retries a 503 and returns the eventual success", async () => {
    vi.useFakeTimers();
    const fn = mockFetchSequence(response(503, {}), response(503, {}), response(200, record));
    const result = getSongById(1);
    await vi.runAllTimersAsync();
    expect(await result).toEqual(record);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up after two retries", async () => {
    vi.useFakeTimers();
    const fn = mockFetchSequence(response(503, {}), response(503, {}), response(503, {}));
    const result = expect(getSongById(1)).rejects.toThrow("lrclib get failed: 503");
    await vi.runAllTimersAsync();
    await result;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("waits for Retry-After on a 429", async () => {
    vi.useFakeTimers();
    const fn = mockFetchSequence(response(429, {}, { "retry-after": "2" }), response(200, []));
    const result = searchSongs("africa");
    await vi.advanceTimersByTimeAsync(1999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(await result).toEqual([]);
  });

  it("caps a long Retry-After", async () => {
    vi.useFakeTimers();
    const fn = mockFetchSequence(response(429, {}, { "retry-after": "60" }), response(200, []));
    const result = searchSongs("africa");
    await vi.advanceTimersByTimeAsync(3000);
    expect(fn).toHaveBeenCalledTimes(2);
    await result;
  });

  it("retries network errors", async () => {
    vi.useFakeTimers();
    const fn = mockFetchSequence(new TypeError("fetch failed"), response(200, record));
    const result = getSongById(1);
    await vi.runAllTimersAsync();
    expect(await result).toEqual(record);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry timeouts", async () => {
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const fn = mockFetchSequence(timeout);
    await expect(getSongById(1)).rejects.toBe(timeout);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it.each([404, 400, 500])("does not retry a %i", async (status) => {
    const fn = mockFetchSequence(response(status, {}));
    await getSongById(1).catch(() => {});
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
