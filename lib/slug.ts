const MAX_SLUG_LENGTH = 80;

function capSlug(s: string): string {
  return s.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");
}

// Cosmetic-only slug for shareable URLs: the numeric lrclib ID is authoritative,
// and slug mismatches 301-redirect to the canonical slug elsewhere.
export function slugify(s: string): string {
  const base = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return capSlug(base) || "song";
}

export function canonicalSlug(artist: string, track: string): string {
  const combined = `${slugify(artist)}-${slugify(track)}`;
  return capSlug(combined) || "song";
}
