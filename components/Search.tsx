"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { canonicalSlug } from "@/lib/slug";
import type { SearchResult } from "@/lib/lrclib";

type Status = "idle" | "loading" | "done" | "error";

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The query string shared by the page URL and the /api/search call.
function toQuery(track: string, artist: string): string {
  const params = new URLSearchParams({ track: track.trim() });
  if (artist.trim()) params.set("artist", artist.trim());
  return params.toString();
}

type Props = {
  // The query from the page URL, which is the source of truth for the search.
  initialTrack?: string;
  initialArtist?: string;
};

export default function Search({ initialTrack = "", initialArtist = "" }: Props) {
  const router = useRouter();
  const [track, setTrack] = useState(initialTrack);
  const [artist, setArtist] = useState(initialArtist);
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<SearchResult[]>([]);
  // Guards against overlapping searches: if a newer search starts before an
  // older one resolves, the older one's response (and any error) is ignored.
  const requestRef = useRef(0);
  // The query of the latest search, so the URL catching up with a submitted
  // search doesn't fire the same search twice.
  const lastQueryRef = useRef<string | null>(null);
  const urlQuery = initialTrack.trim() ? toQuery(initialTrack, initialArtist) : null;

  // When the URL changes from outside the form (back/forward), show its query.
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    setTrack(initialTrack);
    setArtist(initialArtist);
    if (urlQuery === null) {
      setStatus("idle");
      setResults([]);
    }
  }

  async function runSearch(query: string) {
    const myRequest = ++requestRef.current;
    lastQueryRef.current = query;
    setStatus("loading");
    try {
      const res = await fetch(`/api/search?${query}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (myRequest !== requestRef.current) return;
      setResults(data);
      setStatus("done");
    } catch {
      if (myRequest !== requestRef.current) return;
      setStatus("error");
    }
  }

  function doSearch() {
    if (!track.trim() || status === "loading") return;
    const query = toQuery(track, artist);
    runSearch(query);
    if (query !== urlQuery) router.push(`/?${query}`, { scroll: false });
  }

  // Search whatever the URL holds: on load, and on back/forward navigation.
  useEffect(() => {
    if (urlQuery === null) {
      // Drop any in-flight response for the query the user navigated away from.
      requestRef.current++;
      lastQueryRef.current = null;
      return;
    }
    if (urlQuery === lastQueryRef.current) return;
    runSearch(urlQuery);
  }, [urlQuery]);

  const inputClass =
    "rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-[#6aaa64] focus:ring-2 focus:ring-[#6aaa64]/30 dark:border-gray-700 dark:bg-gray-950";

  const announcement =
    status === "loading"
      ? "Searching…"
      : status === "done"
        ? results.length > 0
          ? `${results.length} results found`
          : "No results"
        : "";

  return (
    <div className="mt-8">
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          doSearch();
        }}
        className="flex flex-col gap-3"
      >
        <input
          value={track}
          onChange={(e) => setTrack(e.target.value)}
          placeholder="Song title"
          aria-label="Song title"
          autoComplete="off"
          required
          className={inputClass}
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artist (optional)"
          aria-label="Artist"
          autoComplete="off"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="cursor-pointer rounded-md bg-[#6aaa64] px-4 py-2 font-semibold text-white hover:bg-[#5c9a57] disabled:opacity-60 dark:bg-[#538d4e]"
        >
          {status === "loading" ? "Searching…" : "Search"}
        </button>
      </form>

      {status === "error" && (
        <p role="alert" className="mt-6 text-center text-red-600 dark:text-red-400">
          Search failed — the lyrics service may be down.{" "}
          <button type="button" onClick={doSearch} className="cursor-pointer underline">
            Retry
          </button>
        </p>
      )}

      {status === "done" && results.length === 0 && (
        <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
          No results — check the spelling, or try without the artist.
        </p>
      )}

      {status === "done" && results.length > 0 && (
        <ul className="mt-6 divide-y divide-gray-200 dark:divide-gray-800">
          {results.map((r) => (
            <li key={r.id}>
              <Link
                href={`/song/${r.id}/${canonicalSlug(r.artistName, r.trackName)}`}
                className="flex items-baseline justify-between gap-4 rounded-md px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <span>
                  <span className="font-semibold">{r.trackName}</span>{" "}
                  <span className="text-gray-600 dark:text-gray-400">— {r.artistName}</span>
                  {r.albumName && (
                    <span className="block text-sm text-gray-500">{r.albumName}</span>
                  )}
                </span>
                <span className="text-sm text-gray-500 tabular-nums">
                  {formatDuration(r.duration)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
