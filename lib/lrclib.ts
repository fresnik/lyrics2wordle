const BASE = "https://lrclib.net/api";
const USER_AGENT = "Lyrics2Wordle/1.0 (https://github.com/freyr/lyrics-extractor)";

export interface LrclibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface SearchResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
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
  const res = await fetch(`${BASE}/search?${params}`, {
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
  const res = await fetch(`${BASE}/get/${id}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 2592000 }, // lyrics records are effectively immutable: 30 days
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lrclib get failed: ${res.status}`);
  return (await res.json()) as LrclibRecord;
}
