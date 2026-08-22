import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/search/route";
import { mockFetch, record } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/search", () => {
  it("returns 400 when track is missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/search"));
    expect(res.status).toBe(400);
  });

  it("returns normalized results", async () => {
    mockFetch(200, [record]);
    const res = await GET(new NextRequest("http://localhost/api/search?track=africa&artist=toto"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: 1, trackName: "Africa", artistName: "Toto", albumName: "Toto IV", duration: 295 },
    ]);
  });

  it("returns 502 when lrclib fails", async () => {
    mockFetch(500, {});
    const res = await GET(new NextRequest("http://localhost/api/search?track=africa"));
    expect(res.status).toBe(502);
  });

  it("returns 400 when track is too long", async () => {
    const track = "a".repeat(201);
    const res = await GET(new NextRequest(`http://localhost/api/search?track=${track}`));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "track too long" });
  });
});
