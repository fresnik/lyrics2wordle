import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Search from "@/components/Search";
import HomePage from "@/app/page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
});

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

  it("writes the query to the URL on submit", async () => {
    mockSearchApi(200, results);
    render(<Search />);
    await userEvent.type(screen.getByLabelText("Song title"), " africa ");
    await userEvent.type(screen.getByLabelText("Artist"), "toto");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith("/?track=africa&artist=toto", { scroll: false });
    expect(await screen.findByRole("link")).toBeInTheDocument();
  });

  it("omits an empty artist from the URL", async () => {
    mockSearchApi(200, results);
    render(<Search />);
    await userEvent.type(screen.getByLabelText("Song title"), "africa");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith("/?track=africa", { scroll: false });
  });

  it("prefills the fields from the URL and searches on load", async () => {
    const fn = mockSearchApi(200, results);
    render(<Search initialTrack="africa" initialArtist="toto" />);
    expect(screen.getByLabelText("Song title")).toHaveValue("africa");
    expect(screen.getByLabelText("Artist")).toHaveValue("toto");
    expect(await screen.findByRole("link")).toHaveAttribute("href", "/song/1/toto-africa");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBe("/api/search?track=africa&artist=toto");
    expect(push).not.toHaveBeenCalled();
  });

  it("searches again without pushing when the query matches the URL", async () => {
    const fn = mockSearchApi(200, results);
    render(<Search initialTrack="africa" />);
    await screen.findByRole("link");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
    expect(push).not.toHaveBeenCalled();
  });

  it("does not search again when the URL catches up with a submitted query", async () => {
    const fn = mockSearchApi(200, results);
    const { rerender } = render(<Search />);
    await userEvent.type(screen.getByLabelText("Song title"), "africa");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("link");
    rerender(<Search initialTrack="africa" />);
    await screen.findByRole("link");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("follows the URL on back/forward navigation", async () => {
    const fn = mockSearchApi(200, results);
    const { rerender } = render(<Search initialTrack="africa" initialArtist="toto" />);
    await screen.findByRole("link");

    rerender(<Search initialTrack="rosanna" />);
    expect(screen.getByLabelText("Song title")).toHaveValue("rosanna");
    expect(screen.getByLabelText("Artist")).toHaveValue("");
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
    expect(fn.mock.calls[1][0]).toBe("/api/search?track=rosanna");

    rerender(<Search />);
    expect(screen.getByLabelText("Song title")).toHaveValue("");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("turns off browser form restore, so restored text can't drift from state", () => {
    render(<Search />);
    expect(screen.getByLabelText("Song title")).toHaveAttribute("autocomplete", "off");
    expect(screen.getByLabelText("Artist")).toHaveAttribute("autocomplete", "off");
  });
});

describe("HomePage", () => {
  it("passes the URL query to the search form", async () => {
    mockSearchApi(200, results);
    render(
      await HomePage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ track: "africa", artist: ["toto", "ignored"] }),
      })
    );
    expect(screen.getByLabelText("Song title")).toHaveValue("africa");
    expect(screen.getByLabelText("Artist")).toHaveValue("toto");
    await screen.findByRole("link");
  });
});
