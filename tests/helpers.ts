import { vi } from "vitest";

export const record = {
  id: 1,
  trackName: "Africa",
  artistName: "Toto",
  albumName: "Toto IV",
  duration: 295,
  instrumental: false,
  plainLyrics: "I hear the drums",
  syncedLyrics: null,
};

export function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
