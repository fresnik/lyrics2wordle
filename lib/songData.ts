import "server-only";
import { extractWordleWords, type ExtractionResult } from "./extract";
import { getSongById } from "./lrclib";
import { canonicalSlug } from "./slug";
import { getWordSet } from "./wordle";

export interface SongPageData {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string | null;
  slug: string;
  hasLyrics: boolean;
  extraction: ExtractionResult;
}

export async function getSongData(id: number): Promise<SongPageData | null> {
  const record = await getSongById(id);
  if (!record) return null;
  const lyrics = record.instrumental ? "" : (record.plainLyrics ?? "");
  return {
    id: record.id,
    trackName: record.trackName,
    artistName: record.artistName,
    albumName: record.albumName,
    slug: canonicalSlug(record.artistName, record.trackName),
    hasLyrics: lyrics.trim().length > 0,
    extraction: extractWordleWords(lyrics, getWordSet()),
  };
}
