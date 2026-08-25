import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Footer from "@/components/Footer";
import LyricsPanel from "@/components/LyricsPanel";
import ShareButton from "@/components/ShareButton";
import SongContent from "@/components/SongContent";
import WordTiles from "@/components/WordTiles";

const words = [
  { word: "drums", wholeCount: 2, substringCount: 1 },
  { word: "clips", wholeCount: 0, substringCount: 1 },
];

describe("WordTiles", () => {
  it("renders solid tiles for whole words and outlined for substring-only", () => {
    render(<WordTiles words={words} />);
    expect(screen.getByTitle("Appears as a word in the lyrics")).toBeInTheDocument();
    expect(screen.getByTitle("Found inside a longer word")).toBeInTheDocument();
  });

  it("shows a ×N badge on every word so the columns line up, including ×1", () => {
    render(<WordTiles words={words} />);
    expect(screen.getByText("×3")).toBeInTheDocument();
    expect(screen.getByText("×1")).toBeInTheDocument();
  });

  it("copies a word on click and shows a toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<WordTiles words={words} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy drums" }));
    expect(writeText).toHaveBeenCalledWith("DRUMS");
    expect(screen.getByRole("status")).toHaveTextContent("Copied DRUMS");
  });

  it("shows a cheerful empty state when there are no words", () => {
    render(<WordTiles words={[]} />);
    expect(screen.getByText(/No Wordle words in this one/)).toBeInTheDocument();
  });

  it("announces substring-only tiles distinctly for accessibility", () => {
    render(<WordTiles words={words} />);
    expect(
      screen.getByRole("button", { name: "Copy clips (found inside a longer word)" })
    ).toBeInTheDocument();
  });
});

describe("LyricsPanel", () => {
  it("highlights spans with <mark> and leaves the rest as plain text", () => {
    render(
      <LyricsPanel
        lines={[
          { text: "I hear the drums", spans: [{ start: 11, end: 16, words: ["drums"] }] },
          { text: "", spans: [] },
        ]}
      />
    );
    const mark = screen.getByText("drums");
    expect(mark.tagName).toBe("MARK");
    expect(screen.getByText(/I hear the/)).toBeInTheDocument();
  });

  it("renders multiple marks in a single line", () => {
    render(
      <LyricsPanel
        lines={[
          {
            text: "hello world hello",
            spans: [
              { start: 0, end: 5, words: ["hello"] },
              { start: 12, end: 17, words: ["hello"] },
            ],
          },
        ]}
      />
    );
    const marks = screen.getAllByText("hello");
    expect(marks).toHaveLength(2);
    marks.forEach((m) => expect(m.tagName).toBe("MARK"));
  });
});

// "stones" containing whole-stem "stone" and substring-only "tones",
// with the raw (unmerged) spans extractWordleWords now produces.
const stonesExtraction = {
  words: [
    { word: "stone", wholeCount: 1, substringCount: 0 },
    { word: "tones", wholeCount: 0, substringCount: 1 },
  ],
  lines: [
    {
      text: "stones",
      spans: [
        { start: 0, end: 5, words: ["stone"] },
        { start: 1, end: 6, words: ["tones"] },
      ],
    },
  ],
};
const stoneName = "Copy stone";
const tonesName = "Copy tones (found inside a longer word)";

describe("SongContent hover highlighting", () => {
  it("hovering a tile highlights the lyric marks containing that word", async () => {
    render(<SongContent songId={1} extraction={stonesExtraction} />);
    const mark = screen.getByText("stones");
    expect(mark).not.toHaveAttribute("data-highlighted");
    await userEvent.hover(screen.getByRole("button", { name: stoneName }));
    expect(mark).toHaveAttribute("data-highlighted");
    await userEvent.unhover(screen.getByRole("button", { name: stoneName }));
    expect(mark).not.toHaveAttribute("data-highlighted");
  });

  it("hovering a merged lyric mark highlights all involved tiles", async () => {
    render(<SongContent songId={1} extraction={stonesExtraction} />);
    await userEvent.hover(screen.getByText("stones"));
    expect(screen.getByRole("button", { name: stoneName })).toHaveAttribute("data-highlighted");
    expect(screen.getByRole("button", { name: tonesName })).toHaveAttribute("data-highlighted");
    await userEvent.unhover(screen.getByText("stones"));
    expect(screen.getByRole("button", { name: stoneName })).not.toHaveAttribute(
      "data-highlighted"
    );
  });

  it("focusing a tile also highlights the lyric marks (keyboard)", async () => {
    render(<SongContent songId={1} extraction={stonesExtraction} />);
    await userEvent.tab(); // substring toggle
    await userEvent.tab(); // first tile button receives focus
    expect(screen.getByText("stones")).toHaveAttribute("data-highlighted");
  });
});

describe("SongContent substring toggle", () => {
  const toggleName = "Include words hidden inside longer words";

  beforeEach(() => {
    localStorage.clear();
  });

  it("includes substring-only words by default", () => {
    render(<SongContent songId={1} extraction={stonesExtraction} />);
    expect(screen.getByRole("checkbox", { name: toggleName })).toBeChecked();
    expect(screen.getByRole("button", { name: tonesName })).toBeInTheDocument();
    expect(screen.getByText("stones")).toBeInTheDocument();
  });

  it("unchecking hides substring-only tiles and shrinks lyric marks", async () => {
    render(<SongContent songId={1} extraction={stonesExtraction} />);
    await userEvent.click(screen.getByRole("checkbox", { name: toggleName }));
    expect(screen.queryByRole("button", { name: tonesName })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: stoneName })).toBeInTheDocument();
    // the merged "stones" mark shrinks to just the visible match "stone"
    expect(screen.queryByText("stones")).not.toBeInTheDocument();
    expect(screen.getByText("stone").tagName).toBe("MARK");
  });

  it("persists the choice to localStorage and restores it on mount", async () => {
    render(<SongContent songId={1} extraction={stonesExtraction} />);
    await userEvent.click(screen.getByRole("checkbox", { name: toggleName }));
    expect(localStorage.getItem("lyrics2wordle:include-substring-words")).toBe("false");
    cleanup();

    render(<SongContent songId={1} extraction={stonesExtraction} />);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: toggleName })).not.toBeChecked()
    );
    expect(screen.queryByRole("button", { name: tonesName })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: toggleName }));
    expect(localStorage.getItem("lyrics2wordle:include-substring-words")).toBe("true");
    expect(screen.getByRole("button", { name: tonesName })).toBeInTheDocument();
  });

  it("omits the toggle when every word appears whole", () => {
    render(
      <SongContent
        songId={1}
        extraction={{
          words: [{ word: "hello", wholeCount: 1, substringCount: 0 }],
          lines: [{ text: "hello", spans: [{ start: 0, end: 5, words: ["hello"] }] }],
        }}
      />
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

describe("SongContent finished words", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clicking a tile copies the word and marks it as used", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SongContent songId={1} extraction={stonesExtraction} />);
    await userEvent.click(screen.getByRole("button", { name: stoneName }));
    expect(writeText).toHaveBeenCalledWith("STONE");
    expect(screen.getByRole("status")).toHaveTextContent("Copied STONE — marked as used");
    expect(screen.getByRole("button", { name: "Unmark stone" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("lyrics2wordle:finished:1")!)).toEqual(["stone"]);
  });

  it("clicking a used tile unmarks it without copying again", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SongContent songId={1} extraction={stonesExtraction} />);
    await userEvent.click(screen.getByRole("button", { name: stoneName }));
    await userEvent.click(screen.getByRole("button", { name: "Unmark stone" }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: stoneName })).toBeInTheDocument();
    expect(localStorage.getItem("lyrics2wordle:finished:1")).toBeNull();
  });

  it("restores used words on mount, scoped to the song", async () => {
    localStorage.setItem("lyrics2wordle:finished:1", JSON.stringify(["stone"]));
    render(<SongContent songId={1} extraction={stonesExtraction} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Unmark stone" })).toBeInTheDocument()
    );
    cleanup();

    // the same word is untouched in a different song
    render(<SongContent songId={2} extraction={stonesExtraction} />);
    expect(screen.getByRole("button", { name: stoneName })).toBeInTheDocument();
  });

  it("marks all visible words as used and resets them", async () => {
    render(<SongContent songId={1} extraction={stonesExtraction} />);
    await userEvent.click(screen.getByRole("button", { name: "mark all used" }));
    expect(screen.getByRole("button", { name: "Unmark stone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unmark tones" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(screen.getByRole("button", { name: stoneName })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: tonesName })).toBeInTheDocument();
    expect(localStorage.getItem("lyrics2wordle:finished:1")).toBeNull();
  });
});

describe("ShareButton", () => {
  it("renders the idle label", () => {
    render(<ShareButton path="/song/1/toto-africa" />);
    expect(screen.getByRole("button", { name: "Copy share link" })).toBeInTheDocument();
  });

  it("copies the full URL and shows the copied label", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ShareButton path="/song/1/toto-africa" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy share link" }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/song/1/toto-africa`);
    expect(screen.getByRole("button", { name: "Link copied!" })).toBeInTheDocument();
  });

  it("shows an error label when the clipboard write fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ShareButton path="/song/1/toto-africa" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy share link" }));
    expect(screen.getByRole("button", { name: "Couldn't copy" })).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});

describe("Footer", () => {
  it("links to the Ko-fi page when NEXT_PUBLIC_KOFI_URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_KOFI_URL", "https://ko-fi.com/example");
    render(<Footer />);
    const link = screen.getByRole("link", { name: /support the hosting costs/i });
    expect(link).toHaveAttribute("href", "https://ko-fi.com/example");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    vi.unstubAllEnvs();
  });

  it("renders nothing when NEXT_PUBLIC_KOFI_URL is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_KOFI_URL", "");
    const { container } = render(<Footer />);
    expect(container).toBeEmptyDOMElement();
    vi.unstubAllEnvs();
  });
});
