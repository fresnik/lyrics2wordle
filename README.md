# Lyrics2Wordle

Find every valid Wordle word hiding in a song's lyrics.

Search a song (title + optional artist), pick the right record, and get a
shareable page of all valid Wordle words in the lyrics — both whole words
(solid tiles) and words hidden inside longer words (outlined tiles), e.g.
CLIPS inside "eclipse".

Lyrics come from [lrclib.net](https://lrclib.net). The word list is Wordle's
allowed-guess list (~13k words), bundled server-side.

## Develop

    yarn install
    yarn dev        # http://localhost:3000
    yarn test       # Vitest
    yarn build      # production build

## Deploy

Deployed on Vercel; every push to `main` deploys. Song URLs are
`/song/{lrclib-id}/{artist-track-slug}` — the ID is authoritative, the slug
is cosmetic and 308-redirects to canonical.

Design spec: `docs/superpowers/specs/2026-08-22-lyrics2wordle-design.md`.
