import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SongPage, { generateMetadata } from "@/app/song/[id]/[slug]/page";
import { canonicalSlug } from "@/lib/slug";
import { mockFetch, record } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const slug = canonicalSlug(record.artistName, record.trackName);
const params = Promise.resolve({ id: "1", slug });

describe("SongPage", () => {
  it("renders header, word tiles and highlighted lyrics", async () => {
    mockFetch(200, { ...record, plainLyrics: "I hear the drums echoing tonight" });
    render(await SongPage({ params }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Africa");
    expect(screen.getByRole("button", { name: "Copy drums" })).toBeInTheDocument();
    const mark = screen.getByText("drums", { selector: "mark" });
    expect(mark).toBeInTheDocument();
  });

  it("subtitles with the whole-word count plus a total including substring words", async () => {
    mockFetch(200, { ...record, plainLyrics: "I hear the drums echoing tonight" });
    render(await SongPage({ params }));
    expect(
      screen.getByText(/\d+ Wordle words? \(\d+ including words inside longer words\)/)
    ).toBeInTheDocument();
  });

  it("omits the substring total when every word appears whole in the lyrics", async () => {
    mockFetch(200, { ...record, plainLyrics: "I hear the drums" });
    render(await SongPage({ params }));
    expect(screen.getByText(/1 Wordle word$/)).toBeInTheDocument();
    expect(screen.queryByText(/including words inside longer words/)).not.toBeInTheDocument();
  });

  it("shows the no-lyrics state for instrumental records", async () => {
    mockFetch(200, { ...record, instrumental: true, plainLyrics: null });
    render(await SongPage({ params }));
    expect(screen.getByText("This record has no lyrics.")).toBeInTheDocument();
  });

  it("redirects to the canonical slug when the URL slug doesn't match", async () => {
    mockFetch(200, record);
    await expect(
      SongPage({ params: Promise.resolve({ id: "1", slug: "wrong" }) })
    ).rejects.toThrow();
  });

  it("404s on a non-numeric id", async () => {
    mockFetch(200, record); // stubbed defensively; the regex guard rejects before any fetch
    await expect(
      SongPage({ params: Promise.resolve({ id: "abc", slug: "whatever" }) })
    ).rejects.toThrow();
  });

  it("404s when lrclib has no record for the id", async () => {
    mockFetch(404, {});
    await expect(
      SongPage({ params: Promise.resolve({ id: "999999999", slug: "whatever" }) })
    ).rejects.toThrow();
  });
});

describe("generateMetadata", () => {
  it("emits per-song title and word-count description", async () => {
    mockFetch(200, { ...record, plainLyrics: "I hear the drums echoing tonight" });
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe("Africa — Toto | Lyrics2Wordle");
    expect(meta.description).toMatch(/^\d+ Wordle words?/);
  });

  it("emits no-lyrics copy for instrumental records", async () => {
    mockFetch(200, { ...record, instrumental: true, plainLyrics: null });
    const meta = await generateMetadata({ params });
    expect(meta.description).toBe("No lyrics on record");
  });
});
