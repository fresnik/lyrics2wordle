import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SongPage, { generateMetadata } from "@/app/song/[id]/[slug]/page";
import { mockFetch, record } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const params = Promise.resolve({ id: "1", slug: "toto-africa" });

describe("SongPage", () => {
  it("renders header, word tiles and highlighted lyrics", async () => {
    mockFetch(200, { ...record, plainLyrics: "I hear the drums echoing tonight" });
    render(await SongPage({ params }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Africa");
    expect(screen.getByRole("button", { name: "Copy drums" })).toBeInTheDocument();
    const mark = screen.getByText("drums", { selector: "mark" });
    expect(mark).toBeInTheDocument();
  });

  it("shows the no-lyrics state for instrumental records", async () => {
    mockFetch(200, { ...record, instrumental: true, plainLyrics: null });
    render(await SongPage({ params }));
    expect(screen.getByText("This record has no lyrics.")).toBeInTheDocument();
  });
});

describe("generateMetadata", () => {
  it("emits per-song title and word-count description", async () => {
    mockFetch(200, { ...record, plainLyrics: "I hear the drums echoing tonight" });
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe("Africa — Toto | Lyrics2Wordle");
    expect(meta.description).toMatch(/^\d+ Wordle words?/);
  });
});
