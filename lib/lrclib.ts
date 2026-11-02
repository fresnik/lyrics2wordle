import "server-only";

const BASE = "https://lrclib.net/api";
const USER_AGENT = "Lyrics2Wordle/1.0 (https://github.com/fresnik/lyrics2wordle)";

// lrclib intermittently answers 503 "ServerOverloaded" and rate-limits bursts
// with 429 + Retry-After: 1. Both usually clear within seconds, so a short,
// capped retry turns most of them into a slower response instead of an error.
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const RETRY_DELAYS_MS = [500, 1500]; // one entry per retry
const MAX_RETRY_AFTER_MS = 3000;

function retryDelay(res: Response | null, attempt: number): number {
  const retryAfter = Number(res?.headers?.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS);
  }
  const base = RETRY_DELAYS_MS[attempt];
  return base / 2 + Math.random() * base; // jitter so concurrent callers don't retry in lockstep
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const canRetry = attempt < RETRY_DELAYS_MS.length;
    let res: Response | null = null;
    try {
      // Fail fast well under Vercel's function limit. Timeouts aren't retried,
      // so the worst case stays one 8s timeout plus the short retry delays.
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    } catch (err) {
      // fetch rejects with a TypeError on network failures (DNS, reset, ...).
      if (!canRetry || !(err instanceof TypeError)) throw err;
    }
    if (res && (!canRetry || !RETRY_STATUSES.has(res.status))) return res;
    await new Promise((resolve) => setTimeout(resolve, retryDelay(res, attempt)));
  }
}

export interface LrclibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string | null;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface SearchResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string | null;
  duration: number;
}

export async function searchSongs(track: string, artist?: string): Promise<SearchResult[]> {
  const params = new URLSearchParams();
  if (artist) {
    params.set("track_name", track);
    params.set("artist_name", artist);
  } else {
    params.set("q", track);
  }
  const res = await fetchWithRetry(`${BASE}/search?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 3600 }, // search results: cache 1 hour
  });
  if (!res.ok) throw new Error(`lrclib search failed: ${res.status}`);
  const records = (await res.json()) as LrclibRecord[];
  return records
    .filter((r) => !r.instrumental && r.plainLyrics && r.plainLyrics.trim().length > 0)
    .map(({ id, trackName, artistName, albumName, duration }) => ({
      id,
      trackName,
      artistName,
      albumName,
      duration,
    }));
}

export async function getSongById(id: number): Promise<LrclibRecord | null> {
  const res = await fetchWithRetry(`${BASE}/get/${id}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 2592000 }, // lyrics records are effectively immutable: 30 days
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lrclib get failed: ${res.status}`);
  return (await res.json()) as LrclibRecord;
}
