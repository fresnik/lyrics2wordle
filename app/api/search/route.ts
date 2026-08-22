import { NextRequest, NextResponse } from "next/server";
import { searchSongs } from "@/lib/lrclib";

export async function GET(req: NextRequest) {
  const track = req.nextUrl.searchParams.get("track")?.trim();
  const artist = req.nextUrl.searchParams.get("artist")?.trim() || undefined;
  if (!track) {
    return NextResponse.json({ error: "track is required" }, { status: 400 });
  }
  if (track.length > 200) {
    return NextResponse.json({ error: "track too long" }, { status: 400 });
  }
  try {
    return NextResponse.json(await searchSongs(track, artist));
  } catch (err) {
    console.error("searchSongs failed", err);
    return NextResponse.json({ error: "Lyrics service unavailable" }, { status: 502 });
  }
}
