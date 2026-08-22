"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function SongError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  function retry() {
    // reset() alone only re-renders client-side; router.refresh() re-fetches
    // the RSC payload (and with it the failed lrclib request) from the server.
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Couldn&apos;t load this song</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        The lyrics service may be temporarily unavailable.
      </p>
      <button
        type="button"
        onClick={retry}
        disabled={isPending}
        className="mt-6 cursor-pointer rounded-md bg-[#6aaa64] px-4 py-2 font-semibold text-white disabled:cursor-default disabled:opacity-60 dark:bg-[#538d4e]"
      >
        {isPending ? "Retrying…" : "Try again"}
      </button>
    </main>
  );
}
