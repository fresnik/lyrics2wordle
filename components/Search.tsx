"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { canonicalSlug } from "@/lib/slug";
import type { SearchResult } from "@/lib/lrclib";

type Status = "idle" | "loading" | "done" | "error";

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Search() {
  const [track, setTrack] = useState("");
  const [artist, setArtist] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<SearchResult[]>([]);
  // Guards against overlapping searches: if a newer search starts before an
  // older one resolves, the older one's response (and any error) is ignored.
  const requestRef = useRef(0);

  async function doSearch() {
    if (!track.trim() || status === "loading") return;
    const myRequest = ++requestRef.current;
    setStatus("loading");
    try {
      const params = new URLSearchParams({ track: track.trim() });
      if (artist.trim()) params.set("artist", artist.trim());
      const res = await fetch(`/api/search?${params}`);
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
          required
          className={inputClass}
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artist (optional)"
          aria-label="Artist"
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
