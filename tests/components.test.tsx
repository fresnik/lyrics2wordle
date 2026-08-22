import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LyricsPanel from "@/components/LyricsPanel";
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

  it("shows a ×N badge only for repeated words", () => {
    render(<WordTiles words={words} />);
    expect(screen.getByText("×3")).toBeInTheDocument();
    expect(screen.queryByText("×1")).not.toBeInTheDocument();
  });

  it("copies a word on click and shows a toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<WordTiles words={words} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy drums" }));
    expect(writeText).toHaveBeenCalledWith("drums");
    expect(screen.getByRole("status")).toHaveTextContent("Copied DRUMS");
  });

  it("shows a cheerful empty state when there are no words", () => {
    render(<WordTiles words={[]} />);
    expect(screen.getByText(/No Wordle words in this one/)).toBeInTheDocument();
  });
});

describe("LyricsPanel", () => {
  it("highlights spans with <mark> and leaves the rest as plain text", () => {
    render(
      <LyricsPanel
        lines={[
          { text: "I hear the drums", spans: [{ start: 11, end: 16 }] },
          { text: "", spans: [] },
        ]}
      />
    );
    const mark = screen.getByText("drums");
    expect(mark.tagName).toBe("MARK");
    expect(screen.getByText(/I hear the/)).toBeInTheDocument();
  });
});
