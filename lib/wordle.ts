import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

let cached: Set<string> | null = null;

/** Server-only: the Wordle allowed-guess set, loaded once per process. */
export function getWordSet(): Set<string> {
  if (!cached) {
    const file = path.join(process.cwd(), "data", "wordle-words.txt");
    cached = new Set(
      readFileSync(file, "utf8")
        .split("\n")
        .map((w) => w.trim())
        .filter(Boolean)
    );
  }
  return cached;
}
