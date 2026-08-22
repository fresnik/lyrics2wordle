export function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "song"
  );
}

export function canonicalSlug(artist: string, track: string): string {
  return `${slugify(artist)}-${slugify(track)}`;
}
