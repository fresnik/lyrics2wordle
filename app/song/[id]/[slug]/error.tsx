"use client";

export default function SongError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Couldn&apos;t load this song</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        The lyrics service may be temporarily unavailable.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 cursor-pointer rounded-md bg-[#6aaa64] px-4 py-2 font-semibold text-white dark:bg-[#538d4e]"
      >
        Try again
      </button>
    </main>
  );
}
