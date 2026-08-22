import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import LyricsPanel from "@/components/LyricsPanel";
import ShareButton from "@/components/ShareButton";
import WordTiles from "@/components/WordTiles";
import { getSongData, type SongPageData } from "@/lib/songData";

interface Props {
  params: Promise<{ id: string; slug: string }>;
}

// Dedupes metadata+render calls per request: generateMetadata and the page
// component both call load(), so this ensures getSongData runs once.
const getSong = cache(getSongData);

async function load(idParam: string): Promise<SongPageData> {
  if (!/^\d+$/.test(idParam)) notFound();
  const data = await getSong(Number(idParam));
  if (!data) notFound();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  const title = `${data.trackName} — ${data.artistName} | Lyrics2Wordle`;
  const n = data.extraction.words.length;
  const description = `${n} Wordle ${n === 1 ? "word" : "words"} found in the lyrics`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function SongPage({ params }: Props) {
  const { id, slug } = await params;
  const data = await load(id);
  if (slug !== data.slug) permanentRedirect(`/song/${data.id}/${data.slug}`);

  const n = data.extraction.words.length;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <p className="text-sm">
          <Link href="/" className="font-semibold text-[#6aaa64] hover:underline">
            ← Lyrics2Wordle
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-extrabold">{data.trackName}</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {data.artistName}
          {data.albumName ? ` · ${data.albumName}` : ""} · {n} Wordle {n === 1 ? "word" : "words"}
        </p>
        <div className="mt-3">
          <ShareButton path={`/song/${data.id}/${data.slug}`} />
        </div>
      </header>

      {!data.hasLyrics ? (
        <p className="text-lg">This record has no lyrics.</p>
      ) : (
        <div className="grid gap-10 md:grid-cols-2">
          <section aria-label="Wordle words">
            <h2 className="mb-4 text-xs font-bold tracking-widest text-gray-500 uppercase">
              Wordle words
            </h2>
            <WordTiles words={data.extraction.words} />
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Solid tiles appear as words in the lyrics; outlined tiles are hidden inside longer
              words. Click a word to copy it.
            </p>
          </section>
          <section aria-label="Lyrics">
            <h2 className="mb-4 text-xs font-bold tracking-widest text-gray-500 uppercase">
              Lyrics
            </h2>
            <LyricsPanel lines={data.extraction.lines} />
          </section>
        </div>
      )}
    </main>
  );
}
