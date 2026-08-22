import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Search from "@/components/Search";

afterEach(() => vi.unstubAllGlobals());

function mockSearchApi(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const results = [
  { id: 1, trackName: "Africa", artistName: "Toto", albumName: "Toto IV", duration: 295 },
];

const twoResults = [
  { id: 1, trackName: "Africa", artistName: "Toto", albumName: "Toto IV", duration: 59.7 },
  { id: 2, trackName: "Rosanna", artistName: "Toto", albumName: null, duration: 295.941 },
];

describe("Search", () => {
  it("searches and renders result links with canonical hrefs and duration", async () => {
    const fn = mockSearchApi(200, results);
    render(<Search />);
    await userEvent.type(screen.getByLabelText("Song title"), "africa");
    await userEvent.type(screen.getByLabelText("Artist"), "toto");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    const link = await screen.findByRole("link");
    expect(link).toHaveAttribute("href", "/song/1/toto-africa");
    expect(link).toHaveTextContent("Africa");
    expect(link).toHaveTextContent("Toto IV");
    expect(link).toHaveTextContent("4:55");
    const calledUrl = fn.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/search?");
    expect(calledUrl).toContain("track=africa");
    expect(calledUrl).toContain("artist=toto");
  });

  it("renders multiple results in API order with rounded durations and omits a missing album", async () => {
    mockSearchApi(200, twoResults);
    render(<Search />);
    await userEvent.type(screen.getByLabelText("Song title"), "toto");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    const links = await screen.findAllByRole("link");
    expect(links).toHaveLength(2);

    expect(links[0]).toHaveAttribute("href", "/song/1/toto-africa");
    expect(links[0]).toHaveTextContent("Africa");
    expect(links[0]).toHaveTextContent("Toto IV");
    // 59.7 rounds to 60 total seconds -> 1:00, not 0:60
    expect(links[0]).toHaveTextContent("1:00");

    expect(links[1]).toHaveAttribute("href", "/song/2/toto-rosanna");
    expect(links[1]).toHaveTextContent("Rosanna");
    // 295.941 rounds to 296 total seconds -> 4:56, not 4:55
    expect(links[1]).toHaveTextContent("4:56");
    // albumName is null: no album line should be rendered for this result
    expect(links[1]).not.toHaveTextContent("Toto IV");
  });

  it("shows an empty state when there are no results", async () => {
    mockSearchApi(200, []);
    render(<Search />);
    await userEvent.type(screen.getByLabelText("Song title"), "zzz");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    // Match the full visible message, not the shorter "No results" live-region announcement.
    expect(await screen.findByText(/No results — check the spelling/)).toBeInTheDocument();
  });

  it("shows an error state with retry when the API fails", async () => {
    mockSearchApi(502, { error: "unavailable" });
    render(<Search />);
    await userEvent.type(screen.getByLabelText("Song title"), "africa");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Search failed/);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
